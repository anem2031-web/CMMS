import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildStockBalanceExportDefinition,
  type StockBalanceReportResult,
} from "../services/reports/inventoryStockBalanceReport";
import {
  buildInventoryMovementExportDefinition,
  type InventoryMovementReportResult,
} from "../services/reports/inventoryMovementReport";
import {
  buildReportExcel,
  buildReportHtml,
} from "../services/reports/reportExportFoundation";

const generatedAt = "2026-08-23T13:00:00.000Z";

const stockReport: StockBalanceReportResult = {
  generatedAt,
  readOnly: true,
  filters: { search: "سيكا", warehouseId: 1, status: "normal" },
  summary: { rows: 1, normal: 1, low: 0, zero: 0, negative: 0, lotTracked: 1 },
  warehouses: [{ id: 1, code: "WH-MAIN", nameAr: "المخزن الرئيسي", nameEn: "Main Warehouse", isActive: 1 }],
  rows: [{
    inventoryId: 210274,
    itemName: "سيكا Test",
    internalCode: "INV-2026-210274",
    warehouseId: 1,
    warehouseCode: "WH-MAIN",
    warehouseNameAr: "المخزن الرئيسي",
    warehouseNameEn: "Main Warehouse",
    quantity: 5,
    unit: "قطعة",
    minQuantity: 2,
    averageCost: 10.125,
    totalCostValue: 50.63,
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
  }],
};

const movementReport: InventoryMovementReportResult = {
  generatedAt,
  readOnly: true,
  filters: {
    search: "DLV-2026",
    warehouseId: 1,
    movementType: "delivery",
    direction: "out",
    dateFrom: "2026-08-23",
    dateTo: "2026-08-23",
    itemKey: "code:INV-2026-210274",
  },
  selectedWarehouse: { id: 1, code: "WH-MAIN", nameAr: "المخزن الرئيسي", nameEn: "Main Warehouse", isActive: 1 },
  selectedItem: {
    key: "code:INV-2026-210274",
    itemName: "سيكا Test",
    internalCode: "INV-2026-210274",
    currentQuantity: 4,
    currentValue: 40.5,
    warehouseCount: 1,
    inventoryIds: [210274],
  },
  summary: {
    rows: 1,
    inMovements: 0,
    outMovements: 1,
    inQuantity: 0,
    outQuantity: 1,
    distinctItems: 1,
    currentQuantity: 4,
    currentValue: 40.5,
  },
  rows: [{
    transactionId: 900001,
    inventoryId: 210274,
    itemKey: "code:INV-2026-210274",
    itemName: "سيكا Test",
    internalCode: "INV-2026-210274",
    warehouseId: 1,
    warehouseCode: "WH-MAIN",
    warehouseNameAr: "المخزن الرئيسي",
    warehouseNameEn: "Main Warehouse",
    lotId: 25,
    lotCode: "LOT-2026-191EEB06",
    createdAt: "2026-08-23T12:30:00.000Z",
    direction: "out",
    transactionType: "delivery",
    quantity: 1,
    unit: "قطعة",
    unitCost: 10.125,
    totalCost: 10.13,
    reference: "DLV-2026-300215",
    invoiceNumber: null,
    reason: "تسليم اختبار Test",
    performerName: "User Test",
  }],
};

describe("Main Phase 6.2.3 Unified Export & Review", () => {
  it("keeps both 6.2 reports on one RTL export contract with the same generated-at semantics", () => {
    const stock = buildStockBalanceExportDefinition(stockReport, "ar");
    const movement = buildInventoryMovementExportDefinition(movementReport, "ar");

    expect(stock.direction).toBe("rtl");
    expect(movement.direction).toBe("rtl");
    expect(stock.locale).toBe("ar-SA");
    expect(movement.locale).toBe("ar-SA");
    expect(stock.generatedAt?.toISOString()).toBe(generatedAt);
    expect(movement.generatedAt?.toISOString()).toBe(generatedAt);
    expect(stock.rows).toHaveLength(stockReport.rows.length);
    expect(movement.rows).toHaveLength(movementReport.rows.length);
  });

  it("uses readable filter summaries and preserves mixed warehouse/document/Lot values", () => {
    const stock = buildStockBalanceExportDefinition(stockReport, "ar");
    const movement = buildInventoryMovementExportDefinition(movementReport, "ar");

    const stockFilters = stock.filters?.map((item) => `${item.label}: ${item.value}`).join(" | ") || "";
    const movementFilters = movement.filters?.map((item) => `${item.label}: ${item.value}`).join(" | ") || "";

    expect(stockFilters).toContain("WH-MAIN");
    expect(stockFilters).toContain("المخزن الرئيسي");
    expect(movementFilters).toContain("WH-MAIN");
    expect(movementFilters).toContain("المخزن الرئيسي");
    expect(movementFilters).not.toContain("المخزن: 1");
    expect(movement.rows[0]).toMatchObject({
      lot: "LOT-2026-191EEB06",
      reference: "DLV-2026-300215",
      quantity: 1,
      unitCost: 10.125,
      totalCost: 10.13,
    });
  });

  it("renders both actual 6.2 export definitions as structured XLSX and printable RTL HTML", async () => {
    for (const definition of [
      buildStockBalanceExportDefinition(stockReport, "ar"),
      buildInventoryMovementExportDefinition(movementReport, "ar"),
    ]) {
      const xlsx = await buildReportExcel(definition);
      expect(xlsx.subarray(0, 2).toString("ascii")).toBe("PK");

      const html = buildReportHtml(definition);
      expect(html).toContain('dir="rtl"');
      expect(html).toContain("تاريخ ووقت إنشاء التقرير");
      expect(html).toContain("WH-MAIN");
    }
  });

  it("keeps the same shared toolbar/generated-at/download foundation on both 6.2 pages", () => {
    const stockPage = readFileSync(new URL("../../client/src/pages/inventory/InventoryStockBalanceReport.tsx", import.meta.url), "utf8");
    const movementPage = readFileSync(new URL("../../client/src/pages/inventory/InventoryMovementReport.tsx", import.meta.url), "utf8");

    for (const source of [stockPage, movementPage]) {
      expect(source).toContain("<ReportToolbar");
      expect(source).toContain("<ReportGeneratedAt");
      expect(source).toContain("downloadReportFile");
      expect(source).toContain("openReportPrintView");
      expect(source).toContain("handleReset");
    }
  });
});
