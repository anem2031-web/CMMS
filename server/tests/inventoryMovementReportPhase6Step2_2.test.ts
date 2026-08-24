import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  buildInventoryMovementExportDefinition,
  inventoryMovementItemKey,
  normalizeInventoryMovementFilters,
  summarizeInventoryMovementRows,
  type InventoryMovementReportResult,
  type InventoryMovementRow,
} from "../services/reports/inventoryMovementReport";

describe("Main Phase 6.2.2 Stock Card & Unified Movement Report", () => {
  it("normalizes filters and keeps Stock Card item identity stable", () => {
    expect(normalizeInventoryMovementFilters({
      movementType: "delivery",
      direction: "out",
      dateFrom: "2026-08-23",
      dateTo: "2026-08-01",
      warehouseId: 3,
      search: "  DLV-2026  ",
      itemKey: "linked:77",
    })).toEqual({
      movementType: "delivery",
      direction: "out",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-23",
      warehouseId: 3,
      search: "DLV-2026",
      itemKey: "linked:77",
    });

    expect(inventoryMovementItemKey({ linkedItemId: 77, internalCode: "INV-X", inventoryId: 9 })).toBe("linked:77");
    expect(inventoryMovementItemKey({ internalCode: "INV-X", inventoryId: 9 })).toBe("code:INV-X");
    expect(inventoryMovementItemKey({ inventoryId: 9 })).toBe("inventory:9");
  });

  it("summarizes recorded in/out movements without inventing historical opening balance", () => {
    const rows = [
      { itemKey: "code:A", direction: "in", quantity: 5 },
      { itemKey: "code:A", direction: "out", quantity: 2 },
      { itemKey: "code:B", direction: "in", quantity: 3 },
    ] as InventoryMovementRow[];

    expect(summarizeInventoryMovementRows(rows, {
      key: "code:A",
      itemName: "A",
      internalCode: "A",
      currentQuantity: 11,
      currentValue: 220,
      warehouseCount: 2,
      inventoryIds: [1, 2],
    })).toEqual({
      rows: 3,
      inMovements: 2,
      outMovements: 1,
      inQuantity: 8,
      outQuantity: 2,
      distinctItems: 2,
      currentQuantity: 11,
      currentValue: 220,
    });
  });

  it("builds RTL export rows from the same filtered movement result and preserves mixed document/Lot codes", () => {
    const report: InventoryMovementReportResult = {
      generatedAt: "2026-08-23T12:00:00.000Z",
      readOnly: true,
      filters: { search: "DLV", movementType: "delivery", direction: "out", itemKey: "code:INV-1" },
      selectedWarehouse: null,
      selectedItem: { key: "code:INV-1", itemName: "صنف Test", internalCode: "INV-1", currentQuantity: 4, currentValue: 40, warehouseCount: 1, inventoryIds: [10] },
      summary: { rows: 1, inMovements: 0, outMovements: 1, inQuantity: 0, outQuantity: 1, distinctItems: 1, currentQuantity: 4, currentValue: 40 },
      rows: [{
        transactionId: 1,
        inventoryId: 10,
        itemKey: "code:INV-1",
        itemName: "صنف Test",
        internalCode: "INV-1",
        warehouseId: 1,
        warehouseCode: "WH-MAIN",
        warehouseNameAr: "المخزن الرئيسي",
        warehouseNameEn: "Main Warehouse",
        lotId: 22,
        lotCode: "LOT-2026-ABC123",
        createdAt: "2026-08-23 12:00:00",
        direction: "out",
        transactionType: "delivery",
        quantity: 1,
        unit: "قطعة",
        unitCost: 10,
        totalCost: 10,
        reference: "DLV-2026-300215",
        invoiceNumber: null,
        reason: "اختبار",
        performerName: "User",
      }],
    };

    const definition = buildInventoryMovementExportDefinition(report, "ar");
    expect(definition.direction).toBe("rtl");
    expect(definition.rows).toHaveLength(1);
    expect(definition.rows[0]).toMatchObject({
      lot: "LOT-2026-ABC123",
      reference: "DLV-2026-300215",
      quantity: 1,
      totalCost: 10,
    });
  });

  it("keeps the DB-facing movement report service read-only", () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), "server/services/reports/inventoryMovementReport.ts"), "utf8");
    expect(source).not.toContain(".insert(");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".delete(");
    expect(source).not.toContain("withTransaction(");
  });
});
