import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Main Phase 3 / Step 3 — count cutoff and settlement governance", () => {
  it("freezes count-target Lots during an active periodic count and keeps post-open receipt Lots independent", () => {
    const source = read("server/_core/inventory-lots.ts");
    const guardStart = source.indexOf("export async function assertInventoryLotMovementAllowedDuringCount");
    const transferStart = source.indexOf("export async function resolveInventoryLotForWarehouseTransfer", guardStart);
    const guardBlock = source.slice(guardStart, transferStart);

    expect(guardBlock).toContain('row.status === "in_progress"');
    expect(guardBlock).toContain("ضمن الجرد");
    expect(guardBlock).toContain("الدفعات الجديدة الناتجة عن الاستلام بعد فتح الجرد تبقى متاحة بشكل مستقل");
    expect(guardBlock).toContain("inventoryCountItems.lotId");
    expect(guardBlock).toContain("inventoryCountSnapshots.lotId");
    expect(guardBlock).toContain("Historical pre-Snapshot counts are");
    expect(source).toContain('actionLabel: "التحويل إلى المخزن الهدف"');
  });

  it("keeps discrepant completed Lots frozen until an applied settlement item exists for the exact Lot", () => {
    const source = read("server/_core/inventory-lots.ts");
    const guardStart = source.indexOf("export async function assertInventoryLotMovementAllowedDuringCount");
    const transferStart = source.indexOf("export async function resolveInventoryLotForWarehouseTransfer", guardStart);
    const guardBlock = source.slice(guardStart, transferStart);

    expect(guardBlock).toContain("diffQuantity === 0");
    expect(guardBlock).toContain("inventorySettlements.sourceCountOperationId");
    expect(guardBlock).toContain("inventorySettlementItems.inventoryId");
    expect(guardBlock).toContain("inventorySettlementItems.lotId");
    expect(guardBlock).toContain("وبها فرق لم تتم تسويته بعد");
  });

  it("applies frozen count variance on top of the current Lot and Inventory balances", () => {
    const source = read("server/_core/inventory-lots.ts");
    const applyStart = source.indexOf("export async function applyInventoryLotCountAdjustment");
    const supplierStart = source.indexOf("export async function resolveInventoryLotForSupplierReturn", applyStart);
    const applyBlock = source.slice(applyStart, supplierStart);

    expect(applyBlock).toContain("const diff = normalizeInventoryQuantity(counted - expected)");
    expect(applyBlock).toContain("const afterLotQuantity = normalizeInventoryQuantity(currentBalance + diff)");
    expect(applyBlock).toContain("const newInventoryQuantity = normalizeInventoryQuantity(currentInventoryQuantity + diff)");
    expect(applyBlock).not.toContain("currentBalance !== expected");
  });

  it("prevents duplicate or partial count settlement and trusts the finalized count instead of client edits", () => {
    const source = read("server/_core/db/invoice-drafts.ts");
    const settlementStart = source.indexOf("export async function applySettlement");
    const listStart = source.indexOf("export async function listSettlements", settlementStart);
    const settlementBlock = source.slice(settlementStart, listStart);

    expect(settlementBlock).toContain("FOR UPDATE");
    expect(settlementBlock).toContain("تم تطبيق تسوية لهذا الجرد مسبقاً");
    expect(settlementBlock).toContain("يجب تطبيق التسوية على جميع فروقات الجرد المحفوظة معاً");
    expect(settlementBlock).toContain("Number(countItem.countedQuantity || 0)");
    expect(settlementBlock).not.toContain("const countedAfter = normalizeInventoryQuantity(item.afterQuantity)");
  });

  it("does not expose editable finalized count quantities in the count-settlement UI", () => {
    const ui = read("client/src/pages/inventory/InventoryOperations.tsx");
    const dialogStart = ui.indexOf("تسوية من نتائج الجرد");
    const independentStart = ui.indexOf("{!settlementSourceCountId", dialogStart);
    const countSettlementUi = ui.slice(dialogStart, independentStart);

    expect(countSettlementUi).toContain("فرق التسوية");
    expect(countSettlementUi).toContain("التسوية تطبق فرق الجرد المحفوظ فقط على الرصيد الحالي للدفعة");
    expect(countSettlementUi).not.toContain("بعد (قابل للتعديل)");
  });
});
