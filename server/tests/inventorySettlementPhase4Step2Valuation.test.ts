import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const settlementBlock = () => {
  const source = read("server/_core/db/invoice-drafts.ts");
  const start = source.indexOf("export async function applySettlement");
  const end = source.indexOf("export async function listSettlements", start);
  return source.slice(start, end);
};

describe("Main Phase 4 / Step 2 / 4.2.2 — settlement valuation and financial posting", () => {
  it("reads one trusted Count opening snapshot by operation + inventory + lot", () => {
    const block = settlementBlock();

    expect(block).toContain("inventoryCountSnapshots.operationId");
    expect(block).toContain("inventoryCountSnapshots.inventoryId");
    expect(block).toContain("inventoryCountSnapshots.lotId");
    expect(block).toContain("averageCostSnapshot: inventoryCountSnapshots.averageCostSnapshot");
    expect(block).toContain("snapshotRows.length !== 1");
  });

  it("values periodic Lot count differences at averageCostSnapshot and persists the audit fields", () => {
    const block = settlementBlock();
    const periodicStart = block.indexOf("if (isPeriodicLotSettlement)");
    const legacyStart = block.indexOf("// Legacy non-Lot path", periodicStart);
    const periodic = block.slice(periodicStart, legacyStart);

    expect(periodic).toContain("const snapshot = await readCountSnapshotCost(writer, item.inventoryId, Number(item.lotId))");
    expect(periodic).toContain("const unitCostUsed = snapshot.unitCostUsed");
    expect(periodic).toContain("const adjustmentValue = roundTo(adjustment.diffQuantity * unitCostUsed, 2)");
    expect(periodic).toContain("unitCostUsed: unitCostUsed.toFixed(4)");
    expect(periodic).toContain("adjustmentValue: adjustmentValue.toFixed(2)");
    expect(periodic).toContain("roundTo(currentTotalCostValue + adjustmentValue, 2)");
    expect(periodic).toContain("roundTo(newTotalCostValue / adjustment.afterInventoryQuantity, 4)");
    expect(periodic).toContain("unitCost: unitCostUsed.toFixed(4)");
    expect(periodic).not.toContain("calculateInventoryValue(adjustment.afterInventoryQuantity, averageCost)");
  });

  it("uses the same Snapshot rule for legacy non-Lot Count settlement", () => {
    const block = settlementBlock();
    const legacyStart = block.indexOf("// Legacy non-Lot path");
    const legacy = block.slice(legacyStart);

    expect(legacy).toContain('if (params.sourceType === "from_count")');
    expect(legacy).toContain("readCountSnapshotCost(writer, item.inventoryId, null)");
    expect(legacy).toContain("unitCostUsed = snapshot.unitCostUsed");
    expect(legacy).toContain("adjustmentValue = roundTo(diff * unitCostUsed, 2)");
  });

  it("keeps supported Manual Settlement on current average cost with no operator-entered cost", () => {
    const block = settlementBlock();
    const legacyStart = block.indexOf("// Legacy non-Lot path");
    const legacy = block.slice(legacyStart);
    const router = read("server/routers/inventory/inventoryCount.router.ts");

    expect(legacy).toContain("let unitCostUsed = averageCost");
    expect(legacy).toContain("let adjustmentValue = roundTo(diff * unitCostUsed, 2)");
    expect(legacy).toContain("let newAverageCost = averageCost");
    expect(router).not.toContain("unitCostUsed: z.");
    expect(router).not.toContain("adjustmentValue: z.");
  });

  it("preserves the established zero-quantity convention instead of dividing by zero", () => {
    const block = settlementBlock();

    expect(block).toContain("adjustment.afterInventoryQuantity === 0");
    expect(block).toContain("after === 0");
    expect(block).toContain("? averageCost");
  });

  it("records Opening Balance valuation without inventing a Snapshot that does not exist", () => {
    const block = settlementBlock();
    const openingStart = block.indexOf("if (isOpeningBalance)");
    const periodicStart = block.indexOf("if (isPeriodicLotSettlement)", openingStart);
    const opening = block.slice(openingStart, periodicStart);

    expect(opening).toContain("const openingBalanceAdjustmentValue = roundTo(diff * averageCost, 2)");
    expect(opening).toContain("unitCostUsed: averageCost.toFixed(4)");
    expect(opening).toContain("adjustmentValue: openingBalanceAdjustmentValue.toFixed(2)");
    expect(opening).not.toContain("readCountSnapshotCost");
  });

  it("does not remove Phase 3 duplicate, frozen-diff, or Manual Lot guards", () => {
    const block = settlementBlock();

    expect(block).toContain("تم تطبيق تسوية لهذا الجرد مسبقاً");
    expect(block).toContain("frozenDiff !== normalizeInventoryQuantity(countedAfter - expectedBalance)");
    expect(block).toContain("التسوية اليدوية القديمة موقوفة عند تفعيل Lots");
    expect(block).toContain("applyInventoryLotCountAdjustment");
  });
});
