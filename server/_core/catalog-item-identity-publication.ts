import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import {
  inventory,
  inventoryLots,
  purchaseOrderItems,
  warehouseReceiptItems,
} from "../../drizzle/schema";

export interface CatalogIdentityCandidateSource {
  id: number;
  inventoryId: number;
  sourceReceiptId: number;
  sourceReceiptItemId: number;
  purchaseOrderId?: number | null;
  purchaseOrderItemId?: number | null;
}

function numericId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function assertSameCatalogIdentity(params: {
  label: string;
  currentCatalogItemId: unknown;
  targetCatalogItemId: number;
  candidateId: number;
}) {
  const current = numericId(params.currentCatalogItemId);
  if (current !== null && current !== params.targetCatalogItemId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `تعذر نشر هوية Catalog للـCandidate #${params.candidateId}: ${params.label} مرتبط مسبقاً بصنف Catalog #${current} بينما الحسم الحالي هو #${params.targetCatalogItemId}. لم يتم تغيير أي بيانات.`,
    });
  }
}

/**
 * 2B-7 — Publish the resolved Catalog identity to operational references only.
 *
 * This deliberately does NOT touch quantity, cost, receiving history, invoice
 * snapshots, or any accounting fields. Existing equal links are idempotent;
 * conflicting non-null links abort the surrounding transaction.
 */
