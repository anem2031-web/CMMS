import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure, ticketProcedure } from "../_shared/procedures";
import { APP_ROLE, MAINTENANCE_MANAGER_FAMILY, MAINTENANCE_RESPONSIBLE_DEPARTMENT } from "@shared/roles";
import { detectLanguage, type SupportedLanguage } from "../../services/translation/translation";
import { queueTranslation, translationCache } from "../../services/translation/translationEngine";
import * as db from "../../_core/db";
import { assertTicketReadable, isRoleDeniedFromTickets } from "./tickets.access";

export const ticketsRouter = router({
  list: protectedProcedure.input(z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
    siteId: z.number().optional(),
    sectionId: z.number().optional(),
    assetId: z.number().optional(),
    search: z.string().optional(),
    category: z.string().optional(),
    assignedTechnicianId: z.number().optional(),
    assignedToId: z.number().optional(), // Phase 2: filter by user-based assignment
    maintenanceResponsibleDepartment: z.enum([
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL,
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
    ]).optional(),
  }).optional()).query(async ({ input, ctx }) => {
    const role = ctx.user.role;
    // ✅ إغلاق فجوة الواجهة/الخادم: أدوار محجوبة عن البلاغات بالواجهة كانت ترى الكل هنا
    if (isRoleDeniedFromTickets(role)) return [];
    let filters: any = { ...(input || {}) };
    if (role === APP_ROLE.OPERATOR) filters.reportedById = ctx.user.id;
    else if (role === APP_ROLE.TECHNICIAN) filters.assignedToId = ctx.user.id;
    else if (role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER) {
      filters.constructionManagerScopeUserId = ctx.user.id;
      delete filters.maintenanceResponsibleDepartment;
      delete filters.maintenanceResponsibleManagerId;
    }
    return db.getTickets(filters);
  }),

  // صفحات حقيقية لقائمة البلاغات (10 بلاغات/صفحة افتراضياً) — لا تؤثر على list الأصلي
  listPaginated: protectedProcedure.input(z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
    siteId: z.number().optional(),
    sectionId: z.number().optional(),
    assetId: z.number().optional(),
    search: z.string().optional(),
    category: z.string().optional(),
    assignedTechnicianId: z.number().optional(),
    assignedToId: z.number().optional(),
    maintenanceResponsibleDepartment: z.enum([
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL,
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
    ]).optional(),
    page: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(10),
    // خيارات "صندوق البلاغات" — اختيارية بالكامل ولا تغيّر سلوك الصفحة الحالية
    quickFilter: z.enum(["all", "critical", "unassigned", "stale", "ready_for_closure"]).optional(),
    sort: z.enum(["important", "newest", "oldest", "updated"]).optional(),
    // صفحة "كل البلاغات" فقط: تجمع البلاغات الفرعية داخل بطاقة البلاغ الرئيسي.
    groupSubTickets: z.boolean().optional(),
  }).optional()).query(async ({ input, ctx }) => {
    const role = ctx.user.role;
    const { page = 1, pageSize = 10, quickFilter, sort, groupSubTickets, ...rest } = input || {};
    // ✅ إغلاق فجوة الواجهة/الخادم (نفس قاعدة list)
    if (isRoleDeniedFromTickets(role)) return { items: [], total: 0, page, pageSize, totalPages: 0 } as any;
    let filters: any = { ...rest };
    // قيود الرؤية وحدها تُمرَّر أيضًا لاستعلام أبناء العائلة، حتى لا يؤدي التجميع
    // إلى كشف بلاغ فرعي من جهة/فني خارج نطاق المستخدم.
    const childVisibilityFilters: any = {};
    if (role === APP_ROLE.OPERATOR) {
      filters.reportedById = ctx.user.id;
      childVisibilityFilters.reportedById = ctx.user.id;
    } else if (role === APP_ROLE.TECHNICIAN) {
      filters.assignedToId = ctx.user.id;
      childVisibilityFilters.assignedToId = ctx.user.id;
    } else if (role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER) {
      filters.constructionManagerScopeUserId = ctx.user.id;
      delete filters.maintenanceResponsibleDepartment;
      delete filters.maintenanceResponsibleManagerId;
      childVisibilityFilters.constructionManagerScopeUserId = ctx.user.id;
    }
    return db.getTicketsPaginated(filters, page, pageSize, {
      quickFilter: quickFilter === "all" ? undefined : quickFilter,
      sort,
      groupSubTickets,
      childVisibilityFilters,
    });
  }),

  // عدادات الفلاتر السريعة لصندوق البلاغات — نفس الفلاتر ونفس نطاق الصلاحيات
  // المستخدم في list/listPaginated حرفيًا (operator ← بلاغاته، technician ← المسند له)
  inboxCounts: protectedProcedure.input(z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
    siteId: z.number().optional(),
    sectionId: z.number().optional(),
    search: z.string().optional(),
    assignedToId: z.number().optional(),
    maintenanceResponsibleDepartment: z.enum([
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL,
      MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
    ]).optional(),
  }).optional()).query(async ({ input, ctx }) => {
    const role = ctx.user.role;
    // ✅ إغلاق فجوة الواجهة/الخادم (نفس قاعدة list)
    if (isRoleDeniedFromTickets(role)) return { all: 0, critical: 0, unassigned: 0, stale: 0, ready_for_closure: 0 } as any;
    let filters: any = { ...(input || {}) };
    if (role === APP_ROLE.OPERATOR) filters.reportedById = ctx.user.id;
    else if (role === APP_ROLE.TECHNICIAN) filters.assignedToId = ctx.user.id;
    else if (role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER) {
      filters.constructionManagerScopeUserId = ctx.user.id;
      delete filters.maintenanceResponsibleDepartment;
      delete filters.maintenanceResponsibleManagerId;
    }
    return db.getTicketsInboxCounts(filters);
  }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    // القاعدة العامة تطابق القائمة. مدير الإنشاءات والمشتريات يملك استثناء
    // قراءة فقط عندما يكون البلاغ مرتبطًا بطلب شراء.
    await assertTicketReadable(ctx.user, ticket as any);
    const currentUserTaskAssignee = ctx.user.role === APP_ROLE.TECHNICIAN && ticket.sourceTaskId
      ? await db.isUserAssignedToTicketTasks(ticket.id, ticket.sourceTaskId, ctx.user.id)
      : false;
    return { ...ticket, currentUserTaskAssignee };
  }),

  /**
   * بنود البلاغ (المهام المتعددة داخله) — قراءة فقط.
   *
   * الخطوة 1 من ميزة "البلاغ متعدد الجهات والمسارات" (2026-08-08).
   * كل بلاغ له بند واحد على الأقل: البلاغات السابقة لهذه الميزة لها بند
   * واحد مُرحَّل تلقائيًا (isLegacySingleItem = 1).
   *
   * الصلاحية: نفس حارس قراءة البلاغ نفسه بالضبط (assertTicketReadable)،
   * فلا يفتح هذا الإجراء أي نطاق رؤية جديد لم يكن متاحًا أصلًا.
   */
  items: protectedProcedure.input(z.object({ ticketId: z.number() })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    await assertTicketReadable(ctx.user, ticket as any);
    return db.getTicketItems(input.ticketId);
  }),

  /**
   * بنود المستخدم الحالي فقط ضمن مجموعة بلاغات — الخطوة 2 من ميزة البلاغ متعدد
   * الجهات (2026-08-08). تُستخدم من شاشات القوائم (بلاغات الإنشاءات مثلًا)
   * لعرض "بطاقة مهمتي" داخل كل بلاغ بدل الحقول العامة للبلاغ. آمنة بذاتها —
   * راجع db.getMyTicketItemsForTickets.
   */
  myItemsForTickets: protectedProcedure.input(z.object({ ticketIds: z.array(z.number()) })).query(async ({ input, ctx }) => {
    if (input.ticketIds.length === 0) return [];
    return db.getMyTicketItemsForTickets(input.ticketIds, ctx.user.id);
  }),

  create: protectedProcedure.input(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    priority: z.string().default("medium"),
    category: z.string().default("general"),
    siteId: z.number().optional(),
    sectionId: z.number().optional(),
    assetId: z.number().optional(),
    locationDetail: z.string().optional(),
    beforePhotoUrl: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticketNumber = await db.getNextTicketNumber();

    // كشف اللغة فقط — الترجمة تحدث في الخلفية
    const detectedLang: SupportedLanguage = await detectLanguage(input.title).catch(() => "ar" as SupportedLanguage);

    // إنشاء التذكرة فوراً بدون انتظار الترجمة
    const id = await db.createTicket({
      ...input,
      originalLanguage: detectedLang,
      ticketNumber,
      reportedById: ctx.user.id,
      status: "pending_triage",
      // كل بلاغ جديد يبدأ على نموذج الجهات/المهام؛ البلاغات السابقة للترحيل تبقى legacy.
      workflowModel: "department_tasks",
    });
    // ترجمة في الخلفية — المستخدم لا ينتظر
    const fieldsToQueue = [
      { fieldName: "title", text: input.title },
      ...(input.description ? [{ fieldName: "description", text: input.description }] : []),
    ];
    queueTranslation({
      entityType: "TICKET",
      entityId: id!,
      fields: fieldsToQueue,
      sourceLanguage: detectedLang,
      userId: ctx.user.id,
    }).catch(e => console.error("[Ticket] Queue translation failed:", e));

    await db.addTicketStatusHistory({ ticketId: id!, fromStatus: undefined, toStatus: "pending_triage", changedById: ctx.user.id });

    // بند افتراضي للتوافق الرجعي مع ticket_items. في نموذج الجهات/المهام الجديد
    // لا يمثل هذا البند جهة أو مهمة؛ يبقى بند توافق واحد يعكس حالة الرأس.
    // فشل إنشاء البند لا يُسقط البلاغ نفسه — البلاغ يعمل من أعمدة tickets كالمعتاد.
    try {
      await db.createTicketItem({
        ticketId: id!,
        itemNumber: 1,
        title: input.title,
        description: input.description ?? null,
        descriptionAr: input.description ?? null,
        assetId: input.assetId ?? null,
        status: "pending_triage",
        isLegacySingleItem: 1,
        createdById: ctx.user.id,
      });
    } catch (e) {
      console.error("[Ticket] Failed to create default ticket item:", e);
    }

    await db.createAuditLog({ userId: ctx.user.id, action: "create_ticket", entityType: "ticket", entityId: id! });
    // ⚠️ 2026-08-10: هذا الموضع **يبقى بثًّا لكل المشرفين عمدًا** — البلاغ لحظة
    // إنشائه لم يُفرَز بعد، و`supervisorId` يُملأ فقط عند الفرز
    // (`routeTicketAfterTriage`، يُسجَّل فيه مَن فرز البلاغ). فلا يوجد مشرف
    // مُعيَّن يمكن توجيه الإشعار إليه بهذه اللحظة — تضييقه هنا يعني ألا يصل
    // إشعار "بلاغ بانتظار الفرز" لأحد إطلاقًا، فيبقى البلاغ عالقًا للأبد.
    const supervisors = await db.getUsersByRole("supervisor");
    for (const sup of supervisors) {
      await db.createNotification({ userId: sup.id, title: "بلاغ جديد بانتظار الفرز", message: `البلاغ ${ticketNumber} - ${input.title} بانتظار الفرز والتصنيف`, type: "info", relatedTicketId: id! });
    }
    // Also notify maintenance managers
    const managers = await db.getTicketManagerUsers();
    for (const mgr of managers) {
      await db.createNotification({ userId: mgr.id, title: "بلاغ جديد", message: `تم إنشاء بلاغ جديد: ${ticketNumber} - ${input.title}`, type: "info", relatedTicketId: id! });
    }
    return { id, ticketNumber };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    title: z.string().optional(),
    description: z.string().optional(),
    priority: z.string().optional(),
    category: z.string().optional(),
    siteId: z.number().optional(),
    locationDetail: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    // حارس قراءة أولًا لمنع استدعاء update مباشرة على بلاغ خارج نطاق المستخدم.
    await assertTicketReadable(ctx.user, ticket as any);
    // الأدوار الثلاثة المحددة لا تعدّل بلاغًا أنشأه مستخدم آخر.
    // owner/admin فقط لهما تجاوز إداري؛ بقية الأدوار تحتفظ بالسلوك السابق (المنشئ فقط).
    const isCreatorRestrictedManager = (MAINTENANCE_MANAGER_FAMILY as readonly string[]).includes(ctx.user.role);
    const isAdminOverride = [APP_ROLE.OWNER, APP_ROLE.ADMIN].includes(ctx.user.role as any);
    const isReporter = ticket.reportedById === ctx.user.id;
    if (isCreatorRestrictedManager && !isReporter) {
      throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك تعديل هذا البلاغ لأنك لست منشئه" });
    }
    if (!isAdminOverride && !isReporter) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لتعديل هذا البلاغ" });
    }
    // ✅ البلاغ قابل للتعديل فقط طالما لم يُصنَّف بعد (لا يزال في مرحلة الفرز الأولي pending_triage).
    // بمجرد تصنيفه (انتقاله لأي حالة تالية) يُمنع التعديل نهائياً، بصرف النظر عن الدور.
    if (ticket.status !== "pending_triage") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تعديل البلاغ بعد تصنيفه" });
    }
    const { id, ...updateData } = input;
    const oldValues: any = {};
    const newValues: any = {};
    if (input.title && input.title !== ticket.title) { oldValues.title = ticket.title; newValues.title = input.title; }
    if (input.description && input.description !== ticket.description) { oldValues.description = ticket.description; newValues.description = input.description; }
    if (input.priority && input.priority !== ticket.priority) { oldValues.priority = ticket.priority; newValues.priority = input.priority; }
    if (input.category && input.category !== ticket.category) { oldValues.category = ticket.category; newValues.category = input.category; }
    if (input.siteId && input.siteId !== ticket.siteId) { oldValues.siteId = ticket.siteId; newValues.siteId = input.siteId; }
    // تحديث التذكرة فوراً
    await db.updateTicket(id, { ...updateData });

    // إعادة الترجمة في الخلفية إذا تغيرت حقول نصية
    const fieldsToRequeue = [
      ...(input.title && input.title !== ticket.title
        ? [{ fieldName: "title", text: input.title }] : []),
      ...(input.description && input.description !== ticket.description
        ? [{ fieldName: "description", text: input.description }] : []),
    ];
    if (fieldsToRequeue.length > 0) {
      const detectedLang = await detectLanguage(fieldsToRequeue[0].text).catch(() => ticket.originalLanguage as SupportedLanguage);
      queueTranslation({
        entityType: "TICKET",
        entityId: id,
        fields: fieldsToRequeue,
        sourceLanguage: detectedLang,
        userId: ctx.user.id,
      }).catch(e => console.error("[Ticket] Queue translation update failed:", e));
      translationCache.invalidate("TICKET", id);
    }

