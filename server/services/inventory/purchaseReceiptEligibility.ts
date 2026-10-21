import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { purchaseOrders, purchaseOrderItems, warehouseReceiptItems, warehouseReceipts } from "../../../drizzle/schema";

type ReceiptCandidate = {
  id: number;
  purchaseOrderId: number;
  status: string;
  supplierInvoiceNumber?: string | null;
};

// The receipt workflow is item-scoped. A later pricing batch must not hide
// already delivered items merely because the parent returns to approved.
export function eligiblePurchaseReceiptItems<T extends ReceiptCandidate>(
  items: T[], confirmedItemIds: number[], invoiceNumber?: string,
): T[] {
  const confirmed = new Set(confirmedItemIds);
  return items.filter(item =>
    item.status === "delivered_to_warehouse" &&
    !confirmed.has(item.id) &&
    (invoiceNumber === undefined || item.supplierInvoiceNumber === invoiceNumber ||
      (invoiceNumber === "بدون رقم فاتورة" && !item.supplierInvoiceNumber)),
  );
}

export function receiptOrderScope(purchaseOrderId: number, purchaseOrderIds?: number[], invoiceNumber?: string) {
  const ids = Array.from(new Set([purchaseOrderId, ...(purchaseOrderIds || [])])).sort((a, b) => a - b);
  if (ids.length > 500 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "نطاق طلبات الاستلام غير صالح" });
  }
  if (ids.length > 1 && (!invoiceNumber?.trim() || invoiceNumber === "بدون رقم فاتورة")) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "تجميع عدة طلبات يتطلب رقم فاتورة مورد محدداً" });
  }
  return ids;
}

export async function getPurchaseReceiptContext(database: any, purchaseOrderId: number, invoiceNumber?: string, purchaseOrderIds?: number[]) {
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الاتصال بقاعدة البيانات" });
  const ids = receiptOrderScope(purchaseOrderId, purchaseOrderIds, invoiceNumber);
  const orders = await database.select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber })
    .from(purchaseOrders).where(ids.length === 1 ? eq(purchaseOrders.id, purchaseOrderId) : inArray(purchaseOrders.id, ids)).limit(500);
  const po = orders.find((row: any) => Number(row.id) === purchaseOrderId);
  if (!po || orders.length !== ids.length) throw new TRPCError({ code: "NOT_FOUND", message: "أحد طلبات الشراء غير موجود" });

  // Only fields consumed by receiving; no parent approvals, comments or other items.
  const items = await database.select({
    id: purchaseOrderItems.id, purchaseOrderId: purchaseOrderItems.purchaseOrderId,
    status: purchaseOrderItems.status, supplierInvoiceNumber: purchaseOrderItems.supplierInvoiceNumber,
    itemName: purchaseOrderItems.itemName, quantity: purchaseOrderItems.quantity,
    receivedQuantity: purchaseOrderItems.receivedQuantity, unit: purchaseOrderItems.unit,
    catalogItemId: purchaseOrderItems.catalogItemId,
    actualUnitCost: purchaseOrderItems.actualUnitCost, estimatedUnitCost: purchaseOrderItems.estimatedUnitCost,
  }).from(purchaseOrderItems).where(and(
    ids.length === 1 ? eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId) : inArray(purchaseOrderItems.purchaseOrderId, ids),
    eq(purchaseOrderItems.status, "delivered_to_warehouse"),
  ));
  const confirmed = await database.select({ itemId: warehouseReceiptItems.purchaseOrderItemId })
    .from(warehouseReceiptItems)
    .innerJoin(warehouseReceipts, eq(warehouseReceipts.id, warehouseReceiptItems.receiptId))
    .innerJoin(purchaseOrderItems, eq(purchaseOrderItems.id, warehouseReceiptItems.purchaseOrderItemId))
    .where(and(ids.length === 1 ? eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId) : inArray(purchaseOrderItems.purchaseOrderId, ids), eq(warehouseReceipts.status, "confirmed")));
  return { ...po, ...(ids.length > 1 ? { purchaseOrders: orders } : {}), items: eligiblePurchaseReceiptItems(items, confirmed.map((r: any) => Number(r.itemId)), invoiceNumber) };
}

export function validatePurchaseReceiptSelection(
  purchaseOrderId: number, selectedIds: number[], currentItems: ReceiptCandidate[], confirmedItemIds: number[],
  purchaseOrderIds?: number[], invoiceNumber?: string,
): void {
  if (!selectedIds.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "اختر صنفاً مؤهلاً من طلب الشراء. للاستلام دون بنود طلب استخدم الاستلام المستقل." });
  }
  if (new Set(selectedIds).size !== selectedIds.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تكرار نفس بند طلب الشراء في سند الاستلام" });
  }
  const scope = new Set(receiptOrderScope(purchaseOrderId, purchaseOrderIds, invoiceNumber));
  const valid = new Set(eligiblePurchaseReceiptItems(
    currentItems.filter(item => scope.has(item.purchaseOrderId)), [], invoiceNumber,
  ).map(item => item.id));
  if (selectedIds.some(id => !valid.has(id))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "أحد الأصناف لا ينتمي لهذا الطلب أو لم يعد مؤهلاً للاستلام. حدّث الصفحة." });
  }
  if (selectedIds.some(id => confirmedItemIds.includes(id))) {
    throw new TRPCError({ code: "CONFLICT", message: "سبق إكمال إدخال أحد الأصناف للمخزون. حدّث الصفحة لتجنب تكرار الاستلام." });
  }
}

// Called BEFORE writes, inside the existing receipt transaction. Locking the
// same PO item rows serializes competing saves through this endpoint. The
// confirmed-receipt check is also a current/locking read (not an old snapshot).
export async function lockAndValidatePurchaseReceiptItems(
  tx: any, purchaseOrderId: number, items: Array<{ purchaseOrderItemId?: number }>,
  purchaseOrderIds?: number[], invoiceNumber?: string,
): Promise<void> {
  const scope = receiptOrderScope(purchaseOrderId, purchaseOrderIds, invoiceNumber);
  const ids = items.map(item => item.purchaseOrderItemId).filter((id): id is number => id != null);
  if (!ids.length || new Set(ids).size !== ids.length) {
    validatePurchaseReceiptSelection(purchaseOrderId, ids, [], []);
  }
  const sortedIds = [...ids].sort((a, b) => a - b);
  const current = await tx.select({
    id: purchaseOrderItems.id, purchaseOrderId: purchaseOrderItems.purchaseOrderId, status: purchaseOrderItems.status,
    supplierInvoiceNumber: purchaseOrderItems.supplierInvoiceNumber,
  }).from(purchaseOrderItems)
    .where(and(scope.length === 1 ? eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId) : inArray(purchaseOrderItems.purchaseOrderId, scope), inArray(purchaseOrderItems.id, sortedIds)))
    .orderBy(asc(purchaseOrderItems.id)).for("update");
  const confirmed = await tx.select({ itemId: warehouseReceiptItems.purchaseOrderItemId })
    .from(warehouseReceiptItems)
    .innerJoin(warehouseReceipts, eq(warehouseReceipts.id, warehouseReceiptItems.receiptId))
    .where(and(inArray(warehouseReceiptItems.purchaseOrderItemId, sortedIds), eq(warehouseReceipts.status, "confirmed")))
    .for("update");
  validatePurchaseReceiptSelection(purchaseOrderId, ids, current, confirmed.map((r: any) => Number(r.itemId)), purchaseOrderIds, invoiceNumber);
}
