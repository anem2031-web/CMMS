// ============================================================
// db/tickets.ts — البلاغات وسجل حالاتها وتأكيداتها
// (مُقسَّم من db.ts الأصلي حسب المجال الوظيفي)
// ============================================================
import { eq, desc, asc, and, sql, count, sum, inArray, notInArray, like, or, gte, lte, lt, isNull, isNotNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { alias } from "drizzle-orm/mysql-core";
import mysql from "mysql2/promise";
import {
  InsertUser, users, tickets, purchaseOrders, purchaseOrderItems,
  inventory, inventoryTransactions, notifications, auditLogs,
  ticketStatusHistory, attachments, sites, backups,
  assets, preventivePlans, pmWorkOrders, assetSpareParts, pmJobs, assetMetrics,
  pmChecklistItems, pmWorkOrderBranches,
  twoFactorSecrets, twoFactorAuditLogs,
  pushSubscriptions, sections, technicians, inspectionResults,
  type InsertAsset, type InsertPreventivePlan, type PreventivePlan, type InsertPMWorkOrder,
  type InsertSection, type InsertInspectionResult,
  assetCategories,
  procurementComments,
  type InsertProcurementComment,
  warehouseReceipts,
  warehouseReturns,
  warehouseReceiptItems,
  ocrJobs,
  type InsertWarehouseReceipt,
  type InsertWarehouseReturn,
  ticketConfirmations,
  type InsertTicketConfirmation,
  deliveryDocuments,
  returnDocuments,
  deliveryNumberCounter,
  itemBarcodeCounter,
  disposalOperations,
  disposalItems,
  disposalNumberCounter,
  poPricingBatches,
  type InsertPOPricingBatch,
  inventoryCountOperations,
  inventoryCountItems,
  inventorySettlements,
  inventorySettlementItems,
  inventoryCountNumberCounter,
  inventorySettlementNumberCounter,
} from "../../../drizzle/schema";
import { ENV } from '../env';


import { getDb } from "./client";

// ============================================================
// TICKETS
// ============================================================
export async function getNextTicketNumber() {
  const db = await getDb();
  if (!db) return "MT-2026-00001";
  
  const year = new Date().getFullYear();
  const prefix = `MT-${year}-`;

  // Find the last ticket created in the current year
  const lastTicket = await db
    .select({ ticketNumber: tickets.ticketNumber })
    .from(tickets)
    .where(like(tickets.ticketNumber, `${prefix}%`))
    .orderBy(desc(tickets.ticketNumber))
    .limit(1);

  let nextNum = 1;
  if (lastTicket && lastTicket.length > 0) {
    // Extract the numeric part (e.g., from MT-2026-00014 we get 14)
    const parts = lastTicket[0].ticketNumber.split("-");
    const lastNumStr = parts[parts.length - 1];
    const lastNum = parseInt(lastNumStr || "0", 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(5, "0")}`;
}

export async function createTicket(data: any) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(tickets).values(data);
  return result[0].insertId;
}

type TicketListFilters = { status?: string; priority?: string; siteId?: number; sectionId?: number; assetId?: number; assignedToId?: number; assignedTechnicianId?: number; reportedById?: number; search?: string; category?: string };

// شرط الفلترة المشترك بين getTickets (بدون صفحات) وgetTicketsPaginated (مع صفحات)
function buildTicketsWhere(filters?: TicketListFilters) {
  const conditions: any[] = [];
  if (filters?.status) {
    if (filters.status === "open") {
      conditions.push(ne(tickets.status, "closed" as any));
    } else {
      conditions.push(eq(tickets.status, filters.status as any));
    }
  }
  if (filters?.priority) conditions.push(eq(tickets.priority, filters.priority as any));
  if (filters?.siteId) conditions.push(eq(tickets.siteId, filters.siteId));
  if (filters?.sectionId) conditions.push(eq(tickets.sectionId, filters.sectionId));
  if (filters?.assetId) conditions.push(eq(tickets.assetId, filters.assetId));
  if (filters?.assignedToId) conditions.push(eq(tickets.assignedToId, filters.assignedToId));
  if (filters?.assignedTechnicianId) conditions.push(eq(tickets.assignedTechnicianId, filters.assignedTechnicianId));
  if (filters?.reportedById) conditions.push(eq(tickets.reportedById, filters.reportedById));
  if (filters?.search) conditions.push(or(
    like(tickets.title, `%${filters.search}%`),
    like(tickets.title_ar, `%${filters.search}%`),
    like(tickets.title_en, `%${filters.search}%`),
    like(tickets.title_ur, `%${filters.search}%`),
    like(tickets.ticketNumber, `%${filters.search}%`)
  ));
  if (filters?.category) conditions.push(eq(tickets.category, filters.category as any));
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function getTickets(filters?: TicketListFilters) {
  const db = await getDb();
  if (!db) return [];
  const where = buildTicketsWhere(filters);
  // Phase 4: join both external technicians table AND internal users table
  // to resolve display names for both assignment paths.
  const assignedUser = alias(users, "assignedUser");
  const rows = await db
    .select({
      ticket: tickets,
      technicianName: technicians.name,           // external technician name
      assignedUserName: assignedUser.name,         // internal user name
    })
    .from(tickets)
    .leftJoin(technicians, eq(tickets.assignedTechnicianId, technicians.id))
    .leftJoin(assignedUser, eq(tickets.assignedToId, assignedUser.id))
    .where(where)
    .orderBy(desc(tickets.createdAt));
  return rows.map(r => ({
    ...r.ticket,
    assignedTechnicianName: r.technicianName ?? null,   // legacy external path
    assignedToUserName: r.assignedUserName ?? null,     // Phase 4: internal path
  }));
}

// ============================================================
// صندوق البلاغات (Tickets Inbox) — فلاتر سريعة وترتيب من الخادم
// ملاحظة مهمة: هذه ليست Workflow جديدًا — مجرد شروط "عرض/قراءة" إضافية
// تُبنى فوق نفس buildTicketsWhere ونفس الجدول ونفس الحالات المعرّفة في
// drizzle/schema (ticketStatuses / ticketPriorities). لا قيم جديدة.
// ============================================================
export type TicketInboxQuickFilter = "all" | "critical" | "unassigned" | "stale" | "ready_for_closure";
export type TicketInboxSort = "important" | "newest" | "oldest" | "updated";

const STALE_HOURS = 48;

// شرط "بلاغ مفتوح" = ليس مغلقًا (نفس تعريف فلتر status="open" المستخدم في buildTicketsWhere)
function openCondition() {
  return ne(tickets.status, "closed" as any);
}

// شروط الفلاتر السريعة — تُضاف فوق شرط buildTicketsWhere ولا تستبدله
function quickFilterCondition(quickFilter?: TicketInboxQuickFilter) {
  switch (quickFilter) {
    case "critical":
      // الأولوية الحرجة الحالية (من ticketPriorities)
      return eq(tickets.priority, "critical" as any);
    case "unassigned":
      // لا يوجد فني مسند (لا داخلي ولا خارجي) — مع استبعاد المغلقة لأن الهدف المتابعة
      return and(openCondition(), isNull(tickets.assignedToId), isNull(tickets.assignedTechnicianId));
    case "stale":
      // بلاغ مفتوح لم يتغير updatedAt الخاص به منذ 48 ساعة
      return and(openCondition(), sql`${tickets.updatedAt} < (NOW() - INTERVAL ${sql.raw(String(STALE_HOURS))} HOUR)`);
    case "ready_for_closure":
      // الحالة الحالية المستخدمة في النظام للجاهزية للإغلاق (من ticketStatuses)
      return eq(tickets.status, "ready_for_closure" as any);
    default:
      return undefined;
  }
}

// ترتيب "الأهم أولًا": الحرجة ← غير المسندة ← بدون تحديث 48س ← أقدم المفتوحة ← البقية
function importantFirstRank() {
  return sql`CASE
    WHEN ${tickets.status} <> 'closed' AND ${tickets.priority} = 'critical' THEN 0
    WHEN ${tickets.status} <> 'closed' AND ${tickets.assignedToId} IS NULL AND ${tickets.assignedTechnicianId} IS NULL THEN 1
    WHEN ${tickets.status} <> 'closed' AND ${tickets.updatedAt} < (NOW() - INTERVAL ${sql.raw(String(STALE_HOURS))} HOUR) THEN 2
    WHEN ${tickets.status} <> 'closed' THEN 3
    ELSE 4
  END`;
}

// عدادات الفلاتر السريعة — نفس شرط buildTicketsWhere (وبالتالي نفس نطاق الصلاحيات
// الممرر من الراوتر) ثم عدّ كل فلتر سريع فوقه
export async function getTicketsInboxCounts(filters?: TicketListFilters) {
  const db = await getDb();
  if (!db) return { all: 0, critical: 0, unassigned: 0, stale: 0, ready_for_closure: 0 };
  const base = buildTicketsWhere(filters);
  const countWhere = async (qf?: TicketInboxQuickFilter) => {
    const extra = quickFilterCondition(qf);
    const where = base && extra ? and(base, extra) : (extra ?? base);
    const [{ cnt }] = await db.select({ cnt: count() }).from(tickets).where(where);
    return Number(cnt) || 0;
  };
  const [all, critical, unassigned, stale, ready] = await Promise.all([
    countWhere(undefined),
    countWhere("critical"),
    countWhere("unassigned"),
    countWhere("stale"),
    countWhere("ready_for_closure"),
  ]);
  return { all, critical, unassigned, stale, ready_for_closure: ready };
}

// صفحات حقيقية لقائمة البلاغات: ترجع فقط عناصر الصفحة المطلوبة + العدد الإجمالي
// لحساب عدد الصفحات بالواجهة (limit/offset على مستوى قاعدة البيانات بعد تطبيق نفس الفلاتر والبحث)
// خيارات inbox (quickFilter/sort) اختيارية ولا تغيّر السلوك الافتراضي القديم إطلاقًا
export async function getTicketsPaginated(
  filters: TicketListFilters | undefined,
  page: number = 1,
  pageSize: number = 10,
  options?: { quickFilter?: TicketInboxQuickFilter; sort?: TicketInboxSort },
) {
  const db = await getDb();
  if (!db) return { tickets: [] as any[], total: 0, page: 1, pageSize, totalPages: 1 };

  const base = buildTicketsWhere(filters);
  const extra = quickFilterCondition(options?.quickFilter);
  const where = base && extra ? and(base, extra) : (extra ?? base);

  const [{ cnt }] = await db.select({ cnt: count() }).from(tickets).where(where);
  const total = Number(cnt) || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * pageSize;

  // ترتيب النتائج: الافتراضي القديم (الأحدث أولًا) يبقى كما هو تمامًا
  const sortMode = options?.sort;
  const orderExprs =
    sortMode === "important"
      ? [asc(importantFirstRank()),
         // داخل الفئات المفتوحة (0-3): الأقدم أولًا — والبقية (المغلقة): الأحدث أولًا
         asc(sql`IF(${importantFirstRank()} < 4, UNIX_TIMESTAMP(${tickets.createdAt}), -UNIX_TIMESTAMP(${tickets.createdAt}))`)]
      : sortMode === "oldest"
        ? [asc(tickets.createdAt)]
        : sortMode === "updated"
          ? [desc(tickets.updatedAt)]
          : [desc(tickets.createdAt)]; // newest / الافتراضي القديم

  const assignedUser = alias(users, "assignedUser");
  const reporter = alias(users, "reporterUser");
  const rows = await db
    .select({
      ticket: tickets,
      technicianName: technicians.name,
      assignedUserName: assignedUser.name,
      reporterName: reporter.name,
    })
    .from(tickets)
    .leftJoin(technicians, eq(tickets.assignedTechnicianId, technicians.id))
    .leftJoin(assignedUser, eq(tickets.assignedToId, assignedUser.id))
    .leftJoin(reporter, eq(tickets.reportedById, reporter.id))
    .where(where)
    .orderBy(...orderExprs)
    .limit(pageSize)
    .offset(offset);

  return {
    tickets: rows.map(r => ({
      ...r.ticket,
      assignedTechnicianName: r.technicianName ?? null,
      assignedToUserName: r.assignedUserName ?? null,
      reportedByName: r.reporterName ?? null,
    })),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
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

// ============================================================
// TICKET CONFIRMATIONS (requester confirms completion after closure)
// ============================================================
export async function createTicketConfirmation(data: InsertTicketConfirmation) {
  const db = await getDb();
  if (!db) return;
  await db.insert(ticketConfirmations).values(data);
}

export async function getTicketConfirmation(ticketId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(ticketConfirmations).where(eq(ticketConfirmations.ticketId, ticketId)).orderBy(desc(ticketConfirmations.createdAt)).limit(1);
  return result[0] || null;
}

export async function getTicketHistory(ticketId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(ticketStatusHistory).where(eq(ticketStatusHistory.ticketId, ticketId)).orderBy(desc(ticketStatusHistory.createdAt));
}

