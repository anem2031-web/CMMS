import { eq, desc, and, sql, count, sum, inArray, notInArray, like, or, gte, lte, isNull, isNotNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, tickets, purchaseOrders, purchaseOrderItems,
  inventory, inventoryTransactions, notifications, auditLogs,
  ticketStatusHistory, attachments, sites, backups,
  assets, preventivePlans, pmWorkOrders,
  type InsertAsset, type InsertPreventivePlan, type InsertPMWorkOrder
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================================
// USER OPERATIONS
// ============================================================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'owner'; updateSet.role = 'owner'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createLocalUser(data: { username: string; passwordHash: string; name: string; role: string; email?: string; phone?: string; department?: string }) {
  const db = await getDb();
  if (!db) return null;
  const openId = `local_${data.username}_${Date.now()}`;
  const result = await db.insert(users).values({
    openId,
    username: data.username,
    passwordHash: data.passwordHash,
    name: data.name,
    role: data.role as any,
    email: data.email || null,
    phone: data.phone || null,
    department: data.department || null,
    loginMethod: "local",
    lastSignedIn: new Date(),
  });
  return result[0].insertId;
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUsersByRole(role: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.role, role as any));
}

export async function updateUserRole(userId: number, role: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role: role as any }).where(eq(users.id, userId));
}

// ============================================================
// SITES
// ============================================================
export async function getAllSites() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sites).orderBy(desc(sites.createdAt));
}

export async function createSite(data: { name: string; address?: string; description?: string }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(sites).values(data);
  return result[0].insertId;
}

// ============================================================
// TICKETS
// ============================================================
export async function getNextTicketNumber() {
  const db = await getDb();
  if (!db) return "MT-2026-00001";
  const year = new Date().getFullYear();
  const result = await db.select({ cnt: count() }).from(tickets);
  const num = (result[0]?.cnt || 0) + 1;
  return `MT-${year}-${String(num).padStart(5, "0")}`;
}

export async function createTicket(data: any) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(tickets).values(data);
  return result[0].insertId;
}

export async function getTickets(filters?: { status?: string; priority?: string; siteId?: number; assetId?: number; assignedToId?: number; reportedById?: number; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(tickets.status, filters.status as any));
  if (filters?.priority) conditions.push(eq(tickets.priority, filters.priority as any));
  if (filters?.siteId) conditions.push(eq(tickets.siteId, filters.siteId));
  if (filters?.assetId) conditions.push(eq(tickets.assetId, filters.assetId));
  if (filters?.assignedToId) conditions.push(eq(tickets.assignedToId, filters.assignedToId));
  if (filters?.reportedById) conditions.push(eq(tickets.reportedById, filters.reportedById));
  if (filters?.search) conditions.push(or(like(tickets.title, `%${filters.search}%`), like(tickets.ticketNumber, `%${filters.search}%`)));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(tickets).where(where).orderBy(desc(tickets.createdAt));
}

export async function getTicketById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(tickets).where(eq(tickets.id, id)).limit(1);
  return result[0] || null;
}

export async function getTicketsByAsset(assetId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tickets).where(eq(tickets.assetId, assetId)).orderBy(desc(tickets.createdAt));
}

export async function updateTicket(id: number, data: any) {
  const db = await getDb();
  if (!db) return;
  await db.update(tickets).set(data).where(eq(tickets.id, id));
}

// ============================================================
// TICKET STATUS HISTORY
// ============================================================
export async function addTicketStatusHistory(data: { ticketId: number; fromStatus?: string; toStatus: string; changedById: number; notes?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(ticketStatusHistory).values(data);
}

export async function getTicketHistory(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ticketStatusHistory).where(eq(ticketStatusHistory.ticketId, ticketId)).orderBy(desc(ticketStatusHistory.createdAt));
}

// ============================================================
// PURCHASE ORDERS
// ============================================================
export async function getNextPONumber() {
  const db = await getDb();
  if (!db) return "PR-2026-0001";
  const year = new Date().getFullYear();
  const result = await db.select({ cnt: count() }).from(purchaseOrders);
  const num = (result[0]?.cnt || 0) + 1;
  return `PR-${year}-${String(num).padStart(4, "0")}`;
}

export async function createPurchaseOrder(data: any) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(purchaseOrders).values(data);
  return result[0].insertId;
}

