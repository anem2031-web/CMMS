import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const reportServices = [
  "server/services/reports/inventoryStockBalanceReport.ts",
  "server/services/reports/inventoryMovementReport.ts",
  "server/services/reports/inventoryValuationReport.ts",
  "server/services/reports/inventoryValueDistributionReport.ts",
  "server/services/reports/inventoryAccountingReviewReport.ts",
  "server/services/reports/inventoryAnalyticsReport.ts",
];

describe("Main Phase 6.5 final regression / closure gate", () => {
  it("keeps the unified reports center and all approved Phase 6 routes present", () => {
    const app = read("client/src/App.tsx");
    const center = read("client/src/pages/inventory/InventoryReportsCenter.tsx");

    expect(app).toContain('/inventory/reports');
    expect(app).toContain('/inventory/reports/stock-balance');
    expect(app).toContain('/inventory/reports/movements');
    expect(app).toContain('/inventory/reports/valuation');
    expect(app).toContain('/inventory/reports/analytics');

    expect(center).toContain('/inventory/reports/stock-balance');
    expect(center).toContain('/inventory/reports/movements');
    expect(center).toContain('/inventory/reports/valuation');
    expect(center).toContain('/inventory/reports/analytics');
    expect(center).toContain('/inventory/reconciliation');
  });

  it("keeps the reports center operational and free of development-phase/status clutter", () => {
    const center = read("client/src/pages/inventory/InventoryReportsCenter.tsx");

    expect(center).not.toContain("Main Phase 6");
    expect(center).not.toContain("copy.status.");
    expect(center).not.toContain("ReportToolbar");
    expect(center).not.toContain("ReportGeneratedAt");
    expect(center).not.toContain("foundation-preview");
    expect(center).toContain("copy.reconciliation.title");
  });

  it("keeps the shared Phase 6 report toolbar/export foundation available", () => {
    const toolbar = read("client/src/components/reports/ReportToolbar.tsx");
    const exportFoundation = read("server/services/reports/reportExportFoundation.ts");

    expect(toolbar).toContain("onRefresh");
    expect(toolbar).toContain("onResetFilters");
    expect(toolbar).toContain("onPrint");
    expect(toolbar).toContain("onExportExcel");
    expect(toolbar).toContain("onExportPdf");
    expect(exportFoundation).toContain("xlsx");
    expect(exportFoundation).toMatch(/pdf/i);
  });

  it("keeps DB-facing Phase 6 report services read-only", () => {
    for (const rel of reportServices) {
      const source = read(rel);
      expect(source, rel).not.toMatch(/\.insert\s*\(/);
      expect(source, rel).not.toMatch(/\.update\s*\(/);
      expect(source, rel).not.toMatch(/\.delete\s*\(/);
      expect(source, rel).not.toMatch(/withTransaction\s*\(/);
      expect(source, rel).not.toMatch(/\.transaction\s*\(/);
    }
  });

  it("keeps valuation based on stored totalCostValue without revaluation writes", () => {
    const valuation = read("server/services/reports/inventoryValuationReport.ts");
    const distribution = read("server/services/reports/inventoryValueDistributionReport.ts");
    const review = read("server/services/reports/inventoryAccountingReviewReport.ts");

    expect(valuation).toContain("totalCostValue");
    expect(valuation).toContain("stored_inventory_value");
    expect(distribution).toContain("totalCostValue");
    expect(review).toContain("totalCostValue");
    expect(review).toContain("autoFixIncluded: false");
    expect(review).toContain("revaluationIncluded: false");
    expect(review).toContain("historicalBackfillIncluded: false");

    for (const source of [valuation, distribution, review]) {
      expect(source).not.toMatch(/set\s*\(\s*\{[^}]*averageCost/s);
      expect(source).not.toMatch(/set\s*\(\s*\{[^}]*totalCostValue/s);
      expect(source).not.toMatch(/\.update\s*\([^)]*\)[\s\S]{0,800}?\.set\s*\(\s*\{[^}]*averageCost/s);
      expect(source).not.toMatch(/\.update\s*\([^)]*\)[\s\S]{0,800}?\.set\s*\(\s*\{[^}]*totalCostValue/s);
    }
  });

  it("keeps 6.4 analytics as one page with the five approved planning tabs", () => {
    const page = read("client/src/pages/inventory/InventoryAnalyticsReport.tsx");
    const service = read("server/services/reports/inventoryAnalyticsReport.ts");

    for (const token of ["slow", "dead", "abc", "aging", "turnover"]) {
      expect((page + service).toLowerCase()).toContain(token);
    }
  });

  it("does not introduce centralized receipt_number_counter in the current project schema/code", () => {
    const schema = read("drizzle/schema.ts");
    const receipts = read("server/_core/db/warehouse-receipts.ts");

    expect(schema).not.toMatch(/receipt_number_counter/i);
    expect(schema).not.toMatch(/receiptNumberCounter/);
    expect(receipts).toContain("getNextReceiptNumber");
  });

  it("keeps batch transfer partial/per-item semantics instead of all-or-nothing", () => {
    const warehouses = read("server/_core/db/warehouses.ts");
    expect(warehouses).toMatch(/success:\s*true/);
    expect(warehouses).toMatch(/success:\s*false/);
    expect(warehouses).toMatch(/for\s*\([^)]*item[^)]*\)/);
  });

  it("keeps Main Phase 6.4 shown as officially closed before final 6.5 closure", () => {
    const preview = read("server/services/reports/reportsCenterFoundationPreview.ts");
    expect(preview).toContain('phase: "6.4"');
    expect(preview).toMatch(/6\.4[\s\S]{0,160}(مغلق رسميًا|Officially closed)/);
  });
});
