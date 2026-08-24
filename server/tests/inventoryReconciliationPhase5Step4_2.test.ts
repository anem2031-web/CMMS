import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateInventoryValueTolerance,
  evaluateInventoryReconciliation,
} from "../services/inventory-reconciliation-core";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const config = { quantityScale: 3, averageCostScale: 4, valueScale: 2 };

function baseRows() {
  return {
    inventoryRows: [
      {
        id: 1,
        itemName: "Future item",
        warehouseId: 10,
        quantity: 4,
        averageCost: "10.0000",
        totalCostValue: "40.00",
      },
    ],
    lotRows: [{ id: 20, lotCode: "LOT-FUTURE", remainingQuantity: "4.000" }],
    lotBalanceRows: [{ id: 30, lotId: 20, inventoryId: 1, quantity: "4.000" }],
    warehouseRows: [{ id: 10 }],
    lotsEnabled: true,
  };
}

describe("Main Phase 5 / 5.4.2 — Read-only Reconciliation Engine", () => {
  it("passes a consistent Lot-tracked current state", () => {
    const result = evaluateInventoryReconciliation(baseRows(), config);
    expect(result.readOnly).toBe(true);
    expect(result.scope.historicalReconstructionIncluded).toBe(false);
    expect(result.scope.autoFixIncluded).toBe(false);
    expect(result.scope.trackedInventoryRows).toBe(1);
    expect(result.exceptions).toEqual([]);
    expect(result.summary.exceptionChecks).toBe(0);
  });

  it("detects aggregate Inventory and global Lot quantity mismatches", () => {
    const rows = baseRows();
    rows.inventoryRows[0].quantity = 5;
    rows.lotRows[0].remainingQuantity = "6.000";
    const result = evaluateInventoryReconciliation(rows, config);
    const codes = result.exceptions.map((item) => item.code);
    expect(codes).toContain("INVENTORY_LOT_QUANTITY_MISMATCH");
    expect(codes).toContain("LOT_GLOBAL_BALANCE_MISMATCH");
  });

  it("detects negative balances and broken references without repairing them", () => {
    const rows = baseRows();
    rows.lotBalanceRows[0].quantity = "-1.000";
    rows.inventoryRows[0].quantity = -1;
    rows.lotRows[0].remainingQuantity = "-1.000";
    const result = evaluateInventoryReconciliation(rows, config);
    const codes = result.exceptions.map((item) => item.code);
    expect(codes).toContain("NEGATIVE_INVENTORY_QUANTITY");
    expect(codes).toContain("NEGATIVE_LOT_BALANCE");
    expect(codes).toContain("NEGATIVE_LOT_REMAINING");
    expect(result.scope.autoFixIncluded).toBe(false);
  });

  it("ignores legacy/non-Lot Inventory rows for quantity/value reconciliation", () => {
    const rows = baseRows();
    rows.inventoryRows.push({
      id: 999,
      itemName: "Legacy experimental",
      warehouseId: 10,
      quantity: 5,
      averageCost: "12.0000",
      totalCostValue: "108.00",
    });
    const result = evaluateInventoryReconciliation(rows, config);
    expect(result.scope.inventoryRowsOutsideLotTrackedScope).toBe(1);
    expect(result.exceptions.some((item) => item.inventoryId === 999)).toBe(false);
  });

  it("uses the approved dynamic value tolerance and flags material value drift", () => {
    expect(calculateInventoryValueTolerance(4, config)).toBe(0.01);
    expect(calculateInventoryValueTolerance(1000, config)).toBe(0.05);
    expect(calculateInventoryValueTolerance(0, config)).toBe(0);

    const rows = baseRows();
    rows.inventoryRows[0].totalCostValue = "40.02";
    const result = evaluateInventoryReconciliation(rows, config);
    expect(result.exceptions.map((item) => item.code)).toContain("INVENTORY_VALUE_MISMATCH");
  });

  it("detects duplicate mapping of one Lot to multiple Inventory rows in one warehouse", () => {
    const rows = baseRows();
    rows.inventoryRows.push({
      id: 2,
      itemName: "Future item duplicate",
      warehouseId: 10,
      quantity: 1,
      averageCost: "10.0000",
      totalCostValue: "10.00",
    });
    rows.lotBalanceRows.push({ id: 31, lotId: 20, inventoryId: 2, quantity: "1.000" });
    rows.lotRows[0].remainingQuantity = "5.000";
    const result = evaluateInventoryReconciliation(rows, config);
    expect(result.exceptions.map((item) => item.code)).toContain("DUPLICATE_LOT_WITHIN_WAREHOUSE");
  });

  it("keeps the DB-facing service and router strictly read-only", () => {
    const service = read("server/services/inventory-reconciliation.ts");
    const router = read("server/routers/inventory/reconciliation.router.ts");
    const index = read("server/routers/index.ts");

    const dbFacingStart = service.indexOf("export async function runInventoryReconciliation");
    const dbFacing = service.slice(dbFacingStart);
    expect(dbFacing).toContain("database.select");
    expect(dbFacing).not.toMatch(/database\.(insert|update|delete)\s*\(/);
    expect(dbFacing).not.toContain("transaction(");
    expect(router).toContain("inventoryReadProcedure.query");
    expect(router).not.toContain(".mutation(");
    expect(index).toContain("inventoryReconciliation: reconciliationRouter");
  });
});