export async function getPurchaseOrders(filters?: { status?: string; requestedById?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(purchaseOrders.status, filters.status as any));
  if (filters?.requestedById) conditions.push(eq(purchaseOrders.requestedById, filters.requestedById));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(purchaseOrders).where(where).orderBy(desc(purchaseOrders.createdAt));
}

export async function getPurchaseOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  return result[0] || null;
}

export async function updatePurchaseOrder(id: number, data: any) {
  const db = await getDb();
  if (!db) return;
  await db.update(purchaseOrders).set(data).where(eq(purchaseOrders.id, id));
}

// ============================================================
// PURCHASE ORDER ITEMS
// ============================================================
export async function createPOItems(items: any[]) {
  const db = await getDb();
  if (!db) return;
  if (items.length > 0) await db.insert(purchaseOrderItems).values(items);
}

export async function getPOItems(purchaseOrderId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId)).orderBy(purchaseOrderItems.id);
}

export async function getPOItemsByDelegate(delegateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.delegateId, delegateId)).orderBy(desc(purchaseOrderItems.createdAt));
}

export async function updatePOItem(id: number, data: any) {
  const db = await getDb();
  if (!db) return;
  await db.update(purchaseOrderItems).set(data).where(eq(purchaseOrderItems.id, id));
}

export async function getPOItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, id)).limit(1);
  return result[0] || null;
}

export async function getPOItemsByStatus(status: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.status, status as any)).orderBy(desc(purchaseOrderItems.createdAt));
}

// ============================================================
// INVENTORY
// ============================================================
export async function getInventoryItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(inventory).orderBy(desc(inventory.updatedAt));
}

export async function createInventoryItem(data: any) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(inventory).values(data);
  return result[0].insertId;
}

export async function updateInventoryItem(id: number, data: any) {
  const db = await getDb();
  if (!db) return;
  await db.update(inventory).set(data).where(eq(inventory.id, id));
}

export async function addInventoryTransaction(data: any) {
  const db = await getDb();
  if (!db) return;
  await db.insert(inventoryTransactions).values(data);
  // Update inventory quantity
  const item = await db.select().from(inventory).where(eq(inventory.id, data.inventoryId)).limit(1);
  if (item[0]) {
    const newQty = data.type === "in" ? item[0].quantity + data.quantity : item[0].quantity - data.quantity;
    await db.update(inventory).set({ quantity: Math.max(0, newQty) }).where(eq(inventory.id, data.inventoryId));
  }
}

// ============================================================
// NOTIFICATIONS
// ============================================================
export async function createNotification(data: { userId: number; title: string; message: string; type?: string; relatedTicketId?: number; relatedPOId?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data as any);
}

export async function getUserNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
}

export async function getUnreadNotificationCount(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ cnt: count() }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result[0]?.cnt || 0;
}

// ============================================================
// AUDIT LOG
// ============================================================
export async function createAuditLog(data: { userId?: number; action: string; entityType: string; entityId?: number; oldValues?: any; newValues?: any; ipAddress?: string; userAgent?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data as any);
}

