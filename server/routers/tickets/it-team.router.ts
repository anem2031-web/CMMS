import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../_shared/procedures";
import { APP_ROLE, isItTeamRole, MAINTENANCE_RESPONSIBLE_DEPARTMENT as DEPT } from "@shared/roles";
import { canClaimItDepartment } from "@shared/itTeamWorkflow";
import {
  canRecordItExecutionOutcome,
  canStartItSubTicket,
  IT_EXECUTION_OUTCOMES,
  itExecutionOutcomeRequiresNote,
  itExecutionOutcomeTransition,
} from "@shared/it-execution-workflow";
import { ticketDepartments, itPurchaseNeeds, auditLogs, ticketStatusHistory } from "../../../drizzle/schema";
import * as db from "../../_core/db";
import { assertTicketReadable, assertTicketWorkflowManageable } from "./tickets.access";
import { assertActiveItUser, getItManager, notifyItTeamArrival } from "./it-team.service";
import { assertPathBMaterialsDeliveredToTechnician } from "../purchase/ticket-purchase-workflow";

const needItems = z.array(z.object({ itemName: z.string().trim().min(1).max(300), quantity: z.number().min(1), unit: z.string().trim().max(50).optional() })).min(1).max(20);
const itMaterialItems = z.array(z.object({
  catalogItemId: z.number().int().positive().optional(),
  itemName: z.string().trim().min(1).max(300),
  quantity: z.number().int().positive(),
  unit: z.string().trim().min(1).max(50),
}).strict()).min(1).max(20);
const executionOutcome = z.enum(IT_EXECUTION_OUTCOMES);
function fail(message: string): never { throw new TRPCError({ code: "BAD_REQUEST", message }); }
function assertTeam(user: { role: string; isActive?: number }) {
  if (!isItTeamRole(user.role) || user.isActive === 0) throw new TRPCError({ code: "FORBIDDEN", message: "هذا الإجراء لفريق تقنية المعلومات النشط" });
}
async function audit(tx: any, userId: number, ticketId: number, action: string, data: any) {
  await tx.insert(auditLogs).values({ userId, entityType: "ticket", entityId: ticketId, action, newValues: data });
}

