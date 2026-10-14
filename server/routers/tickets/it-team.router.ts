import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../_shared/procedures";
import { APP_ROLE, isItTeamRole, MAINTENANCE_RESPONSIBLE_DEPARTMENT as DEPT } from "@shared/roles";
import { canClaimItDepartment } from "@shared/itTeamWorkflow";
import { ticketDepartments, itPurchaseNeeds, auditLogs } from "../../../drizzle/schema";
import * as db from "../../_core/db";
import { assertTicketReadable, assertTicketWorkflowManageable } from "./tickets.access";
import { assertActiveItUser, getItManager, notifyItTeamArrival } from "./it-team.service";

const needItems = z.array(z.object({ itemName: z.string().trim().min(1).max(300), quantity: z.number().min(1), unit: z.string().trim().max(50).optional() })).min(1).max(20);
function fail(message: string): never { throw new TRPCError({ code: "BAD_REQUEST", message }); }
function assertTeam(user: { role: string; isActive?: number }) {
  if (!isItTeamRole(user.role) || user.isActive === 0) throw new TRPCError({ code: "FORBIDDEN", message: "هذا الإجراء لفريق تقنية المعلومات النشط" });
}
async function audit(tx: any, userId: number, ticketId: number, action: string, data: any) {
  await tx.insert(auditLogs).values({ userId, entityType: "ticket", entityId: ticketId, action, newValues: data });
}

export const itTeamRouter = router({
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
