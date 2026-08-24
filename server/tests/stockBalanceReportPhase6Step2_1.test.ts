import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildStockBalanceExportDefinition,
  classifyStockBalanceStatus,
  summarizeStockBalanceRows,
  type StockBalanceReportResult,
  type StockBalanceRow,
} from "../services/reports/inventoryStockBalanceReport";

const baseRow = (overrides: Partial<StockBalanceRow> = {}): StockBalanceRow => ({
  inventoryId: 210274,
  itemName: "سيكا رابيد 2 مواد سرعة تصلب",
  internalCode: "INV-210274",
  warehouseId: 1,
  warehouseCode: "WH-MAIN",
  warehouseNameAr: "المخزن الرئيسي",
  warehouseNameEn: "Main Warehouse",
  quantity: 5,
  unit: "قطعة",
  minQuantity: 2,
  averageCost: 10,
  totalCostValue: 50,
  status: "normal",
  lotTracked: true,
  lots: [{
    lotId: 25,
    lotCode: "LOT-2026-191EEB06",
    trackingToken: "CMMS-LOT-191eeb06",
    balanceQuantity: 5,
    remainingQuantity: 5,
    expiryDate: null,
  }],
  ...overrides,
});

describe("Main Phase 6.2.1 Stock Balance & Status", () => {
  it("classifies negative, zero, low, and normal stock with zero taking precedence over minimum", () => {
    expect(classifyStockBalanceStatus(-1, 5)).toBe("negative");
    expect(classifyStockBalanceStatus(0, 5)).toBe("zero");
    expect(classifyStockBalanceStatus(2, 2)).toBe("low");
    expect(classifyStockBalanceStatus(2.001, 2)).toBe("normal");
    expect(classifyStockBalanceStatus(5, 0)).toBe("normal");
  });

  it("summarizes only the report rows in the active filter result", () => {
    const rows = [
      baseRow(),
      baseRow({ inventoryId: 2, status: "low", quantity: 1 }),
      baseRow({ inventoryId: 3, status: "zero", quantity: 0, lotTracked: false, lots: [] }),
    ];
    expect(summarizeStockBalanceRows(rows)).toEqual({
      rows: 3,
      normal: 1,
      low: 1,
      zero: 1,
      negative: 0,
      lotTracked: 2,
    });
  });

  it("builds an RTL export definition from the same filtered rows and preserves Lot codes", () => {
    const report: StockBalanceReportResult = {
      generatedAt: "2026-08-23T12:00:00.000Z",
      readOnly: true,
      filters: { search: "سيكا", warehouseId: 1, status: "normal" },
      summary: { rows: 1, normal: 1, low: 0, zero: 0, negative: 0, lotTracked: 1 },
      warehouses: [{ id: 1, code: "WH-MAIN", nameAr: "المخزن الرئيسي", nameEn: "Main Warehouse", isActive: 1 }],
      rows: [baseRow()],
    };

    const definition = buildStockBalanceExportDefinition(report, "ar");
    expect(definition.direction).toBe("rtl");
    expect(definition.rows).toHaveLength(1);
    expect(definition.rows[0].lots).toContain("LOT-2026-191EEB06");
    expect(definition.filters?.map((filter) => filter.value).join(" ")).toContain("WH-MAIN");
  });

  it("keeps the DB-facing report service read-only", () => {
    const source = readFileSync(new URL("../services/reports/inventoryStockBalanceReport.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/withTransaction\s*\(/);
  });
});
