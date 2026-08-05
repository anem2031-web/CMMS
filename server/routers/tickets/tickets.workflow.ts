import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, ticketProcedure, ticketManagerProcedure, supervisorProcedure,
  ticketTriageProcedure, warehouseProcedure, accountantProcedure, managementProcedure } from "../_shared/procedures";
import {
  APP_ROLE,
  MAINTENANCE_INSPECTION_RESULT_STATUS,
  MAINTENANCE_INSPECTION_WORKFLOW_STATUS,
  MAINTENANCE_RESPONSIBLE_DEPARTMENT,
} from "@shared/roles";
import * as db from "../../_core/db";
import {
  assertTicketWorkflowManageable,
  canRecordTicketInspection,
  canReviewTicketInspection,
  canSelectTicketMaintenancePath,
  shouldAutoApproveRecordedInspection,
} from "./tickets.access";

const responsibleDepartmentSchema = z.enum([
  MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL,
  MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
]);

const inspectionSeveritySchema = z.enum(["low", "medium", "high", "critical"]);
const inspectionSubmissionSchema = z.enum(["save_draft", "submit"]);

const inspectionActorRoles = new Set<string>([
  APP_ROLE.TECHNICIAN,
  APP_ROLE.SUPERVISOR,
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.ADMIN,
  APP_ROLE.OWNER,
]);

function legacyTicketPurchaseWorkflowDisabled(): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "تم إيقاف إجراءات المسار B القديمة. استخدم إعادة الإسناد المعتمدة وطلب الشراء المرتبط بالبلاغ لإكمال دورة التسعير والاعتمادات والشراء والاستلام.",
  });
}

async function resolveInspectionPerformerId(args: {
  actor: { id: number; role: string };
  ticket: any;
  requestedId?: number;
}): Promise<number> {
  if (args.actor.role === APP_ROLE.TECHNICIAN) {
    if (args.ticket.assignedToId !== args.actor.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "البلاغ غير مسند إليك للفحص" });
    }
    if (args.requestedId && args.requestedId !== args.actor.id) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن للفني تسجيل الفحص باسم مستخدم آخر" });
    }
    return args.actor.id;
  }

  const performerId = args.requestedId ?? args.actor.id;
  const performer = await db.getUserById(performerId);
  if (!performer || performer.isActive === 0 || !inspectionActorRoles.has(performer.role)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "منفذ الفحص المختار غير موجود أو غير نشط أو غير مخول" });
  }
  return performerId;
}

function assertSubmittedInspectionFields(input: {
  inspectionNotes?: string;
  severity?: string;
  findings?: string;
  recommendedAction?: string;
}) {
  if (!input.inspectionNotes?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "الملاحظات الفنية مطلوبة عند إرسال نتيجة الفحص" });
  }
  if (!input.severity) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "مستوى الخطورة مطلوب عند إرسال نتيجة الفحص" });
  }
  if (!input.findings?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "نتائج الفحص مطلوبة عند الإرسال" });
  }
  if (!input.recommendedAction?.trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "الإجراء الموصى به مطلوب عند الإرسال" });
  }
}

function isInspectionLocked(status?: string | null): boolean {
  return [
    MAINTENANCE_INSPECTION_WORKFLOW_STATUS.SUBMITTED_FOR_REVIEW,
    MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED,
  ].includes(status as any);
}

async function resolveResponsibleManagerId(
  department: z.infer<typeof responsibleDepartmentSchema>,
  requestedManagerId: number | undefined,
  actor: { id: number; role: string },
): Promise<number> {
  const requiredRole = department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION
    ? APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER
    : APP_ROLE.GENERAL_MAINTENANCE_MANAGER;
  const candidateRoles = department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION
    ? [requiredRole]
    : [requiredRole, APP_ROLE.MAINTENANCE_MANAGER];
  const candidateLists = await Promise.all(candidateRoles.map((role) => db.getUsersByRole(role)));
  const candidates = candidateLists.flat().filter((u: any) => u.isActive !== 0);

  if (requestedManagerId) {
    const selected = candidates.find((u: any) => u.id === requestedManagerId);
    if (!selected) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "المسؤول المختار غير نشط أو لا يحمل الدور المطلوب" });
    }
    return selected.id;
  }

  if (
    department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL &&
    [APP_ROLE.GENERAL_MAINTENANCE_MANAGER, APP_ROLE.MAINTENANCE_MANAGER].includes(actor.role as any)
  ) {
    return actor.id;
  }
  if (candidates.length === 1) return candidates[0].id;
  if (candidates.length === 0) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "لا يوجد مسؤول نشط للجهة المختارة" });
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: "يوجد أكثر من مسؤول نشط؛ يجب تحديد المسؤول" });
}


