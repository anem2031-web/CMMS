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
 * "الوثائق المالية المعتمدة" مع اسم المندوب — الجزء 2 من إصلاحات 2026-08-10.
 * `attachments.entityId` لهذا النوع يحمل رقم دفعة التسعير (`po_pricing_batches.id`)،
 * والمندوب هو من قدَّم الدفعة (`submittedById`) — لا عمود مندوب مباشر على
 * المرفق نفسه، فيُستنتَج بربط بسيط بجدول الدفعات ثم المستخدمين.
 *
 * دالة مخصصة منفصلة عن `getAttachmentsByType` العامة عمدًا — لا نُحمِّل كل
 * استدعاء عام لهذه الدالة (مستقبلًا لأنواع أخرى) بربط لا يخصه.
 */
export async function getFinancialBatchAttachmentsWithDelegate() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: attachments.id,
      entityType: attachments.entityType,
      entityId: attachments.entityId,
      fileName: attachments.fileName,
      fileUrl: attachments.fileUrl,
      fileKey: attachments.fileKey,
      mimeType: attachments.mimeType,
      fileSize: attachments.fileSize,
      uploadedById: attachments.uploadedById,
      createdAt: attachments.createdAt,
      delegateId: poPricingBatches.submittedById,
      delegateName: users.name,
    })
    .from(attachments)
    .leftJoin(poPricingBatches, eq(attachments.entityId, poPricingBatches.id))
    .leftJoin(users, eq(poPricingBatches.submittedById, users.id))
    .where(eq(attachments.entityType, "po_financial_batch"))
    .orderBy(desc(attachments.createdAt));
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

