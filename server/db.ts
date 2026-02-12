import { eq, desc, and, sql, count, sum, inArray, like, or, gte, lte, isNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, tickets, purchaseOrders, purchaseOrderItems,
  inventory, inventoryTransactions, notifications, auditLogs,
  ticketStatusHistory, attachments, sites
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

export async function getTickets(filters?: { status?: string; priority?: string; siteId?: number; assignedToId?: number; reportedById?: number; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(tickets.status, filters.status as any));
  if (filters?.priority) conditions.push(eq(tickets.priority, filters.priority as any));
  if (filters?.siteId) conditions.push(eq(tickets.siteId, filters.siteId));
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
  return db.select().from(attachments).where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId)));
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
  const [totalCostResult] = await db.select({ total: sum(purchaseOrderItems.actualTotalCost) }).from(purchaseOrderItems).where(eq(purchaseOrderItems.status, "received"));
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