await db.createAuditLog({ userId: ctx.user.id, action: "update_ticket", entityType: "ticket", entityId: id, oldValues, newValues });
    // Notify managers about ticket edit
    if (Object.keys(newValues).length > 0) {
      const managers = await db.getTicketManagerUsers();
      const changedFields = Object.keys(newValues).join(", ");
      for (const mgr of managers) {
        if (mgr.id !== ctx.user.id) {
          await db.createNotification({ userId: mgr.id, title: `تعديل بلاغ #${ticket.ticketNumber}`, message: `قام ${ctx.user.name} بتعديل البلاغ "${ticket.title}" - الحقول: ${changedFields}`, type: "ticket_updated", relatedTicketId: id });
        }
      }
    }
    return { success: true };
  }),

  delete: ticketProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    // Only owner/admin can delete
    if (!["owner", "admin"].includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لحذف البلاغات" });
    }
    // لا نسمح بحذف الرأس التنظيمي مع بقاء بلاغات فرعية حيّة؛ وإلا ستتحول
    // الأبناء إلى بلاغات يتيمة ويفقد الفنيون الإضافيون رابط مهمة المصدر.
    if (ticket.workflowModel === "department_tasks") {
      const tasks = await db.getTicketTasks(ticket.id);
      if (tasks.some((task: any) => !!task.convertedTicketId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "لا يمكن حذف البلاغ الرئيسي قبل حذف البلاغات الفرعية المرتبطة به",
        });
      }
    }
    await db.deleteTicket(input.id);
    await db.createAuditLog({ userId: ctx.user.id, action: "delete_ticket", entityType: "ticket", entityId: input.id, oldValues: { ticketNumber: ticket.ticketNumber, title: ticket.title, status: ticket.status } });
    // Notify managers about ticket deletion
    const managers = await db.getTicketManagerUsers();
    for (const mgr of managers) {
      if (mgr.id !== ctx.user.id) {
        await db.createNotification({ userId: mgr.id, title: `حذف بلاغ #${ticket.ticketNumber}`, message: `قام ${ctx.user.name} بحذف البلاغ "${ticket.title}"`, type: "ticket_deleted", relatedTicketId: input.id });
      }
    }
    return { success: true };
  }),

  history: protectedProcedure.input(z.object({ ticketId: z.number() })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    await assertTicketReadable(ctx.user, ticket as any);
    return db.getTicketHistory(input.ticketId);
  }),

  createTicket: protectedProcedure.input(z.object({
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "critical"]),
    category: z.enum(["electrical", "plumbing", "hvac", "structural", "mechanical", "general", "safety", "cleaning"]),
    siteId: z.number().optional(),
    assetId: z.number().optional(),
    locationDetail: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const ticketNumber = `TK-${Date.now()}`;
    const ticket = await db.createTicket({
      ticketNumber,
      title: input.title,
      description: input.description,
      priority: input.priority as any,
      category: input.category as any,
      siteId: input.siteId,
      assetId: input.assetId,
      locationDetail: input.locationDetail,
      reportedById: ctx.user.id,
      status: "pending_triage",
      workflowModel: "department_tasks",
    });
    if (!ticket) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
    const ticketId = typeof ticket === 'number' ? ticket : (ticket as any).id;
    await db.createTicketItem({
      ticketId, itemNumber: 1, title: input.title, description: input.description ?? null,
      descriptionAr: input.description ?? null, assetId: input.assetId ?? null,
      status: "pending_triage", isLegacySingleItem: 1, createdById: ctx.user.id,
    });
    await db.addTicketStatusHistory({ ticketId, fromStatus: "new", toStatus: "pending_triage", changedById: ctx.user.id });
    return ticket;
  }),
});
