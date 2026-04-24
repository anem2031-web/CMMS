import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";
import { invokeLLM } from "./_core/llm";
import { nanoid } from "nanoid";
import { translationRouter } from "./routers/translation";
import { translateFields, detectLanguage, type SupportedLanguage } from "./services/translation";
import bcrypt from "bcryptjs";
import { cacheManager, cacheKeys, invalidateCache } from "./_core/cache";
import { generateTwoFactorSecret, verifyTwoFactorToken, verifyBackupCode, hashBackupCodes, removeUsedBackupCode, getRemainingBackupCodesCount } from "./_core/twoFactor";
import { rateLimiters } from "./_core/rateLimiter";

// Role-based middleware
const roleMiddleware = (allowedRoles: string[]) => {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!allowedRoles.includes(ctx.user.role) && ctx.user.role !== "admin" && ctx.user.role !== "owner") {
      throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لهذا الإجراء" });
    }
    return next({ ctx });
  });
};

const managerProcedure = roleMiddleware(["maintenance_manager", "purchase_manager", "owner", "admin"]);
const supervisorProcedure = roleMiddleware(["supervisor", "maintenance_manager", "owner", "admin"]);
const gateSecurityProcedure = roleMiddleware(["gate_security", "owner", "admin"]);
const accountantProcedure = roleMiddleware(["accountant", "owner", "admin"]);
const managementProcedure = roleMiddleware(["senior_management", "owner", "admin"]);
const warehouseProcedure = roleMiddleware(["warehouse", "owner", "admin"]);
const delegateProcedure = roleMiddleware(["delegate", "owner", "admin"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
    login: publicProcedure.input(z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    })).mutation(async ({ input, ctx }) => {
      const user = await db.getUserByUsername(input.username);
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      if (!user.isActive) {
        throw new TRPCError({ code: "FORBIDDEN", message: "الحساب معطل" });
      }
      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
      }
      // Create session
      const { sdk } = await import("./_core/sdk");
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || user.username || "", expiresInMs: 1000 * 60 * 60 * 24 * 365 });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: 1000 * 60 * 60 * 24 * 365 });
      // Update last signed in
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      // Get 2FA enforcement status
      const twoFactorSecret = await db.getTwoFactorSecret(user.id);
      const { getTwoFactorEnforcementStatus } = await import("./_core/twoFactorEnforcement");
      const twoFactorEnforcementStatus = getTwoFactorEnforcementStatus(user, twoFactorSecret?.isEnabled || false);
      
      return {
        success: true,
        user: { id: user.id, name: user.name, role: user.role, username: user.username },
        twoFactorEnforcementStatus
      };
    }),
    changePassword: protectedProcedure.input(z.object({
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").regex(/(?=.*[A-Z])(?=.*\d)/, "يجب أن تحتوي على حرف كبير ورقم واحد على الأقل"),
    })).mutation(async ({ input, ctx }) => {
      // Admin can change any user's password without current password
      if (ctx.user.passwordHash && input.currentPassword) {
        const valid = await bcrypt.compare(input.currentPassword, ctx.user.passwordHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "كلمة المرور الحالية غير صحيحة" });
      }
      const hash = await bcrypt.hash(input.newPassword, 10);
      await db.updateUserPassword(ctx.user.id, hash);
      return { success: true };
    }),
  }),

  // ============================================================
  // USERS
  // ============================================================
  users: router({
    list: protectedProcedure.query(async () => {
      return cacheManager.getOrCompute(
        cacheKeys.users(),
        () => db.getAllUsers(),
        600 // 10 minutes
      );
    }),
    byRole: protectedProcedure.input(z.object({ role: z.string() })).query(async ({ input }) => {
      return cacheManager.getOrCompute(
        cacheKeys.usersByRole(input.role),
        () => db.getUsersByRole(input.role),
        600 // 10 minutes
      );
    }),
    updateRole: protectedProcedure.input(z.object({ userId: z.number(), role: z.string() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "فقط المالك يمكنه تغيير الأدوار" });
      }
      const oldUser = await db.getUserById(input.userId);
      await db.updateUserRole(input.userId, input.role);
      await db.createAuditLog({ userId: ctx.user.id, action: "update_role", entityType: "user", entityId: input.userId, oldValues: { role: oldUser?.role }, newValues: { role: input.role } });
      // Invalidate user cache
      invalidateCache.users();
      return { success: true };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      email: z.string().optional(),
      role: z.string().optional(),
      phone: z.string().optional(),
      department: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "فقط المالك يمكنه تعديل المستخدمين" });
      }
      const oldUser = await db.getUserById(input.id);
      if (!oldUser) throw new TRPCError({ code: "NOT_FOUND", message: "المستخدم غير موجود" });
      const { id, ...updateData } = input;
      await db.updateUser(id, updateData);
      await db.createAuditLog({ userId: ctx.user.id, action: "update_user", entityType: "user", entityId: id, oldValues: { name: oldUser.name, email: oldUser.email, role: oldUser.role }, newValues: updateData });
      return { success: true };
    }),

    create: protectedProcedure.input(z.object({
      username: z.string().min(2),
      password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").regex(/(?=.*[A-Z])(?=.*\d)/, "يجب أن تحتوي على حرف كبير ورقم واد على الأقل"),
      name: z.string().min(1),
      role: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
      department: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "فقط المالك يمكنه إنشاء مستخدمين" });
      }
      const existing = await db.getUserByUsername(input.username);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "اسم المستخدم موجود مسبقاً" });
      const hash = await bcrypt.hash(input.password, 10);
      const id = await db.createLocalUser({ ...input, passwordHash: hash });
      await db.createAuditLog({ userId: ctx.user.id, action: "create_user", entityType: "user", entityId: id!, newValues: { username: input.username, name: input.name, role: input.role } });
      return { success: true, id };
    }),

    resetPassword: protectedProcedure.input(z.object({
      userId: z.number(),
      newPassword: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل").regex(/(?=.*[A-Z])(?=.*\d)/, "يجب أن تحتوي على حرف كبير ورقم واحد على الأقل"),
    })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية" });
      }
      const hash = await bcrypt.hash(input.newPassword, 10);
      await db.updateUserPassword(input.userId, hash);
      await db.createAuditLog({ userId: ctx.user.id, action: "reset_password", entityType: "user", entityId: input.userId });
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "فقط المالك يمكنه حذف المستخدمين" });
      }
      const user = await db.getUserById(input.id);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "المستخدم غير موجود" });
      if (user.role === "owner") throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكن حذف المالك" });
      await db.deleteUser(input.id);
      await db.createAuditLog({ userId: ctx.user.id, action: "delete_user", entityType: "user", entityId: input.id, oldValues: { name: user.name, email: user.email, role: user.role } });
      return { success: true };
    }),
  }),

  // ============================================================
  // SITES
  // ============================================================
  sites: router({
    list: protectedProcedure.query(async () => {
      return cacheManager.getOrCompute(
        cacheKeys.sites(),
        () => db.getAllSites(),
        600 // 10 minutes
      );
    }),
    create: protectedProcedure.input(z.object({ name: z.string().min(1), address: z.string().optional(), description: z.string().optional() })).mutation(async ({ input, ctx }) => {
      const id = await db.createSite(input);
      await db.createAuditLog({ userId: ctx.user.id, action: "create_site", entityType: "site", entityId: id!, newValues: input });
      // Invalidate sites cache
      invalidateCache.sites();
      return { id };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      address: z.string().optional(),
      description: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const oldSite = await db.getSiteById(input.id);
      if (!oldSite) throw new TRPCError({ code: "NOT_FOUND", message: "الموقع غير موجود" });
      const { id, ...updateData } = input;
      await db.updateSite(id, updateData);
      await db.createAuditLog({ userId: ctx.user.id, action: "update_site", entityType: "site", entityId: id, oldValues: { name: oldSite.name, address: oldSite.address, description: oldSite.description }, newValues: updateData });
      // Invalidate sites cache
      invalidateCache.sites();
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const site = await db.getSiteById(input.id);
      if (!site) throw new TRPCError({ code: "NOT_FOUND", message: "الموقع غير موجود" });
      await db.deleteSite(input.id);
      await db.createAuditLog({ userId: ctx.user.id, action: "delete_site", entityType: "site", entityId: input.id, oldValues: { name: site.name, address: site.address } });
      // Invalidate sites cache
      invalidateCache.sites();
      return { success: true };
    }),
  }),

  // ============================================================
  // SECTIONS
  // ============================================================
  sections: router({
    list: protectedProcedure.input(z.object({ siteId: z.number().optional() }).optional()).query(async ({ input }) => {
      return db.getSections(input?.siteId);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      siteId: z.number(),
      description: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await db.createSection({ ...input, isActive: true });
      await db.createAuditLog({ userId: ctx.user.id, action: "create_section", entityType: "section", entityId: id!, newValues: input });
      return { id };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;
      await db.updateSection(id, updateData);
      await db.createAuditLog({ userId: ctx.user.id, action: "update_section", entityType: "section", entityId: id, newValues: updateData });
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.deleteSection(input.id);
      await db.createAuditLog({ userId: ctx.user.id, action: "delete_section", entityType: "section", entityId: input.id });
      return { success: true };
    }),
  }),
  // ============================================================
  // TECHNICIANS
  // ============================================================
  technicians: router({
    list: protectedProcedure.input(z.object({ activeOnly: z.boolean().optional() }).optional()).query(async ({ input }) => {
      return db.getAllTechnicians(input?.activeOnly ?? false);
    }),
    create: protectedProcedure.input(z.object({
      name: z.string().min(1),
      specialty: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await db.createTechnician(input);
      await db.createAuditLog({ userId: ctx.user.id, action: "create_technician", entityType: "technician", entityId: id!, newValues: input });
      return { id };
    }),
    update: protectedProcedure.input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      specialty: z.string().optional(),
      status: z.enum(["active", "inactive"]).optional(),
    })).mutation(async ({ input, ctx }) => {
      const { id, ...updateData } = input;
      await db.updateTechnician(id, updateData);
      await db.createAuditLog({ userId: ctx.user.id, action: "update_technician", entityType: "technician", entityId: id, newValues: updateData });
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.deleteTechnician(input.id);
      await db.createAuditLog({ userId: ctx.user.id, action: "delete_technician", entityType: "technician", entityId: input.id });
      return { success: true };
    }),
    getOpenTicketCounts: protectedProcedure.query(async () => {
      return db.getTechnicianOpenTicketCounts();
    }),
  }),
  // ============================================================
  // TICKETS
  // ============================================================
  tickets: router({
    list: protectedProcedure.input(z.object({
      status: z.string().optional(),
      priority: z.string().optional(),
      siteId: z.number().optional(),
      sectionId: z.number().optional(),
      assetId: z.number().optional(),
      search: z.string().optional(),
      category: z.string().optional(),
      assignedTechnicianId: z.number().optional(),
    }).optional()).query(async ({ input, ctx }) => {
      const role = ctx.user.role;
      let filters: any = input || {};
      if (role === "operator") filters.reportedById = ctx.user.id;
      else if (role === "technician") filters.assignedToId = ctx.user.id;
      return db.getTickets(filters);
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
      return ticket;
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
      // Auto-translate fields
      const fieldsToTranslate: Record<string, string> = {};
      if (input.title) fieldsToTranslate.title = input.title;
      if (input.description) fieldsToTranslate.description = input.description;
      let translationData: Record<string, any> = {};
      let detectedLang: SupportedLanguage = "ar";
      if (Object.keys(fieldsToTranslate).length > 0) {
        try {
          detectedLang = await detectLanguage(input.title);
          const translations = await translateFields(fieldsToTranslate, detectedLang);
          if (translations.title) {
            translationData.title_ar = translations.title.ar;
            translationData.title_en = translations.title.en;
            translationData.title_ur = translations.title.ur;
          }
          if (translations.description) {
            translationData.description_ar = translations.description.ar;
            translationData.description_en = translations.description.en;
            translationData.description_ur = translations.description.ur;
          }
        } catch (e) {
          console.error("[Ticket] Translation failed:", e);
        }
      }
      // New workflow: tickets start as pending_triage and go to supervisor
      const id = await db.createTicket({ ...input, ...translationData, originalLanguage: detectedLang, ticketNumber, reportedById: ctx.user.id, status: "pending_triage" });
      await db.addTicketStatusHistory({ ticketId: id!, fromStatus: undefined, toStatus: "pending_triage", changedById: ctx.user.id });
      await db.createAuditLog({ userId: ctx.user.id, action: "create_ticket", entityType: "ticket", entityId: id! });
      // Notify supervisors first (new workflow)
      const supervisors = await db.getUsersByRole("supervisor");
      for (const sup of supervisors) {
        await db.createNotification({ userId: sup.id, title: "بلاغ جديد بانتظار الفرز", message: `البلاغ ${ticketNumber} - ${input.title} بانتظار الفرز والتصنيف`, type: "info", relatedTicketId: id! });
      }
      // Also notify maintenance managers
      const managers = await db.getManagerUsers();
      for (const mgr of managers) {
        await db.createNotification({ userId: mgr.id, title: "بلاغ جديد", message: `تم إنشاء بلاغ جديد: ${ticketNumber} - ${input.title}`, type: "info", relatedTicketId: id! });
      }
      return { id, ticketNumber };
    }),

    approve: managerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateTicket(input.id, { status: "approved", approvedById: ctx.user.id });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "approved", changedById: ctx.user.id });
      // Notify supervisors that ticket is approved
      const supervisorsApprove = await db.getUsersByRole("supervisor");
      for (const sup of supervisorsApprove) {
        await db.createNotification({ userId: sup.id, title: "✅ تمت الموافقة على بلاغ", message: `تمت الموافقة على البلاغ ${ticket.ticketNumber} من قبل المدير`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    assign: managerProcedure.input(z.object({
      id: z.number(),
      technicianId: z.number().optional(),           // System user technician
      externalTechnicianId: z.number().optional(),   // External technician (no account)
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (!input.technicianId && !input.externalTechnicianId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "يجب تحديد فني للإسناد" });
      }
      const updateData: Record<string, any> = {
        status: "assigned",
        assignedAt: new Date(),
      };
      if (input.technicianId) updateData.assignedToId = input.technicianId;
      if (input.externalTechnicianId) updateData.assignedTechnicianId = input.externalTechnicianId;
      await db.updateTicket(input.id, updateData);
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "assigned", changedById: ctx.user.id });
      if (input.technicianId) {
        await db.createNotification({ userId: input.technicianId, title: "بلاغ مُسند إليك", message: `تم إسناد البلاغ ${ticket.ticketNumber} إليك`, type: "info", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    startRepair: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      // Accept from assigned, in_progress, or repaired (after materials delivered)
      const validStatuses = ["assigned", "in_progress", "repaired", "purchase_approved", "purchased", "partial_purchase"];
      if (!validStatuses.includes(ticket.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `لا يمكن بدء التنفيذ في الحالة الحالية: ${ticket.status}` });
      }
      await db.updateTicket(input.id, { status: "in_progress" });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "in_progress", changedById: ctx.user.id });
      // Notify managers that work has started
      const managers = await db.getManagerUsers();
      for (const mgr of managers) {
        await db.createNotification({ userId: mgr.id, title: "🔧 بدأ تنفيذ بلاغ", message: `بدأ الفني العمل على البلاغ ${ticket.ticketNumber}`, type: "info", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    completeRepair: protectedProcedure.input(z.object({
      id: z.number(),
      afterPhotoUrl: z.string().min(1, "صورة بعد الإصلاح مطلوبة"),
      repairNotes: z.string().optional(),
      materialsUsed: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "in_progress") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "يجب أن يكون البلاغ قيد التنفيذ أولاً" });
      }
      // Auto-translate repairNotes
      let repairTranslation: Record<string, any> = {};
      if (input.repairNotes) {
        try {
          const lang = await detectLanguage(input.repairNotes);
          const translations = await translateFields({ repairNotes: input.repairNotes }, lang);
          if (translations.repairNotes) {
            repairTranslation.repairNotes_ar = translations.repairNotes.ar;
            repairTranslation.repairNotes_en = translations.repairNotes.en;
            repairTranslation.repairNotes_ur = translations.repairNotes.ur;
          }
        } catch (e) {
          console.error("[Ticket] RepairNotes translation failed:", e);
        }
      }
      await db.updateTicket(input.id, { status: "repaired", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes, materialsUsed: input.materialsUsed, ...repairTranslation });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "repaired", changedById: ctx.user.id });
      const managers = await db.getManagerUsers();
      for (const mgr of managers) {
        await db.createNotification({ userId: mgr.id, title: "تم إصلاح بلاغ", message: `تم إصلاح البلاغ ${ticket.ticketNumber}`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    close: managerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateTicket(input.id, { status: "closed", closedAt: new Date() });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "closed", changedById: ctx.user.id });
      await db.createAuditLog({ userId: ctx.user.id, action: "close_ticket", entityType: "ticket", entityId: input.id });
      // Notify reporter and assigned technician
      if (ticket.reportedById) {
        await db.createNotification({ userId: ticket.reportedById, title: "🔒 تم إغلاق بلاغك", message: `تم إغلاق البلاغ ${ticket.ticketNumber} بنجاح`, type: "success", relatedTicketId: input.id });
      }
      if (ticket.assignedToId && ticket.assignedToId !== ticket.reportedById) {
        await db.createNotification({ userId: ticket.assignedToId, title: "🔒 تم إغلاق البلاغ", message: `تم إغلاق البلاغ ${ticket.ticketNumber} الذي كنت مسؤولاً عنه`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    // ❌ REMOVED: updateStatus (was allowing any status without validation)
    // ✅ REPLACED WITH: Specific procedures for each valid transition

    // Transition: new → pending_triage (Operator creates ticket)
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
      });
      if (!ticket) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.addTicketStatusHistory({ ticketId: typeof ticket === 'number' ? ticket : (ticket as any).id, fromStatus: "new", toStatus: "pending_triage", changedById: ctx.user.id });
      return ticket;
    }),

    // Transition: pending_triage → under_inspection (Manager assigns for inspection)
    assignForInspection: managerProcedure.input(z.object({
      id: z.number(),
      assignedToId: z.number(),
      triageNotes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "pending_triage") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون في مرحلة الفحص الأولي" });
      await db.updateTicket(input.id, { status: "under_inspection", assignedToId: input.assignedToId, triageNotes: input.triageNotes });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "pending_triage", toStatus: "under_inspection", changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: under_inspection → work_approved (Manager approves + chooses path)
    // Already exists as approveWork - no change needed

    // ========== PATH A TRANSITIONS ==========
    // Transition: work_approved → ready_for_closure (Technician completes)
    // Already exists as markReadyForClosure - no change needed

    // Transition: ready_for_closure → closed (Supervisor closes)
    // Already exists as closeBySupervisor - no change needed

    // ========== PATH B TRANSITIONS ==========
    // Transition: work_approved → assigned (Manager assigns technician)
    assignTechnician: managerProcedure.input(z.object({
      id: z.number(),
      assignedToId: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "work_approved") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون معتمداً" });
      if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
      await db.updateTicket(input.id, { status: "assigned", assignedToId: input.assignedToId });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "work_approved", toStatus: "assigned", changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: assigned → in_progress (Technician starts work)
    startWork: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "assigned") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون مسنداً" });
      if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
      await db.updateTicket(input.id, { status: "in_progress" });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "assigned", toStatus: "in_progress", changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: in_progress → needs_purchase (Technician identifies need)
    requestPurchase: protectedProcedure.input(z.object({
      id: z.number(),
      materialsNeeded: z.string(),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون قيد التنفيذ" });
      if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
      await db.updateTicket(input.id, { status: "needs_purchase", materialsUsed: input.materialsNeeded });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "in_progress", toStatus: "needs_purchase", changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: needs_purchase → purchase_pending_estimate (Purchase manager gets estimate)
    submitEstimate: managerProcedure.input(z.object({
      id: z.number(),
      estimatedCost: z.number(),
      estimateNotes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "needs_purchase") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون بانتظار الشراء" });
      if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
      await db.updateTicket(input.id, { status: "purchase_pending_estimate" });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "needs_purchase", toStatus: "purchase_pending_estimate", changedById: ctx.user.id, notes: `التكلفة المقدرة: ${input.estimatedCost}` });
      return { success: true };
    }),

    // Transition: purchase_pending_estimate → purchase_pending_accounting (Accountant reviews)
    submitToAccounting: accountantProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }: any) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "purchase_pending_estimate") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون بانتظار التقدير" });
      if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
      await db.updateTicket(input.id, { status: "purchase_pending_accounting" });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "purchase_pending_estimate", toStatus: "purchase_pending_accounting", changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: purchase_pending_accounting → purchase_pending_management (Senior management approval)
    submitToManagement: managementProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }: any) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "purchase_pending_accounting") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون بانتظار المحاسبة" });
      if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
      await db.updateTicket(input.id, { status: "purchase_pending_management" });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "purchase_pending_accounting", toStatus: "purchase_pending_management", changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: purchase_pending_management → purchase_approved (Management approves)
    approvePurchase: managementProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "purchase_pending_management") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون بانتظار الموافقة الإدارية" });
      if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
      await db.updateTicket(input.id, { status: "purchase_approved" });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "purchase_pending_management", toStatus: "purchase_approved", changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: purchase_approved → partial_purchase or purchased (Purchase manager executes)
    executePurchase: managerProcedure.input(z.object({
      id: z.number(),
      isPartial: z.boolean().default(false),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "purchase_approved") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون معتمداً للشراء" });
      if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
      const newStatus = input.isPartial ? "partial_purchase" : "purchased";
      await db.updateTicket(input.id, { status: newStatus });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "purchase_approved", toStatus: newStatus, changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: partial_purchase → purchased (Final purchase)
    completePurchase: managerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "partial_purchase") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون بشراء جزئي" });
      if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
      await db.updateTicket(input.id, { status: "purchased" });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "partial_purchase", toStatus: "purchased", changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: purchased → received_warehouse (Warehouse receives)
    receiveInWarehouse: warehouseProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "purchased") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون مشتراً" });
      if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
      await db.updateTicket(input.id, { status: "received_warehouse" });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "purchased", toStatus: "received_warehouse", changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: received_warehouse → ready_for_closure (Technician completes with parts)
    completeWithParts: protectedProcedure.input(z.object({
      id: z.number(),
      afterPhotoUrl: z.string().optional(),
      repairNotes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "received_warehouse") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون مستلماً من المستودع" });
      if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
      await db.updateTicket(input.id, { status: "ready_for_closure", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "received_warehouse", toStatus: "ready_for_closure", changedById: ctx.user.id });
      return { success: true };
    }),

    // ========== PATH C TRANSITIONS ==========
    // Transitions already exist: approveGateExit, markExternalRepairDone, approveGateEntry

    // ========== FINAL TRANSITIONS (All Paths) ==========
    // Transition: ready_for_closure → repaired (Verification)
    markRepaired: managerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "ready_for_closure") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون جاهزاً للإغلاق" });
      await db.updateTicket(input.id, { status: "repaired" });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "ready_for_closure", toStatus: "repaired", changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: repaired → verified (Final verification)
    markVerified: supervisorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "repaired") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون مصلحاً" });
      await db.updateTicket(input.id, { status: "verified" });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "repaired", toStatus: "verified", changedById: ctx.user.id });
      return { success: true };
    }),

    // Transition: verified → closed (Final closure)
    finalClose: supervisorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "verified") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون مُتحقق منه" });
      await db.updateTicket(input.id, { status: "closed", closedAt: new Date() });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "verified", toStatus: "closed", changedById: ctx.user.id });
      await db.createAuditLog({ userId: ctx.user.id, action: "close_ticket", entityType: "ticket", entityId: input.id });
      return { success: true };
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
      // Only owner/admin/manager or the reporter can edit
      const canEdit = ["owner", "admin", "maintenance_manager"].includes(ctx.user.role) || ticket.reportedById === ctx.user.id;
      if (!canEdit) throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لتعديل هذا البلاغ" });
      if (ticket.status === "closed") throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تعديل بلاغ مغلق" });
      const { id, ...updateData } = input;
      const oldValues: any = {};
      const newValues: any = {};
      if (input.title && input.title !== ticket.title) { oldValues.title = ticket.title; newValues.title = input.title; }
      if (input.description && input.description !== ticket.description) { oldValues.description = ticket.description; newValues.description = input.description; }
      if (input.priority && input.priority !== ticket.priority) { oldValues.priority = ticket.priority; newValues.priority = input.priority; }
      if (input.category && input.category !== ticket.category) { oldValues.category = ticket.category; newValues.category = input.category; }
      if (input.siteId && input.siteId !== ticket.siteId) { oldValues.siteId = ticket.siteId; newValues.siteId = input.siteId; }
      // Auto-translate updated text fields to all 3 languages
      let translationUpdate: Record<string, any> = {};
      const fieldsToTranslate: Record<string, string> = {};
      if (input.title && input.title !== ticket.title) fieldsToTranslate.title = input.title;
      if (input.description && input.description !== ticket.description) fieldsToTranslate.description = input.description;
      if (Object.keys(fieldsToTranslate).length > 0) {
        try {
          const textForDetection = Object.values(fieldsToTranslate)[0];
          const detectedLang = await detectLanguage(textForDetection) as SupportedLanguage;
          const translations = await translateFields(fieldsToTranslate, detectedLang);
          if (translations.title) {
            translationUpdate.title_ar = translations.title.ar;
            translationUpdate.title_en = translations.title.en;
            translationUpdate.title_ur = translations.title.ur;
          }
          if (translations.description) {
            translationUpdate.description_ar = translations.description.ar;
            translationUpdate.description_en = translations.description.en;
            translationUpdate.description_ur = translations.description.ur;
          }
        } catch (e) {
          console.error("[Ticket] Update translation failed:", e);
        }
      }
      await db.updateTicket(id, { ...updateData, ...translationUpdate });
      await db.createAuditLog({ userId: ctx.user.id, action: "update_ticket", entityType: "ticket", entityId: id, oldValues, newValues });
      // Notify managers about ticket edit
      if (Object.keys(newValues).length > 0) {
        const managers = await db.getManagerUsers();
        const changedFields = Object.keys(newValues).join(", ");
        for (const mgr of managers) {
          if (mgr.id !== ctx.user.id) {
            await db.createNotification({ userId: mgr.id, title: `تعديل بلاغ #${ticket.ticketNumber}`, message: `قام ${ctx.user.name} بتعديل البلاغ "${ticket.title}" - الحقول: ${changedFields}`, type: "ticket_updated", relatedTicketId: id });
          }
        }
      }
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
      // Only owner/admin/manager can delete
      if (!["owner", "admin", "maintenance_manager"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لحذف البلاغات" });
      }
      await db.deleteTicket(input.id);
      await db.createAuditLog({ userId: ctx.user.id, action: "delete_ticket", entityType: "ticket", entityId: input.id, oldValues: { ticketNumber: ticket.ticketNumber, title: ticket.title, status: ticket.status } });
      // Notify managers about ticket deletion
      const managers = await db.getManagerUsers();
      for (const mgr of managers) {
        if (mgr.id !== ctx.user.id) {
          await db.createNotification({ userId: mgr.id, title: `حذف بلاغ #${ticket.ticketNumber}`, message: `قام ${ctx.user.name} بحذف البلاغ "${ticket.title}"`, type: "ticket_deleted", relatedTicketId: input.id });
        }
      }
      return { success: true };
    }),

    history: protectedProcedure.input(z.object({ ticketId: z.number() })).query(async ({ input }) => {
      return db.getTicketHistory(input.ticketId);
    }),

    // =============================================
    // NEW WORKFLOW PROCEDURES
    // =============================================

    // 1. Submit for Triage (after creation, ticket goes to supervisor)
    submitForTriage: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
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

    // 2. Triage by Supervisor (Eng. Khaled)
    triage: supervisorProcedure.input(z.object({
      id: z.number(),
      ticketType: z.enum(["internal", "external", "procurement"]),
      priority: z.string().optional(),
      triageNotes: z.string().optional(),
      assignedToId: z.number().optional(), // Assign inspection team
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "pending_triage") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفرز" });
      const updateData: any = {
        status: "under_inspection",
        ticketType: input.ticketType,
        supervisorId: ctx.user.id,
        triageNotes: input.triageNotes,
      };
      if (input.priority) updateData.priority = input.priority;
      if (input.assignedToId) updateData.assignedToId = input.assignedToId;
      await db.updateTicket(input.id, updateData);
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "under_inspection", changedById: ctx.user.id, notes: input.triageNotes });
      // Notify maintenance manager
      const managers = await db.getManagerUsers();
      for (const mgr of managers) {
        await db.createNotification({ userId: mgr.id, title: "بلاغ قيد الفحص", message: `تم فرز البلاغ ${ticket.ticketNumber} وهو الآن قيد الفحص`, type: "info", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    // 2b. Triage Ticket (Supervisor moves ticket from pending_triage to under_inspection)
    triageTicket: supervisorProcedure.input(z.object({
      id: z.number(),
      assignedToId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "pending_triage") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفرز" });
      const updateData: any = { status: "under_inspection", supervisorId: ctx.user.id };
      if (input.assignedToId) updateData.assignedToId = input.assignedToId;
      await db.updateTicket(input.id, updateData);
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "under_inspection", changedById: ctx.user.id, notes: input.assignedToId ? `تم نقل البلاغ لمرحلة الفحص وتعيينه للفني` : "تم نقل البلاغ لمرحلة الفحص" });
      // Notify maintenance manager
      const managers = await db.getManagerUsers();
      for (const mgr of managers) {
        await db.createNotification({ userId: mgr.id, title: "بلاغ قيد الفحص", message: `البلاغ ${ticket.ticketNumber} الآن قيد الفحص من قبل المشرف`, type: "info", relatedTicketId: input.id });
      }
      // Notify assigned technician if provided
      if (input.assignedToId) {
        await db.createNotification({ userId: input.assignedToId, title: "تم تعيينك لفحص بلاغ", message: `تم تعيينك للفحص الميداني للبلاغ ${ticket.ticketNumber}`, type: "warning", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    // 2c. Inspect Ticket (Supervisor completes inspection and prepares for approval)
    inspectTicket: supervisorProcedure.input(z.object({
      id: z.number(),
      inspectionNotes: z.string(),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "under_inspection") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفحص" });
      // Update inspection notes
      await db.updateTicket(input.id, { inspectionNotes: input.inspectionNotes });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "under_inspection", changedById: ctx.user.id, notes: `ملاحظات الفحص: ${input.inspectionNotes}` });
      // Notify maintenance manager to approve work
      const managers = await db.getManagerUsers();
      for (const mgr of managers) {
        await db.createNotification({ userId: mgr.id, title: "بلاغ جاهز للموافقة", message: `البلاغ ${ticket.ticketNumber} انتهى من الفحص وجاهز للموافقة على العمل`, type: "warning", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    // 3. Work Approval by Maintenance Manager (Abdel Fattah) + Path Selection
    approveWork: managerProcedure.input(z.object({
      id: z.number(),
      maintenancePath: z.enum(["A", "B", "C"]),
      inspectionNotes: z.string().optional(),
      justification: z.string().optional(), // Required for Path C
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "under_inspection") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس في مرحلة الفحص" });
      if (input.maintenancePath === "C" && !input.justification) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "المسار C يتطلب مبرراً للصيانة الخارجية" });
      }
      const updateData: any = {
        status: "work_approved",
        maintenancePath: input.maintenancePath,
        approvedById: ctx.user.id,
        inspectionNotes: input.inspectionNotes,
        justification: input.justification,
      };
      await db.updateTicket(input.id, updateData);
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "work_approved", changedById: ctx.user.id, notes: `المسار: ${input.maintenancePath}` });
      // Notify based on path
      if (input.maintenancePath === "C") {
        // Notify supervisor for external path approval
        const supervisors = await db.getUsersByRole("supervisor");
        for (const sup of supervisors) {
          await db.createNotification({ userId: sup.id, title: "بلاغ مسار خارجي", message: `البلاغ ${ticket.ticketNumber} يحتاج موافقة للصيانة الخارجية (المسار C)`, type: "warning", relatedTicketId: input.id });
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

    // 4. Mark Ready for Closure (Path A - after technician completes repair)
    markReadyForClosure: protectedProcedure.input(z.object({
      id: z.number(),
      afterPhotoUrl: z.string().optional(),
      repairNotes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.maintenancePath !== "A") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار A فقط" });
      await db.updateTicket(input.id, { status: "ready_for_closure", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "ready_for_closure", changedById: ctx.user.id });
      // Notify supervisor to close
      const supervisors = await db.getUsersByRole("supervisor");
      for (const sup of supervisors) {
        await db.createNotification({ userId: sup.id, title: "بلاغ جاهز للإغلاق", message: `البلاغ ${ticket.ticketNumber} جاهز للإغلاق - المسار A`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    // 5. Supervisor closes ticket (Path A)
    closeBySupervisor: supervisorProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "ready_for_closure") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ ليس جاهزاً للإغلاق" });
      await db.updateTicket(input.id, { status: "closed", closedAt: new Date() });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "closed", changedById: ctx.user.id });
      await db.createAuditLog({ userId: ctx.user.id, action: "close_ticket", entityType: "ticket", entityId: input.id });
      // Notify managers, reporter, and technician
      const managersSup = await db.getManagerUsers();
      for (const mgr of managersSup) {
        await db.createNotification({ userId: mgr.id, title: "🔒 تم إغلاق بلاغ", message: `أغلق المشرف البلاغ ${ticket.ticketNumber}`, type: "success", relatedTicketId: input.id });
      }
      if (ticket.reportedById) {
        await db.createNotification({ userId: ticket.reportedById, title: "🔒 تم إغلاق بلاغك", message: `تم إغلاق البلاغ ${ticket.ticketNumber} بنجاح`, type: "success", relatedTicketId: input.id });
      }
      if (ticket.assignedToId && ticket.assignedToId !== ticket.reportedById) {
        await db.createNotification({ userId: ticket.assignedToId, title: "🔒 تم إغلاق البلاغ", message: `تم إغلاق البلاغ ${ticket.ticketNumber}`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    // 6. Gate Exit Approval (Path C - asset leaves for external repair)
    approveGateExit: gateSecurityProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.maintenancePath !== "C") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار C فقط" });
      await db.updateTicket(input.id, { status: "out_for_repair", gateExitApprovedById: ctx.user.id, gateExitApprovedAt: new Date() });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "out_for_repair", changedById: ctx.user.id, notes: "تمت الموافقة على خروج الأصل" });
      await db.createAuditLog({ userId: ctx.user.id, action: "gate_exit_approved", entityType: "ticket", entityId: input.id });
      return { success: true };
    }),

    // 7. Mark External Repair Completed (Delegate)
    markExternalRepairDone: delegateProcedure.input(z.object({
      id: z.number(),
      repairNotes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.status !== "out_for_repair") throw new TRPCError({ code: "BAD_REQUEST", message: "الأصل ليس خارجاً للإصلاح" });
      await db.updateTicket(input.id, { externalRepairCompletedAt: new Date(), externalRepairCompletedById: ctx.user.id, repairNotes: input.repairNotes });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "out_for_repair", changedById: ctx.user.id, notes: "تم الإصلاح الخارجي - بانتظار موافقة الدخول" });
      // Notify gate security
      const gateUsers = await db.getUsersByRole("gate_security");
      for (const g of gateUsers) {
        await db.createNotification({ userId: g.id, title: "أصل عائد للمنشأة", message: `الأصل المرتبط بالبلاغ ${ticket.ticketNumber} عائد بعد الإصلاح الخارجي`, type: "info", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    // 8. Gate Entry Approval (Path C - asset returns after external repair)
    approveGateEntry: gateSecurityProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      if (ticket.maintenancePath !== "C") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار C فقط" });
      // ✅ Fixed: Move to ready_for_closure (NOT repaired)
      await db.updateTicket(input.id, { status: "ready_for_closure", gateEntryApprovedById: ctx.user.id, gateEntryApprovedAt: new Date() });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "ready_for_closure", changedById: ctx.user.id, notes: "تمت الموافقة على دخول الأصل - جاهز للإغلاق" });
      await db.createAuditLog({ userId: ctx.user.id, action: "gate_entry_approved", entityType: "ticket", entityId: input.id });
      // Notify maintenance manager to close
      const managers = await db.getManagerUsers();
      for (const mgr of managers) {
        await db.createNotification({ userId: mgr.id, title: "أصل عاد بعد الإصلاح", message: `البلاغ ${ticket.ticketNumber} - الأصل عاد بعد الإصلاح الخارجي وجاهز للإغلاق`, type: "success", relatedTicketId: input.id });
      }
      return { success: true };
    }),

    // 9. Get tickets for gate security
    listForGate: gateSecurityProcedure.query(async () => {
      return db.getTickets({ status: "work_approved" });
    }),
  }),

  // ============================================================
  // NFC / RFID SCANNING
  // ============================================================
  nfc: router({
    // Scan an NFC/RFID tag and return asset + location info
    scanTag: protectedProcedure.input(z.object({
      rfidTag: z.string().min(1, "يجب توفير رقم الرقاقة"),
    })).mutation(async ({ input }) => {
      // ✅ Find asset by RFID tag
      const asset = await db.getAssetByRfidTag(input.rfidTag);
      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "الأصل غير موجود. يرجى تسجيل الرقاقة أولاً.",
        });
      }
      // ✅ Get site/location associated with the asset
      const site = asset.siteId ? await db.getSiteById(asset.siteId) : null;
      return {
        success: true,
        asset: {
          id: asset.id,
          assetNumber: asset.assetNumber,
          name: asset.name,
          description: asset.description,
          category: asset.category,
          brand: asset.brand,
          model: asset.model,
          serialNumber: asset.serialNumber,
          siteId: asset.siteId,
          locationDetail: asset.locationDetail,
          photoUrl: asset.photoUrl,
          rfidTag: asset.rfidTag,
        },
        site: site ? { id: site.id, name: site.name, address: site.address } : null,
      };
    }),

    // Lookup asset by tag without mutation (for QR code or manual entry)
    lookupTag: protectedProcedure.input(z.object({
      rfidTag: z.string().min(1),
    })).query(async ({ input }) => {
      const asset = await db.getAssetByRfidTag(input.rfidTag);
      if (!asset) return null;
      const site = asset.siteId ? await db.getSiteById(asset.siteId) : null;
      return {
        asset: {
          id: asset.id,
          assetNumber: asset.assetNumber,
          name: asset.name,
          siteId: asset.siteId,
          locationDetail: asset.locationDetail,
          photoUrl: asset.photoUrl,
        },
        site: site ? { id: site.id, name: site.name } : null,
      };
    }),
  }),

  // ============================================================
  // PURCHASE ORDERS
  // ============================================================
  purchaseOrders: router({
    list: protectedProcedure.input(z.object({ status: z.string().optional() }).optional()).query(async ({ input, ctx }) => {
      const role = ctx.user.role;
      let filters: any = input || {};
      if (role === "delegate") {
        // Delegates see POs that have items assigned to them
        const items = await db.getPOItemsByDelegate(ctx.user.id);
        const poIds = Array.from(new Set(items.map(i => i.purchaseOrderId)));
        if (poIds.length === 0) return [];
        const allPOs = await db.getPurchaseOrders(filters);
        return allPOs.filter(po => poIds.includes(po.id));
      }
      return db.getPurchaseOrders(filters);
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const po = await db.getPurchaseOrderById(input.id);
      if (!po) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الشراء غير موجود" });
      const items = await db.getPOItems(input.id);
      return { ...po, items };
    }),

    create: protectedProcedure.input(z.object({
      ticketId: z.number().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        itemName: z.string().min(1),
        description: z.string().optional(),
        quantity: z.number().min(1),
        unit: z.string().optional(),
        photoUrl: z.string().optional(),
        notes: z.string().optional(),
        delegateId: z.number().optional(),
      })),
    })).mutation(async ({ input, ctx }) => {
      // ✅ Batching Limit: Max 15 items per PO
      if (input.items.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "يجب إضافة صنف واحد على الأقل" });
      }
      if (input.items.length > 15) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `الحد الأقصى 15 صنف لكل طلب شراء. لديك ${input.items.length} صنف` });
      }
      const poNumber = await db.getNextPONumber();
      const poId = await db.createPurchaseOrder({
        poNumber,
        ticketId: input.ticketId,
        requestedById: ctx.user.id,
        status: "pending_estimate",
        notes: input.notes,
      });
      const itemsData = input.items.map(item => ({ ...item, purchaseOrderId: poId!, status: "pending" }));
      await db.createPOItems(itemsData);
      // Update ticket status if linked
      if (input.ticketId) {
        const ticket = await db.getTicketById(input.ticketId);
        if (ticket) {
          await db.updateTicket(input.ticketId, { status: "needs_purchase" });
          await db.addTicketStatusHistory({ ticketId: input.ticketId, fromStatus: ticket.status, toStatus: "needs_purchase", changedById: ctx.user.id });
        }
      }
      // Notify delegates
      const delegateIds = Array.from(new Set(input.items.filter(i => i.delegateId).map(i => i.delegateId!)));
      for (const dId of delegateIds) {
        await db.createNotification({ userId: dId, title: "طلب شراء جديد", message: `تم تخصيص أصناف لك في طلب الشراء ${poNumber}`, type: "info", relatedPOId: poId! });
      }
      await db.createAuditLog({ userId: ctx.user.id, action: "create_po", entityType: "purchase_order", entityId: poId! });
      return { id: poId, poNumber };
    }),

    update: protectedProcedure.input(z.object({
      id: z.number(),
      notes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const po = await db.getPurchaseOrderById(input.id);
      if (!po) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الشراء غير موجود" });
      if (!["pending_estimate", "pending_accounting"].includes(po.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تعديل طلب شراء معتمد" });
      }
      const oldValues = { notes: po.notes };
      await db.updatePurchaseOrder(input.id, { notes: input.notes });
      await db.createAuditLog({ userId: ctx.user.id, action: "update_po", entityType: "purchase_order", entityId: input.id, oldValues, newValues: { notes: input.notes } });
      // Notify managers about PO edit
      const poManagers = await db.getManagerUsers();
      for (const mgr of poManagers) {
        if (mgr.id !== ctx.user.id) {
          await db.createNotification({ userId: mgr.id, title: `تعديل طلب شراء #${po.poNumber}`, message: `قام ${ctx.user.name} بتعديل طلب الشراء`, type: "po_updated", relatedPOId: input.id });
        }
      }
      return { success: true };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const po = await db.getPurchaseOrderById(input.id);
      if (!po) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الشراء غير موجود" });
      if (!["owner", "admin", "maintenance_manager", "purchase_manager"].includes(ctx.user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لحذف طلبات الشراء" });
      }
      if (["funded", "partially_purchased", "completed"].includes(po.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن حذف طلب شراء مموّل أو مكتمل" });
      }
      await db.deletePurchaseOrder(input.id);
      await db.createAuditLog({ userId: ctx.user.id, action: "delete_po", entityType: "purchase_order", entityId: input.id, oldValues: { poNumber: po.poNumber, status: po.status, notes: po.notes } });
      // Notify managers about PO deletion
      const poDelManagers = await db.getManagerUsers();
      for (const mgr of poDelManagers) {
        if (mgr.id !== ctx.user.id) {
          await db.createNotification({ userId: mgr.id, title: `حذف طلب شراء #${po.poNumber}`, message: `قام ${ctx.user.name} بحذف طلب الشراء`, type: "po_deleted", relatedPOId: input.id });
        }
      }
      return { success: true };
    }),

    editItem: protectedProcedure.input(z.object({
      id: z.number(),
      purchaseOrderId: z.number(),
      itemName: z.string().optional(),
      description: z.string().optional(),
      quantity: z.number().optional(),
      estimatedUnitCost: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const po = await db.getPurchaseOrderById(input.purchaseOrderId);
      if (!po) throw new TRPCError({ code: "NOT_FOUND" });
      if (!['pending_estimate', 'pending_accounting', 'draft'].includes(po.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تعديل صنف في طلب معتمد أو ممول" });
      }
      const oldItem = await db.getPOItemById(input.id);
      if (!oldItem) throw new TRPCError({ code: "NOT_FOUND" });
      const updates: any = {};
      if (input.itemName !== undefined) updates.itemName = input.itemName;
      if (input.description !== undefined) updates.description = input.description;
      if (input.quantity !== undefined) updates.quantity = input.quantity;
      if (input.estimatedUnitCost !== undefined) {
        updates.estimatedUnitCost = input.estimatedUnitCost;
        updates.estimatedTotalCost = String(parseFloat(input.estimatedUnitCost) * (input.quantity || oldItem.quantity));
      } else if (input.quantity !== undefined && oldItem.estimatedUnitCost) {
        updates.estimatedTotalCost = String(parseFloat(oldItem.estimatedUnitCost) * input.quantity);
      }
      await db.updatePOItem(input.id, updates);
      await db.createAuditLog({
        userId: ctx.user.id, action: "update", entityType: "purchase_order_item", entityId: input.id,
        oldValues: { itemName: oldItem.itemName, description: oldItem.description, quantity: oldItem.quantity, estimatedUnitCost: oldItem.estimatedUnitCost },
        newValues: updates,

      });
      return { success: true };
    }),

    deleteItem: protectedProcedure.input(z.object({ id: z.number(), purchaseOrderId: z.number() })).mutation(async ({ input, ctx }) => {
      const po = await db.getPurchaseOrderById(input.purchaseOrderId);
      if (!po) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["pending_estimate", "pending_accounting"].includes(po.status)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن حذف صنف من طلب معتمد" });
      }
      const item = await db.getPOItemById(input.id);
      await db.deletePOItem(input.id);
      await db.createAuditLog({ userId: ctx.user.id, action: "delete_po_item", entityType: "purchase_order_item", entityId: input.id, oldValues: { itemName: item?.itemName, quantity: item?.quantity } });
      return { success: true };
    }),

    // Delegate estimates cost
    estimateCost: delegateProcedure.input(z.object({
      purchaseOrderId: z.number(),
      items: z.array(z.object({
        id: z.number(),
        estimatedUnitCost: z.string(),
      })),
    })).mutation(async ({ input, ctx }) => {
      let totalEstimated = 0;
      for (const item of input.items) {
        const cost = parseFloat(item.estimatedUnitCost);
        const poItem = (await db.getPOItems(input.purchaseOrderId)).find(i => i.id === item.id);
        const totalCost = cost * (poItem?.quantity || 1);
        totalEstimated += totalCost;
        await db.updatePOItem(item.id, { estimatedUnitCost: item.estimatedUnitCost, estimatedTotalCost: String(totalCost), status: "estimated" });
      }
      // Check if all items are estimated
      const allItems = await db.getPOItems(input.purchaseOrderId);
      const allEstimated = allItems.every(i => i.status !== "pending");
      if (allEstimated) {
        await db.updatePurchaseOrder(input.purchaseOrderId, { status: "pending_accounting", totalEstimatedCost: String(totalEstimated) });
        // Notify accountants
        const accountants = await db.getUsersByRole("accountant");
        for (const acc of accountants) {
          await db.createNotification({ userId: acc.id, title: "طلب شراء بانتظار الاعتماد", message: `طلب شراء بانتظار اعتماد الحسابات`, type: "warning", relatedPOId: input.purchaseOrderId });
        }
      }
      return { success: true };
    }),

    // Accounting approval
    approveAccounting: accountantProcedure.input(z.object({
      id: z.number(),
      notes: z.string().optional(),
      custodyAmount: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      await db.updatePurchaseOrder(input.id, { status: "pending_management", accountingApprovedById: ctx.user.id, accountingApprovedAt: new Date(), accountingNotes: input.notes, custodyAmount: input.custodyAmount || null });
      // Notify senior management
      const mgmt = await db.getUsersByRole("senior_management");
      const po = await db.getPurchaseOrderById(input.id);
      const custodyMsg = input.custodyAmount ? ` مبلغ العهدة: ${Number(input.custodyAmount).toLocaleString("ar-SA")} ر.س.` : "";
      for (const m of mgmt) {
        await db.createNotification({ userId: m.id, title: "طلب شراء بانتظار اعتمادك", message: `طلب شراء رقم ${po?.poNumber || input.id} بانتظار اعتماد الإدارة العليا.${custodyMsg}`, type: "warning", relatedPOId: input.id });
      }
      await db.createAuditLog({ userId: ctx.user.id, action: "approve_accounting", entityType: "purchase_order", entityId: input.id });
      return { success: true };
    }),

    // Management approval
    approveManagement: managementProcedure.input(z.object({
      id: z.number(),
      notes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const po = await db.getPurchaseOrderById(input.id);
      await db.updatePurchaseOrder(input.id, { status: "approved", managementApprovedById: ctx.user.id, managementApprovedAt: new Date(), managementNotes: input.notes });
      // Update all items to approved
      const items = await db.getPOItems(input.id);
      for (const item of items) {
        await db.updatePOItem(item.id, { status: "approved" });
      }
      // Notify delegates with detailed message
      const delegateIds = Array.from(new Set(items.filter(i => i.delegateId).map(i => i.delegateId!)));
      for (const dId of delegateIds) {
        const delegateItems = items.filter(i => i.delegateId === dId);
        const itemNames = delegateItems.map(i => i.itemName).join("، ");
        const custodyInfo = po?.custodyAmount ? ` مبلغ العهدة المُصرف لك: ${Number(po.custodyAmount).toLocaleString("ar-SA")} ر.س.` : "";
        await db.createNotification({
          userId: dId,
          title: "✅ تم اعتماد طلب الشراء - ابدأ الشراء الآن",
          message: `تم اعتماد طلب الشراء رقم ${po?.poNumber || input.id} من قِبل الإدارة. الأصناف المطلوبة منك: ${itemNames}.${custodyInfo} يمكنك البدء بالشراء فوراً.`,
          type: "success",
          relatedPOId: input.id
        });
      }
      // If no delegates assigned, notify managers
      if (delegateIds.length === 0) {
        const managers = await db.getManagerUsers();
        for (const mgr of managers) {
          await db.createNotification({
            userId: mgr.id,
            title: "✅ تم اعتماد طلب الشراء",
            message: `تم اعتماد طلب الشراء رقم ${po?.poNumber || input.id}. لا يوجد مندوب مُعيَّن للأصناف.`,
            type: "warning",
            relatedPOId: input.id
          });
        }
      }
      // Update ticket
      if (po?.ticketId) {
        await db.updateTicket(po.ticketId, { status: "purchase_approved" });
        await db.addTicketStatusHistory({ ticketId: po.ticketId, fromStatus: "purchase_pending_management", toStatus: "purchase_approved", changedById: ctx.user.id });
      }
      await db.createAuditLog({ userId: ctx.user.id, action: "approve_management", entityType: "purchase_order", entityId: input.id });
      return { success: true };
    }),

    // Reject PO
    reject: protectedProcedure.input(z.object({
      id: z.number(),
      reason: z.string().min(1),
    })).mutation(async ({ input, ctx }) => {
      const poReject = await db.getPurchaseOrderById(input.id);
      await db.updatePurchaseOrder(input.id, { status: "rejected", rejectedById: ctx.user.id, rejectedAt: new Date(), rejectionReason: input.reason });
      // Notify PO creator and managers
      if (poReject?.requestedById && poReject.requestedById !== ctx.user.id) {
        await db.createNotification({ userId: poReject.requestedById, title: "❌ تم رفض طلب الشراء", message: `تم رفض طلب الشراء رقم ${poReject.poNumber}. السبب: ${input.reason}`, type: "critical", relatedPOId: input.id });
      }
      const managersReject = await db.getManagerUsers();
      for (const mgr of managersReject) {
        if (mgr.id !== ctx.user.id) {
          await db.createNotification({ userId: mgr.id, title: "❌ رفض طلب شراء", message: `تم رفض طلب الشراء رقم ${poReject?.poNumber || input.id}. السبب: ${input.reason}`, type: "critical", relatedPOId: input.id });
        }
      }
      return { success: true };
    }),

    // ============ المرحلة 1: المندوب يؤكد شراء صنف ============
    confirmItemPurchase: delegateProcedure.input(z.object({
      itemId: z.number(),
      purchasedPhotoUrl: z.string().min(1, "صورة الصنف المشترى مطلوبة"),
      invoicePhotoUrl: z.string().min(1, "صورة الفاتورة مطلوبة"),
    })).mutation(async ({ input, ctx }) => {
      // Admin/owner can confirm purchase for any item; delegate only for their own
      const isAdminOrOwner = ctx.user.role === "admin" || ctx.user.role === "owner";
      let item: any;
      if (isAdminOrOwner) {
        item = await db.getPOItemById(input.itemId);
      } else {
        const allItems = await db.getPOItemsByDelegate(ctx.user.id);
        item = allItems.find(i => i.id === input.itemId);
      }
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود أو غير مخصص لك" });
      if (item.status !== "approved" && item.status !== "funded") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تأكيد شراء هذا الصنف في حالته الحالية" });
      }
      await db.updatePOItem(input.itemId, {
        status: "purchased",
        purchasedAt: new Date(),
        purchasedById: ctx.user.id,
        purchasedPhotoUrl: input.purchasedPhotoUrl,
        invoicePhotoUrl: input.invoicePhotoUrl,
      });
      // Update PO status
      const poItems = await db.getPOItems(item.purchaseOrderId);
      const purchasedOrLater = poItems.filter(i => ["purchased", "delivered_to_warehouse", "delivered_to_requester"].includes(i.status));
      if (purchasedOrLater.length === poItems.length) {
        await db.updatePurchaseOrder(item.purchaseOrderId, { status: "purchased" });
        const po = await db.getPurchaseOrderById(item.purchaseOrderId);
        if (po?.ticketId) {
          await db.updateTicket(po.ticketId, { status: "purchased" });
        }
      } else if (purchasedOrLater.length > 0) {
        await db.updatePurchaseOrder(item.purchaseOrderId, { status: "partial_purchase" });
        const po = await db.getPurchaseOrderById(item.purchaseOrderId);
        if (po?.ticketId) {
          await db.updateTicket(po.ticketId, { status: "partial_purchase" });
        }
      }
      // Notify warehouse with detailed message
      const warehouseUsers = await db.getUsersByRole("warehouse");
      const po = await db.getPurchaseOrderById(item.purchaseOrderId);
      const buyer = ctx.user;
      for (const w of warehouseUsers) {
        await db.createNotification({
          userId: w.id,
          title: "📦 صنف تم شراؤه - بانتظار الاستلام",
          message: `تم شراء الصنف: "${item.itemName}" (الكمية: ${item.quantity} ${item.unit || ''}). طلب الشراء رقم: ${po?.poNumber || item.purchaseOrderId}. المندوب: ${buyer.name}. يرجى تسجيل استلام البضاعة عند وصولها.`,
          type: "info",
          relatedPOId: item.purchaseOrderId
        });
      }
      // Also notify managers/owner
      const managers = await db.getManagerUsers();
      for (const mgr of managers) {
        await db.createNotification({
          userId: mgr.id,
          title: "🛒 تم شراء صنف",
          message: `قام ${buyer.name} بشراء صنف "${item.itemName}" من طلب الشراء رقم ${po?.poNumber || item.purchaseOrderId}.`,
          type: "info",
          relatedPOId: item.purchaseOrderId
        });
      }
      await db.createAuditLog({ userId: ctx.user.id, action: "confirm_purchase", entityType: "po_item", entityId: input.itemId });
      return { success: true };
    }),

    // ============ المرحلة 2: المستودع يؤكد التوريد ============
    confirmDeliveryToWarehouse: warehouseProcedure.input(z.object({
      itemId: z.number(),
      supplierName: z.string().min(1, "اسم المورد مطلوب"),
      supplierItemName: z.string().optional(),
      actualUnitCost: z.string().min(1, "تكلفة الصنف مطلوبة"),
      warehousePhotoUrl: z.string().min(1, "صورة الصنف مطلوبة"),
    })).mutation(async ({ input, ctx }) => {
      // Get the item
      const item = await db.getPOItemById(input.itemId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود" });
      if (item.status !== "purchased") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الصنف ليس في حالة \"تم الشراء\" بعد" });
      }
      const actualTotal = parseFloat(input.actualUnitCost) * item.quantity;
      await db.updatePOItem(input.itemId, {
        status: "delivered_to_warehouse",
        receivedAt: new Date(),
        receivedById: ctx.user.id,
        supplierName: input.supplierName,
        supplierItemName: input.supplierItemName || item.itemName,
        actualUnitCost: input.actualUnitCost,
        actualTotalCost: String(actualTotal),
        warehousePhotoUrl: input.warehousePhotoUrl,
      });
      // Update PO status
      const allItems = await db.getPOItems(item.purchaseOrderId);
      const allInWarehouse = allItems.every(i => ["delivered_to_warehouse", "delivered_to_requester"].includes(i.status));
      if (allInWarehouse) {
        const totalActual = allItems.reduce((sum, i) => sum + parseFloat(i.actualTotalCost || "0"), 0);
        await db.updatePurchaseOrder(item.purchaseOrderId, { status: "received", totalActualCost: String(totalActual) });
        const po = await db.getPurchaseOrderById(item.purchaseOrderId);
        if (po?.ticketId) {
          await db.updateTicket(po.ticketId, { status: "received_warehouse" });
        }
      }
      // Notify assigned technician and managers that item arrived at warehouse
      const poForNotif = await db.getPurchaseOrderById(item.purchaseOrderId);
      if (poForNotif?.ticketId) {
        const ticketForNotif = await db.getTicketById(poForNotif.ticketId);
        if (ticketForNotif?.assignedToId) {
          await db.createNotification({ userId: ticketForNotif.assignedToId, title: "📦 وصلت موادك للمستودع", message: `تم استلام الصنف "${item.itemName}" في المستودع. سيتم تسليمه لك قريباً.`, type: "info", relatedTicketId: poForNotif.ticketId });
        }
      }
      const managersWH = await db.getManagerUsers();
      for (const mgr of managersWH) {
        await db.createNotification({ userId: mgr.id, title: "📦 وصلت بضاعة للمستودع", message: `استلم المستودع الصنف "${item.itemName}" بتكلفة فعلية ${input.actualUnitCost} ر.س من المورد ${input.supplierName}`, type: "info", relatedPOId: item.purchaseOrderId });
      }
      await db.createAuditLog({ userId: ctx.user.id, action: "deliver_to_warehouse", entityType: "po_item", entityId: input.itemId, newValues: { supplierName: input.supplierName, actualUnitCost: input.actualUnitCost } });
      return { success: true };
    }),

    // ============ المرحلة 3: المستودع يسلم الصنف للفني/المسؤول ============
    confirmDeliveryToRequester: warehouseProcedure.input(z.object({
      itemId: z.number(),
      deliveredToId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const item = await db.getPOItemById(input.itemId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود" });
      if (item.status !== "delivered_to_warehouse") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الصنف لم يتم توريده للمستودع بعد" });
      }
      await db.updatePOItem(input.itemId, {
        status: "delivered_to_requester",
        deliveredAt: new Date(),
        deliveredById: ctx.user.id,
        deliveredToId: input.deliveredToId || null,
      });
      // Check if all items delivered to requester
      const allItems = await db.getPOItems(item.purchaseOrderId);
      const allDelivered = allItems.every(i => i.status === "delivered_to_requester");
      if (allDelivered) {
        await db.updatePurchaseOrder(item.purchaseOrderId, { status: "closed" });
        // Auto-update ticket to allow closure
        const po = await db.getPurchaseOrderById(item.purchaseOrderId);
        if (po?.ticketId) {
          const ticket = await db.getTicketById(po.ticketId);
          if (ticket && ticket.status !== "closed") {
            await db.updateTicket(po.ticketId, { status: "repaired" });
            await db.addTicketStatusHistory({ ticketId: po.ticketId, fromStatus: ticket.status, toStatus: "repaired", changedById: ctx.user.id, notes: "تم تسليم جميع المواد - جاهز للإغلاق" });
            // Notify maintenance manager to close the ticket
            const managers = await db.getManagerUsers();
            for (const mgr of managers) {
              await db.createNotification({ userId: mgr.id, title: "بلاغ جاهز للإغلاق", message: `تم تسليم جميع مواد البلاغ ${ticket.ticketNumber}. يمكن إغلاقه الآن.`, type: "success", relatedTicketId: po.ticketId });
            }
          }
        }
      }
      await db.createAuditLog({ userId: ctx.user.id, action: "deliver_to_requester", entityType: "po_item", entityId: input.itemId });
      return { success: true };
    }),

    // Get items pending purchase (for delegate)
    pendingPurchaseItems: protectedProcedure.query(async ({ ctx }) => {
      const isAdminOrOwner = ctx.user.role === "admin" || ctx.user.role === "owner";
      if (isAdminOrOwner) {
        // Admin/owner see all approved/funded items
        const approved = await db.getPOItemsByStatus("approved");
        const funded = await db.getPOItemsByStatus("funded");
        return [...approved, ...funded];
      }
      if (ctx.user.role !== "delegate") return [];
      const items = await db.getPOItemsByDelegate(ctx.user.id);
      return items.filter(i => i.status === "approved" || i.status === "funded");
    }),

    // Get items pending warehouse receiving
    pendingWarehouseItems: protectedProcedure.query(async ({ ctx }) => {
      const isAdminOrOwner = ctx.user.role === "admin" || ctx.user.role === "owner";
      if (isAdminOrOwner || ctx.user.role === "warehouse") {
        return db.getPOItemsByStatus("purchased");
      }
      return [];
    }),

    // Get items pending delivery to requester
    pendingDeliveryItems: protectedProcedure.query(async ({ ctx }) => {
      const isAdminOrOwner = ctx.user.role === "admin" || ctx.user.role === "owner";
      if (isAdminOrOwner || ctx.user.role === "warehouse") {
        return db.getPOItemsByStatus("delivered_to_warehouse");
      }
      return [];
    }),

    myItems: protectedProcedure.query(async ({ ctx }) => {
      const isAdminOrOwner = ctx.user.role === "admin" || ctx.user.role === "owner";
      if (isAdminOrOwner) {
        // Admin/owner see all items
        return db.getAllPOItems();
      }
      if (ctx.user.role !== "delegate") return [];
      return db.getPOItemsByDelegate(ctx.user.id);
    }),
  }),

  // ============================================================
  // INVENTORY
  // ============================================================
  inventory: router({
    list: protectedProcedure.query(async () => {
      return db.getInventoryItems();
    }),
    create: warehouseProcedure.input(z.object({
      itemName: z.string().min(1),
      description: z.string().optional(),
      quantity: z.number().default(0),
      unit: z.string().optional(),
      minQuantity: z.number().optional(),
      location: z.string().optional(),
      siteId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await db.createInventoryItem(input);
      await db.createAuditLog({ userId: ctx.user.id, action: "create_inventory", entityType: "inventory", entityId: id! });
      return { id };
    }),
    update: warehouseProcedure.input(z.object({
      id: z.number(),
      itemName: z.string().optional(),
      description: z.string().optional(),
      unit: z.string().optional(),
      minQuantity: z.number().optional(),
      location: z.string().optional(),
      siteId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const item = await db.getInventoryItemById(input.id);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود" });
      const { id, ...updateData } = input;
      const oldValues = { itemName: item.itemName, description: item.description, unit: item.unit, minQuantity: item.minQuantity, location: item.location };
      await db.updateInventoryItem(id, updateData);
      await db.createAuditLog({ userId: ctx.user.id, action: "update_inventory", entityType: "inventory", entityId: id, oldValues, newValues: updateData });
      return { success: true };
    }),

    delete: warehouseProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const item = await db.getInventoryItemById(input.id);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود" });
      await db.deleteInventoryItem(input.id);
      await db.createAuditLog({ userId: ctx.user.id, action: "delete_inventory", entityType: "inventory", entityId: input.id, oldValues: { itemName: item.itemName, quantity: item.quantity } });
      return { success: true };
    }),

    addTransaction: protectedProcedure.input(z.object({
      inventoryId: z.number(),
      type: z.enum(["in", "out"]),
      quantity: z.number().min(1),
      reason: z.string().optional(),
      ticketId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      await db.addInventoryTransaction({ ...input, performedById: ctx.user.id });
      return { success: true };
    }),
  }),

  // ============================================================
  // NOTIFICATIONS
  // ============================================================
  notifications: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserNotifications(ctx.user.id);
    }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return db.getUnreadNotificationCount(ctx.user.id);
    }),
    markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      await db.markNotificationRead(input.id, ctx.user.id);
      return { success: true };
    }),
    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  // ============================================================
  // FILE UPLOAD
  // ============================================================
  upload: router({
    getPresignedUrl: protectedProcedure.input(z.object({
      fileName: z.string(),
      contentType: z.string(),
      entityType: z.string(),
      entityId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const fileKey = `cmms/${input.entityType}/${Date.now()}-${nanoid(8)}-${input.fileName}`;
      return { fileKey, uploadUrl: `/api/upload` };
    }),
  }),

  // ============================================================
  // ATTACHMENTS
  // ============================================================
  attachments: router({
    list: protectedProcedure.input(z.object({
      entityType: z.string(),
      entityId: z.number(),
    })).query(async ({ input }) => {
      return db.getAttachments(input.entityType, input.entityId);
    }),

    add: protectedProcedure.input(z.object({
      entityType: z.string(),
      entityId: z.number(),
      fileName: z.string(),
      fileUrl: z.string(),
      fileKey: z.string(),
      mimeType: z.string().optional(),
      fileSize: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const id = await db.createAttachment({
        entityType: input.entityType,
        entityId: input.entityId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileKey: input.fileKey,
        mimeType: input.mimeType || null,
        fileSize: input.fileSize || null,
        uploadedById: ctx.user.id,
      });
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "add_attachment",
        entityType: input.entityType,
        entityId: input.entityId,
        newValues: { fileName: input.fileName, mimeType: input.mimeType },
      });
      return { id };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const attachment = await db.getAttachmentById(input.id);
      if (!attachment) throw new TRPCError({ code: "NOT_FOUND", message: "المرفق غير موجود" });
      // Only owner/admin/manager or the uploader can delete
      const canDelete = ["owner", "admin", "maintenance_manager"].includes(ctx.user.role) || attachment.uploadedById === ctx.user.id;
      if (!canDelete) throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لحذف هذا المرفق" });
      await db.deleteAttachment(input.id);
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "delete_attachment",
        entityType: attachment.entityType,
        entityId: attachment.entityId,
        oldValues: { fileName: attachment.fileName, mimeType: attachment.mimeType },
      });
      return { success: true };
    }),
  }),

  // ============================================================
  // DASHBOARD
  // ============================================================
  dashboard: router({
    stats: protectedProcedure.query(async () => {
      return db.getDashboardStats();
    }),
  }),

  // ============================================================
  // REPORTS
  // ============================================================
  reports: router({
    ticketsByStatus: protectedProcedure.query(async () => {
      const allTickets = await db.getTickets();
      const statusCounts: Record<string, number> = {};
      allTickets.forEach(t => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1; });
      return Object.entries(statusCounts).map(([status, count]) => ({ status, count }));
    }),
    ticketsByCategory: protectedProcedure.query(async () => {
      const allTickets = await db.getTickets();
      const catCounts: Record<string, number> = {};
      allTickets.forEach(t => { catCounts[t.category] = (catCounts[t.category] || 0) + 1; });
      return Object.entries(catCounts).map(([category, count]) => ({ category, count }));
    }),
    ticketsByPriority: protectedProcedure.query(async () => {
      const allTickets = await db.getTickets();
      const priCounts: Record<string, number> = {};
      allTickets.forEach(t => { priCounts[t.priority] = (priCounts[t.priority] || 0) + 1; });
      return Object.entries(priCounts).map(([priority, count]) => ({ priority, count }));
    }),
    costComparison: protectedProcedure.query(async () => {
      const pos = await db.getPurchaseOrders();
      return pos.map(po => ({
        poNumber: po.poNumber,
        estimated: parseFloat(po.totalEstimatedCost || "0"),
        actual: parseFloat(po.totalActualCost || "0"),
      }));
    }),
    monthlySummary: protectedProcedure.query(async () => {
      const allTickets = await db.getTickets();
      const monthly: Record<string, { created: number; closed: number }> = {};
      allTickets.forEach(t => {
        const month = new Date(t.createdAt).toISOString().slice(0, 7);
        if (!monthly[month]) monthly[month] = { created: 0, closed: 0 };
        monthly[month].created++;
        if (t.status === "closed") monthly[month].closed++;
      });
      return Object.entries(monthly).map(([month, data]) => ({ month, ...data })).sort((a, b) => a.month.localeCompare(b.month));
    }),
    technicianPerformance: protectedProcedure.input(z.object({
      period: z.enum(["week", "month", "quarter", "year", "all", "custom"]).default("all"),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      siteId: z.number().optional(),
      sectionId: z.number().optional(),
      technicianName: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const period = input?.period || "all";
      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;

      if (period === "custom" && input?.dateFrom && input?.dateTo) {
        dateFrom = new Date(input.dateFrom);
        dateTo = new Date(input.dateTo);
        dateTo.setHours(23, 59, 59, 999);
      } else if (period !== "all") {
        dateTo = new Date();
        dateFrom = new Date();
        switch (period) {
          case "week":
            dateFrom.setDate(dateFrom.getDate() - 7);
            break;
          case "month":
            dateFrom.setMonth(dateFrom.getMonth() - 1);
            break;
          case "quarter":
            dateFrom.setMonth(dateFrom.getMonth() - 3);
            break;
          case "year":
            dateFrom.setFullYear(dateFrom.getFullYear() - 1);
            break;
        }
      }

      return db.getTechnicianPerformance({
        ...(period !== "all" ? { dateFrom, dateTo } : {}),
        siteId: input?.siteId,
        sectionId: input?.sectionId,
        technicianName: input?.technicianName,
      });
    }),

    externalTechnicianPerformance: protectedProcedure.input(z.object({
      period: z.enum(["week", "month", "quarter", "year", "all", "custom"]).default("all"),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const period = input?.period || "all";
      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;
      if (period === "custom" && input?.dateFrom && input?.dateTo) {
        dateFrom = new Date(input.dateFrom);
        dateTo = new Date(input.dateTo);
        dateTo.setHours(23, 59, 59, 999);
      } else if (period !== "all") {
        dateTo = new Date();
        dateFrom = new Date();
        switch (period) {
          case "week": dateFrom.setDate(dateFrom.getDate() - 7); break;
          case "month": dateFrom.setMonth(dateFrom.getMonth() - 1); break;
          case "quarter": dateFrom.setMonth(dateFrom.getMonth() - 3); break;
          case "year": dateFrom.setFullYear(dateFrom.getFullYear() - 1); break;
        }
      }
      return db.getExternalTechnicianPerformance(period === "all" ? undefined : { dateFrom, dateTo });
    }),

    // ── تقرير دورة الشراء ─────────────────────────────────────────────────────
    purchaseCycleReport: protectedProcedure.input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      poId: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const [allPOs, allUsers, allItems] = await Promise.all([
        db.getPurchaseOrders(),
        db.getAllUsers(),
        db.getAllPOItems(),
      ]);

      let pos = allPOs;
      if (input?.dateFrom) {
        const from = new Date(input.dateFrom);
        pos = pos.filter(p => new Date(p.createdAt) >= from);
      }
      if (input?.dateTo) {
        const to = new Date(input.dateTo);
        to.setHours(23, 59, 59, 999);
        pos = pos.filter(p => new Date(p.createdAt) <= to);
      }
      if (input?.poId) {
        pos = pos.filter(p => p.id === input.poId);
      }

      const msToHours = (ms: number) => Math.round(ms / 3600000 * 10) / 10;

      const result = pos.map(po => {
        const items = allItems.filter(i => i.purchaseOrderId === po.id);
        const requestedBy = allUsers.find(u => u.id === po.requestedById)?.name || "غير معروف";
        const accountingApprovedBy = allUsers.find(u => u.id === po.accountingApprovedById)?.name;
        const managementApprovedBy = allUsers.find(u => u.id === po.managementApprovedById)?.name;

        const t0 = new Date(po.createdAt).getTime();
        const t1 = po.accountingApprovedAt ? new Date(po.accountingApprovedAt).getTime() : null;
        const t2 = po.managementApprovedAt ? new Date(po.managementApprovedAt).getTime() : null;

        const poPhases = [
          { phase: "إنشاء الطلب", startAt: new Date(po.createdAt), endAt: po.accountingApprovedAt ? new Date(po.accountingApprovedAt) : null, durationHours: t1 ? msToHours(t1 - t0) : null, actor: requestedBy, status: "done" },
          { phase: "موافقة الحسابات", startAt: po.accountingApprovedAt ? new Date(po.accountingApprovedAt) : null, endAt: po.managementApprovedAt ? new Date(po.managementApprovedAt) : null, durationHours: t1 && t2 ? msToHours(t2 - t1) : null, actor: accountingApprovedBy || null, status: po.accountingApprovedAt ? "done" : "pending" },
          { phase: "موافقة الإدارة", startAt: po.managementApprovedAt ? new Date(po.managementApprovedAt) : null, endAt: null, durationHours: null, actor: managementApprovedBy || null, status: po.managementApprovedAt ? "done" : "pending" },
        ];

        const itemsReport = items.map(item => {
          const delegate = allUsers.find(u => u.id === item.delegateId)?.name || "غير مُعيَّن";
          const receivedBy = allUsers.find(u => u.id === item.receivedById)?.name;
          const deliveredBy = allUsers.find(u => u.id === item.deliveredById)?.name;
          const purchasedBy = allUsers.find(u => u.id === item.purchasedById)?.name;

          const tCreated = new Date(item.createdAt).getTime();
          const tPurchased = item.purchasedAt ? new Date(item.purchasedAt).getTime() : null;
          const tReceived = item.receivedAt ? new Date(item.receivedAt).getTime() : null;
          const tDelivered = item.deliveredAt ? new Date(item.deliveredAt).getTime() : null;

          const phases = [
            { phase: "انتظار التسعير", startAt: new Date(item.createdAt), endAt: item.estimatedUnitCost ? new Date(item.updatedAt) : null, durationHours: item.estimatedUnitCost && t2 ? msToHours(t2 - tCreated) : null, status: item.estimatedUnitCost ? "done" : "pending" },
            { phase: "اعتماد الشراء", startAt: po.managementApprovedAt ? new Date(po.managementApprovedAt) : null, endAt: item.purchasedAt ? new Date(item.purchasedAt) : null, durationHours: t2 && tPurchased ? msToHours(tPurchased - t2) : null, status: item.purchasedAt ? "done" : (po.managementApprovedAt ? "in_progress" : "pending") },
            { phase: "شراء المندوب", startAt: item.purchasedAt ? new Date(item.purchasedAt) : null, endAt: item.receivedAt ? new Date(item.receivedAt) : null, durationHours: tPurchased && tReceived ? msToHours(tReceived - tPurchased) : null, actor: purchasedBy || delegate, status: item.purchasedAt ? "done" : "pending" },
            { phase: "استلام المستودع", startAt: item.receivedAt ? new Date(item.receivedAt) : null, endAt: item.deliveredAt ? new Date(item.deliveredAt) : null, durationHours: tReceived && tDelivered ? msToHours(tDelivered - tReceived) : null, actor: receivedBy || null, status: item.receivedAt ? "done" : "pending" },
            { phase: "تسليم للفني", startAt: item.deliveredAt ? new Date(item.deliveredAt) : null, endAt: null, durationHours: null, actor: deliveredBy || null, status: item.deliveredAt ? "done" : "pending" },
          ];

          const totalHours = tDelivered ? msToHours(tDelivered - tCreated) : null;

          return {
            itemId: item.id, itemName: item.itemName, quantity: item.quantity, unit: item.unit,
            delegate, estimatedCost: item.estimatedTotalCost ? parseFloat(item.estimatedTotalCost) : null,
            actualCost: item.actualTotalCost ? parseFloat(item.actualTotalCost) : null,
            currentStatus: item.status, totalHours, phases,
          };
        });

        const completedItems = itemsReport.filter(i => i.totalHours !== null);
        const totalPOHours = completedItems.length > 0
          ? Math.round(completedItems.reduce((s, i) => s + (i.totalHours || 0), 0) / completedItems.length * 10) / 10
          : null;

        return {
          poId: po.id, poNumber: po.poNumber, status: po.status, requestedBy,
          createdAt: new Date(po.createdAt), ticketId: po.ticketId,
          custodyAmount: po.custodyAmount ? parseFloat(po.custodyAmount) : null,
          poPhases, items: itemsReport, totalPOHours, itemCount: items.length,
        };
      });

      const completedPOs = result.filter(r => r.totalPOHours !== null);
      const avgTotalHours = completedPOs.length > 0
        ? Math.round(completedPOs.reduce((s, r) => s + (r.totalPOHours || 0), 0) / completedPOs.length * 10) / 10
        : null;

      const phaseNames = ["انتظار التسعير", "اعتماد الشراء", "شراء المندوب", "استلام المستودع", "تسليم للفني"];
      const phaseAvgs = phaseNames.map(phaseName => {
        const durations: number[] = result.flatMap(r => r.items.flatMap(i => i.phases.filter(p => p.phase === phaseName && p.durationHours !== null).map(p => p.durationHours as number)));
        return { phase: phaseName, avgHours: durations.length > 0 ? Math.round(durations.reduce((s: number, d: number) => s + d, 0) / durations.length * 10) / 10 : null, count: durations.length };
      });

      return { pos: result, avgTotalHours, phaseAvgs, total: result.length };
    }),

    // ── تقرير دورة الصيانة ────────────────────────────────────────────────────
    maintenanceCycleReport: protectedProcedure.input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      ticketId: z.number().optional(),
      status: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const [allTickets, allUsers, allSites] = await Promise.all([
        db.getTickets(),
        db.getAllUsers(),
        db.getAllSites(),
      ]);

      let tickets = allTickets;
      if (input?.dateFrom) { const from = new Date(input.dateFrom); tickets = tickets.filter(t => new Date(t.createdAt) >= from); }
      if (input?.dateTo) { const to = new Date(input.dateTo); to.setHours(23, 59, 59, 999); tickets = tickets.filter(t => new Date(t.createdAt) <= to); }
      if (input?.ticketId) { tickets = tickets.filter(t => t.id === input.ticketId); }
      if (input?.status) { tickets = tickets.filter(t => t.status === input.status); }

      const msToHours = (ms: number) => Math.round(ms / 3600000 * 10) / 10;

      const STAGE_LABELS: Record<string, string> = {
        "new": "إنشاء البلاغ", "pending_triage": "انتظار الفرز", "under_inspection": "قيد الفحص",
        "work_approved": "موافقة على العمل", "approved": "موافقة الإدارة", "assigned": "تعيين فني",
        "in_progress": "قيد التنفيذ", "needs_purchase": "يحتاج شراء", "purchase_pending_estimate": "انتظار تسعير",
        "purchase_pending_accounting": "انتظار الحسابات", "purchase_pending_management": "انتظار الإدارة",
        "purchase_approved": "شراء معتمد", "partial_purchase": "شراء جزئي", "purchased": "تم الشراء",
        "received_warehouse": "استلام مستودع", "repaired": "تم الإصلاح", "verified": "تم التحقق",
        "ready_for_closure": "جاهز للإغلاق", "out_for_repair": "خارج للإصلاح", "closed": "مغلق",
      };

      const ticketHistories = await Promise.all(tickets.map(t => db.getTicketHistory(t.id).then(h => ({ ticketId: t.id, history: h }))));
      const historyMap = new Map(ticketHistories.map(th => [th.ticketId, th.history]));

      const result = tickets.map(ticket => {
        const history = historyMap.get(ticket.id) || [];
        const sortedHistory = [...history].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        const reportedBy = allUsers.find(u => u.id === ticket.reportedById)?.name || "غير معروف";
        const assignedTo = allUsers.find(u => u.id === ticket.assignedToId)?.name || "غير مسند";
        const site = allSites.find(s => s.id === ticket.siteId)?.name || "";

        const phases: Array<{ fromStatus: string; toStatus: string; label: string; startAt: Date; endAt: Date | null; durationHours: number | null; changedBy: string }> = [];

        for (let i = 0; i < sortedHistory.length; i++) {
          const entry = sortedHistory[i];
          const nextEntry = sortedHistory[i + 1];
          const startAt = new Date(entry.createdAt);
          const endAt = nextEntry ? new Date(nextEntry.createdAt) : (ticket.closedAt ? new Date(ticket.closedAt) : null);
          const durationHours = endAt ? msToHours(endAt.getTime() - startAt.getTime()) : null;
          phases.push({
            fromStatus: entry.fromStatus || "",
            toStatus: entry.toStatus,
            label: STAGE_LABELS[entry.toStatus] || entry.toStatus,
            startAt, endAt, durationHours,
            changedBy: allUsers.find(u => u.id === entry.changedById)?.name || "النظام",
          });
        }

        const createdAt = new Date(ticket.createdAt);
        const endTime = ticket.closedAt ? new Date(ticket.closedAt) : new Date();
        const totalHours = msToHours(endTime.getTime() - createdAt.getTime());
        const totalDays = Math.round(totalHours / 24 * 10) / 10;

        const maxPhase = phases.reduce((max, p) => {
          if (p.durationHours !== null && (max === null || p.durationHours > (max.durationHours || 0))) return p;
          return max;
        }, null as typeof phases[0] | null);

        return {
          ticketId: ticket.id, ticketNumber: ticket.ticketNumber, title: ticket.title,
          status: ticket.status, priority: ticket.priority, category: ticket.category,
          site, reportedBy, assignedTo, maintenancePath: ticket.maintenancePath,
          createdAt: new Date(ticket.createdAt), closedAt: ticket.closedAt ? new Date(ticket.closedAt) : null,
          totalHours, totalDays, phases,
          bottleneck: maxPhase ? { phase: maxPhase.label, hours: maxPhase.durationHours } : null,
          isClosed: ticket.status === "closed",
        };
      });

      const closedTickets = result.filter(r => r.isClosed);
      const avgTotalHours = closedTickets.length > 0
        ? Math.round(closedTickets.reduce((s, r) => s + r.totalHours, 0) / closedTickets.length * 10) / 10
        : null;

      const allPhaseLabelsSet = new Set(result.flatMap(r => r.phases.map(p => p.label)));
      const allPhaseLabels = Array.from(allPhaseLabelsSet);
      const phaseAvgs = allPhaseLabels.map(label => {
        const durations: number[] = result.flatMap(r => r.phases.filter(p => p.label === label && p.durationHours !== null).map(p => p.durationHours as number));
        return { phase: label, avgHours: durations.length > 0 ? Math.round(durations.reduce((s: number, d: number) => s + d, 0) / durations.length * 10) / 10 : null, count: durations.length };
      }).filter(p => p.avgHours !== null).sort((a, b) => (b.avgHours || 0) - (a.avgHours || 0));

      return { tickets: result, avgTotalHours, avgTotalDays: avgTotalHours ? Math.round(avgTotalHours / 24 * 10) / 10 : null, phaseAvgs, total: result.length, closedCount: closedTickets.length };
    }),

    sectionReport: protectedProcedure.input(z.object({
      siteId: z.number().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const allSections = await db.getSections();
      const allTickets = await db.getTickets({});
      const allAssets = await db.listAssets({});
      const allPMWorkOrders = await db.listPMWorkOrders();
      const dateFrom = input?.dateFrom ? new Date(input.dateFrom) : null;
      const dateTo = input?.dateTo ? new Date(input.dateTo) : null;

      const filteredTickets = allTickets.filter((t: any) => {
        if (input?.siteId && t.siteId !== input.siteId) return false;
        if (dateFrom && new Date(t.createdAt) < dateFrom) return false;
        if (dateTo && new Date(t.createdAt) > dateTo) return false;
        return true;
      });

      // فلترة أوامر العمل الوقائية حسب التاريخ
      const filteredPMWOs = allPMWorkOrders.filter((wo: any) => {
        if (dateFrom && new Date(wo.scheduledDate) < dateFrom) return false;
        if (dateTo && new Date(wo.scheduledDate) > dateTo) return false;
        return true;
      });

      // بناء خريطة assetId → sectionId من الأصول
      const assetSectionMap = new Map<number, number | null>();
      allAssets.forEach((a: any) => assetSectionMap.set(a.id, a.sectionId ?? null));

      const sectionStats = allSections
        .filter((s: any) => !input?.siteId || s.siteId === input.siteId)
        .map((section: any) => {
          const sectionTickets = filteredTickets.filter((t: any) => t.sectionId === section.id);
          const sectionAssets = allAssets.filter((a: any) => a.sectionId === section.id);
          const openTickets = sectionTickets.filter((t: any) => t.status !== "closed").length;
          const closedTickets = sectionTickets.filter((t: any) => t.status === "closed").length;
          const urgentTickets = sectionTickets.filter((t: any) => t.priority === "critical" || t.priority === "high").length;
          const maintenanceCost = sectionTickets.reduce((sum: number, t: any) => {
            return sum + (parseFloat(t.estimatedCost || "0") || 0);
          }, 0);
          const avgCloseTime = (() => {
            const closed = sectionTickets.filter((t: any) => t.status === "closed" && t.closedAt && t.createdAt);
            if (!closed.length) return null;
            const totalHours = closed.reduce((sum: number, t: any) => {
              return sum + (new Date(t.closedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
            }, 0);
            return Math.round(totalHours / closed.length * 10) / 10;
          })();

          // عدد أوامر العمل الوقائية لهذا القسم
          // أولاً: من pmWorkOrders.siteId مباشرةً (plan مرتبط بالموقع)
          // ثانياً: من assetId → sectionId عبر خريطة الأصول
          const sectionPMWOs = filteredPMWOs.filter((wo: any) => {
            // مطابقة مباشرة عبر siteId إذا كان القسم مرتبط بالموقع
            if (wo.assetId && assetSectionMap.get(wo.assetId) === section.id) return true;
            return false;
          });
          const preventiveCount = sectionPMWOs.length;
          const preventiveCompleted = sectionPMWOs.filter((wo: any) => wo.status === "completed").length;

          return {
            sectionId: section.id, sectionName: section.name, siteId: section.siteId,
            totalTickets: sectionTickets.length, openTickets, closedTickets, urgentTickets,
            totalAssets: sectionAssets.length, maintenanceCost: Math.round(maintenanceCost * 100) / 100,
            avgCloseTimeHours: avgCloseTime,
            preventiveCount,
            preventiveCompleted,
            emergencyCount: sectionTickets.length, // البلاغات هي الصيانة الطارئة
          };
        })
        .sort((a: any, b: any) => b.totalTickets - a.totalTickets);
      const unassigned = filteredTickets.filter((t: any) => !t.sectionId);
      return { sections: sectionStats, unassignedTickets: unassigned.length, totalTickets: filteredTickets.length };
    }),

    // تقرير التكاليف البصري: حسب القسم والموقع مع فلاتر زمنية
    costReport: protectedProcedure.input(z.object({
      groupBy: z.enum(["section", "site"]).default("site"),
      period: z.enum(["month", "quarter", "year", "all", "custom"]).default("all"),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const groupBy = input?.groupBy ?? "site";
      const period = input?.period ?? "all";
      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;
      if (period === "custom" && input?.dateFrom && input?.dateTo) {
        dateFrom = new Date(input.dateFrom);
        dateTo = new Date(input.dateTo);
        dateTo.setHours(23, 59, 59, 999);
      } else if (period !== "all") {
        dateTo = new Date();
        dateFrom = new Date();
        if (period === "month") dateFrom.setMonth(dateFrom.getMonth() - 1);
        else if (period === "quarter") dateFrom.setMonth(dateFrom.getMonth() - 3);
        else if (period === "year") dateFrom.setFullYear(dateFrom.getFullYear() - 1);
      }
      // جلب البيانات: البلاغات + أصناف الشراء المستلمة (المصدر الموحد) + المواقع + الأقسام
      const [allTickets, allSites, allSections, allPOs, allPOItems] = await Promise.all([
        db.getTickets({}),
        db.getAllSites(),
        db.getSections(),
        db.getPurchaseOrders(),
        db.getAllPOItems(),
      ]);
      // فلترة البلاغات حسب التاريخ
      const filteredTickets = allTickets.filter((t: any) => {
        if (dateFrom && new Date(t.createdAt) < dateFrom) return false;
        if (dateTo && new Date(t.createdAt) > dateTo) return false;
        return true;
      });
      // أصناف الشراء المستلمة فعلياً (delivered_to_warehouse أو delivered_to_requester)
      // هذا المصدر يطابق بطاقة لوحة التحكم تماماً
      const deliveredItems = allPOItems.filter((item: any) => {
        if (item.status !== "delivered_to_warehouse" && item.status !== "delivered_to_requester") return false;
        const dateRef = item.deliveredAt || item.receivedAt || item.createdAt;
        if (dateFrom && new Date(dateRef) < dateFrom) return false;
        if (dateTo && new Date(dateRef) > dateTo) return false;
        return true;
      });
      // بناء خريطة purchaseOrderId → siteId/sectionId من جدول purchaseOrders
      const poMap = new Map<number, { siteId: number | null; sectionId: number | null }>();
      allPOs.forEach((po: any) => poMap.set(po.id, { siteId: po.siteId ?? null, sectionId: po.sectionId ?? null }));
      // الاتجاه الشهري (آخر 12 شهر) - يستخدم المصدر الموحد
      const monthlyTrend: { month: string; label: string; ticketCost: number; purchaseCost: number; total: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const monthKey = d.toISOString().slice(0, 7);
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        const ticketCost = allTickets
          .filter((t: any) => { const c = new Date(t.createdAt); return c >= monthStart && c <= monthEnd; })
          .reduce((sum: number, t: any) => sum + parseFloat(t.actualCost || t.estimatedCost || "0"), 0);
        const purchaseCost = allPOItems
          .filter((item: any) => {
            if (item.status !== "delivered_to_warehouse" && item.status !== "delivered_to_requester") return false;
            const dateRef = item.deliveredAt || item.receivedAt || item.createdAt;
            const c = new Date(dateRef);
            return c >= monthStart && c <= monthEnd;
          })
          .reduce((sum: number, item: any) => sum + parseFloat(item.actualTotalCost || item.estimatedTotalCost || "0"), 0);
        monthlyTrend.push({ month: monthKey, label, ticketCost: Math.round(ticketCost * 100) / 100, purchaseCost: Math.round(purchaseCost * 100) / 100, total: Math.round((ticketCost + purchaseCost) * 100) / 100 });
      }
      type GroupItem = { id: number; name: string; siteName?: string; ticketCost: number; purchaseCost: number; totalCost: number; ticketCount: number; ticketsNoCost: number; percentage: number; isUnclassified?: boolean };
      let groups: GroupItem[] = [];
      if (groupBy === "site") {
        groups = allSites.map((site: any) => {
          const siteTickets = filteredTickets.filter((t: any) => t.siteId === site.id);
          const siteItems = deliveredItems.filter((item: any) => poMap.get(item.purchaseOrderId)?.siteId === site.id);
          const ticketCost = siteTickets.reduce((sum: number, t: any) => sum + parseFloat(t.actualCost || t.estimatedCost || "0"), 0);
          const purchaseCost = siteItems.reduce((sum: number, item: any) => sum + parseFloat(item.actualTotalCost || item.estimatedTotalCost || "0"), 0);
          const ticketsNoCost = siteTickets.filter((t: any) => !t.actualCost && !t.estimatedCost).length;
          return { id: site.id, name: site.name, ticketCost: Math.round(ticketCost * 100) / 100, purchaseCost: Math.round(purchaseCost * 100) / 100, totalCost: Math.round((ticketCost + purchaseCost) * 100) / 100, ticketCount: siteTickets.length, ticketsNoCost, percentage: 0 };
        });
        // التكاليف غير المرتبطة بأي موقع
        const unclassifiedTickets = filteredTickets.filter((t: any) => !t.siteId);
        const unclassifiedItems = deliveredItems.filter((item: any) => !poMap.get(item.purchaseOrderId)?.siteId);
        const unclassifiedTicketCost = unclassifiedTickets.reduce((sum: number, t: any) => sum + parseFloat(t.actualCost || t.estimatedCost || "0"), 0);
        const unclassifiedPurchaseCost = unclassifiedItems.reduce((sum: number, item: any) => sum + parseFloat(item.actualTotalCost || item.estimatedTotalCost || "0"), 0);
        const unclassifiedTotal = unclassifiedTicketCost + unclassifiedPurchaseCost;
        if (unclassifiedTotal > 0 || unclassifiedTickets.length > 0) {
          groups.push({ id: -1, name: "غير محدد", ticketCost: Math.round(unclassifiedTicketCost * 100) / 100, purchaseCost: Math.round(unclassifiedPurchaseCost * 100) / 100, totalCost: Math.round(unclassifiedTotal * 100) / 100, ticketCount: unclassifiedTickets.length, ticketsNoCost: unclassifiedTickets.filter((t: any) => !t.actualCost && !t.estimatedCost).length, percentage: 0, isUnclassified: true });
        }
      } else {
        groups = allSections.map((section: any) => {
          const secTickets = filteredTickets.filter((t: any) => t.sectionId === section.id);
          const secItems = deliveredItems.filter((item: any) => poMap.get(item.purchaseOrderId)?.sectionId === section.id);
          const ticketCost = secTickets.reduce((sum: number, t: any) => sum + parseFloat(t.actualCost || t.estimatedCost || "0"), 0);
          const purchaseCost = secItems.reduce((sum: number, item: any) => sum + parseFloat(item.actualTotalCost || item.estimatedTotalCost || "0"), 0);
          const siteName = allSites.find((s: any) => s.id === section.siteId)?.name ?? "";
          const ticketsNoCost = secTickets.filter((t: any) => !t.actualCost && !t.estimatedCost).length;
          return { id: section.id, name: section.name, siteName, ticketCost: Math.round(ticketCost * 100) / 100, purchaseCost: Math.round(purchaseCost * 100) / 100, totalCost: Math.round((ticketCost + purchaseCost) * 100) / 100, ticketCount: secTickets.length, ticketsNoCost, percentage: 0 };
        });
        // التكاليف غير المرتبطة بأي قسم
        const unclassifiedTickets = filteredTickets.filter((t: any) => !t.sectionId);
        const unclassifiedItems = deliveredItems.filter((item: any) => !poMap.get(item.purchaseOrderId)?.sectionId);
        const unclassifiedTicketCost = unclassifiedTickets.reduce((sum: number, t: any) => sum + parseFloat(t.actualCost || t.estimatedCost || "0"), 0);
        const unclassifiedPurchaseCost = unclassifiedItems.reduce((sum: number, item: any) => sum + parseFloat(item.actualTotalCost || item.estimatedTotalCost || "0"), 0);
        const unclassifiedTotal = unclassifiedTicketCost + unclassifiedPurchaseCost;
        if (unclassifiedTotal > 0 || unclassifiedTickets.length > 0) {
          groups.push({ id: -1, name: "غير محدد", ticketCost: Math.round(unclassifiedTicketCost * 100) / 100, purchaseCost: Math.round(unclassifiedPurchaseCost * 100) / 100, totalCost: Math.round(unclassifiedTotal * 100) / 100, ticketCount: unclassifiedTickets.length, ticketsNoCost: unclassifiedTickets.filter((t: any) => !t.actualCost && !t.estimatedCost).length, percentage: 0, isUnclassified: true });
        }
      }
      groups = groups.sort((a, b) => b.totalCost - a.totalCost);
      const grandTotal = groups.reduce((sum, g) => sum + g.totalCost, 0);
      groups = groups.map(g => ({ ...g, percentage: grandTotal > 0 ? Math.round((g.totalCost / grandTotal) * 1000) / 10 : 0 }));
      const totalTicketsNoCost = filteredTickets.filter((t: any) => !t.actualCost && !t.estimatedCost).length;
      return { groups, grandTotal: Math.round(grandTotal * 100) / 100, monthlyTrend, groupBy, totalTicketsNoCost };
    }),
  }),

  // ============================================================
  // AI INSIGHTS
  // ============================================================
  ai: router({
    analyze: protectedProcedure.input(z.object({
      question: z.string(),
      conversationHistory: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })).optional(),
    })).mutation(async ({ input, ctx }) => {
      // جمع بيانات شاملة من قاعدة البيانات
      const [tickets, pos, inventoryItems, allUsers, allSites, stats, recentAudit] = await Promise.all([
        db.getTickets(),
        db.getPurchaseOrders(),
        db.getInventoryItems(),
        db.getAllUsers(),
        db.getAllSites(),
        db.getDashboardStats(),
        db.getAuditLogsEnhanced({ limit: 50 }),
      ]);

      // تحليل البلاغات
      const ticketsByStatus = tickets.reduce((acc: any, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
      const ticketsByPriority = tickets.reduce((acc: any, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {});
      const ticketsByCategory = tickets.reduce((acc: any, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc; }, {});
      const ticketsBySite = tickets.reduce((acc: any, t) => { const site = allSites.find(s => s.id === t.siteId); acc[site?.name || `موقع #${t.siteId}`] = (acc[site?.name || `موقع #${t.siteId}`] || 0) + 1; return acc; }, {});

      // تحليل طلبات الشراء
      const posByStatus = pos.reduce((acc: any, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc; }, {});
      const totalPOCost = pos.reduce((sum, p) => sum + parseFloat(p.totalEstimatedCost || "0"), 0);
      const totalActualCost = pos.reduce((sum, p) => sum + parseFloat(p.totalActualCost || "0"), 0);

      // تحليل المخزون
      const lowStockItems = inventoryItems.filter((i: any) => i.quantity <= i.minQuantity);

      // تفاصيل البلاغات (آخر 20)
      const recentTickets = tickets.slice(0, 20).map(t => ({
        id: t.id, ticketNumber: t.ticketNumber, title: t.title, description: t.description,
        status: t.status, priority: t.priority, category: t.category,
        assignedTo: allUsers.find(u => u.id === t.assignedToId)?.name || "غير مسند",
        reportedBy: allUsers.find(u => u.id === t.reportedById)?.name || "غير معروف",
        site: allSites.find(s => s.id === t.siteId)?.name || "",
        createdAt: new Date(t.createdAt).toLocaleDateString("ar-SA"),
      }));

      // تفاصيل طلبات الشراء (آخر 20)
      const recentPOs = pos.slice(0, 20).map(p => ({
        id: p.id, poNumber: p.poNumber, status: p.status,
        estimatedCost: p.totalEstimatedCost, actualCost: p.totalActualCost,
        requestedBy: allUsers.find(u => u.id === p.requestedById)?.name || "",
        createdAt: new Date(p.createdAt).toLocaleDateString("ar-SA"),
      }));

      const dbContext = `
=== بيانات نظام إدارة الصيانة (CMMS) - محدثة الآن ===

ـــ إحصائيات عامة ـــ
• إجمالي البلاغات: ${tickets.length}
• البلاغات المفتوحة: ${stats?.openTickets || 0}
• المغلقة اليوم: ${stats?.closedToday || 0}
• الحرجة: ${stats?.criticalTickets || 0}
• طلبات شراء بانتظار الاعتماد: ${stats?.pendingApprovals || 0}
• إجمالي تكلفة الصيانة: ${stats?.totalMaintenanceCost || 0} ر.س

ـــ توزيع البلاغات ـــ
حسب الحالة: ${JSON.stringify(ticketsByStatus)}
حسب الأولوية: ${JSON.stringify(ticketsByPriority)}
حسب الفئة: ${JSON.stringify(ticketsByCategory)}
حسب الموقع: ${JSON.stringify(ticketsBySite)}

ـــ طلبات الشراء ـــ
إجمالي طلبات الشراء: ${pos.length}
حسب الحالة: ${JSON.stringify(posByStatus)}
إجمالي التكلفة المقدرة: ${totalPOCost.toFixed(2)} ر.س
إجمالي التكلفة الفعلية: ${totalActualCost.toFixed(2)} ر.س

ـــ المخزون ـــ
إجمالي الأصناف: ${inventoryItems.length}
أصناف منخفضة المخزون: ${lowStockItems.length}
${lowStockItems.length > 0 ? `الأصناف المنخفضة: ${lowStockItems.map((i: any) => `${i.itemName} (الكمية: ${i.quantity}, الحد الأدنى: ${i.minQuantity})`).join(" | ")}` : ""}
قائمة المخزون: ${JSON.stringify(inventoryItems.map((i: any) => ({ name: i.itemName, qty: i.quantity, min: i.minQuantity, unit: i.unit, location: i.location })))}

ـــ المستخدمون ـــ
إجمالي: ${allUsers.length}
القائمة: ${allUsers.map(u => `${u.name} (الدور: ${u.role}, القسم: ${u.department || "-"})`).join(" | ")}

ـــ المواقع ـــ
${allSites.map(s => `${s.name}: ${s.address || "-"}`).join(" | ")}

ـــ آخر 20 بلاغ ـــ
${JSON.stringify(recentTickets, null, 0)}

ـــ آخر 20 طلب شراء ـــ
${JSON.stringify(recentPOs, null, 0)}

ـــ آخر 50 عملية تدقيق ـــ
${JSON.stringify(recentAudit.map((a: any) => ({ action: a.action, entity: a.entityType, id: a.entityId, desc: a.description, date: new Date(a.createdAt).toLocaleDateString("ar-SA") })), null, 0)}
`;

      const systemPrompt = `أنت "مساعد الصيانة الذكي" - مساعد AI متخصص في نظام إدارة الصيانة المتكامل (CMMS).

قواعدك الأساسية:
1. أجب بنفس لغة المستخدم تماماً:
   - إذا كتب بالعربية الفصحى → أجب بالفصحى
   - إذا كتب باللهجة السعودية (مثل: "وش البلاغات اليوم؟", "كم عندنا طلب شراء؟", "وشلون المخزون؟", "ايش السالفة؟", "وين المشكلة؟") → أجب باللهجة السعودية
   - إذا كتب باللهجة المصرية (مثل: "ايه البلاغات دي؟", "عايز اعرف", "فين المشكلة؟") → أجب باللهجة المصرية
   - If user writes in English → Reply in English
   - اگر صارف اردو میں لکھے → اردو میں جواب دیں

2. لديك وصول كامل لقاعدة بيانات النظام. استخدم البيانات المرفقة للإجابة بدقة.

3. يمكنك الإجابة عن:
   - البلاغات: عددها، حالاتها، أولوياتها، فئاتها، من أنشأها، من مسند إليه، الموقع، التاريخ
   - طلبات الشراء: عددها، حالاتها، تكاليفها، من طلبها
   - المخزون: الأصناف، الكميات، الأصناف المنخفضة
   - المستخدمين: أسماؤهم، أدوارهم، أقسامهم
   - المواقع: أسماؤها، عناوينها
   - سجل التدقيق: آخر العمليات
   - التكاليف والإحصائيات المالية
   - تحليل الأداء والتوصيات
   - خطط الصيانة الوقائية

4. كن مفيداً وعملياً. استخدم الأرقام الفعلية من البيانات. لا تخترع بيانات.

5. استخدم تنسيق Markdown للردود (عناوين، جداول، قوائم) لتكون واضحة ومنظمة.

6. إذا سأل المستخدم عن شيء غير موجود في البيانات، أخبره بذلك بوضوح.

7. المستخدم الحالي: ${ctx.user?.name || "غير معروف"} (الدور: ${ctx.user?.role || "غير محدد"})`;

      // بناء سجل المحادثة
      const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `هذه بيانات النظام المحدثة:\n${dbContext}` },
        { role: "assistant", content: "تم تحميل بيانات النظام بنجاح. أنا جاهز للإجابة على أي سؤال." },
      ];

      // إضافة سجل المحادثة السابق
      if (input.conversationHistory?.length) {
        for (const msg of input.conversationHistory) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      // إضافة السؤال الحالي
      messages.push({ role: "user", content: input.question });

      const response = await invokeLLM({ messages });
      return { answer: response.choices[0]?.message?.content || "لم أتمكن من الإجابة" };
    }),
  }),

  // ============================================================
  // DATABASE BACKUPS
  // ============================================================
  backups: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!["owner", "admin"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية" });
      return db.getBackups();
    }),

    create: protectedProcedure.input(z.object({
      description: z.string().optional(),
    }).optional()).mutation(async ({ input, ctx }) => {
      if (!["owner", "admin"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية" });
      
      // Export all data
      const exportResult = await db.exportAllTablesData();
      if (!exportResult) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل تصدير البيانات" });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupName = `backup-${timestamp}`;
      const jsonData = JSON.stringify(exportResult.data, null, 2);
      const buffer = Buffer.from(jsonData, "utf-8");
      
      // Upload to S3
      const fileKey = `cmms/backups/${backupName}.json`;
      const { url } = await storagePut(fileKey, buffer, "application/json");

      // Save backup record
      const id = await db.createBackup({
        name: backupName,
        description: input?.description || `نسخة احتياطية - ${new Date().toLocaleDateString("ar-SA")}`,
        fileUrl: url,
        fileKey,
        fileSize: buffer.length,
        tablesCount: exportResult.tablesCount,
        recordsCount: exportResult.recordsCount,
        createdById: ctx.user.id,
      });

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "create_backup",
        entityType: "backup",
        entityId: id!,
        newValues: { name: backupName, tablesCount: exportResult.tablesCount, recordsCount: exportResult.recordsCount },
      });

      return { id, name: backupName, tablesCount: exportResult.tablesCount, recordsCount: exportResult.recordsCount, fileUrl: url };
    }),

    restore: protectedProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input, ctx }) => {
      if (!["owner", "admin"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية" });
      
      const backup = await db.getBackupById(input.id);
      if (!backup) throw new TRPCError({ code: "NOT_FOUND", message: "النسخة الاحتياطية غير موجودة" });

      // Download backup file
      const response = await fetch(backup.fileUrl);
      if (!response.ok) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل تحميل ملف النسخة الاحتياطية" });
      const backupData = await response.json();

      // Restore data
      await db.restoreFromBackup(backupData);

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "restore_backup",
        entityType: "backup",
        entityId: input.id,
        newValues: { name: backup.name, restoredAt: new Date().toISOString() },
      });

      return { success: true, name: backup.name };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      if (!["owner", "admin"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية" });
      const backup = await db.getBackupById(input.id);
      if (!backup) throw new TRPCError({ code: "NOT_FOUND", message: "النسخة الاحتياطية غير موجودة" });
      await db.deleteBackup(input.id);
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "delete_backup",
        entityType: "backup",
        entityId: input.id,
        oldValues: { name: backup.name },
      });
      return { success: true };
    }),
  }),

  // ============================================================
  // AUDIT LOGS
  // ============================================================
  audit: router({
    list: protectedProcedure.input(z.object({
      entityType: z.string().optional(),
      entityId: z.number().optional(),
      userId: z.number().optional(),
      action: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      const filters: any = {};
      if (input?.entityType) filters.entityType = input.entityType;
      if (input?.entityId) filters.entityId = input.entityId;
      if (input?.userId) filters.userId = input.userId;
      if (input?.action) filters.action = input.action;
      if (input?.dateFrom) filters.dateFrom = new Date(input.dateFrom);
      if (input?.dateTo) { const d = new Date(input.dateTo); d.setHours(23, 59, 59, 999); filters.dateTo = d; }
      if (input?.limit) filters.limit = input.limit;
      return db.getAuditLogsEnhanced(filters);
    }),
  }),

   // ============================================================
  // TRANSLATION ENGINE
  // ============================================================
  translation: translationRouter,

  // ============================================================
  // ASSETS - إدارة الأصول
  // ============================================================
  assets: router({
    list: protectedProcedure.input(z.object({
      siteId: z.number().optional(),
      sectionId: z.number().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listAssets(input ?? {});
    }),

    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const asset = await db.getAssetById(input.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "الأصل غير موجود" });
      return asset;
    }),

    create: managerProcedure.input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      category: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      serialNumber: z.string().optional(),
      siteId: z.number().optional(),
      sectionId: z.number().optional(),
      locationDetail: z.string().optional(),
      status: z.enum(["active", "inactive", "under_maintenance", "disposed"]).optional(),
      purchaseDate: z.string().optional(),
      purchaseCost: z.string().optional(),
      warrantyExpiry: z.string().optional(),
      warrantyNotes: z.string().optional(),
      photoUrl: z.string().optional(),
      notes: z.string().optional(),
      rfidTag: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const assetNumber = await db.generateAssetNumber();
      // Auto-translate description and notes
      let assetTranslation: Record<string, any> = {};
      const fieldsToTranslate: Record<string, string> = {};
      if (input.description) fieldsToTranslate.description = input.description;
      if (input.notes) fieldsToTranslate.notes = input.notes;
      if (Object.keys(fieldsToTranslate).length > 0) {
        try {
          const lang = await detectLanguage(Object.values(fieldsToTranslate)[0]);
          const translations = await translateFields(fieldsToTranslate, lang);
          if (translations.description) {
            assetTranslation.description_ar = translations.description.ar;
            assetTranslation.description_en = translations.description.en;
            assetTranslation.description_ur = translations.description.ur;
          }
          if (translations.notes) {
            assetTranslation.notes_ar = translations.notes.ar;
            assetTranslation.notes_en = translations.notes.en;
            assetTranslation.notes_ur = translations.notes.ur;
          }
          assetTranslation.originalLanguage = lang;
        } catch (e) {
          console.error("[Asset] Translation failed:", e);
        }
      }
      const result = await db.createAsset({
        ...input,
        ...assetTranslation,
        assetNumber,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : undefined,
        warrantyExpiry: input.warrantyExpiry ? new Date(input.warrantyExpiry) : undefined,
        status: input.status ?? "active",
        createdById: ctx.user.id,
      });
      return result;
    }),

    update: managerProcedure.input(z.object({
      id: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      brand: z.string().optional(),
      model: z.string().optional(),
      serialNumber: z.string().optional(),
      siteId: z.number().optional(),
      sectionId: z.number().optional(),
      locationDetail: z.string().optional(),
      status: z.enum(["active", "inactive", "under_maintenance", "disposed"]).optional(),
      purchaseDate: z.string().optional(),
      purchaseCost: z.string().optional(),
      warrantyExpiry: z.string().optional(),
      warrantyNotes: z.string().optional(),
      photoUrl: z.string().optional(),
      notes: z.string().optional(),
      rfidTag: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      // Auto-translate updated text fields to all 3 languages
      let assetTranslation: Record<string, any> = {};
      const assetFieldsToTranslate: Record<string, string> = {};
      if (data.description) assetFieldsToTranslate.description = data.description;
      if (data.notes) assetFieldsToTranslate.notes = data.notes;
      if (Object.keys(assetFieldsToTranslate).length > 0) {
        try {
          const textForDetection = Object.values(assetFieldsToTranslate)[0];
          const detectedLang = await detectLanguage(textForDetection) as SupportedLanguage;
          const translations = await translateFields(assetFieldsToTranslate, detectedLang);
          if (translations.description) {
            assetTranslation.description_ar = translations.description.ar;
            assetTranslation.description_en = translations.description.en;
            assetTranslation.description_ur = translations.description.ur;
          }
          if (translations.notes) {
            assetTranslation.notes_ar = translations.notes.ar;
            assetTranslation.notes_en = translations.notes.en;
            assetTranslation.notes_ur = translations.notes.ur;
          }
        } catch (e) {
          console.error("[Asset] Update translation failed:", e);
        }
      }
      return db.updateAsset(id, {
        ...data,
        ...assetTranslation,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : undefined,
      });
    }),

    delete: managerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      return db.deleteAsset(input.id);
    }),

    // ============================================================
    // RFID - تقنية تحديد الموقع بالترددات الراديوية
    // ============================================================
    getByRfid: protectedProcedure.input(z.object({
      rfidTag: z.string().min(1),
    })).query(async ({ input }) => {
      const asset = await db.getAssetByRfidTag(input.rfidTag);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "الأصل بهذا الـ RFID غير موجود" });
      return asset;
    }),

    updateRfid: managerProcedure.input(z.object({
      id: z.number(),
      rfidTag: z.string().min(1),
    })).mutation(async ({ input }) => {
      return db.updateAssetRfidTag(input.id, input.rfidTag);
    }),

    linkRfidTag: protectedProcedure.input(z.object({
      assetId: z.number(),
      rfidTag: z.string().min(1),
    })).mutation(async ({ input }) => {
      const asset = await db.getAssetById(input.assetId);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "الأصل غير موجود" });
      return db.updateAssetRfidTag(input.assetId, input.rfidTag);
    }),

    getMaintenanceHistory: protectedProcedure.input(z.object({
      id: z.number(),
    })).query(async ({ input }) => {
      const asset = await db.getAssetById(input.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "الأصل غير موجود" });
      return db.getAssetMaintenanceHistory(input.id);
    }),

    getMaintenanceStats: protectedProcedure.input(z.object({
      id: z.number(),
    })).query(async ({ input }) => {
      const asset = await db.getAssetById(input.id);
      if (!asset) throw new TRPCError({ code: "NOT_FOUND", message: "الأصل غير موجود" });
      return db.getAssetMaintenanceStats(input.id);
    }),

    addSparePart: managerProcedure.input(z.object({
      assetId: z.number(),
      inventoryItemId: z.number(),
      minStockLevel: z.number().optional(),
      preferredQuantity: z.number().optional(),
      notes: z.string().optional(),
    })).mutation(async ({ input }) => {
      return db.addAssetSparePart(input);
    }),

    getSpareParts: protectedProcedure.input(z.object({
      assetId: z.number(),
    })).query(async ({ input }) => {
      return db.getAssetSpareParts(input.assetId);
    }),

    removeSparePart: managerProcedure.input(z.object({
      id: z.number(),
    })).mutation(async ({ input }) => {
      return db.removeAssetSparePart(input.id);
    }),

    getMetrics: protectedProcedure.input(z.object({
      assetId: z.number(),
    })).query(async ({ input }) => {
      return db.getAssetMetricsById(input.assetId);
    }),

    calculateMetrics: managerProcedure.input(z.object({
      assetId: z.number(),
    })).mutation(async ({ input }) => {
      return db.calculateAssetMetrics(input.assetId);
    }),

    getAllMetrics: protectedProcedure.query(async () => {
      return db.getAllAssetMetrics();
    }),

    getLowStockAlerts: managerProcedure.query(async () => {
      return db.getInventoryAlerts();
    }),

    getAssetSparePartsWithLowStock: protectedProcedure.input(z.object({
      assetId: z.number(),
    })).query(async ({ input }) => {
      return db.getAssetSparePartsWithLowStock(input.assetId);
    }),
  }),

  // ============================================================
  // PREVENTIVE MAINTENANCE - الصيانة الوقائية
  // ============================================================
  preventive: router({
    listPlans: protectedProcedure.input(z.object({
      assetId: z.number().optional(),
      siteId: z.number().optional(),
      isActive: z.boolean().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listPreventivePlans(input ?? {});
    }),

    getPlanById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const plan = await db.getPreventivePlanById(input.id);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "الخطة غير موجودة" });
      return plan;
    }),

    createPlan: managerProcedure.input(z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      assetId: z.number().optional(),
      siteId: z.number().optional(),
      frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "biannual", "annual"]),
      frequencyValue: z.number().default(1),
      estimatedDurationMinutes: z.number().optional(),
      assignedToId: z.number().optional(),
      checklist: z.array(z.object({ id: z.string(), text: z.string(), required: z.boolean().optional() })).optional(),
      nextDueDate: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const planNumber = await db.generatePlanNumber();
      const nextDue = input.nextDueDate ? new Date(input.nextDueDate) : db.calcNextDueDate(new Date(), input.frequency, input.frequencyValue);
      const result = await db.createPreventivePlan({
        ...input,
        planNumber,
        checklist: input.checklist ?? [],
        nextDueDate: nextDue,
        createdById: ctx.user.id,
      });
      return result;
    }),

    updatePlan: managerProcedure.input(z.object({
      id: z.number(),
      title: z.string().optional(),
      description: z.string().optional(),
      assetId: z.number().optional(),
      siteId: z.number().optional(),
      frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "biannual", "annual"]).optional(),
      frequencyValue: z.number().optional(),
      estimatedDurationMinutes: z.number().optional(),
      assignedToId: z.number().optional(),
      checklist: z.array(z.object({ id: z.string(), text: z.string(), required: z.boolean().optional() })).optional(),
      isActive: z.boolean().optional(),
      nextDueDate: z.string().optional(),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.updatePreventivePlan(id, {
        ...data,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : undefined,
      });
    }),

    deletePlan: managerProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      return db.deletePreventivePlan(input.id);
    }),

    // Work Orders
    listWorkOrders: protectedProcedure.input(z.object({
      planId: z.number().optional(),
      assetId: z.number().optional(),
      status: z.string().optional(),
      assignedToId: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      return db.listPMWorkOrders(input ?? {});
    }),

    getWorkOrderById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      const wo = await db.getPMWorkOrderById(input.id);
      if (!wo) throw new TRPCError({ code: "NOT_FOUND", message: "أمر العمل غير موجود" });
      return wo;
    }),

    generateWorkOrder: managerProcedure.input(z.object({
      planId: z.number(),
      scheduledDate: z.string(),
    })).mutation(async ({ input }) => {
      const plan = await db.getPreventivePlanById(input.planId);
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "الخطة غير موجودة" });
      const woNumber = await db.generateWorkOrderNumber();
      const result = await db.createPMWorkOrder({
        workOrderNumber: woNumber,
        planId: input.planId,
        assetId: plan.assetId ?? undefined,
        siteId: plan.siteId ?? undefined,
        title: plan.title,
        scheduledDate: new Date(input.scheduledDate),
        status: "scheduled",
        assignedToId: plan.assignedToId ?? undefined,
        checklistResults: plan.checklist,
      });
      // Update plan's lastGeneratedAt and nextDueDate
      const nextDue = db.calcNextDueDate(new Date(input.scheduledDate), plan.frequency, plan.frequencyValue ?? 1);
      await db.updatePreventivePlan(input.planId, { lastGeneratedAt: new Date(), nextDueDate: nextDue });
      return result;
    }),

    updateWorkOrder: protectedProcedure.input(z.object({
      id: z.number(),
      status: z.enum(["scheduled", "in_progress", "completed", "overdue", "cancelled"]).optional(),
      // Accept null (from DB) and normalize to [] to prevent validation errors
      checklistResults: z.array(z.object({ id: z.string(), text: z.string(), done: z.boolean(), notes: z.string().optional() })).nullish().transform(v => v ?? []),
      technicianNotes: z.string().nullish().transform(v => v ?? undefined),
      completionPhotoUrl: z.string().nullish().transform(v => v ?? undefined),
      completedDate: z.string().nullish().transform(v => v ?? undefined),
    })).mutation(async ({ input }) => {
      const { id, ...data } = input;
      // Auto-translate technicianNotes to all 3 languages
      let woTranslation: Record<string, any> = {};
      if (data.technicianNotes && data.technicianNotes.trim().length > 0) {
        try {
          const detectedLang = await detectLanguage(data.technicianNotes) as SupportedLanguage;
          const translations = await translateFields({ technicianNotes: data.technicianNotes }, detectedLang);
          if (translations.technicianNotes) {
            woTranslation.technicianNotes_ar = translations.technicianNotes.ar;
            woTranslation.technicianNotes_en = translations.technicianNotes.en;
            woTranslation.technicianNotes_ur = translations.technicianNotes.ur;
          }
        } catch (e) {
          console.error("[WorkOrder] technicianNotes translation failed:", e);
        }
      }
      return db.updatePMWorkOrder(id, {
        ...data,
        ...woTranslation,
        completedDate: data.completedDate ? new Date(data.completedDate) : undefined,
      });
    }),

    // ─── AI Predictive Analysis ──────────────────────────────────────────
    // Analyze a fault image and return diagnosis + recommendations
    analyzeFaultImage: protectedProcedure.input(z.object({
      imageUrl: z.string().url(),
      assetName: z.string().optional(),
      assetCategory: z.string().optional(),
      description: z.string().optional(),
    })).mutation(async ({ input }) => {
      const systemPrompt = `أنت خبير هندسي متخصص في تشخيص أعطال المعدات والأصول. 
عند تحليل صورة العطل، قدم:
1. تشخيص العطل المحتمل
2. مستوى الخطورة (منخفض/متوسط/عالٍ/حرج)
3. الأسباب المحتملة
4. الإجراءات التصحيحية الموصى بها
5. هل يحتاج إلى إيقاف تشغيل فوري؟
أجب بصيغة JSON منظمة.`;

      const userMessage = `الأصل: ${input.assetName ?? "غير محدد"} | الفئة: ${input.assetCategory ?? "غير محدد"}\nالوصف: ${input.description ?? "لا يوجد وصف"}\nرابط الصورة: ${input.imageUrl}\n\nحلل صورة العطل وقدم تشخيصاً مفصلاً.`;
      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "fault_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                diagnosis: { type: "string", description: "تشخيص العطل" },
                severity: { type: "string", enum: ["low", "medium", "high", "critical"], description: "مستوى الخطورة" },
                causes: { type: "array", items: { type: "string" }, description: "الأسباب المحتملة" },
                recommendations: { type: "array", items: { type: "string" }, description: "الإجراءات الموصى بها" },
                requiresImmediateShutdown: { type: "boolean", description: "هل يحتاج إيقاف تشغيل فوري" },
                estimatedRepairTime: { type: "string", description: "الوقت التقديري للإصلاح" },
                confidence: { type: "number", description: "مستوى الثقة 0-100" },
              },
              required: ["diagnosis", "severity", "causes", "recommendations", "requiresImmediateShutdown", "estimatedRepairTime", "confidence"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل تحليل الصورة" });
      return JSON.parse(content as string);
    }),

    // Predict assets at risk based on maintenance history
    predictAtRiskAssets: protectedProcedure.mutation(async () => {
      const assets = await db.listAssets({});
      const tickets = await db.getTickets();

      if (assets.length === 0) {
        return { atRiskAssets: [], summary: "لا توجد أصول مسجلة بعد" };
      }

      // Build asset maintenance history summary
      const assetSummaries = assets.slice(0, 20).map((asset: any) => {
        const assetTickets = tickets.filter((t: any) => t.assetId === asset.id);
        const recentTickets = assetTickets.filter((t: any) => {
          const days = (Date.now() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return days <= 90;
        });
        return {
          id: asset.id,
          name: asset.name,
          category: asset.category,
          status: asset.status,
          warrantyExpiry: asset.warrantyExpiry,
          totalTickets: assetTickets.length,
          recentTickets: recentTickets.length,
          lastTicketDate: assetTickets.length > 0 ? assetTickets[assetTickets.length - 1].createdAt : null,
        };
      });

      const result = await invokeLLM({
        messages: [
          { role: "system", content: "أنت محلل بيانات صيانة متخصص. بناءً على بيانات الأصول وتاريخ الأعطال، حدد الأصول الأكثر عرضة للأعطال وقدم توصيات وقائية." },
          { role: "user", content: `بيانات الأصول:\n${JSON.stringify(assetSummaries, null, 2)}\n\nحدد الأصول الأكثر خطورة وقدم توصيات.` as string },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "risk_prediction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                atRiskAssets: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      assetId: { type: "number" },
                      assetName: { type: "string" },
                      riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
                      reason: { type: "string" },
                      recommendation: { type: "string" },
                    },
                    required: ["assetId", "assetName", "riskLevel", "reason", "recommendation"],
                    additionalProperties: false,
                  },
                },
                summary: { type: "string", description: "ملخص التحليل" },
              },
              required: ["atRiskAssets", "summary"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = result.choices?.[0]?.message?.content;
      if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "فشل التحليل" });
      return JSON.parse(content as string);
    }),
    // ─── PM Report ────────────────────────────────────────────────────────
    getReport: protectedProcedure.input(z.object({
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional()).query(async ({ input }) => {
      const plans = await db.listPreventivePlans();
      const workOrders = await db.listPMWorkOrders();
      const now = new Date();
      const from = input?.dateFrom ? new Date(input.dateFrom) : null;
      const to = input?.dateTo ? new Date(input.dateTo) : null;
      const filteredWOs = workOrders.filter((wo: any) => {
        if (from && new Date(wo.scheduledDate) < from) return false;
        if (to && new Date(wo.scheduledDate) > to) return false;
        return true;
      });
      const totalPlans = plans.length;
      const activePlans = plans.filter((p: any) => p.isActive !== false).length;
      const inactivePlans = totalPlans - activePlans;
      const overduePlans = plans.filter((p: any) => {
        if (!p.nextDueDate || p.isActive === false) return false;
        return new Date(p.nextDueDate) < now;
      }).length;
      const totalWOs = filteredWOs.length;
      const completedWOs = filteredWOs.filter((wo: any) => wo.status === 'completed').length;
      const inProgressWOs = filteredWOs.filter((wo: any) => wo.status === 'in_progress').length;
      const scheduledWOs = filteredWOs.filter((wo: any) => wo.status === 'scheduled').length;
      const overdueWOs = filteredWOs.filter((wo: any) => wo.status === 'overdue').length;
      const cancelledWOs = filteredWOs.filter((wo: any) => wo.status === 'cancelled').length;
      const completionRate = totalWOs > 0 ? Math.round((completedWOs / totalWOs) * 100) : 0;
      let totalChecklistItems = 0;
      let doneChecklistItems = 0;
      filteredWOs.forEach((wo: any) => {
        if (Array.isArray(wo.checklistResults)) {
          totalChecklistItems += wo.checklistResults.length;
          doneChecklistItems += wo.checklistResults.filter((c: any) => c.done).length;
        }
      });
      const checklistCompletionRate = totalChecklistItems > 0 ? Math.round((doneChecklistItems / totalChecklistItems) * 100) : 0;
      const byFrequency: Record<string, number> = {};
      plans.forEach((p: any) => {
        byFrequency[p.frequency] = (byFrequency[p.frequency] || 0) + 1;
      });
      const recentWorkOrders = filteredWOs.slice(0, 10).map((wo: any) => ({
        id: wo.id,
        workOrderNumber: wo.workOrderNumber,
        title: wo.title,
        status: wo.status,
        scheduledDate: wo.scheduledDate,
        completedDate: wo.completedDate,
        completionPhotoUrl: wo.completionPhotoUrl,
      }));
      return {
        summary: { totalPlans, activePlans, inactivePlans, overduePlans },
        workOrders: { total: totalWOs, completed: completedWOs, inProgress: inProgressWOs, scheduled: scheduledWOs, overdue: overdueWOs, cancelled: cancelledWOs, completionRate },
        checklist: { total: totalChecklistItems, done: doneChecklistItems, completionRate: checklistCompletionRate },
        byFrequency,
        recentWorkOrders,
      };
    }),
  }),

  // ============================================================
  // WEB PUSH SUBSCRIPTIONS
  // ============================================================
  push: router({
    getVapidPublicKey: publicProcedure.query(() => {
      return { publicKey: process.env.VAPID_PUBLIC_KEY || "" };
    }),

    subscribe: protectedProcedure.input(z.object({
      endpoint: z.string().url(),
      p256dh: z.string(),
      auth: z.string(),
      userAgent: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      await db.savePushSubscription({
        userId: ctx.user.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
      });
      return { success: true };
    }),

    unsubscribe: protectedProcedure.input(z.object({
      endpoint: z.string(),
    })).mutation(async ({ input }) => {
      await db.deletePushSubscription(input.endpoint);
      return { success: true };
    }),

    getStatus: protectedProcedure.query(async ({ ctx }) => {
      const subs = await db.getPushSubscriptionsByUser(ctx.user.id);
      return { subscribed: subs.length > 0, count: subs.length };
    }),
  }),
});
export type AppRouter = typeof appRouter;
