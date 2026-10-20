import { asc, inArray } from "drizzle-orm";
import { purchaseOrders, purchaseOrderItems, purchasePackageSubmissions, poPricingBatches } from "../../../drizzle/schema";
import { readScopeChunks, groupReadRows } from "../authz/read-batch";
import { getDb } from "./client";

async function connection(database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("تعذر تحميل نطاق بيانات الشراء");
  return db;
}

export async function getPurchaseOrdersByIds(ids: number[], database?: any): Promise<any[]> {
  if (!ids.length) return [];
  const db = await connection(database);
  return readScopeChunks(ids, selected => db.select().from(purchaseOrders).where(inArray(purchaseOrders.id, selected)));
}

export async function getPurchaseOrdersForPackages(ids: number[], database?: any): Promise<any[]> {
  if (!ids.length) return [];
  const db = await connection(database);
  return readScopeChunks(ids, selected => db.select().from(purchaseOrders)
    .where(inArray(purchaseOrders.packageId, selected)).orderBy(asc(purchaseOrders.id)));
}

/** Full getPOItems shape and per-order ID ordering, not the small actionable DTO. */
export async function getFullPOItemsForPOs(ids: number[], database?: any): Promise<any[]> {
  if (!ids.length) return [];
  const db = await connection(database);
  return readScopeChunks(ids, selected => db.select().from(purchaseOrderItems)
    .where(inArray(purchaseOrderItems.purchaseOrderId, selected)).orderBy(asc(purchaseOrderItems.id)));
}

/** Both levels are batched. Every submission includes ALL its batches. */
export async function getPackageSubmissionsWithBatchesForPackages(ids: number[], database?: any): Promise<any[]> {
  if (!ids.length) return [];
  const db = await connection(database);
  const submissions: any[] = await readScopeChunks(ids, selected => db.select().from(purchasePackageSubmissions)
    .where(inArray(purchasePackageSubmissions.purchasePackageId, selected)).orderBy(asc(purchasePackageSubmissions.subNumber)));
  const batches: any[] = await readScopeChunks(submissions.map(row => Number(row.id)), selected => db.select().from(poPricingBatches)
    .where(inArray(poPricingBatches.purchasePackageSubmissionId, selected)).orderBy(asc(poPricingBatches.id)));
  const grouped = groupReadRows(batches, row => Number(row.purchasePackageSubmissionId));
  return submissions.map(row => ({ ...row, batches: grouped.get(Number(row.id)) ?? [] }));
}