export const itTeamRouter = router({
  startItExecution: protectedProcedure.input(z.object({ ticketId: z.number().int().positive() }).strict()).mutation(async ({ ctx, input }) => {
    assertTeam(ctx.user);
    await assertActiveItUser(ctx.user.id);
    await db.withTransaction(async tx => {
      await db.lockTicketForSubTicketSequence(input.ticketId, tx);
      const ticket = await db.getTicketById(input.ticketId, tx);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
      if (!canStartItSubTicket(ctx.user, ticket)) throw new TRPCError({ code: "FORBIDDEN", message: "بدء التنفيذ متاح فقط لمنفذ تقنية المعلومات المسند إليه البلاغ" });
      const changed = { status: "in_progress", inspectionWorkflowStatus: null } as const;
      await db.updateTicket(ticket.id, changed, tx);
      if (!await db.syncSingleTicketItem(ticket.id, { status: "in_progress" }, tx)) fail("بلاغ التنفيذ يجب أن يحتوي بندًا واحدًا");
      await tx.insert(ticketStatusHistory).values({ ticketId: ticket.id, fromStatus: ticket.status, toStatus: "in_progress", changedById: ctx.user.id, notes: "بدأ منفذ تقنية المعلومات العمل" });
      await audit(tx, ctx.user.id, ticket.id, "start_it_ticket_execution", { fromStatus: ticket.status, toStatus: "in_progress" });
    });
    return { success: true };
  }),

  recordItExecutionOutcome: protectedProcedure.input(z.object({
    ticketId: z.number().int().positive(),
    outcome: executionOutcome,
    note: z.string().trim().max(4000).default(""),
    materialsUsed: z.string().trim().max(4000).optional(),
    afterPhotoUrl: z.string().trim().max(2000).optional(),
  }).strict()).mutation(async ({ ctx, input }) => {
    assertTeam(ctx.user);
    await assertActiveItUser(ctx.user.id);
    if (itExecutionOutcomeRequiresNote(input.outcome) && !input.note) fail("اكتب تفاصيل النتيجة قبل الحفظ");

    // Preserve the existing stock/external workflow checks when execution resumes
    // after materials or an external repair. The new direct IT path cannot bypass them.
    const before = await db.getTicketById(input.ticketId);
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    if (!canRecordItExecutionOutcome(ctx.user, before)) throw new TRPCError({ code: "FORBIDDEN", message: "تسجيل النتيجة متاح فقط لمنفذ تقنية المعلومات أثناء التنفيذ" });
    if (["ok", "fixed"].includes(input.outcome) && before.maintenancePath === "B") {
      await assertPathBMaterialsDeliveredToTechnician(before.id);
    }
    if (["ok", "fixed"].includes(input.outcome) && before.maintenancePath === "C") {
      const job = await db.getExternalMaintenanceJobByTicketId(before.id);
      if (!job || job.status !== "reinstall_in_progress") fail("أكمل استلام الأصل وابدأ إعادة التركيب قبل إنهاء الصيانة الخارجية");
    }

    let result!: { status: string; maintenancePath: string | null; ticketNumber: string; reportedById: number | null };
    await db.withTransaction(async tx => {
      await db.lockTicketForSubTicketSequence(input.ticketId, tx);
      const ticket = await db.getTicketById(input.ticketId, tx);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
      if (!canRecordItExecutionOutcome(ctx.user, ticket)) throw new TRPCError({ code: "CONFLICT", message: "تغير إسناد البلاغ أو حالته؛ أعد تحميل الصفحة" });
      const transition = itExecutionOutcomeTransition(input.outcome, ticket.maintenancePath);
      const repairNotes = input.outcome === "ok" ? (input.note || "سليم ولا يحتاج إصلاح") : (input.note || ticket.repairNotes);
      const closedAt = transition.status === "closed" ? new Date() : undefined;
      const changes: Record<string, any> = {
        status: transition.status,
        maintenancePath: transition.maintenancePath,
        ...(repairNotes ? { repairNotes } : {}),
        ...(input.materialsUsed ? { materialsUsed: input.materialsUsed } : {}),
        ...(input.afterPhotoUrl ? { afterPhotoUrl: input.afterPhotoUrl } : {}),
        ...(input.outcome === "blocked" || input.outcome === "external" ? { justification: input.note } : {}),
        ...(closedAt ? { closedAt } : {}),
      };
      await db.updateTicket(ticket.id, changes, tx);
      if (!await db.syncSingleTicketItem(ticket.id, changes, tx)) fail("بلاغ التنفيذ يجب أن يحتوي بندًا واحدًا");
      if (transition.status === "closed" && ticket.maintenancePath === "C") {
        await db.updateExternalMaintenanceJobByTicketId(ticket.id, { status: "closed" }, tx);
      }
      const historyNote = input.outcome === "needs_material" ? "يحتاج مواد"
        : input.outcome === "external" ? `يحتاج صيانة خارجية: ${input.note}`
          : input.outcome === "blocked" ? `يوجد عائق: ${input.note}`
            : input.outcome === "ok" ? repairNotes : `تم الإصلاح: ${input.note}`;
      await tx.insert(ticketStatusHistory).values({ ticketId: ticket.id, fromStatus: ticket.status, toStatus: transition.status, changedById: ctx.user.id, notes: historyNote });
      await audit(tx, ctx.user.id, ticket.id, "record_it_ticket_execution_outcome", { outcome: input.outcome, fromStatus: ticket.status, toStatus: transition.status, maintenancePath: transition.maintenancePath });
      result = { status: transition.status, maintenancePath: transition.maintenancePath, ticketNumber: ticket.ticketNumber, reportedById: ticket.reportedById ?? null };
    });

    if (result.status === "closed" && result.reportedById) {
      await db.createNotification({ userId: result.reportedById, title: "🔒 تم إغلاق بلاغك", message: `أنهى فريق تقنية المعلومات البلاغ ${result.ticketNumber}. يرجى تأكيد إتمام العمل.`, type: "success", relatedTicketId: input.ticketId });
    }
    if (input.outcome === "external") {
      const warehouseUsers = await db.getUsersByRole(APP_ROLE.WAREHOUSE);
      for (const warehouseUser of warehouseUsers.filter((user: any) => user.isActive !== 0)) {
        await db.createNotification({ userId: warehouseUser.id, title: "🔧 أصل بانتظار التجهيز للصيانة الخارجية", message: `اختار فريق تقنية المعلومات الصيانة الخارجية للبلاغ ${result.ticketNumber}.`, type: "warning", relatedTicketId: input.ticketId });
      }
    }
    return { success: true, status: result.status, maintenancePath: result.maintenancePath };
  }),

  claimItTicket: protectedProcedure.input(z.object({ ticketId: z.number(), departmentId: z.number() })).mutation(async ({ ctx, input }) => {
    assertTeam(ctx.user);
    await assertActiveItUser(ctx.user.id);
    await db.withTransaction(async tx => {
      // Same lock ordering for claim, transfer and promotion: parent, department, tasks.
      await db.lockTicketForSubTicketSequence(input.ticketId, tx);
      await db.lockTicketDepartmentForTaskSequence(input.departmentId, tx);
      const parent = await db.getTicketById(input.ticketId, tx);
      const department = await db.getTicketDepartmentById(input.departmentId, tx);
      if (!parent || !department || department.ticketId !== input.ticketId) fail("الجهة لا تنتمي لهذا البلاغ");
      if (!canClaimItDepartment(ctx.user, parent, department)) throw new TRPCError({ code: "CONFLICT", message: "البلاغ مستلم بالفعل أو لم يعد متاحًا للاستلام" });
      const result = await tx.update(ticketDepartments).set({ claimedById: ctx.user.id, claimedAt: new Date().toISOString().slice(0,19).replace("T", " "), status: "active" })
        .where(and(eq(ticketDepartments.id, department.id), isNull(ticketDepartments.claimedById)));
      if (result[0].affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "استلم عضو آخر البلاغ" });
      if (parent.maintenanceResponsibleDepartment === DEPT.IT) {
        await db.updateTicket(parent.id, { assignedToId: ctx.user.id, assignedAt: new Date() }, tx);
        await db.syncSingleTicketItem(parent.id, { assignedToId: ctx.user.id, assignedAt: new Date() }, tx);
      }
      await audit(tx, ctx.user.id, parent.id, "claim_it_ticket", { departmentId: department.id, claimedById: ctx.user.id });
    });
    return { success: true };
  }),

  handoverItTicket: protectedProcedure.input(z.object({ ticketId: z.number(), departmentId: z.number(), userId: z.number().nullable(), reason: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
    assertTeam(ctx.user);
    if (input.userId) await assertActiveItUser(input.userId);
    await db.withTransaction(async tx => {
      await db.lockTicketForSubTicketSequence(input.ticketId, tx);
      await db.lockTicketDepartmentForTaskSequence(input.departmentId, tx);
      const parent = await db.getTicketById(input.ticketId, tx);
      const department = await db.getTicketDepartmentById(input.departmentId, tx);
      if (!parent || !department || department.ticketId !== parent.id || department.department !== DEPT.IT) fail("جهة غير صالحة");
      if (["closed", "requester_confirmed"].includes(parent.status)) fail("البلاغ مغلق");
      if (department.claimedById !== ctx.user.id && !(ctx.user.role === APP_ROLE.IT_MANAGER && department.responsibleManagerId === ctx.user.id)) throw new TRPCError({ code: "FORBIDDEN" });
      await db.updateTicketDepartment(department.id, { claimedById: input.userId, claimedAt: input.userId ? new Date() : null }, tx);
      if (parent.maintenanceResponsibleDepartment === DEPT.IT) {
        await db.updateTicket(parent.id, { assignedToId: input.userId, assignedAt: input.userId ? new Date() : null }, tx);
        await db.syncSingleTicketItem(parent.id, { assignedToId: input.userId, assignedAt: input.userId ? new Date() : null }, tx);
      }
      await audit(tx, ctx.user.id, parent.id, "handover_it_ticket", { from: department.claimedById, to: input.userId, reason: input.reason });
    });
    return { success: true };
  }),

  routeGeneralTicketToIt: protectedProcedure.input(z.object({ ticketId: z.number(), reason: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
    if (![APP_ROLE.GENERAL_MAINTENANCE_MANAGER, APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER, APP_ROLE.MAINTENANCE_MANAGER, APP_ROLE.OWNER, APP_ROLE.ADMIN].includes(ctx.user.role as any)) throw new TRPCError({ code: "FORBIDDEN" });
    const manager = await getItManager();
    let number = "";
    await db.withTransaction(async tx => {
      await db.lockTicketForSubTicketSequence(input.ticketId, tx);
      const ticket = await db.getTicketById(input.ticketId, tx);
      if (!ticket) fail("البلاغ غير موجود");
      assertTicketWorkflowManageable(ctx.user, ticket);
      if (ticket.maintenanceResponsibleDepartment && ![DEPT.GENERAL, DEPT.CONSTRUCTION].includes(ticket.maintenanceResponsibleDepartment as any)) {
        fail("هذا التحويل مخصص لبلاغات الصيانة العامة أو الإنشاءات");
      }
      if (!["pending_triage", "department_planning", "under_inspection"].includes(ticket.status) || ticket.maintenancePath || ticket.sourceTaskId) fail("التحويل متاح قبل بدء التنفيذ واختيار المسار فقط");
      if (ticket.inspectionNotes || ticket.inspectionSubmittedAt || ticket.inspectionApprovedAt) fail("توجد نتيجة فحص؛ لا يمكن نقل مسؤولية البلاغ بهذه المرحلة");
      const departments = await db.getTicketDepartments(ticket.id, tx);
      if (departments.length > 1) fail("البلاغ متعدد الجهات؛ يجب تحويل جهة مستقلة قبل تنفيذها");
      const tasks = await db.getTicketTasks(ticket.id, tx);
      if (tasks.some((t: any) => t.convertedTicketId || ["promoted", "completed"].includes(t.status))) fail("لا يمكن التحويل بعد إنشاء بلاغات فرعية");
      // Historical or manually linked PO data must not be orphaned by routing.
      const orders = await tx.execute(sql`SELECT id FROM purchase_orders WHERE ticketId = ${ticket.id} LIMIT 1`);
      if (orders[0]?.length) fail("يوجد طلب شراء مرتبط؛ لا يمكن التحويل");
      const items = await db.getTicketItems(ticket.id, tx);
      if (items.length > 1 || items.some((i: any) => i.maintenancePath)) fail("البلاغ يتضمن بنود تنفيذ مستقلة؛ لا يمكن تحويل الرأس بالكامل");
      if (departments[0]) {
        await db.lockTicketDepartmentForTaskSequence(departments[0].id, tx);
        await db.updateTicketDepartment(departments[0].id, { department: DEPT.IT, responsibleManagerId: manager.id, claimedById: null, claimedAt: null, routedById: ctx.user.id, routedAt: new Date(), routingNote: input.reason, status: "planning" }, tx);
      } else await db.createTicketDepartments([{ ticketId: ticket.id, department: DEPT.IT, responsibleManagerId: manager.id, routedById: ctx.user.id, routingNote: input.reason, status: "planning" }], tx);
      for (const task of tasks) {
        await db.replaceTicketTaskAssignees(task.id, [], ctx.user.id, tx);
        if (task.status !== "cancelled") await db.updateTicketTask(task.id, { status: "pending_assignment" }, tx);
      }
      const change = { status: "department_planning", workflowModel: "department_tasks", maintenanceResponsibleDepartment: DEPT.IT, maintenanceResponsibleManagerId: manager.id, maintenanceRoutedById: ctx.user.id, maintenanceRoutedAt: new Date(), maintenanceRoutingNote: input.reason, assignedToId: null, assignedTechnicianId: null, assignedAt: null, inspectionWorkflowStatus: null };
      await db.updateTicket(ticket.id, change, tx);
      const itemChange = { responsibleDepartment: DEPT.IT, responsibleManagerId: manager.id, status: "department_planning", assignedToId: null, assignedTechnicianId: null, assignedAt: null, routedById: ctx.user.id, routingNote: input.reason };
      if (items.length) await db.syncSingleTicketItem(ticket.id, itemChange, tx);
      else await db.createTicketItem({ ticketId: ticket.id, itemNumber: 1, title: ticket.title, isLegacySingleItem: 1, createdById: ctx.user.id, ...itemChange }, tx);
      await audit(tx, ctx.user.id, ticket.id, "route_maintenance_ticket_to_it", { reason: input.reason, previousDepartment: ticket.maintenanceResponsibleDepartment, managerId: manager.id });
      number = ticket.ticketNumber;
    });
    await db.addTicketStatusHistory({ ticketId: input.ticketId, toStatus: "department_planning", changedById: ctx.user.id, notes: `تحويل إلى فريق تقنية المعلومات: ${input.reason}` });
    await notifyItTeamArrival(input.ticketId, number);
    return { success: true };
  }),

  itMaterialAssignment: protectedProcedure.input(z.object({ ticketId: z.number().int().positive() }).strict()).query(async ({ ctx, input }) => {
    assertTeam(ctx.user);
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    await assertTicketReadable(ctx.user, ticket);
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
    const result = await database.execute(sql`SELECT a.id AS assignmentId,a.stage,a.revision,a.warehouseId FROM ticket_team_assignments a WHERE a.ticketId=${input.ticketId} LIMIT 1`);
    const row = (result as any)?.[0]?.[0];
    return row ? { assignmentId: Number(row.assignmentId), stage: String(row.stage), revision: Number(row.revision), warehouseId: Number(row.warehouseId) } : null;
  }),

  requestItMaterials: protectedProcedure.input(z.object({
    ticketId: z.number().int().positive(),
    items: itMaterialItems,
    reason: z.string().trim().max(2000).default(""),
  }).strict()).mutation(async ({ ctx, input }) => {
    assertTeam(ctx.user);
    await assertActiveItUser(ctx.user.id);
    const catalogIds = Array.from(new Set(input.items.flatMap(item => item.catalogItemId ? [item.catalogItemId] : [])));
    if (catalogIds.length !== input.items.filter(item => item.catalogItemId != null).length) fail("لا تكرر صنف الكتالوج في الطلب");
    const manualNames = input.items.filter(item => item.catalogItemId == null).map(item => item.itemName.trim().toLocaleLowerCase());
    if (new Set(manualNames).size !== manualNames.length) fail("لا تكرر المادة المكتوبة في الطلب");
    let assignmentId = 0;
    await db.withTransaction(async tx => {
      await db.lockTicketForSubTicketSequence(input.ticketId, tx);
      const ticket = await db.getTicketById(input.ticketId, tx);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
      if (!canRecordItExecutionOutcome(ctx.user, ticket)) throw new TRPCError({ code: "FORBIDDEN", message: "طلب المواد متاح فقط لمنفذ تقنية المعلومات أثناء التنفيذ" });
      if (ticket.maintenancePath) fail("تم اختيار مسار تنفيذ لهذا البلاغ مسبقًا");
      const ticketItems = await db.getTicketItems(ticket.id, tx);
      if (ticketItems.length !== 1) fail("بلاغ التنفيذ يجب أن يحتوي بندًا واحدًا");
      if (!ticket.siteId || !ticket.sectionId || !ticket.maintenanceResponsibleManagerId) fail("الموقع والقسم ومسؤول تقنية المعلومات مطلوبة قبل طلب المواد");
      const existingResult = await tx.execute(sql`SELECT id FROM ticket_team_assignments WHERE ticketItemId=${ticketItems[0].id} LIMIT 1 FOR UPDATE`);
      if ((existingResult as any)?.[0]?.length) fail("يوجد طلب مواد محفوظ لهذا البلاغ بالفعل");
      const teamResult = await tx.execute(sql`SELECT t.id,t.warehouseId FROM maintenance_team_members m INNER JOIN maintenance_teams t ON t.id=m.teamId AND t.isActive=1 INNER JOIN warehouses w ON w.id=t.warehouseId AND w.isActive=1 AND w.type='branch' INNER JOIN users u ON u.id=m.userId AND u.isActive=1 AND u.role IN ('it_manager','it_member') WHERE m.userId=${ctx.user.id} AND m.isActive=1 ORDER BY t.id FOR UPDATE`);
      const teams = (teamResult as any)?.[0] ?? [];
      if (teams.length === 0) fail("اربط منفذ تقنية المعلومات بفريق نشط له مستودع فرعي قبل طلب المواد");
      if (teams.length > 1) fail("منفذ تقنية المعلومات مرتبط بأكثر من فريق نشط؛ أبقِ له فريق مواد واحدًا فقط");
      const teamId = Number(teams[0].id), warehouseId = Number(teams[0].warehouseId);
      const catalogResult = catalogIds.length
        ? await tx.execute(sql`SELECT id,nameAr,unit,isActive FROM catalog_items WHERE id IN (${sql.join(catalogIds.map(id => sql`${id}`), sql`,`)}) FOR UPDATE`)
        : [[], []];
      const catalogRows = (catalogResult as any)?.[0] ?? [];
      if (catalogRows.length !== catalogIds.length) fail("أحد أصناف الكتالوج غير موجود");
      const normalized = input.items.map(item => {
        if (!item.catalogItemId) return item;
        const catalog = catalogRows.find((row: any) => Number(row.id) === item.catalogItemId);
        if (!catalog || Number(catalog.isActive) !== 1) fail("أحد أصناف الكتالوج غير نشط");
        if (String(catalog.unit).trim() !== item.unit.trim()) fail(`وحدة الصنف «${catalog.nameAr}» لا تطابق الكتالوج`);
        return { ...item, itemName: String(catalog.nameAr) };
      });
      const insertResult = await tx.execute(sql`INSERT INTO ticket_team_assignments (ticketId,ticketItemId,ticketNumber,titleSnapshot,teamId,warehouseId,responsibleManagerId,siteId,sectionId,assetId,stage,outcome,revision,materialRound,assignedById) VALUES (${ticket.id},${ticketItems[0].id},${ticket.ticketNumber},${String(ticket.title).slice(0,250)},${teamId},${warehouseId},${ticket.maintenanceResponsibleManagerId},${ticket.siteId},${ticket.sectionId},${ticket.assetId ?? null},'waiting_material','needs_material',1,1,${ctx.user.id})`);
      assignmentId = Number(
        (insertResult as any)?.insertId ??
          (insertResult as any)?.[0]?.insertId ??
          0
      );
      if (!assignmentId) throw new Error("تعذر إنشاء طلب مواد تقنية المعلومات");
      await tx.execute(sql`INSERT INTO ticket_team_actions (assignmentId,actorId,kind,note,revision,operationKey) VALUES (${assignmentId},${ctx.user.id},'execution_protocol','{"version":1}',0,${`it-material-protocol:${assignmentId}`}),(${assignmentId},${ctx.user.id},'needs_material',${input.reason || "احتياج مواد تقنية المعلومات"},1,${`it-material-request:${assignmentId}`})`);
      for (const item of normalized) {
        await tx.execute(sql`INSERT INTO ticket_team_material_needs (assignmentId,materialRound,catalogItemId,itemNameSnapshot,originalItemName,unitSnapshot,requestedQuantity,usedQuantity,requestedById,warehouseId) VALUES (${assignmentId},1,${item.catalogItemId ?? null},${item.itemName},${item.itemName},${item.unit},${item.quantity},NULL,${ctx.user.id},${warehouseId})`);
      }
      const changes = { status: "work_approved", maintenancePath: "B" } as const;
      await db.updateTicket(ticket.id, changes, tx);
      if (!await db.syncSingleTicketItem(ticket.id, changes, tx)) fail("تعذر مزامنة بند البلاغ");
      await tx.insert(ticketStatusHistory).values({ ticketId: ticket.id, fromStatus: ticket.status, toStatus: "work_approved", changedById: ctx.user.id, notes: "حُفظ احتياج مواد تقنية المعلومات وأُرسل للمستودع" });
      await audit(tx, ctx.user.id, ticket.id, "request_it_ticket_materials", { assignmentId, teamId, warehouseId, items: normalized, reason: input.reason });
      await tx.execute(sql`INSERT INTO notifications (userId,title,message,type,eventKey,relatedTicketId) SELECT id,'📦 طلب مواد لتذكرة IT',${`${ticket.ticketNumber}: احتياج مواد جديد بانتظار معالجة المستودع.`},'warning','ticket_material_request',${ticket.id} FROM users WHERE isActive=1 AND role='warehouse'`);
    });
    return { success: true, assignmentId };
  }),

  itPurchaseNeeds: protectedProcedure.input(z.object({ ticketId: z.number().optional() }).optional()).query(async ({ ctx, input }) => {
    assertTeam(ctx.user);
    if (input?.ticketId) {
      const ticket = await db.getTicketById(input.ticketId);
      if (!ticket) fail("البلاغ غير موجود");
      await assertTicketReadable(ctx.user, ticket);
    }
    const database = await db.getDb();
    if (!database) return [];
    const predicates = [
      ctx.user.role === APP_ROLE.IT_MANAGER ? eq(itPurchaseNeeds.managerId, ctx.user.id) : eq(itPurchaseNeeds.requestedById, ctx.user.id),
    ];
    if (input?.ticketId !== undefined) predicates.push(eq(itPurchaseNeeds.ticketId, input.ticketId));
    return database.select().from(itPurchaseNeeds).where(and(...predicates)).orderBy(desc(itPurchaseNeeds.id)).limit(200);
  }),

  submitItPurchaseNeed: protectedProcedure.input(z.object({ ticketId: z.number(), items: needItems, reason: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
    assertTeam(ctx.user);
    if (ctx.user.role !== APP_ROLE.IT_MEMBER) throw new TRPCError({ code: "FORBIDDEN", message: "مدير تقنية المعلومات ينشئ طلب الشراء الرسمي مباشرة" });
    await db.withTransaction(async tx => {
      await db.lockTicketForSubTicketSequence(input.ticketId, tx);
      const ticket = await db.getTicketById(input.ticketId, tx);
      if (!ticket || ticket.maintenanceResponsibleDepartment !== DEPT.IT || ticket.maintenancePath !== "B" || ticket.status !== "work_approved") fail("ارفع الاحتياج بعد اعتماد المسار B وقبل بدء الشراء");
      assertTicketWorkflowManageable(ctx.user, ticket);
      const existing = await tx.select().from(itPurchaseNeeds).where(and(eq(itPurchaseNeeds.ticketId, ticket.id), eq(itPurchaseNeeds.status, "pending"))).limit(1);
      if (existing.length) fail("يوجد احتياج بانتظار المدير لهذا البلاغ");
      const items = await db.getTicketItems(ticket.id, tx);
      if (items.length !== 1) fail("ارفع الاحتياج من البلاغ الفرعي الخاص بالمهمة");
      await tx.insert(itPurchaseNeeds).values({ ticketId: ticket.id, ticketItemId: items[0].id, requestedById: ctx.user.id, managerId: ticket.maintenanceResponsibleManagerId!, items: input.items, reason: input.reason });
      await audit(tx, ctx.user.id, ticket.id, "submit_it_purchase_need", { items: input.items, reason: input.reason });
    });
    return { success: true };
  }),

  returnItPurchaseNeed: protectedProcedure.input(z.object({ id: z.number(), reason: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== APP_ROLE.IT_MANAGER) throw new TRPCError({ code: "FORBIDDEN" });
    await db.withTransaction(async tx => {
      const rows = await tx.select().from(itPurchaseNeeds).where(eq(itPurchaseNeeds.id, input.id)).for("update");
      const need = rows[0];
      if (!need || need.managerId !== ctx.user.id || need.status !== "pending") fail("الاحتياج غير متاح للمراجعة");
      await tx.update(itPurchaseNeeds).set({ status: "returned", reviewNote: input.reason }).where(eq(itPurchaseNeeds.id, need.id));
      await audit(tx, ctx.user.id, need.ticketId, "return_it_purchase_need", { id: need.id, reason: input.reason });
    });
    return { success: true };
  }),
});
