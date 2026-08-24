import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildInventoryValueDistributionExportDefinition,
  groupInventoryValueByCategory,
  groupInventoryValueByWarehouse,
  type InventoryValueDistributionReportResult,
} from "../services/reports/inventoryValueDistributionReport";
import type { InventoryValuationRow } from "../services/reports/inventoryValuationReport";

const row = (overrides: Partial<InventoryValuationRow> = {}): InventoryValuationRow => ({
  inventoryId: 1,
  itemName: "Item A",
  internalCode: "INV-A",
  warehouseId: 10,
  warehouseCode: "WH-MAIN",
  warehouseNameAr: "المخزن الرئيسي",
  warehouseNameEn: "Main Warehouse",
  quantity: 3,
  unit: "قطعة",
  averageCost: 999,
  totalCostValue: 30,
  status: "positive",
  ...overrides,
});

const taxonomy = [
  {
    inventoryId: 1,
    catalogItemId: 100,
    catalogNodeId: 900,
    catalogNodeCode: "CAT-A",
    catalogNodeNameAr: "مواد",
    catalogNodeNameEn: "Materials",
    catalogCategoryPathAr: "المواد › مواد",
    catalogCategoryPathEn: "Materials > Materials",
  },
  {
    inventoryId: 2,
    catalogItemId: 100,
    catalogNodeId: 900,
    catalogNodeCode: "CAT-A",
    catalogNodeNameAr: "مواد",
    catalogNodeNameEn: "Materials",
    catalogCategoryPathAr: "المواد › مواد",
    catalogCategoryPathEn: "Materials > Materials",
  },
];

describe("Main Phase 6.3.2 Value by Warehouse / Category", () => {
  it("groups stored values by warehouse and keeps mixed quantities separated by unit", () => {
    const rows = [
      row({ totalCostValue: 30, quantity: 3, unit: "قطعة" }),
      row({ inventoryId: 2, totalCostValue: 10, quantity: 2, unit: "لتر" }),
      row({ inventoryId: 3, warehouseId: 20, warehouseCode: "SUB-1", warehouseNameAr: "فرعي", warehouseNameEn: "Sub", totalCostValue: 10, quantity: 1, unit: "قطعة" }),
    ];
    const grouped = groupInventoryValueByWarehouse(rows, 50);

    expect(grouped).toHaveLength(2);
    expect(grouped[0].warehouseId).toBe(10);
    expect(grouped[0].totalValue).toBe(40);
    expect(grouped[0].sharePercent).toBe(80);
    expect(grouped[0].quantityContext).toEqual(expect.arrayContaining([
      { unit: "قطعة", quantity: 3 },
      { unit: "لتر", quantity: 2 },
    ]));
  });

  it("groups by accepted catalog taxonomy and leaves unmapped inventory visibly uncategorized", () => {
    const rows = [
      row({ inventoryId: 1, warehouseId: 10, totalCostValue: 30 }),
      row({ inventoryId: 2, warehouseId: 20, warehouseCode: "SUB-1", totalCostValue: 10 }),
      row({ inventoryId: 3, itemName: "Unmapped", internalCode: "U-1", totalCostValue: 5 }),
    ];
    const grouped = groupInventoryValueByCategory(rows, taxonomy, 45);

    const mapped = grouped.find((item) => item.categoryNodeId === 900)!;
    const unmapped = grouped.find((item) => item.uncategorized)!;
    expect(mapped.totalValue).toBe(40);
    expect(mapped.itemCount).toBe(1); // same Catalog Item across warehouses counts once
    expect(mapped.inventoryRows).toBe(2);
    expect(unmapped.totalValue).toBe(5);
    expect(unmapped.inventoryRows).toBe(1);
  });

  it("does not invent percentages when the active total is zero or negative", () => {
    expect(groupInventoryValueByWarehouse([row({ totalCostValue: 0, status: "zero" })], 0)[0].sharePercent).toBeNull();
    expect(groupInventoryValueByCategory([row({ totalCostValue: -10, status: "negative" })], [], -10)[0].sharePercent).toBeNull();
  });

  it("exports the grouped stored value with active-result filters", () => {
    const report: InventoryValueDistributionReportResult = {
      generatedAt: "2026-08-24T06:00:00.000Z",
      readOnly: true,
      basis: "stored_inventory_value",
      categoryBasis: "inventory_linked_catalog_taxonomy",
      filters: { search: "Item", warehouseId: undefined, status: "all" },
      summary: {
        rows: 1,
        totalValue: 30,
        positiveValueRows: 1,
        zeroValueRows: 0,
        negativeValueRows: 0,
        warehouses: 1,
        warehouseGroups: 1,
        categoryGroups: 1,
        uncategorizedInventoryRows: 1,
      },
      warehouses: [{ id: 10, code: "WH-MAIN", nameAr: "المخزن الرئيسي", nameEn: "Main Warehouse", isActive: 1 }],
      byWarehouse: [{
        warehouseId: 10,
        warehouseCode: "WH-MAIN",
        warehouseNameAr: "المخزن الرئيسي",
        warehouseNameEn: "Main Warehouse",
        inventoryRows: 1,
        quantityContext: [{ unit: "قطعة", quantity: 3 }],
        totalValue: 30,
        sharePercent: 100,
      }],
      byCategory: [{
        categoryNodeId: null,
        categoryCode: null,
        categoryNameAr: null,
        categoryNameEn: null,
        categoryPathAr: null,
        categoryPathEn: null,
        uncategorized: true,
        itemCount: 1,
        inventoryRows: 1,
        quantityContext: [{ unit: "قطعة", quantity: 3 }],
        totalValue: 30,
        sharePercent: 100,
      }],
    };

    const warehouseDef = buildInventoryValueDistributionExportDefinition(report, "warehouse", "ar");
    const categoryDef = buildInventoryValueDistributionExportDefinition(report, "category", "en");
    expect(warehouseDef.rows[0].value).toBe(30);
    expect(warehouseDef.filters?.map((f) => f.value).join(" ")).toContain("Item");
    expect(categoryDef.rows[0].category).toBe("Uncategorized");
    expect(categoryDef.rows[0].value).toBe(30);
  });

  it("keeps 6.3.2 DB-facing code read-only and reuses 6.3.1 + 2B-9 foundations", () => {
    const source = readFileSync(new URL("../services/reports/inventoryValueDistributionReport.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/\.insert\s*\(/);
    expect(source).not.toMatch(/\.update\s*\(/);
    expect(source).not.toMatch(/\.delete\s*\(/);
    expect(source).not.toMatch(/withTransaction\s*\(/);
    expect(source).toContain("loadInventoryValuationReport");
    expect(source).toContain("getInventoryCatalogTaxonomy");
    expect(source).toContain('basis: "stored_inventory_value"');
  });
});
