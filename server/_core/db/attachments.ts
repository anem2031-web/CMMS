// ============================================================
// db/attachments.ts — المرفقات
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
  purchasePackageSubmissions,
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
import { attachmentDocumentSource, documentQueryRows } from "./document-list";

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

/**
 * كل مرفقات نوع كيان بعينه، بلا تحديد entityId — لعرض مجمَّع بمركز المستندات.
 * الخطوة الجديدة (2026-08-10): "الوثائق المالية المعتمدة"
 * (entityType = "po_financial_batch"). لا فحص صلاحية هنا — يُفرض على مستوى
 * الإجراء المستدعي (راجع attachmentsRouter.listByType، مقيَّد بأدوار مالية).
 */
export async function getAttachmentsByType(entityType: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(attachments).where(eq(attachments.entityType, entityType)).orderBy(desc(attachments.createdAt));
}

/**
 * "الوثائق المالية المعتمدة" مع اسم المندوب.
 *
 * تدعم نوعين معزولين من الارتباط داخل نفس تبويب مركز المستندات:
 * - po_financial_batch: المستندات القديمة، entityId = po_pricing_batches.id.
 * - purchase_package_submission_financial: مستند الحزمة الموحد،
 *   entityId = purchase_package_submissions.id.
 *
 * الفصل بين النوعين يمنع تداخل أرقام Pricing Batch مع أرقام دفعات الإرسال،
 * مع إبقاء واجهة مركز المستندات الحالية وقواعد صلاحياتها كما هي.
 */
export async function getFinancialBatchAttachmentsWithDelegate(actorRole?: string) {
  return allDocumentAttachments("po_financial_batch", actorRole);
}

export async function getDelegatePricingAttachmentsWithDelegate() {
  return allDocumentAttachments("delegate_pricing_documents");
}

async function allDocumentAttachments(kind: "po_financial_batch" | "delegate_pricing_documents", actorRole?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await documentQueryRows(db, sql`SELECT d.* FROM ${attachmentDocumentSource(kind, actorRole)} ORDER BY d.createdAt DESC,d.id DESC`);
  return rows.map(({ documentScope, ...row }) => ({ ...row,
    totalEstimatedCost: kind === "delegate_pricing_documents" && documentScope === "package_submission"
      ? Number(row.totalEstimatedCost || 0).toFixed(2) : row.totalEstimatedCost,
    [kind === "po_financial_batch" ? "financialDocumentScope" : "pricingDocumentScope"]: documentScope }));
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

