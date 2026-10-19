import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { router, protectedProcedure, ideaTriageProcedure, managementProcedure } from "../_shared/procedures";
import { detectLanguage, type SupportedLanguage } from "../../services/translation/translation";
import * as db from "../../_core/db";
import * as ideasDb from "../../services/improvement-ideas/improvementIdeas";
import { validateIdeaLocation, improvementExecutionSummary, executionReference } from "../../services/improvement-ideas/execution";
import { hasCompleteCostStudy, moneyCents } from "../../../shared/improvement-execution";
import { loadImprovementExecutionProgress } from "../../services/improvement-ideas/progress";
import { assertTicketReadable } from "../tickets/tickets.access";
import { assertCanViewPurchaseOrder, filterVisiblePurchaseOrders } from "../../_core/authz/guard";

// الأدوار صاحبة الرؤية الكاملة (الفرز + التصنيف + اتخاذ القرار النهائي مجتمعين برؤية كل المقترحات)
const FULL_VISIBILITY_ROLES = ["maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "senior_management", "executive_director", "owner", "admin"];

// الموظف العادي لا يرى إلا حالة مقترحه فقط — بدون أي بيانات داخلية عن المراجعة أو القرار
function sanitizeForEmployee(idea: any) {
  const { triagerName, deciderName, decisionNotes, cancelReason, completionNotes, groupCategory,
    linkedTicketNumber, linkedTicketStatus, linkedPONumber, linkedPOStatus,
    costStudyRequired, estimatedMaterialsCost, estimatedLaborCost, estimatedServicesCost,
    costStudyNotes, costStudyById, costStudyAuthorName, costStudiedAt, executionTrackingVersion, implementationOwner,
    implementationStartDate, implementationDueDate, implementationProgress, implementationNotes, executionProgress,
    actualCost, achievedValue, resultRating, resultNotes, evaluatedAt, evaluatedById, ...safe } = idea;
  return safe;
}

export const improvementIdeasRouter = router({
  // قائمة مرقّمة — تُستخدم لتبويب "الكل" (الأدوار صاحبة الصلاحية) وتبويب "أفكاري" (الموظف العادي)
  listPaginated: protectedProcedure.input(z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    groupCategory: z.string().optional(),
    siteId: z.number().optional(),
    sectionId: z.number().optional(),
    search: z.string().optional(),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(10),
  }).optional()).query(async ({ input, ctx }) => {
    const { page = 1, pageSize = 10, ...filters } = input || {};
    const hasFullVisibility = FULL_VISIBILITY_ROLES.includes(ctx.user.role);
    const finalFilters: any = hasFullVisibility ? filters : { ...filters, submittedById: ctx.user.id };
    const result = await ideasDb.getImprovementIdeasPaginated(finalFilters, page, pageSize);
    if (hasFullVisibility) return result;
    return { ...result, ideas: result.ideas.map(sanitizeForEmployee) };
  }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    const idea = await ideasDb.getImprovementIdeaById(input.id);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "الفكرة غير موجودة" });

    const hasFullVisibility = FULL_VISIBILITY_ROLES.includes(ctx.user.role);
    if (!hasFullVisibility) {
      if (idea.submittedById !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك الاطلاع على مقترحات الآخرين" });
      return sanitizeForEmployee(idea);
    }
    if (Number(idea.executionTrackingVersion) !== 1) return idea;
    const progress = await db.withTransaction(tx => loadImprovementExecutionProgress(tx, [idea]));
    return { ...idea, executionProgress: progress.get(Number(idea.id)) };
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1, "وصف الفكرة مطلوب"),
    category: z.string(),
    priority: z.string().default("medium"),
    expectedBenefit: z.string().trim().min(1, "الفائدة المتوقعة مطلوبة"),
    currentSituation: z.string().trim().min(1, "يرجى توضيح الوضع الحالي"),
    targetOutcome: z.string().trim().min(1, "يرجى تحديد النتيجة المستهدفة"),
    successMetric: z.string().trim().min(1, "يرجى تحديد مؤشر قياس النجاح"),
    baselineValue: z.number().finite().min(-999999999999.99).max(999999999999.99).optional(),
    targetValue: z.number().finite().min(-999999999999.99).max(999999999999.99).optional(),
    siteId: z.number().int().positive(),
    sectionId: z.number().int().positive(),
    assetId: z.number().int().positive().optional(),
  })).mutation(async ({ input, ctx }) => {
    await db.withTransaction(tx => validateIdeaLocation(tx, input));
    if ((input.baselineValue === undefined) !== (input.targetValue === undefined)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يجب إدخال قيمة البداية والقيمة المستهدفة معًا أو تركهما فارغتين" });
    }
    const requestNumber = await ideasDb.getNextImprovementIdeaNumber();
    const detectedLang: SupportedLanguage = await detectLanguage(input.title).catch(() => "ar" as SupportedLanguage);

    const id = await ideasDb.createImprovementIdea({
      ...input,
      requestNumber,
      originalLanguage: detectedLang,
      submittedById: ctx.user.id,
      status: "new",
      costStudyRequired: 1,
      executionTrackingVersion: 1,
    });

    await db.createAuditLog({ userId: ctx.user.id, action: "create_improvement_idea", entityType: "improvement_idea", entityId: id! });

    // إشعار الأدوار صاحبة صلاحية الفرز والتصنيف فقط (مدير الصيانة + owner/admin)
    const managers = await db.getOperationalManagerUsers();
    for (const u of managers) {
      await db.createNotification({ userId: u.id, title: "فكرة تحسين جديدة", message: `${requestNumber} - ${input.title} بانتظار الفرز والتصنيف`, type: "info" });
    }

    return { id, requestNumber };
  }),

  // عدّادات المجموعات للأفكار المصنّفة (لعرض المجلدات بانتظار قرار الإدارة)
  getGroupedClassifiedCounts: protectedProcedure.query(async ({ ctx }) => {
    if (!FULL_VISIBILITY_ROLES.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "غير مخوَّل" });
    return ideasDb.getGroupedClassifiedCounts(["senior_management", "executive_director"].includes(ctx.user.role));
  }),

  // الأفكار المصنّفة داخل مجموعة معيّنة، مرتبة حسب الأولوية
  getClassifiedByGroup: protectedProcedure.input(z.object({ groupCategory: z.string() })).query(async ({ input, ctx }) => {
    if (!FULL_VISIBILITY_ROLES.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "غير مخوَّل" });
    return ideasDb.getClassifiedIdeasByGroup(input.groupCategory, ["senior_management", "executive_director"].includes(ctx.user.role));
  }),

  // الأفكار المعتمدة بانتظار تحويلها لتذكرة/طلب شراء — يظهر فقط لأدوار الفرز (ليس الإدارة العليا)
  getApproved: ideaTriageProcedure.query(async () => {
    const ideas = await ideasDb.getApprovedIdeas();
    if (!ideas.some(idea => Number(idea.executionTrackingVersion) === 1)) return ideas;
    const progress = await db.withTransaction(tx => loadImprovementExecutionProgress(tx, ideas));
    return ideas.map(idea => ({ ...idea, executionProgress: progress.get(Number(idea.id)) }));
  }),

  // الفرز والتصنيف: تصحيح التصنيف + تحديد المجموعة/الملف + تحديد الأولوية — بإجراء واحد
  classify: ideaTriageProcedure.input(z.object({
    id: z.number(),
    category: z.string(),
    groupCategory: z.string(),
    priority: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const idea = await ideasDb.getImprovementIdeaById(input.id);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "الفكرة غير موجودة" });
    if (idea.status !== "new") throw new TRPCError({ code: "BAD_REQUEST", message: "هذه الفكرة تم فرزها وتصنيفها مسبقاً" });

    await ideasDb.classifyImprovementIdea(input.id, {
      classifiedById: ctx.user.id,
      category: input.category,
      groupCategory: input.groupCategory,
      priority: input.priority,
    });
    await db.createAuditLog({ userId: ctx.user.id, action: "classify_improvement_idea", entityType: "improvement_idea", entityId: input.id });

    // ملاحظة: لا تُرسل إشعارات لدور الإدارة العليا هنا — حسب السياسة المعتمدة،
    // هذا الدور يستقبل فقط إشعار "طلب شراء بانتظار اعتمادك" ولا شيء غيره.
    // (الحماية مفروضة أيضاً مركزياً داخل db.createNotification كطبقة أمان إضافية)
  }),

  // دراسة تكلفة مصنّفة: فقط مسؤولو الفرز، والتخويل مفروض على الخادم.
  saveCostStudy: ideaTriageProcedure.input(z.object({
    id: z.number(),
    estimatedMaterialsCost: z.number().finite().min(0).max(999999999999.99),
    estimatedLaborCost: z.number().finite().min(0).max(999999999999.99),
    estimatedServicesCost: z.number().finite().min(0).max(999999999999.99),
    costStudyNotes: z.string().trim().min(1, "يرجى توضيح الجدوى ومبررات التكلفة"),
  })).mutation(async ({ input, ctx }) => {
    if ([input.estimatedMaterialsCost, input.estimatedLaborCost, input.estimatedServicesCost].some(value => moneyCents(value) === null)) throw new TRPCError({ code: "BAD_REQUEST", message: "التكلفة يجب أن تكون بمنازل عشرية لا تتجاوز منزلتين" });
    const idea = await ideasDb.getImprovementIdeaById(input.id);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "الفكرة غير موجودة" });
    if (idea.status !== "classified") throw new TRPCError({ code: "BAD_REQUEST", message: "دراسة التكلفة متاحة للأفكار المصنفة فقط" });
    await ideasDb.saveImprovementCostStudy(input.id, { ...input, costStudyById: ctx.user.id });
    await db.createAuditLog({ userId: ctx.user.id, action: "save_improvement_cost_study", entityType: "improvement_idea", entityId: input.id });
  }),

  savePlan: ideaTriageProcedure.input(z.object({
    id: z.number(),
    implementationOwner: z.string().trim().min(1).max(200),
    implementationStartDate: z.iso.date().optional(),
    implementationDueDate: z.iso.date(),
    implementationProgress: z.number().int().min(0).max(100),
    implementationNotes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const idea = await ideasDb.getImprovementIdeaById(input.id);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "الفكرة غير موجودة" });
    if (!["approved", "in_progress"].includes(idea.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إعداد الخطة في هذه المرحلة" });
    if (input.implementationStartDate && input.implementationStartDate > input.implementationDueDate) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "تاريخ البداية يجب أن يسبق الموعد المستهدف" });
    }
    await ideasDb.saveImprovementPlan(input.id, input);
    await db.createAuditLog({ userId: ctx.user.id, action: "save_improvement_plan", entityType: "improvement_idea", entityId: input.id });
  }),

  // قرار الإدارة العليا: موافقة / تأجيل (+تاريخ) / إلغاء (+سبب)
  decide: managementProcedure.input(z.object({
    id: z.number(),
    decision: z.enum(["approved", "postponed", "cancelled"]),
    decisionNotes: z.string().optional(),
    postponedUntil: z.string().optional(), // ISO date string
    cancelReason: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const idea = await ideasDb.getImprovementIdeaById(input.id);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "الفكرة غير موجودة" });
    if (idea.status !== "classified") throw new TRPCError({ code: "BAD_REQUEST", message: "هذه الفكرة ليست بانتظار قرار حالياً" });

    // الأفكار الجديدة لا تُعتمد قبل تسجيل دراسة التكلفة. القديمة مستثناة حفاظًا على دورة عملها.
    if (input.decision === "approved" && idea.costStudyRequired && !(idea.executionTrackingVersion === 1 ? hasCompleteCostStudy(idea) : idea.costStudiedAt)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يجب إعداد دراسة التكلفة التقديرية قبل الموافقة" });
    }

    if (input.decision === "postponed" && !input.postponedUntil) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يجب تحديد تاريخ التأجيل" });
    }

    await ideasDb.decideImprovementIdea(input.id, {
      decision: input.decision,
      decidedById: ctx.user.id,
      decisionNotes: input.decisionNotes,
      postponedUntil: input.postponedUntil ? new Date(input.postponedUntil) : undefined,
      cancelReason: input.cancelReason,
    });
    await db.createAuditLog({ userId: ctx.user.id, action: `decide_improvement_idea_${input.decision}`, entityType: "improvement_idea", entityId: input.id });

    const decisionTitle = input.decision === "approved" ? "تمت الموافقة على فكرتك" : input.decision === "postponed" ? "تم تأجيل فكرتك" : "تم إلغاء فكرتك";
    await db.createNotification({
      userId: idea.submittedById,
      title: decisionTitle,
      message: `${idea.requestNumber} - ${idea.title}`,
      type: input.decision === "approved" ? "success" : "info",
    });

    if (input.decision === "approved") {
      const managers = await db.getOperationalManagerUsers();
      for (const u of managers) {
        await db.createNotification({ userId: u.id, title: "فكرة معتمدة بانتظار التحويل", message: `${idea.requestNumber} - ${idea.title}`, type: "success" });
      }
    }
  }),

  // ربط الفكرة المعتمدة بتذكرة تم إنشاؤها فعلياً من نافذة البلاغات الأصلية
  linkToTicket: ideaTriageProcedure.input(z.object({ id: z.number(), ticketId: z.number() })).mutation(async ({ input, ctx }) => {
    const idea = await ideasDb.getImprovementIdeaById(input.id);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "الفكرة غير موجودة" });
    if (idea.executionTrackingVersion === 1) throw new TRPCError({ code: "BAD_REQUEST", message: "أنشئ مستند الفكرة الجديدة من زر التحويل؛ الربط يحفظ مع الإنشاء" });
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "التذكرة غير موجودة" });
    await assertTicketReadable(ctx.user, ticket);
    if (idea.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "هذه الفكرة ليست معتمدة حالياً" });

    if (idea.costStudyRequired && (!idea.implementationOwner?.trim() || !idea.implementationDueDate)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يجب تسجيل المسؤول والموعد المستهدف في خطة التنفيذ أولاً" });
    }

    await ideasDb.linkIdeaToTicket(input.id, input.ticketId);
    await db.createAuditLog({ userId: ctx.user.id, action: "link_improvement_idea_ticket", entityType: "improvement_idea", entityId: input.id });
  }),

  // ربط الفكرة المعتمدة بطلب شراء تم إنشاؤه فعلياً من نافذة المشتريات الأصلية
  linkToPurchaseOrder: ideaTriageProcedure.input(z.object({ id: z.number(), purchaseOrderId: z.number() })).mutation(async ({ input, ctx }) => {
    const idea = await ideasDb.getImprovementIdeaById(input.id);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "الفكرة غير موجودة" });
    if (idea.executionTrackingVersion === 1) throw new TRPCError({ code: "BAD_REQUEST", message: "أنشئ مستند الفكرة الجديدة من زر التحويل؛ الربط يحفظ مع الإنشاء" });
    const order = await db.getPurchaseOrderById(input.purchaseOrderId);
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الشراء غير موجود" });
    await assertCanViewPurchaseOrder(ctx.user, order);
    if (idea.status !== "approved") throw new TRPCError({ code: "BAD_REQUEST", message: "هذه الفكرة ليست معتمدة حالياً" });

    if (idea.costStudyRequired && (!idea.implementationOwner?.trim() || !idea.implementationDueDate)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يجب تسجيل المسؤول والموعد المستهدف في خطة التنفيذ أولاً" });
    }

    await ideasDb.linkIdeaToPurchaseOrder(input.id, input.purchaseOrderId);
    await db.createAuditLog({ userId: ctx.user.id, action: "link_improvement_idea_po", entityType: "improvement_idea", entityId: input.id });
  }),

  // تقييم النتائج قبل الإغلاق للأفكار الجديدة. تظل الأفكار القديمة متوافقة مع الإغلاق السابق.
  complete: ideaTriageProcedure.input(z.object({
    id: z.number(),
    completionNotes: z.string().optional(),
    actualCost: z.number().finite().min(0).max(999999999999.99).optional(),
    achievedValue: z.number().finite().optional(),
    resultRating: z.enum(["achieved", "partial", "not_achieved"]).optional(),
    resultNotes: z.string().trim().optional(),
  })).mutation(async ({ input, ctx }) => {
    const idea = await ideasDb.getImprovementIdeaById(input.id);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "الفكرة غير موجودة" });
    if (idea.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "هذه الفكرة ليست قيد التنفيذ حالياً" });
    if (idea.costStudyRequired && ((idea.executionTrackingVersion !== 1 && input.actualCost === undefined) || !input.resultRating || !input.resultNotes)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يجب تسجيل التكلفة الفعلية وتقييم نتيجة التحسين وملاحظات التقييم" });
    }
    if (idea.costStudyRequired && idea.targetValue !== null && input.achievedValue === undefined) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "يرجى إدخال القيمة الفعلية لمؤشر النجاح" });
    }

    if (idea.executionTrackingVersion === 1) {
      await db.withTransaction(async tx => {
        const result = await tx.execute(sql`SELECT * FROM improvement_ideas WHERE id=${input.id} FOR UPDATE`);
        const fresh = (result[0] as any[])[0];
        if (!fresh || fresh.status !== "in_progress") throw new TRPCError({ code: "CONFLICT", message: "تغيرت حالة الفكرة؛ حدّث الصفحة" });
        const summary = await improvementExecutionSummary(tx, fresh);
        if (!summary.executionDone || !summary.complete) throw new TRPCError({ code: "BAD_REQUEST", message: "يلزم اكتمال التنفيذ وتسوية بيانات التكلفة قبل الإغلاق" });
        if (summary.total > 999999999999.99) throw new TRPCError({ code: "BAD_REQUEST", message: "إجمالي التكلفة يتجاوز الحد المسموح" });
        await ideasDb.completeImprovementIdea(input.id, { ...input, actualCost: summary.total, evaluatedById: ctx.user.id }, tx);
        await tx.execute(sql`INSERT INTO audit_logs (userId,action,entityType,entityId,newValues) VALUES (${ctx.user.id},'complete_improvement_idea','improvement_idea',${input.id},${JSON.stringify({ actualCost: summary.total, resultRating: input.resultRating, sources: summary.lines.map(line => line.key) })})`);
      });
    } else await ideasDb.completeImprovementIdea(input.id, { ...input, evaluatedById: ctx.user.id });
    if (idea.executionTrackingVersion !== 1) await db.createAuditLog({ userId: ctx.user.id, action: "complete_improvement_idea", entityType: "improvement_idea", entityId: input.id });

    await db.createNotification({
      userId: idea.submittedById,
      title: "اكتمل تنفيذ فكرتك وتوثيق نتائجها",
      message: `${idea.requestNumber} - ${idea.title}`,
      type: input.resultRating === "not_achieved" ? "info" : "success",
    });
  }),

  executionSummary: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input, ctx }) => {
    if (!FULL_VISIBILITY_ROLES.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
    const idea = await ideasDb.getImprovementIdeaById(input.id);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND" });
    const summary = await db.withTransaction(tx => improvementExecutionSummary(tx, idea));
    const visibleOrders = await filterVisiblePurchaseOrders(ctx.user, summary.orders);
    if (visibleOrders.length !== summary.orders.length) throw new TRPCError({ code: "FORBIDDEN", message: "بعض مستندات التنفيذ لم تصل إلى مرحلة الاطلاع المسموح بها لدورك" });
    return summary;
  }),
  executionReference: protectedProcedure.input(z.object({ kind: z.enum(["ticket", "purchase"]), id: z.number().int().positive() })).query(async ({ input, ctx }) => {
    if (input.kind === "ticket") {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      await assertTicketReadable(ctx.user, ticket);
    } else {
      const order = await db.getPurchaseOrderById(input.id);
      if (!order) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanViewPurchaseOrder(ctx.user, order);
    }
    return db.withTransaction(tx => executionReference(tx, input.kind, input.id));
  }),

  // حذف — فقط مقدّم الطلب وبحالة "جديدة" (قبل الفرز)، أو admin/owner بأي وقت
  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const idea = await ideasDb.getImprovementIdeaById(input.id);
    if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "الفكرة غير موجودة" });

    const canDelete = (idea.submittedById === ctx.user.id && idea.status === "new") || ["admin", "owner"].includes(ctx.user.role);
    if (!canDelete) throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك حذف هذه الفكرة" });

    if (idea.executionTrackingVersion === 1 && (idea.linkedTicketId || idea.linkedPurchaseOrderId)) throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن حذف فكرة لها مستند تنفيذ مرتبط" });
    await ideasDb.deleteImprovementIdea(input.id);
    await db.createAuditLog({ userId: ctx.user.id, action: "delete_improvement_idea", entityType: "improvement_idea", entityId: input.id });
  }),
});
