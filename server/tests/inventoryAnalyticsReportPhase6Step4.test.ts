import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  buildAbcClassification,
  calculateTurnoverIndicator,
  classifyAgingBucket,
  classifyMovementVelocity,
  normalizeInventoryAnalyticsFilters,
} from "../services/reports/inventoryAnalyticsReportCore";

describe("Main Phase 6.4 Inventory Analytics & Planning", () => {
  it("normalizes planning thresholds without allowing the dead threshold to precede slow moving", () => {
    expect(normalizeInventoryAnalyticsFilters({})).toMatchObject({ slowDays: 90, deadDays: 180, turnoverDays: 365, category: "all" });
    expect(normalizeInventoryAnalyticsFilters({ slowDays: 200, deadDays: 100 }).deadDays).toBe(201);
  });

  it("classifies only recorded outbound ages and keeps missing history explicitly unassessed", () => {
    expect(classifyMovementVelocity(null, 90, 180)).toBe("no_outbound_history");
    expect(classifyMovementVelocity(89, 90, 180)).toBe("active");
    expect(classifyMovementVelocity(90, 90, 180)).toBe("slow");
    expect(classifyMovementVelocity(180, 90, 180)).toBe("dead");
  });

  it("builds ABC from positive current value with cumulative A/B/C boundaries", () => {
    const rows = buildAbcClassification([
      { key: "a", value: 80 },
      { key: "b", value: 15 },
      { key: "c", value: 5 },
    ]);
    expect(rows.map((row) => row.abcClass)).toEqual(["A", "B", "C"]);
    expect(rows.map((row) => row.cumulativePercent)).toEqual([80, 95, 100]);
  });

  it("uses explicit current-lot age buckets", () => {
    expect(classifyAgingBucket(null)).toBe("unknown");
    expect(classifyAgingBucket(30)).toBe("0_30");
    expect(classifyAgingBucket(31)).toBe("31_90");
    expect(classifyAgingBucket(180)).toBe("91_180");
    expect(classifyAgingBucket(365)).toBe("181_365");
    expect(classifyAgingBucket(366)).toBe("365_plus");
  });

  it("keeps turnover a planning indicator based only on recorded outbound value and current stored value", () => {
    expect(calculateTurnoverIndicator(500, 250)).toBe(2);
    expect(calculateTurnoverIndicator(500, 0)).toBeNull();
    expect(calculateTurnoverIndicator(-1, 250)).toBeNull();
  });

  it("keeps DB-facing 6.4 code read-only and avoids revaluation/backfill mutations", () => {
    const file = fs.readFileSync(path.join(process.cwd(), "server/services/reports/inventoryAnalyticsReport.ts"), "utf8");
    expect(file).toContain("readOnly: true");
    expect(file).toContain("historicalBackfillIncluded: false");
    expect(file).toContain("revaluationIncluded: false");
    expect(file).toContain("accountingTurnoverClaimed: false");
    expect(file).not.toMatch(/\.insert\s*\(/);
    expect(file).not.toMatch(/\.update\s*\(/);
    expect(file).not.toMatch(/\.delete\s*\(/);
    expect(file).not.toContain("averageCost");
  });

  it("uses the accepted current Lot relation for aging and does not invent age for uncovered inventory", () => {
    const file = fs.readFileSync(path.join(process.cwd(), "server/services/reports/inventoryAnalyticsReport.ts"), "utf8");
    expect(file).toContain("inventoryLotBalances.inventoryId");
    expect(file).toContain("inventoryLots.createdAt");
    expect(file).toContain("agingUncoveredInventoryRows");
    expect(file).not.toContain("inventoryLots.inventoryId");
  });

  it("delivers one analytics page with the five approved tabs and shared export foundation", () => {
    const page = fs.readFileSync(path.join(process.cwd(), "client/src/pages/inventory/InventoryAnalyticsReport.tsx"), "utf8");
    const app = fs.readFileSync(path.join(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(page).toContain('value="slow"');
    expect(page).toContain('value="dead"');
    expect(page).toContain('value="abc"');
    expect(page).toContain('value="aging"');
    expect(page).toContain('value="turnover"');
    expect(page).toContain("ReportToolbar");
    expect(page).toContain("/api/reports/inventory/analytics.xlsx");
    expect(page).toContain("/api/reports/inventory/analytics.pdf");
    expect(page).toContain("/api/reports/inventory/analytics/print");
    expect(app).toContain('/inventory/reports/analytics');
  });
});
