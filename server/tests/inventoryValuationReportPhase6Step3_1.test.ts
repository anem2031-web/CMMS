import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildInventoryValuationExportDefinition,
  classifyInventoryValuationStatus,
  normalizeInventoryValuationFilters,
  summarizeInventoryValuationRows,
  type InventoryValuationReportResult,
  type InventoryValuationRow,
} from "../services/reports/inventoryValuationReport";

const baseRow = (overrides: Partial<InventoryValuationRow> = {}): InventoryValuationRow => ({
  inventoryId: 210274,
  itemName: "سيكا رابيد 2 مواد سرعة تصلب",
  internalCode: "INV-210274",
  warehouseId: 1,
  warehouseCode: "WH-MAIN",
  warehouseNameAr: "المخزن الرئيسي",
  warehouseNameEn: "Main Warehouse",
  quantity: 3,
  unit: "قطعة",
  averageCost: 10,
  totalCostValue: 30,
  status: "positive",
  ...overrides,
});

describe("Main Phase 6.3.1 Inventory Valuation Report", () => {
  it("classifies the stored inventory value without recalculating valuation", () => {
    expect(classifyInventoryValuationStatus(30)).toBe("positive");
    expect(classifyInventoryValuationStatus(0)).toBe("zero");
    expect(classifyInventoryValuationStatus(-1)).toBe("negative");
  });

  it("summarizes the filtered rows from stored totalCostValue", () => {
    const rows = [
      baseRow({ totalCostValue: 30, status: "positive" }),
      baseRow({ inventoryId: 2, warehouseId: 2, totalCostValue: 10, status: "positive" }),
      baseRow({ inventoryId: 3, totalCostValue: 0, status: "zero" }),
    ];
    expect(summarizeInventoryValuationRows(rows)).toEqual({
      rows: 3,
      totalValue: 40,
      positiveValueRows: 2,
      zeroValueRows: 1,
      negativeValueRows: 0,
      warehouses: 2,
    });
  });

  it("normalizes filters and exports the same stored value in RTL", () => {
    expect(normalizeInventoryValuationFilters({ search: "  سيكا  ", warehouseId: 1, status: "positive" })).toEqual({
      search: "سيكا",
      warehouseId: 1,
      status: "positive",
    });

    const report: InventoryValuationReportResult = {
      generatedAt: "2026-08-23T14:00:00.000Z",
      readOnly: true,
      basis: "stored_inventory_value",
      filters: { search: "سيكا", warehouseId: 1, status: "positive" },
      summary: { rows: 1, totalValue: 30, positiveValueRows: 1, zeroValueRows: 0, negativeValueRows: 0, warehouses: 1 },
      warehouses: [{ id: 1, code: "WH-MAIN", nameAr: "المخزن الرئيسي", nameEn: "Main Warehouse", isActive: 1 }],
      rows: [baseRow()],
    };

    const definition = buildInventoryValuationExportDefinition(report, "ar");
    expect(definition.direction).toBe("rtl");
    expect(definition.rows).toHaveLength(1);
    expect(definition.rows[0].value).toBe(30);
    expect(definition.filters?.map((f) => f.value).join(" ")).toContain("WH-MAIN");
  });

  it("keeps the DB-facing valuation service read-only", () => {
    const source = readFileSync(new URL("../services/reports/inventoryValuationReport.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/withTransaction\s*\(/);
    expect(source).toContain('basis: "stored_inventory_value"');
  });
});