async function assertActiveInternalTechnician(technicianId: number): Promise<void> {
  const technician = await db.getUserById(technicianId);
  if (!technician || technician.role !== APP_ROLE.TECHNICIAN || technician.isActive === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "الفني المختار غير موجود أو غير نشط أو لا يحمل دور فني",
    });
  }
}

async function routeTicketAfterTriage(args: {
  ticket: any;
  actor: { id: number; role: string };
  department: z.infer<typeof responsibleDepartmentSchema>;
  responsibleManagerId?: number;
  assignedToId?: number;
  ticketType?: "internal" | "external" | "procurement";
  priority?: string;
  triageNotes?: string;
}) {
  const managerId = await resolveResponsibleManagerId(args.department, args.responsibleManagerId, args.actor);
  const isConstruction = args.department === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION;
  if (!isConstruction && !args.assignedToId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "يجب تعيين فني مسؤول عند توجيه البلاغ إلى الصيانة العامة",
    });
  }
  if (!isConstruction && args.assignedToId) {
    await assertActiveInternalTechnician(args.assignedToId);
  }
  const routedAt = new Date();
  const updateData: any = {
    status: "under_inspection",
    supervisorId: args.actor.id,
    ticketType: args.ticketType,
    priority: args.priority,
    triageNotes: args.triageNotes,
    maintenanceResponsibleDepartment: args.department,
    maintenanceResponsibleManagerId: managerId,
    maintenanceRoutedById: args.actor.id,
    maintenanceRoutedAt: routedAt,
    maintenanceRoutingNote: args.triageNotes,
    inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.PENDING_SUBMISSION,
    inspectionPerformedById: null,
    inspectionRecordedById: null,
    inspectionSubmittedAt: null,
    inspectionSubmittedById: null,
    inspectionApprovedAt: null,
    inspectionApprovedById: null,
    inspectionReturnedAt: null,
    inspectionReturnedById: null,
    inspectionReturnReason: null,
    inspectionNotes: null,
    // Construction manager assigns the technician after receiving the ticket.
    assignedToId: isConstruction ? null : (args.assignedToId ?? null),
    assignedTechnicianId: isConstruction ? null : undefined,
    assignedAt: !isConstruction && args.assignedToId ? routedAt : null,
  };
  Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

  await db.updateTicket(args.ticket.id, updateData);
  const departmentLabel = isConstruction ? "قسم الإنشاءات" : "الصيانة العامة";
  await db.addTicketStatusHistory({
    ticketId: args.ticket.id,
    fromStatus: args.ticket.status,
    toStatus: "under_inspection",
    changedById: args.actor.id,
    notes: `تم توجيه البلاغ إلى ${departmentLabel}${args.triageNotes ? ` — ${args.triageNotes}` : ""}`,
  });
  await db.createAuditLog({
    userId: args.actor.id,
    action: "route_maintenance_ticket",
    entityType: "ticket",
    entityId: args.ticket.id,
    oldValues: {
      maintenanceResponsibleDepartment: args.ticket.maintenanceResponsibleDepartment,
      maintenanceResponsibleManagerId: args.ticket.maintenanceResponsibleManagerId,
    },
    newValues: {
      maintenanceResponsibleDepartment: args.department,
      maintenanceResponsibleManagerId: managerId,
    },
  });

  await db.createNotification({
    userId: managerId,
    title: isConstruction ? "بلاغ إنشائي جديد" : "بلاغ صيانة عامة جديد",
    message: `تم توجيه البلاغ ${args.ticket.ticketNumber} إليك بعد الفرز`,
    type: "warning",
    relatedTicketId: args.ticket.id,
  });

  if (!isConstruction && args.assignedToId) {
    await db.createNotification({
      userId: args.assignedToId,
      title: "تم تعيينك لفحص بلاغ",
      message: `تم تعيينك للفحص الميداني للبلاغ ${args.ticket.ticketNumber}`,
      type: "warning",
      relatedTicketId: args.ticket.id,
    });
  }

  return { managerId };
}

