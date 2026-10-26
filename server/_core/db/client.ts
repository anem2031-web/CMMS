// ============================================================
// db/client.ts — اتصال قاعدة البيانات (Pool) والمعاملات
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
import { guardObserverSqlClient } from '../authz/observer-read-scope';
import { databaseConnectionOptions } from './connection-config';



let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;
let _connecting: Promise<ReturnType<typeof drizzle> | null> | null = null;

export async function getDb() {
  if (_db) return _db;
  if (!process.env.DATABASE_URL) return null;
  if (_connecting) return _connecting;

  _connecting = (async () => {
    let candidatePool: mysql.Pool | null = null;
    try {
      const connection = databaseConnectionOptions(process.env.DATABASE_URL!, ENV.databaseSslMode);
      // استخدام Pool بدل اتصال واحد — يعيد الاتصال تلقائياً عند الانقطاع
      candidatePool = mysql.createPool({
        ...connection,
        waitForConnections: true,
        connectionLimit:    10,
        queueLimit:         0,
        enableKeepAlive:    true,
        keepAliveInitialDelay: 30000,
        connectTimeout:     60000,
      });
      // createPool is lazy; a real query is required before announcing that
      // the database is ready or allowing background jobs to start.
      await candidatePool.query("SELECT 1");
      _pool = candidatePool;
      _db = drizzle(guardObserverSqlClient(candidatePool) as any);
      console.log("[Database] Secure connection verified");
      return _db;
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      try { await candidatePool?.end(); } catch {}
      _db   = null;
      _pool = null;
      return null;
    } finally {
      _connecting = null;
    }
  })();

  return _connecting;
}

// ─────────────────────────────────────────────────────────────
// تنفيذ مجموعة عمليات ضمن معاملة DB واحدة (Atomicity)
// أي دالة تُستدعى داخل fn يجب أن تستقبل ويستخدم نفس الـ tx الممرَّر
// (وإلا فهي تعمل على اتصال منفصل من الـ Pool ولا تكون جزءاً من المعاملة)
// عند فشل أي خطوة، تُلغى (rollback) كل الكتابات السابقة داخل نفس fn تلقائياً
// ─────────────────────────────────────────────────────────────
export async function withTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const database = await getDb();
  if (!database) throw new Error("قاعدة البيانات غير متاحة");
  return database.transaction(fn);
}

// إعادة الاتصال عند انقطاع ECONNRESET
export async function resetDb() {
  console.warn("[Database] Resetting connection pool...");
  try { await _pool?.end(); } catch {}
  _db   = null;
  _pool = null;
  _connecting = null;
  return getDb();
}

// معالجة أخطاء الاتصال تلقائياً
process.on("uncaughtException", async (err: any) => {
  if (err?.code === "ECONNRESET" || err?.cause?.code === "ECONNRESET") {
    console.warn("[Database] ECONNRESET detected — resetting pool...");
    await resetDb();
  }
});