export async function getAuditLogs(filters?: { entityType?: string; entityId?: number; userId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
  if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
  if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(200);
}

// ============================================================
// TECHNICIAN PERFORMANCE REPORT
// ============================================================
export async function getTechnicianPerformance(filters?: { dateFrom?: Date; dateTo?: Date }) {
  const db = await getDb();
  if (!db) return [];

  const dateFrom = filters?.dateFrom;
  const dateTo = filters?.dateTo;

  // Build date condition helper
  const withDateFilter = (baseConditions: any[], dateField: any) => {
    const conds = [...baseConditions];
    if (dateFrom) conds.push(gte(dateField, dateFrom));
    if (dateTo) conds.push(lte(dateField, dateTo));
    return conds;
  };

  // Get all technicians
  const techs = await db.select().from(users).where(eq(users.role, "technician" as any));

  const results = [];
  for (const tech of techs) {
    const baseCond = [eq(tickets.assignedToId, tech.id)];
    const dateFilteredCond = withDateFilter(baseCond, tickets.createdAt);

    // Total assigned tickets (within date range)
    const [totalAssigned] = await db.select({ cnt: count() }).from(tickets).where(and(...dateFilteredCond));

    // Completed tickets (repaired, verified, closed) within date range
    const [completed] = await db.select({ cnt: count() }).from(tickets).where(
      and(...dateFilteredCond, or(eq(tickets.status, "repaired"), eq(tickets.status, "verified"), eq(tickets.status, "closed")))
    );

    // In progress tickets within date range
    const [inProgress] = await db.select({ cnt: count() }).from(tickets).where(
      and(...dateFilteredCond, eq(tickets.status, "in_progress"))
    );

    // Closed tickets with resolution time within date range
    const closedCond = withDateFilter([eq(tickets.assignedToId, tech.id), eq(tickets.status, "closed")], tickets.closedAt);
    const closedTickets = await db.select({
      id: tickets.id,
      createdAt: tickets.createdAt,
      closedAt: tickets.closedAt,
      priority: tickets.priority,
      category: tickets.category,
    }).from(tickets).where(and(...closedCond));

    // Calculate avg resolution time in hours
    let totalHours = 0;
    let resolvedCount = 0;
    const resolutionTimes: number[] = [];
    for (const t of closedTickets) {
      if (t.closedAt && t.createdAt) {
        const hours = (new Date(t.closedAt).getTime() - new Date(t.createdAt).getTime()) / (1000 * 60 * 60);
        totalHours += hours;
        resolvedCount++;
        resolutionTimes.push(hours);
      }
    }
    const avgResolutionHours = resolvedCount > 0 ? totalHours / resolvedCount : 0;
    const minResolutionHours = resolutionTimes.length > 0 ? Math.min(...resolutionTimes) : 0;
    const maxResolutionHours = resolutionTimes.length > 0 ? Math.max(...resolutionTimes) : 0;

    // Tickets by priority (within date range)
    const priorityBreakdown: Record<string, number> = {};
    const allTechTickets = await db.select({ priority: tickets.priority, category: tickets.category }).from(tickets).where(and(...dateFilteredCond));
    allTechTickets.forEach(t => { priorityBreakdown[t.priority] = (priorityBreakdown[t.priority] || 0) + 1; });

    // Tickets by category (within date range)
    const catBreak: Record<string, number> = {};
    allTechTickets.forEach(t => { catBreak[t.category] = (catBreak[t.category] || 0) + 1; });

    // Monthly trend (last 6 months or within date range)
    const monthlyTrend: { month: string; completed: number; assigned: number }[] = [];
    const trendMonths = 6;
    for (let i = trendMonths - 1; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().slice(0, 7);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const [assigned] = await db.select({ cnt: count() }).from(tickets).where(
        and(eq(tickets.assignedToId, tech.id), gte(tickets.createdAt, monthStart), lte(tickets.createdAt, monthEnd))
      );
      const [comp] = await db.select({ cnt: count() }).from(tickets).where(
        and(eq(tickets.assignedToId, tech.id), eq(tickets.status, "closed"), gte(tickets.closedAt, monthStart), lte(tickets.closedAt, monthEnd))
      );
      monthlyTrend.push({ month: monthStr, assigned: assigned?.cnt || 0, completed: comp?.cnt || 0 });
    }

    // Completion rate
    const totalAssignedCount = totalAssigned?.cnt || 0;
    const completedCount = completed?.cnt || 0;
    const completionRate = totalAssignedCount > 0 ? Math.round((completedCount / totalAssignedCount) * 100) : 0;

    // Performance score (0-100)
    let score = 0;
    if (totalAssignedCount > 0) {
      const rateScore = completionRate * 0.4;
      const speedScore = avgResolutionHours > 0 ? Math.max(0, (1 - avgResolutionHours / (30 * 24)) * 100) * 0.3 : 0;
      const volumeScore = Math.min(100, totalAssignedCount * 5) * 0.3;
      score = Math.round(rateScore + speedScore + volumeScore);
    }

    results.push({
      technician: { id: tech.id, name: tech.name, email: tech.email, phone: (tech as any).phone, department: (tech as any).department },
      totalAssigned: totalAssignedCount,
      completed: completedCount,
      inProgress: inProgress?.cnt || 0,
      pending: totalAssignedCount - completedCount - (inProgress?.cnt || 0),
      completionRate,
      avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
      minResolutionHours: Math.round(minResolutionHours * 10) / 10,
      maxResolutionHours: Math.round(maxResolutionHours * 10) / 10,
      priorityBreakdown,
      categoryBreakdown: catBreak,
      monthlyTrend,
      performanceScore: score,
    });
  }

  return results.sort((a, b) => b.performanceScore - a.performanceScore);
}

// ============================================================
// ATTACHMENTS
// ============================================================
export async function createAttachment(data: any) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(attachments).values(data);
  return result[0].insertId;
}

