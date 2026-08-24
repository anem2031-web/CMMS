import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildInventoryAccountingReviewExportDefinition,
  buildInventoryAccountingReviewRows,
  normalizeInventoryAccountingReviewFilters,
  type InventoryAccountingReviewReportResult,
} from "../services/reports/inventoryAccountingReviewReport";
import type { InventoryValuationRow } from "../services/reports/inventoryValuationReport";
import type { InventoryReconciliationException } from "../services/inventory-reconciliation-core";

const valuationRow = (overrides: Partial<InventoryValuationRow> = {}): InventoryValuationRow => ({
  inventoryId: 1,
  itemName: "Item A",
  internalCode: "INV-A",
  warehouseId: 10,
  warehouseCode: "WH-MAIN",
  warehouseNameAr: "المخزن الرئيسي",
  warehouseNameEn: "Main Warehouse",
  quantity: 10,
  unit: "قطعة",
  averageCost: 20,
  totalCostValue: 180,
  status: "positive",
  ...overrides,
});

const reconciliationException = (overrides: Partial<InventoryReconciliationException> = {}): InventoryReconciliationException => ({
  code: "INVENTORY_VALUE_MISMATCH",
  entityType: "inventory",
  inventoryId: 1,
  lotId: null,
  warehouseId: 10,
  itemName: "Item A",
  lotCode: null,
  currentValue: 180,
  expectedValue: 200,
  difference: -20,
  tolerance: 0.01,
  message: "stored value differs within the accepted 5.4 rule",
  ...overrides,
});

const taxonomy = [{
  inventoryId: 1,
  catalogNodeId: 90,
  catalogNodeCode: "CAT-A",
  catalogNodeNameAr: "مواد",
  catalogNodeNameEn: "Materials",
  catalogCategoryPathAr: "المواد › مواد",
  catalogCategoryPathEn: "Materials > Materials",
}];

describe("Merged Main Phase 6.3.2 Inventory Variance & Accounting Review", () => {
  it("reuses authoritative 5.4 value-mismatch evidence without changing stored valuation", () => {
    const rows = buildInventoryAccountingReviewRows(
      [valuationRow()],
      taxonomy,
      [reconciliationException()],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].totalCostValue).toBe(180);
    expect(rows[0].averageCost).toBe(20);
    expect(rows[0].conditions[0]).toMatchObject({
      condition: "value_mismatch",
      reconciliationCode: "INVENTORY_VALUE_MISMATCH",
      currentValue: 180,
      expectedValue: 200,
      difference: -20,
    });
  });

  it("surfaces negative stored value as review visibility only and preserves uncategorized rows", () => {
    const rows = buildInventoryAccountingReviewRows(
      [valuationRow({ inventoryId: 2, totalCostValue: -5, status: "negative" })],
      taxonomy,
      [],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].uncategorized).toBe(true);
    expect(rows[0].categoryKey).toBe("uncategorized");
    expect(rows[0].totalCostValue).toBe(-5);
    expect(rows[0].conditions.map((item) => item.condition)).toEqual(["negative_stored_value"]);
  });

  it("does not invent a review exception for a normal row when 5.4 has no accepted exception", () => {
    expect(buildInventoryAccountingReviewRows([valuationRow({ totalCostValue: 200 })], taxonomy, [])).toEqual([]);
  });

  it("normalizes only supported current-state review filters", () => {
    expect(normalizeInventoryAccountingReviewFilters({
      search: "  Item  ",
      warehouseId: 10,
      status: "positive",
      category: "node:90",
      condition: "value_mismatch",
    })).toEqual({
      search: "Item",
      warehouseId: 10,
      status: "positive",
      category: "node:90",
      condition: "value_mismatch",
    });

    expect(normalizeInventoryAccountingReviewFilters({ category: "bad", condition: "all" })).toMatchObject({ category: "all" });
  });

  it("exports the same stored value and active review filters", () => {
    const reviewRow = buildInventoryAccountingReviewRows([valuationRow()], taxonomy, [reconciliationException()])[0];
    const report: InventoryAccountingReviewReportResult = {
      generatedAt: "2026-08-24T07:00:00.000Z",
      readOnly: true,
      basis: "stored_inventory_value",
      reconciliationBasis: "main_phase_5_4_read_only",
      autoFixIncluded: false,
      revaluationIncluded: false,
      historicalBackfillIncluded: false,
      filters: { search: "Item", warehouseId: 10, status: "positive", category: "node:90", condition: "value_mismatch" },
      summary: {
        checkedInventoryRows: 1,
        reviewRows: 1,
        withoutDetectedReview: 0,
        valueMismatchRows: 1,
        negativeStoredValueRows: 0,
        negativeQuantityRows: 0,
        otherReconciliationRows: 0,
      },
      warehouses: [{ id: 10, code: "WH-MAIN", nameAr: "المخزن الرئيسي", nameEn: "Main Warehouse", isActive: 1 }],
      categories: [{ key: "node:90", nodeId: 90, code: "CAT-A", nameAr: "مواد", nameEn: "Materials", pathAr: "المواد › مواد", pathEn: "Materials > Materials", uncategorized: false }],
      reconciliationPath: "/inventory/reconciliation",
      rows: [reviewRow],
    };

    const definition = buildInventoryAccountingReviewExportDefinition(report, "ar");
    expect(definition.rows[0].storedValue).toBe(180);
    expect(definition.rows[0].expected).toBe(200);
    expect(definition.filters?.map((item) => item.value).join(" | ")).toContain("WH-MAIN");
    expect(definition.filters?.map((item) => item.value).join(" | ")).toContain("فرق قيمة");
  });

  it("keeps merged 6.3.2 read-only and reuses 6.3.1 + 5.4 instead of forking reconciliation", () => {
    const source = readFileSync(new URL("../services/reports/inventoryAccountingReviewReport.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/withTransaction\s*\(/);
    expect(source).toContain("loadInventoryValuationReport");
    expect(source).toContain("runInventoryReconciliation");
    expect(source).toContain('basis: "stored_inventory_value"');
    expect(source).toContain('reconciliationBasis: "main_phase_5_4_read_only"');
    expect(source).toContain("autoFixIncluded: false");
    expect(source).toContain("revaluationIncluded: false");
    expect(source).toContain("historicalBackfillIncluded: false");
  });
});
