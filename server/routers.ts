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
const accountantProcedure = roleMiddleware(["accountant"]);
const managementProcedure = roleMiddleware(["senior_management"]);
const warehouseProcedure = roleMiddleware(["warehouse"]);
const delegateProcedure = roleMiddleware(["delegate"]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================================
  // USERS
  // ============================================================
  users: router({
    list: protectedProcedure.query(async () => {
      return db.getAllUsers();
    }),
    byRole: protectedProcedure.input(z.object({ role: z.string() })).query(async ({ input }) => {
      return db.getUsersByRole(input.role);
    }),
    updateRole: protectedProcedure.input(z.object({ userId: z.number(), role: z.string() })).mutation(async ({ input, ctx }) => {
      if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "فقط المالك يمكنه تغيير الأدوار" });
      }
      await db.updateUserRole(input.userId, input.role);
      await db.createAuditLog({ userId: ctx.user.id, action: "update_role", entityType: "user", entityId: input.userId, newValues: { role: input.role } });
      return { success: true };
    }),
  }),

  // ============================================================
  // SITES
  // ============================================================
  sites: router({
    list: protectedProcedure.query(async () => {
      return db.getAllSites();
    }),
    create: protectedProcedure.input(z.object({ name: z.string().min(1), address: z.string().optional(), description: z.string().optional() })).mutation(async ({ input, ctx }) => {
      const id = await db.createSite(input);
      await db.createAuditLog({ userId: ctx.user.id, action: "create_site", entityType: "site", entityId: id! });
      return { id };
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
      search: z.string().optional(),
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
      locationDetail: z.string().optional(),
      beforePhotoUrl: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const ticketNumber = await db.getNextTicketNumber();
      const id = await db.createTicket({ ...input, ticketNumber, reportedById: ctx.user.id, status: "new" });
      await db.addTicketStatusHistory({ ticketId: id!, fromStatus: undefined, toStatus: "new", changedById: ctx.user.id });
      await db.createAuditLog({ userId: ctx.user.id, action: "create_ticket", entityType: "ticket", entityId: id! });
      // Notify maintenance manager
      const managers = await db.getUsersByRole("maintenance_manager");
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
      return { success: true };
    }),

    assign: managerProcedure.input(z.object({ id: z.number(), technicianId: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateTicket(input.id, { status: "assigned", assignedToId: input.technicianId });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "assigned", changedById: ctx.user.id });
      await db.createNotification({ userId: input.technicianId, title: "بلاغ مُسند إليك", message: `تم إسناد البلاغ ${ticket.ticketNumber} إليك`, type: "info", relatedTicketId: input.id });
      return { success: true };
    }),

    startRepair: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateTicket(input.id, { status: "in_progress" });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "in_progress", changedById: ctx.user.id });
      return { success: true };
    }),

    completeRepair: protectedProcedure.input(z.object({
      id: z.number(),
      afterPhotoUrl: z.string().optional(),
      repairNotes: z.string().optional(),
      materialsUsed: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      await db.updateTicket(input.id, { status: "repaired", afterPhotoUrl: input.afterPhotoUrl, repairNotes: input.repairNotes, materialsUsed: input.materialsUsed });
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: "repaired", changedById: ctx.user.id });
      const managers = await db.getUsersByRole("maintenance_manager");
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
      return { success: true };
    }),

    updateStatus: protectedProcedure.input(z.object({ id: z.number(), status: z.string(), notes: z.string().optional() })).mutation(async ({ input, ctx }) => {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
      const updateData: any = { status: input.status };
      if (input.status === "closed") updateData.closedAt = new Date();
      await db.updateTicket(input.id, updateData);
      await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: ticket.status, toStatus: input.status, changedById: ctx.user.id, notes: input.notes });
      return { success: true };
    }),

    history: protectedProcedure.input(z.object({ ticketId: z.number() })).query(async ({ input }) => {
      return db.getTicketHistory(input.ticketId);
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
    })).mutation(async ({ input, ctx }) => {
      await db.updatePurchaseOrder(input.id, { status: "pending_management", accountingApprovedById: ctx.user.id, accountingApprovedAt: new Date(), accountingNotes: input.notes });
      // Notify senior management
      const mgmt = await db.getUsersByRole("senior_management");
      for (const m of mgmt) {
        await db.createNotification({ userId: m.id, title: "طلب شراء بانتظار اعتمادك", message: `طلب شراء بانتظار اعتماد الإدارة العليا`, type: "warning", relatedPOId: input.id });
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
      // Notify delegates
      const delegateIds = Array.from(new Set(items.filter(i => i.delegateId).map(i => i.delegateId!)));
      for (const dId of delegateIds) {
        await db.createNotification({ userId: dId, title: "تم اعتماد طلب الشراء", message: `تم اعتماد طلب الشراء. يمكنك البدء بالشراء`, type: "success", relatedPOId: input.id });
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
      await db.updatePurchaseOrder(input.id, { status: "rejected", rejectedById: ctx.user.id, rejectedAt: new Date(), rejectionReason: input.reason });
      return { success: true };
    }),

    // Delegate confirms purchase of specific item
    confirmItemPurchase: delegateProcedure.input(z.object({
      itemId: z.number(),
      invoicePhotoUrl: z.string().optional(),
      purchasedPhotoUrl: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      await db.updatePOItem(input.itemId, { status: "purchased", purchasedAt: new Date(), invoicePhotoUrl: input.invoicePhotoUrl, purchasedPhotoUrl: input.purchasedPhotoUrl });
      // Check if all items for this PO are purchased
      const item = (await db.getPOItems(0)).find(i => i.id === input.itemId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      const allItems = await db.getPOItems(item.purchaseOrderId);
      const allPurchased = allItems.every(i => i.status === "purchased" || i.status === "received");
      const somePurchased = allItems.some(i => i.status === "purchased" || i.status === "received");
      if (allPurchased) {
        await db.updatePurchaseOrder(item.purchaseOrderId, { status: "purchased" });
        const po = await db.getPurchaseOrderById(item.purchaseOrderId);
        if (po?.ticketId) {
          await db.updateTicket(po.ticketId, { status: "purchased" });
        }
      } else if (somePurchased) {
        await db.updatePurchaseOrder(item.purchaseOrderId, { status: "partial_purchase" });
        const po = await db.getPurchaseOrderById(item.purchaseOrderId);
        if (po?.ticketId) {
          await db.updateTicket(po.ticketId, { status: "partial_purchase" });
        }
      }
      // Notify warehouse
      const warehouseUsers = await db.getUsersByRole("warehouse");
      for (const w of warehouseUsers) {
        await db.createNotification({ userId: w.id, title: "صنف تم شراؤه", message: `تم شراء صنف جديد بانتظار الاستلام في المستودع`, type: "info" });
      }
      return { success: true };
    }),

    // Warehouse receives item
    receiveItem: warehouseProcedure.input(z.object({
      itemId: z.number(),
      actualUnitCost: z.string(),
      supplierName: z.string(),
    })).mutation(async ({ input, ctx }) => {
      const allItemsList = await db.getPOItems(0);
      const item = allItemsList.find(i => i.id === input.itemId);
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });
      const actualTotal = parseFloat(input.actualUnitCost) * item.quantity;
      await db.updatePOItem(input.itemId, { status: "received", receivedAt: new Date(), receivedById: ctx.user.id, actualUnitCost: input.actualUnitCost, actualTotalCost: String(actualTotal), supplierName: input.supplierName });
      // Check if all items received
      const allItems = await db.getPOItems(item.purchaseOrderId);
      const allReceived = allItems.every(i => i.status === "received");
      if (allReceived) {
        const totalActual = allItems.reduce((sum, i) => sum + parseFloat(i.actualTotalCost || "0"), 0);
        await db.updatePurchaseOrder(item.purchaseOrderId, { status: "received", totalActualCost: String(totalActual) });
        const po = await db.getPurchaseOrderById(item.purchaseOrderId);
        if (po?.ticketId) {
          await db.updateTicket(po.ticketId, { status: "received_warehouse" });
        }
      }
      await db.createAuditLog({ userId: ctx.user.id, action: "receive_item", entityType: "po_item", entityId: input.itemId, newValues: { actualUnitCost: input.actualUnitCost, supplierName: input.supplierName } });
      return { success: true };
    }),

    myItems: delegateProcedure.query(async ({ ctx }) => {
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
  }),

  // ============================================================
  // AI INSIGHTS
  // ============================================================
  ai: router({
    analyze: protectedProcedure.input(z.object({ question: z.string() })).mutation(async ({ input }) => {
      const tickets = await db.getTickets();
      const stats = await db.getDashboardStats();
      const context = `
بيانات النظام الحالية:
- عدد البلاغات المفتوحة: ${stats?.openTickets}
- عدد البلاغات المغلقة اليوم: ${stats?.closedToday}
- بلاغات حرجة: ${stats?.criticalTickets}
- طلبات شراء بانتظار الاعتماد: ${stats?.pendingApprovals}
- إجمالي تكلفة الصيانة: ${stats?.totalMaintenanceCost}
- عدد البلاغات الكلي: ${tickets.length}
- توزيع الأولويات: ${JSON.stringify(tickets.reduce((acc: any, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {}))}
- توزيع الفئات: ${JSON.stringify(tickets.reduce((acc: any, t) => { acc[t.category] = (acc[t.category] || 0) + 1; return acc; }, {}))}
      `;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "أنت مساعد ذكي لنظام إدارة الصيانة. قم بتحليل البيانات والإجابة على الأسئلة باللغة العربية بشكل مختصر ومفيد." },
          { role: "user", content: `${context}\n\nالسؤال: ${input.question}` },
        ],
      });
      return { answer: response.choices[0]?.message?.content || "لم أتمكن من الإجابة" };
    }),
  }),

  // ============================================================
  // AUDIT LOGS
  // ============================================================
  audit: router({
    list: protectedProcedure.input(z.object({
      entityType: z.string().optional(),
      entityId: z.number().optional(),
    }).optional()).query(async ({ input }) => {
      return db.getAuditLogs(input || undefined);
    }),
  }),
});

export type AppRouter = typeof appRouter;