export async function getAttachments(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(attachments).where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId))).orderBy(desc(attachments.createdAt));
}

export async function getAttachmentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  return result[0] || null;
}

export async function deleteAttachment(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(attachments).where(eq(attachments.id, id));
}

// ============================================================
// DASHBOARD STATS
// ============================================================
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;
  const [openTickets] = await db.select({ cnt: count() }).from(tickets).where(ne(tickets.status, "closed"));
  const [closedToday] = await db.select({ cnt: count() }).from(tickets).where(and(eq(tickets.status, "closed"), gte(tickets.closedAt, sql`CURDATE()`)));
  const [criticalTickets] = await db.select({ cnt: count() }).from(tickets).where(and(eq(tickets.priority, "critical"), ne(tickets.status, "closed")));
  const [pendingPOs] = await db.select({ cnt: count() }).from(purchaseOrders).where(or(eq(purchaseOrders.status, "pending_accounting"), eq(purchaseOrders.status, "pending_management")));
  const [totalCostResult] = await db.select({ total: sum(purchaseOrderItems.actualTotalCost) }).from(purchaseOrderItems).where(or(eq(purchaseOrderItems.status, "delivered_to_warehouse"), eq(purchaseOrderItems.status, "delivered_to_requester")));
  const [pendingItems] = await db.select({ cnt: count() }).from(purchaseOrderItems).where(ne(purchaseOrderItems.status, "purchased"));
  const [purchasedItems] = await db.select({ cnt: count() }).from(purchaseOrderItems).where(eq(purchaseOrderItems.status, "purchased"));
  return {
    openTickets: openTickets?.cnt || 0,
    closedToday: closedToday?.cnt || 0,
    criticalTickets: criticalTickets?.cnt || 0,
    pendingApprovals: pendingPOs?.cnt || 0,
    totalMaintenanceCost: totalCostResult?.total || "0",
    pendingPurchaseItems: pendingItems?.cnt || 0,
    purchasedItems: purchasedItems?.cnt || 0,
  };
}

// ============================================================
// DELETE OPERATIONS
// ============================================================
export async function deleteTicket(id: number) {
  const db = await getDb();
  if (!db) return;
  // Delete related records first
  await db.delete(ticketStatusHistory).where(eq(ticketStatusHistory.ticketId, id));
  await db.delete(attachments).where(and(eq(attachments.entityType, "ticket"), eq(attachments.entityId, id)));
  await db.delete(notifications).where(eq(notifications.relatedTicketId, id));
  await db.delete(tickets).where(eq(tickets.id, id));
}

export async function deletePurchaseOrder(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, id));
  await db.delete(attachments).where(and(eq(attachments.entityType, "purchase_order"), eq(attachments.entityId, id)));
  await db.delete(notifications).where(eq(notifications.relatedPOId, id));
  await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
}

export async function deletePOItem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.id, id));
}

export async function deleteInventoryItem(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(inventoryTransactions).where(eq(inventoryTransactions.inventoryId, id));
  await db.delete(inventory).where(eq(inventory.id, id));
}

export async function deleteSite(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(sites).where(eq(sites.id, id));
}