export async function publishResolvedCatalogIdentity(
  tx: any,
  candidates: CatalogIdentityCandidateSource[],
  catalogItemId: number,
): Promise<void> {
  if (!Number.isInteger(catalogItemId) || catalogItemId <= 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "رقم صنف الكتالوج المحسوم غير صالح" });
  }

  for (const candidate of candidates) {
    const inventoryRows = await tx.select({
      id: inventory.id,
      linkedItemId: inventory.linkedItemId,
    }).from(inventory)
      .where(eq(inventory.id, candidate.inventoryId))
      .limit(1);
    const inventoryRow = inventoryRows[0] as any;
    if (!inventoryRow) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `تعذر نشر هوية Catalog للـCandidate #${candidate.id}: سجل Inventory #${candidate.inventoryId} غير موجود.`,
      });
    }
    assertSameCatalogIdentity({
      label: `Inventory #${candidate.inventoryId}`,
      currentCatalogItemId: inventoryRow.linkedItemId,
      targetCatalogItemId: catalogItemId,
      candidateId: candidate.id,
    });

    const receiptItemRows = await tx.select({
      id: warehouseReceiptItems.id,
      receiptId: warehouseReceiptItems.receiptId,
      inventoryId: warehouseReceiptItems.inventoryId,
      purchaseOrderItemId: warehouseReceiptItems.purchaseOrderItemId,
      catalogItemId: warehouseReceiptItems.catalogItemId,
    }).from(warehouseReceiptItems)
      .where(eq(warehouseReceiptItems.id, candidate.sourceReceiptItemId))
      .limit(1);
    const receiptItem = receiptItemRows[0] as any;
    if (!receiptItem) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `تعذر نشر هوية Catalog للـCandidate #${candidate.id}: سطر الاستلام #${candidate.sourceReceiptItemId} غير موجود.`,
      });
    }

    if (Number(receiptItem.receiptId) !== Number(candidate.sourceReceiptId)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `تعذر نشر هوية Catalog للـCandidate #${candidate.id}: سطر الاستلام لا يتبع سند الاستلام المتوقع.`,
      });
    }
    if (numericId(receiptItem.inventoryId) !== Number(candidate.inventoryId)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `تعذر نشر هوية Catalog للـCandidate #${candidate.id}: Inventory في سطر الاستلام لا يطابق Inventory المرشح.`,
      });
    }
    assertSameCatalogIdentity({
      label: `Receipt Item #${candidate.sourceReceiptItemId}`,
      currentCatalogItemId: receiptItem.catalogItemId,
      targetCatalogItemId: catalogItemId,
      candidateId: candidate.id,
    });

    // 2B-8: الصنف الجديد قد يملك Receipt Lot وQR قبل اعتماد Master Catalog.
    // عند الحسم ننشر نفس الهوية إلى كل Lots المنشأة من سطر الاستلام نفسه،
    // مع نفس قاعدة عدم الكتابة فوق Catalog identity مختلفة.
    const lotRows = await tx.select({
      id: inventoryLots.id,
      catalogItemId: inventoryLots.catalogItemId,
    }).from(inventoryLots)
      .where(eq(inventoryLots.receiptItemId, candidate.sourceReceiptItemId));
    for (const lot of lotRows as any[]) {
      assertSameCatalogIdentity({
        label: `Inventory Lot #${lot.id}`,
        currentCatalogItemId: lot.catalogItemId,
        targetCatalogItemId: catalogItemId,
        candidateId: candidate.id,
      });
    }

    const candidatePoItemId = numericId(candidate.purchaseOrderItemId);
    const receiptPoItemId = numericId(receiptItem.purchaseOrderItemId);
    if (candidatePoItemId !== null && receiptPoItemId !== null && candidatePoItemId !== receiptPoItemId) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `تعذر نشر هوية Catalog للـCandidate #${candidate.id}: بند طلب الشراء في Candidate لا يطابق سطر الاستلام.`,
      });
    }

    const purchaseOrderItemId = candidatePoItemId ?? receiptPoItemId;
    let purchaseOrderItem: any = null;
    if (purchaseOrderItemId !== null) {
      const poItemRows = await tx.select({
        id: purchaseOrderItems.id,
        purchaseOrderId: purchaseOrderItems.purchaseOrderId,
        catalogItemId: purchaseOrderItems.catalogItemId,
      }).from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.id, purchaseOrderItemId))
        .limit(1);
      purchaseOrderItem = poItemRows[0] as any;
      if (!purchaseOrderItem) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `تعذر نشر هوية Catalog للـCandidate #${candidate.id}: بند طلب الشراء #${purchaseOrderItemId} غير موجود.`,
        });
      }
      if (candidate.purchaseOrderId != null && Number(purchaseOrderItem.purchaseOrderId) !== Number(candidate.purchaseOrderId)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `تعذر نشر هوية Catalog للـCandidate #${candidate.id}: بند طلب الشراء لا يتبع طلب الشراء المتوقع.`,
        });
      }
      assertSameCatalogIdentity({
        label: `PO Item #${purchaseOrderItemId}`,
        currentCatalogItemId: purchaseOrderItem.catalogItemId,
        targetCatalogItemId: catalogItemId,
        candidateId: candidate.id,
      });
    }

    if (numericId(inventoryRow.linkedItemId) === null) {
      await tx.update(inventory).set({ linkedItemId: catalogItemId } as any).where(and(
        eq(inventory.id, candidate.inventoryId),
        isNull(inventory.linkedItemId),
      ));
    }

    if (numericId(receiptItem.catalogItemId) === null) {
      await tx.update(warehouseReceiptItems).set({ catalogItemId } as any).where(and(
        eq(warehouseReceiptItems.id, candidate.sourceReceiptItemId),
        isNull(warehouseReceiptItems.catalogItemId),
      ));
    }

    if (lotRows.length > 0) {
      await tx.update(inventoryLots).set({ catalogItemId } as any).where(and(
        eq(inventoryLots.receiptItemId, candidate.sourceReceiptItemId),
        isNull(inventoryLots.catalogItemId),
      ));
    }

    if (purchaseOrderItemId !== null && numericId(purchaseOrderItem?.catalogItemId) === null) {
      await tx.update(purchaseOrderItems).set({ catalogItemId } as any).where(and(
        eq(purchaseOrderItems.id, purchaseOrderItemId),
        isNull(purchaseOrderItems.catalogItemId),
      ));
    }
  }
}