export const ticketsWorkflowRouter = router({
  submitForTriage: ticketProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    await db.updateTicket(input.id, { status: "pending_triage" });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "pending_triage", changedById: ctx.user.id });
    // Notify supervisors
    const supervisors = await db.getUsersByRole("supervisor");
    for (const sup of supervisors) {
      await db.createNotification({ userId: sup.id, title: "بلاغ بانتظار الفرز", message: `البلاغ ${ticket.ticketNumber} بانتظار الفرز والتصنيف`, type: "info", relatedTicketId: input.id });
    }
    return { success: true };
  }),

  triage: ticketTriageProcedure.input(z.object({
    id: z.number(),
    ticketType: z.enum(["internal", "external", "procurement"]),
    priority: z.string().optional(),
    triageNotes: z.string().optional(),
    assignedToId: z.number().optional(),
    maintenanceResponsibleDepartment: responsibleDepartmentSchema,
    maintenanceResponsibleManagerId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    if (ticket.status !== "pending_triage") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفرز" });
    await routeTicketAfterTriage({
      ticket,
      actor: ctx.user,
      department: input.maintenanceResponsibleDepartment,
      responsibleManagerId: input.maintenanceResponsibleManagerId,
      assignedToId: input.assignedToId,
      ticketType: input.ticketType,
      priority: input.priority,
      triageNotes: input.triageNotes,
    });
    return { success: true };
  }),

  triageTicket: ticketTriageProcedure.input(z.object({
    id: z.number(),
    assignedToId: z.number().optional(),
    triageNotes: z.string().optional(),
    maintenanceResponsibleDepartment: responsibleDepartmentSchema,
    maintenanceResponsibleManagerId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    if (ticket.status !== "pending_triage") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفرز" });
    await routeTicketAfterTriage({
      ticket,
      actor: ctx.user,
      department: input.maintenanceResponsibleDepartment,
      responsibleManagerId: input.maintenanceResponsibleManagerId,
      assignedToId: input.assignedToId,
      triageNotes: input.triageNotes,
    });
    return { success: true };
  }),

  inspectTicket: protectedProcedure.input(z.object({
    id: z.number(),
    performedById: z.number().optional(),
    inspectionNotes: z.string().optional(),
    severity: inspectionSeveritySchema.optional(),
    rootCause: z.string().optional(),
    findings: z.string().optional(),
    recommendedAction: z.string().optional(),
    submissionMode: inspectionSubmissionSchema.default("submit"),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    if (!canRecordTicketInspection(ctx.user, ticket as any)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لتسجيل نتيجة فحص لهذا البلاغ" });
    }
    if (ticket.status !== "under_inspection") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفحص" });
    }
    if (isInspectionLocked(ticket.inspectionWorkflowStatus)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: ticket.inspectionWorkflowStatus === MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED
          ? "نتيجة الفحص معتمدة بالفعل"
          : "نتيجة الفحص مرسلة للمراجعة ولا يمكن تعديلها",
      });
    }

    const performedById = await resolveInspectionPerformerId({
      actor: ctx.user,
      ticket,
      requestedId: input.performedById,
    });
    const isSubmit = input.submissionMode === "submit";
    if (isSubmit) assertSubmittedInspectionFields(input);

    const latest = await db.getLatestInspectionResultByTicket(input.id);
    if (latest && [
      MAINTENANCE_INSPECTION_RESULT_STATUS.SUBMITTED,
      MAINTENANCE_INSPECTION_RESULT_STATUS.APPROVED,
    ].includes(latest.workflowStatus as any)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "توجد نتيجة فحص مقفلة لهذا البلاغ" });
    }
    if (
      latest?.workflowStatus === MAINTENANCE_INSPECTION_RESULT_STATUS.DRAFT &&
      latest.recordedById && latest.recordedById !== ctx.user.id
    ) {
      throw new TRPCError({ code: "CONFLICT", message: "توجد مسودة فحص محفوظة بواسطة مستخدم آخر" });
    }

    const now = new Date();
    const autoApproved = isSubmit && shouldAutoApproveRecordedInspection(ctx.user);
    const resultStatus = !isSubmit
      ? MAINTENANCE_INSPECTION_RESULT_STATUS.DRAFT
      : autoApproved
        ? MAINTENANCE_INSPECTION_RESULT_STATUS.APPROVED
        : MAINTENANCE_INSPECTION_RESULT_STATUS.SUBMITTED;
    const revisionNumber = latest?.workflowStatus === MAINTENANCE_INSPECTION_RESULT_STATUS.DRAFT
      ? latest.revisionNumber
      : Number(latest?.revisionNumber ?? 0) + 1;
    const resultData: any = {
      ticketId: input.id,
      assetId: ticket.assetId ?? undefined,
      inspectorId: performedById,
      performedById,
      recordedById: ctx.user.id,
      inspectionType: "detailed",
      severity: input.severity ?? "medium",
      rootCause: input.rootCause?.trim() || null,
      findings: input.findings?.trim() || null,
      recommendedAction: input.recommendedAction?.trim() || null,
      inspectionNotes: input.inspectionNotes?.trim() || null,
      workflowStatus: resultStatus,
      revisionNumber,
      submittedAt: isSubmit ? now : null,
      approvedAt: autoApproved ? now : null,
      approvedById: autoApproved ? ctx.user.id : null,
      returnedAt: null,
      returnedById: null,
      returnReason: null,
    };

    let resultId: number;
    if (latest?.workflowStatus === MAINTENANCE_INSPECTION_RESULT_STATUS.DRAFT) {
      await db.updateInspectionResult(latest.id, resultData);
      resultId = latest.id;
    } else {
      const created = await db.createInspectionResult(resultData);
      resultId = Number(created?.id ?? 0);
    }

    const ticketUpdate: any = {
      inspectionPerformedById: performedById,
      inspectionRecordedById: ctx.user.id,
      inspectionNotes: input.inspectionNotes?.trim() || ticket.inspectionNotes || null,
    };
    if (isSubmit) {
      ticketUpdate.inspectionWorkflowStatus = autoApproved
        ? MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED
        : MAINTENANCE_INSPECTION_WORKFLOW_STATUS.SUBMITTED_FOR_REVIEW;
      ticketUpdate.inspectionSubmittedAt = now;
      ticketUpdate.inspectionSubmittedById = ctx.user.id;
      ticketUpdate.inspectionReturnedAt = null;
      ticketUpdate.inspectionReturnedById = null;
      ticketUpdate.inspectionReturnReason = null;
      ticketUpdate.inspectionApprovedAt = autoApproved ? now : null;
      ticketUpdate.inspectionApprovedById = autoApproved ? ctx.user.id : null;
    }
    await db.updateTicket(input.id, ticketUpdate);

    await db.createAuditLog({
      userId: ctx.user.id,
      action: isSubmit
        ? (autoApproved ? "record_and_approve_ticket_inspection" : "submit_ticket_inspection")
        : "save_ticket_inspection_draft",
      entityType: "ticket",
      entityId: input.id,
      oldValues: { inspectionWorkflowStatus: ticket.inspectionWorkflowStatus },
      newValues: {
        resultId,
        revisionNumber,
        performedById,
        recordedById: ctx.user.id,
        inspectionWorkflowStatus: ticketUpdate.inspectionWorkflowStatus ?? ticket.inspectionWorkflowStatus,
      },
    });

    if (isSubmit) {
      await db.addTicketStatusHistory({
        ticketId: input.id,
        fromStatus: ticket.status,
        toStatus: "under_inspection",
        changedById: ctx.user.id,
        notes: autoApproved
          ? `تم تسجيل واعتماد نتيجة الفحص — المراجعة رقم ${revisionNumber}`
          : `تم إرسال نتيجة الفحص للمراجعة — المراجعة رقم ${revisionNumber}`,
      });
      if (!autoApproved) {
        const managers = await db.getTicketWorkflowManagerUsers(ticket);
        for (const mgr of managers) {
          if (mgr.id === ctx.user.id) continue;
          await db.createNotification({
            userId: mgr.id,
            title: "نتيجة فحص بانتظار المراجعة",
            message: `تم إرسال نتيجة فحص البلاغ ${ticket.ticketNumber} لاعتمادها`,
            type: "warning",
            relatedTicketId: input.id,
          });
        }
      } else if (ticket.assignedToId && ticket.assignedToId !== ctx.user.id) {
        await db.createNotification({
          userId: ticket.assignedToId,
          title: "تم اعتماد نتيجة الفحص",
          message: `سجّل مدير الجهة واعتمد نتيجة فحص البلاغ ${ticket.ticketNumber}`,
          type: "success",
          relatedTicketId: input.id,
        });
      }
    }

    return {
      success: true,
      resultId,
      workflowStatus: ticketUpdate.inspectionWorkflowStatus ?? ticket.inspectionWorkflowStatus,
      autoApproved,
    };
  }),

  reviewInspection: ticketManagerProcedure.input(z.object({
    id: z.number(),
    action: z.enum(["approve", "return_for_correction"]),
    reason: z.string().trim().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    if (!canReviewTicketInspection(ctx.user, ticket as any)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية مراجعة نتيجة الفحص لهذا البلاغ" });
    }
    if (input.action === "return_for_correction" && !input.reason) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "سبب إعادة نتيجة الفحص للتصحيح مطلوب" });
    }
    const latest = await db.getLatestInspectionResultByTicket(input.id);
    if (!latest || latest.workflowStatus !== MAINTENANCE_INSPECTION_RESULT_STATUS.SUBMITTED) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا توجد نتيجة فحص مرسلة قابلة للمراجعة" });
    }

    const now = new Date();
    if (input.action === "approve") {
      await db.updateInspectionResult(latest.id, {
        workflowStatus: MAINTENANCE_INSPECTION_RESULT_STATUS.APPROVED as any,
        approvedAt: now as any,
        approvedById: ctx.user.id,
        returnedAt: null,
        returnedById: null,
        returnReason: null,
      } as any);
      await db.updateTicket(input.id, {
        inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED,
        inspectionApprovedAt: now,
        inspectionApprovedById: ctx.user.id,
        inspectionReturnedAt: null,
        inspectionReturnedById: null,
        inspectionReturnReason: null,
      });
      await db.addTicketStatusHistory({
        ticketId: input.id,
        fromStatus: ticket.status,
        toStatus: "under_inspection",
        changedById: ctx.user.id,
        notes: `تم اعتماد نتيجة الفحص — المراجعة رقم ${latest.revisionNumber}`,
      });
    } else {
      await db.updateInspectionResult(latest.id, {
        workflowStatus: MAINTENANCE_INSPECTION_RESULT_STATUS.RETURNED as any,
        returnedAt: now as any,
        returnedById: ctx.user.id,
        returnReason: input.reason,
      } as any);
      await db.updateTicket(input.id, {
        inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.RETURNED_FOR_CORRECTION,
        inspectionReturnedAt: now,
        inspectionReturnedById: ctx.user.id,
        inspectionReturnReason: input.reason,
        inspectionApprovedAt: null,
        inspectionApprovedById: null,
      });
      await db.addTicketStatusHistory({
        ticketId: input.id,
        fromStatus: ticket.status,
        toStatus: "under_inspection",
        changedById: ctx.user.id,
        notes: `أعيدت نتيجة الفحص للتصحيح — السبب: ${input.reason}`,
      });
    }

    await db.createAuditLog({
      userId: ctx.user.id,
      action: input.action === "approve" ? "approve_ticket_inspection" : "return_ticket_inspection",
      entityType: "ticket",
      entityId: input.id,
      oldValues: { inspectionWorkflowStatus: ticket.inspectionWorkflowStatus },
      newValues: {
        inspectionWorkflowStatus: input.action === "approve"
          ? MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED
          : MAINTENANCE_INSPECTION_WORKFLOW_STATUS.RETURNED_FOR_CORRECTION,
        reason: input.reason,
      },
    });

    const notificationTargets = new Set<number>();
    if (ticket.assignedToId) notificationTargets.add(ticket.assignedToId);
    if (latest.recordedById) notificationTargets.add(latest.recordedById);
    notificationTargets.delete(ctx.user.id);
    for (const userId of notificationTargets) {
      await db.createNotification({
        userId,
        title: input.action === "approve" ? "تم اعتماد نتيجة الفحص" : "نتيجة الفحص تحتاج تصحيحًا",
        message: input.action === "approve"
          ? `تم اعتماد نتيجة فحص البلاغ ${ticket.ticketNumber}`
          : `أعيدت نتيجة فحص البلاغ ${ticket.ticketNumber}: ${input.reason}`,
        type: input.action === "approve" ? "success" : "warning",
        relatedTicketId: input.id,
      });
    }
    return { success: true };
  }),

  approveWork: ticketManagerProcedure.input(z.object({
    id: z.number(),
    maintenancePath: z.enum(["A", "B", "C"]),
    inspectionNotes: z.string().optional(),
    justification: z.string().optional(), // Required for Path C
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertTicketWorkflowManageable(ctx.user, ticket as any);
    if (ticket.status !== "under_inspection") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفحص" });
    if (!canSelectTicketMaintenancePath(ctx.user, ticket as any)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تحديد مسار التنفيذ قبل اعتماد نتيجة الفحص" });
    }
    if (input.maintenancePath === "C" && !input.justification) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "المسار C يتطلب مبرراً للصيانة الخارجية" });
    }
    const updateData: any = {
      status: "work_approved",
      maintenancePath: input.maintenancePath,
      approvedById: ctx.user.id,
      inspectionNotes: input.inspectionNotes ?? ticket.inspectionNotes,
      justification: input.justification,
    };
    await db.updateTicket(input.id, updateData);
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "work_approved", changedById: ctx.user.id, notes: `المسار: ${input.maintenancePath}` });
    // Notify based on path
    if (input.maintenancePath === "C") {
      // المسار C يبدأ لدى المستودع لتجهيز الأصل واختيار المندوب وإصدار وثيقة الخروج.
      const warehouseUsers = await db.getUsersByRole(APP_ROLE.WAREHOUSE);
      for (const warehouseUser of warehouseUsers) {
        await db.createNotification({
          userId: warehouseUser.id,
          title: "🔧 أصل بانتظار التجهيز للصيانة الخارجية",
          message: `تم اعتماد المسار C للبلاغ ${ticket.ticketNumber}. يرجى تجهيز الأصل، تحديد المندوب، وإصدار وثيقة الخروج.`,
          type: "warning",
          relatedTicketId: input.id,
        });
      }
    } else if (input.maintenancePath === "A") {
      // Notify assigned technician
      if (ticket.assignedToId) {
        await db.createNotification({ userId: ticket.assignedToId, title: "اعتماد بدء العمل", message: `تم اعتماد البلاغ ${ticket.ticketNumber} للإصلاح المباشر`, type: "success", relatedTicketId: input.id });
      }
    } else if (input.maintenancePath === "B") {
      // Notify assigned technician for path B (purchase required)
      if (ticket.assignedToId) {
        await db.createNotification({ userId: ticket.assignedToId, title: "اعتماد بلاغ - مسار الشراء", message: `تم اعتماد البلاغ ${ticket.ticketNumber} - سيتم رفع طلب شراء المواد اللازمة`, type: "warning", relatedTicketId: input.id });
      }
    }
    return { success: true };
  }),

  assignTechnician: ticketManagerProcedure.input(z.object({
    id: z.number(),
    assignedToId: z.number(),
  })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  startWork: protectedProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  submitEstimate: ticketManagerProcedure.input(z.object({
    id: z.number(),
    estimatedCost: z.number(),
    estimateNotes: z.string().optional(),
  })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  submitToAccounting: accountantProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  submitToManagement: managementProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  approvePurchase: managementProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  executePurchase: ticketManagerProcedure.input(z.object({
    id: z.number(),
    isPartial: z.boolean().default(false),
  })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  completePurchase: ticketManagerProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  receiveInWarehouse: warehouseProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    return legacyTicketPurchaseWorkflowDisabled();
  }),

  markRepaired: ticketManagerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertTicketWorkflowManageable(ctx.user, ticket as any);
    if (ticket.maintenancePath) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء القديم غير متاح لمسارات الصيانة A/B/C" });
    }
    if (ticket.status !== "ready_for_closure") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون جاهزاً للإغلاق" });
    await db.updateTicket(input.id, { status: "repaired" });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "ready_for_closure", toStatus: "repaired", changedById: ctx.user.id });
    return { success: true };
  }),

  markVerified: supervisorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    assertTicketWorkflowManageable(ctx.user, ticket as any);
    if (ticket.maintenancePath) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء القديم غير متاح لمسارات الصيانة A/B/C" });
    }
    if (ticket.status !== "repaired") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون مصلحاً" });
    await db.updateTicket(input.id, { status: "verified" });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "repaired", toStatus: "verified", changedById: ctx.user.id });
    return { success: true };
  }),
});