export async function updateSite(id: number, data: { name?: string; address?: string; description?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(sites).set(data).where(eq(sites.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notifications).where(eq(notifications.userId, id));
  await db.delete(users).where(eq(users.id, id));
}

export async function updateUser(id: number, data: { name?: string; email?: string; role?: string; phone?: string; department?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data as any).where(eq(users.id, id));
}

export async function getSiteById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(sites).where(eq(sites.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getInventoryItemById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(inventory).where(eq(inventory.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

// Enhanced audit log with action filter
export async function getAuditLogsEnhanced(filters?: { entityType?: string; entityId?: number; userId?: number; action?: string; dateFrom?: Date; dateTo?: Date; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.entityType) conditions.push(eq(auditLogs.entityType, filters.entityType));
  if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
  if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
  if (filters?.dateFrom) conditions.push(gte(auditLogs.createdAt, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(auditLogs.createdAt, filters.dateTo));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(filters?.limit || 500);
}

// ============================================================
// BACKUPS
// ============================================================
export async function createBackup(data: { name: string; description?: string; fileUrl: string; fileKey: string; fileSize?: number; tablesCount?: number; recordsCount?: number; createdById: number }) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(backups).values(data);
  return result[0].insertId;
}

export async function getBackups() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(backups).orderBy(desc(backups.createdAt));
}

export async function getBackupById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(backups).where(eq(backups.id, id)).limit(1);
  return result[0] || null;
}

export async function deleteBackup(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(backups).where(eq(backups.id, id));
}

// Export all tables data for backup
export async function exportAllTablesData() {
  const db = await getDb();
  if (!db) return null;
  
  const [
    usersData, sitesData, ticketsData, ticketHistoryData,
    posData, poItemsData, inventoryData, invTransData,
    notificationsData, auditData, attachmentsData
  ] = await Promise.all([
    db.select().from(users),
    db.select().from(sites),
    db.select().from(tickets),
    db.select().from(ticketStatusHistory),
    db.select().from(purchaseOrders),
    db.select().from(purchaseOrderItems),
    db.select().from(inventory),
    db.select().from(inventoryTransactions),
    db.select().from(notifications),
    db.select().from(auditLogs),
    db.select().from(attachments),
  ]);

  const data = {
    users: usersData,
    sites: sitesData,
    tickets: ticketsData,
    ticket_status_history: ticketHistoryData,
    purchase_orders: posData,
    purchase_order_items: poItemsData,
    inventory: inventoryData,
    inventory_transactions: invTransData,
    notifications: notificationsData,
    audit_logs: auditData,
    attachments: attachmentsData,
  };

  let totalRecords = 0;
  for (const table of Object.values(data)) {
    totalRecords += table.length;
  }

  return { data, tablesCount: Object.keys(data).length, recordsCount: totalRecords };
}

// Restore tables from backup data
export async function restoreFromBackup(backupData: Record<string, any[]>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete in reverse dependency order
  await db.delete(inventoryTransactions);
  await db.delete(attachments);
  await db.delete(ticketStatusHistory);
  await db.delete(notifications);
  await db.delete(auditLogs);
  await db.delete(purchaseOrderItems);
  await db.delete(purchaseOrders);
  await db.delete(inventory);
  await db.delete(tickets);
  await db.delete(sites);
  // Don't delete users to preserve login sessions

  // Insert in dependency order
  if (backupData.sites?.length) await db.insert(sites).values(backupData.sites);
  if (backupData.tickets?.length) await db.insert(tickets).values(backupData.tickets);
  if (backupData.ticket_status_history?.length) await db.insert(ticketStatusHistory).values(backupData.ticket_status_history);
  if (backupData.purchase_orders?.length) await db.insert(purchaseOrders).values(backupData.purchase_orders);
  if (backupData.purchase_order_items?.length) await db.insert(purchaseOrderItems).values(backupData.purchase_order_items);
  if (backupData.inventory?.length) await db.insert(inventory).values(backupData.inventory);
  if (backupData.inventory_transactions?.length) await db.insert(inventoryTransactions).values(backupData.inventory_transactions);
  if (backupData.notifications?.length) await db.insert(notifications).values(backupData.notifications);
  if (backupData.audit_logs?.length) await db.insert(auditLogs).values(backupData.audit_logs);
  if (backupData.attachments?.length) await db.insert(attachments).values(backupData.attachments);

  return { success: true };
}

// ============================================================
// ASSETS - إدارة الأصول
// ============================================================
export async function listAssets(filters?: { siteId?: number; status?: string; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  let query = db.select().from(assets);
  const conditions = [];
  if (filters?.siteId) conditions.push(eq(assets.siteId, filters.siteId));
  if (filters?.status) conditions.push(eq(assets.status, filters.status as any));
  if (filters?.search) conditions.push(or(
    like(assets.name, `%${filters.search}%`),
    like(assets.assetNumber, `%${filters.search}%`),
    like(assets.serialNumber, `%${filters.search}%`)
  ));
  if (conditions.length > 0) return await (query as any).where(and(...conditions)).orderBy(desc(assets.createdAt));
  return await query.orderBy(desc(assets.createdAt));
}

export async function getAssetById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createAsset(data: InsertAsset) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(assets).values(data);
  const id = (result as any)[0]?.insertId ?? null;
  return { id };
}

export async function updateAsset(id: number, data: Partial<InsertAsset>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(assets).set(data).where(eq(assets.id, id));
  return { success: true };
}

export async function deleteAsset(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(assets).where(eq(assets.id, id));
  return { success: true };
}

export async function generateAssetNumber() {
  const db = await getDb();
  if (!db) return `AST-${Date.now()}`;
  const rows = await db.select({ cnt: count() }).from(assets);
  const n = (rows[0]?.cnt ?? 0) + 1;
  return `AST-${String(n).padStart(5, "0")}`;
}

// ============================================================
// PREVENTIVE PLANS - خطط الصيانة الوقائية
// ============================================================
export async function listPreventivePlans(filters?: { assetId?: number; siteId?: number; isActive?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.assetId) conditions.push(eq(preventivePlans.assetId, filters.assetId));
  if (filters?.siteId) conditions.push(eq(preventivePlans.siteId, filters.siteId));
  if (filters?.isActive !== undefined) conditions.push(eq(preventivePlans.isActive, filters.isActive));
  let query = db.select().from(preventivePlans);
  if (conditions.length > 0) return await (query as any).where(and(...conditions)).orderBy(desc(preventivePlans.createdAt));
  return await query.orderBy(desc(preventivePlans.createdAt));
}

export async function getPreventivePlanById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(preventivePlans).where(eq(preventivePlans.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPreventivePlan(data: InsertPreventivePlan) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(preventivePlans).values(data);
  const id = (result as any)[0]?.insertId ?? null;
  return { id };
}

export async function updatePreventivePlan(id: number, data: Partial<InsertPreventivePlan>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(preventivePlans).set(data).where(eq(preventivePlans.id, id));
  return { success: true };
}

export async function deletePreventivePlan(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(preventivePlans).where(eq(preventivePlans.id, id));
  return { success: true };
}

export async function generatePlanNumber() {
  const db = await getDb();
  if (!db) return `PM-${Date.now()}`;
  const rows = await db.select({ cnt: count() }).from(preventivePlans);
  const n = (rows[0]?.cnt ?? 0) + 1;
  return `PM-${String(n).padStart(5, "0")}`;
}

// ============================================================
// PM WORK ORDERS - أوامر العمل الوقائية
// ============================================================
export async function listPMWorkOrders(filters?: { planId?: number; assetId?: number; status?: string; assignedToId?: number }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.planId) conditions.push(eq(pmWorkOrders.planId, filters.planId));
  if (filters?.assetId) conditions.push(eq(pmWorkOrders.assetId, filters.assetId));
  if (filters?.status) conditions.push(eq(pmWorkOrders.status, filters.status as any));
  if (filters?.assignedToId) conditions.push(eq(pmWorkOrders.assignedToId, filters.assignedToId));
  let query = db.select().from(pmWorkOrders);
  if (conditions.length > 0) return await (query as any).where(and(...conditions)).orderBy(desc(pmWorkOrders.scheduledDate));
  return await query.orderBy(desc(pmWorkOrders.scheduledDate));
}

export async function getPMWorkOrderById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(pmWorkOrders).where(eq(pmWorkOrders.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createPMWorkOrder(data: InsertPMWorkOrder) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(pmWorkOrders).values(data);
  const id = (result as any)[0]?.insertId ?? null;
  return { id };
}

export async function updatePMWorkOrder(id: number, data: Partial<InsertPMWorkOrder>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(pmWorkOrders).set(data).where(eq(pmWorkOrders.id, id));
  return { success: true };
}

export async function generateWorkOrderNumber() {
  const db = await getDb();
  if (!db) return `WO-${Date.now()}`;
  const rows = await db.select({ cnt: count() }).from(pmWorkOrders);
  const n = (rows[0]?.cnt ?? 0) + 1;
  return `WO-${String(n).padStart(5, "0")}`;
}

// Calculate next due date based on frequency
export function calcNextDueDate(from: Date, frequency: string, frequencyValue: number = 1): Date {
  const d = new Date(from);
  switch (frequency) {
    case "daily": d.setDate(d.getDate() + frequencyValue); break;
    case "weekly": d.setDate(d.getDate() + 7 * frequencyValue); break;
    case "monthly": d.setMonth(d.getMonth() + frequencyValue); break;
    case "quarterly": d.setMonth(d.getMonth() + 3 * frequencyValue); break;
    case "biannual": d.setMonth(d.getMonth() + 6 * frequencyValue); break;
    case "annual": d.setFullYear(d.getFullYear() + frequencyValue); break;
  }
  return d;
}


// ============================================================
// RFID OPERATIONS
// ============================================================
export async function getAssetByRfidTag(rfidTag: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(assets).where(eq(assets.rfidTag, rfidTag)).limit(1);
  return rows[0] ?? null;
}

export async function updateAssetRfidTag(assetId: number, rfidTag: string | null) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  if (rfidTag && rfidTag.trim()) {
    // Check if RFID tag already exists
    const existing = await db.select().from(assets).where(eq(assets.rfidTag, rfidTag)).limit(1);
    if (existing.length > 0 && existing[0].id !== assetId) {
      throw new Error("RFID tag already assigned to another asset");
    }
  }
  await db.update(assets).set({ rfidTag: rfidTag || null }).where(eq(assets.id, assetId));
  return { success: true };
}

export async function listAssetsWithRfid() {
  const db = await getDb();
  if (!db) return [];
  return await db.select({
    id: assets.id,
    assetNumber: assets.assetNumber,
    name: assets.name,
    rfidTag: assets.rfidTag,
    status: assets.status,
    siteId: assets.siteId,
  }).from(assets).where(isNotNull(assets.rfidTag));
}

// ============================================================
// ASSET MAINTENANCE HISTORY - سجل الصيانة الكامل للأصل
// ============================================================
export async function getAssetMaintenanceHistory(assetId: number) {
  const db = await getDb();
  if (!db) return { tickets: [], pmPlans: [], workOrders: [] };

  // Fetch all tickets linked to this asset
  const assetTickets = await db
    .select()
    .from(tickets)
    .where(eq(tickets.assetId, assetId))
    .orderBy(desc(tickets.createdAt));

  // Fetch all preventive plans for this asset
  const assetPlans = await db
    .select()
    .from(preventivePlans)
    .where(eq(preventivePlans.assetId, assetId))
    .orderBy(desc(preventivePlans.createdAt));

  // Fetch all PM work orders for this asset
  const assetWorkOrders = await db
    .select()
    .from(pmWorkOrders)
    .where(eq(pmWorkOrders.assetId, assetId))
    .orderBy(desc(pmWorkOrders.scheduledDate));

  return {
    tickets: assetTickets,
    pmPlans: assetPlans,
    workOrders: assetWorkOrders,
  };
}

export async function getAssetMaintenanceStats(assetId: number) {
  const db = await getDb();
  if (!db) return null;

  const [ticketRows, planRows, woRows] = await Promise.all([
    db.select({ cnt: count() }).from(tickets).where(eq(tickets.assetId, assetId)),
    db.select({ cnt: count() }).from(preventivePlans).where(eq(preventivePlans.assetId, assetId)),
    db.select({ cnt: count() }).from(pmWorkOrders).where(eq(pmWorkOrders.assetId, assetId)),
  ]);

  const openTickets = await db
    .select({ cnt: count() })
    .from(tickets)
    .where(and(eq(tickets.assetId, assetId), notInArray(tickets.status, ["closed", "rejected"] as any)));

  const completedWOs = await db
    .select({ cnt: count() })
    .from(pmWorkOrders)
    .where(and(eq(pmWorkOrders.assetId, assetId), eq(pmWorkOrders.status, "completed")));

  return {
    totalTickets: ticketRows[0]?.cnt ?? 0,
    openTickets: openTickets[0]?.cnt ?? 0,
    totalPMPlans: planRows[0]?.cnt ?? 0,
    totalWorkOrders: woRows[0]?.cnt ?? 0,
    completedWorkOrders: completedWOs[0]?.cnt ?? 0,
  };
}
