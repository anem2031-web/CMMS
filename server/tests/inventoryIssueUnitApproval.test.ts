import { describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { getTableName } from "drizzle-orm";
import { approveIssueUnitConversion, matchCatalogIssueUnit, previewIssueUnitConversion } from "../services/inventory/issue-unit-approval";
import { businessRpcAllowed } from "../../shared/business-role-policy";

vi.mock("../_core/catalog-unit-governance", () => ({ getActiveCatalogUnitCanonicalName: async (name: string) => name }));
vi.mock("../_core/inventory-lots", () => ({ isInventoryLotsEnabled: () => true }));
vi.mock("../services/inventory/issue-unit-request-conversion", () => ({
  planIssueUnitRequests: async () => ({ affected: [], changes: [], blockers: [] }),
  applyIssueUnitRequests: async () => {},
}));

const input = { inventoryId: 10, issueUnit: "حبة", factor: 20 };
const dialect = new MySqlDialect();

function fixture(options: { supplierReturnNumber?: string } = {}) {
  const item = { id: 10, unit: "كرتون", issueUnit: "كرتون", issueUnitApprovedAt: null as string | null,
    quantity: "3.000", averageCost: "100.0000", totalCostValue: "300.00", minQuantity: "1.000",
    conversionFactor: "1.0000", isFrozen: 0, linkedItemId: 21, warehouseId: 1 };
  const lots = [{ balanceId: 1, lotId: 55, lotCode: "LOT-55", quantity: "3.000", remainingQuantity: "3.000",
    originalQuantity: "4.000", issueUnit: "كرتون", issueUnitCost: "100.0000", conversionFactor: "1.0000" }];
  const writes: Array<{ table: string; values?: any }> = [];
  const db = {
    execute: vi.fn(async statement => {
      const { sql } = dialect.sqlToQuery(statement);
      if (sql.includes("SELECT id,unit,issueUnit,")) return [[{ ...item }], []];
      if (sql.includes("b.id AS balanceId")) return [lots, []];
      if (sql.includes("FROM warehouse_returns") && options.supplierReturnNumber) {
        return [[{ returnNumber: options.supplierReturnNumber }], []];
      }
      if (sql.includes("SELECT unit FROM catalog_items")) return [[{ unit: "كرتون" }], []];
      if (sql.startsWith("UPDATE")) writes.push({ table: sql });
      return [[], []];
    }),
    update: (table: any) => ({ set: (values: any) => ({ where: async () => {
      writes.push({ table: getTableName(table), values });
      if (getTableName(table) === "inventory") item.issueUnitApprovedAt = "2026-11-11 10:00:00.000";
    } }) }),
    insert: (table: any) => ({ values: async (values: any) => { writes.push({ table: getTableName(table), values }); } }),
  };
  return { item, lots, db, writes };
}

describe("warehouse issue unit approval", () => {
  it("previews without writes, converts stock and lot values on confirmation, and rejects repetition", async () => {
    const f = fixture();
    const preview = await previewIssueUnitConversion(f.db, input);
    expect(preview).toMatchObject({ before: { quantity: 3, unit: "كرتون" }, after: { quantity: 60, unit: "حبة" }, blockers: [] });
    expect(f.writes).toHaveLength(0);
    const confirmed = { ...input, confirmationToken: preview.confirmationToken };
    await approveIssueUnitConversion(f.db, confirmed, 9);
    expect(f.writes).toContainEqual(expect.objectContaining({ table: expect.stringContaining("SET t.unitSnapshot=") }));
    expect(f.writes).toContainEqual({ table: "inventory_lot_balances", values: { quantity: "60.000" } });
    expect(f.writes).toContainEqual({ table: "inventory_lots", values: expect.objectContaining({ issueUnit: "حبة", issueUnitCost: "5.0000", originalQuantity: "80.000" }) });
    expect(f.writes).toContainEqual({ table: "inventory", values: expect.objectContaining({ quantity: 60, averageCost: "5.0000", minQuantity: 20 }) });
    expect(f.writes).toContainEqual({ table: "audit_logs", values: expect.objectContaining({ userId: 9, newValues: expect.objectContaining({ totalCostValue: "300.00", factor: 20 }) }) });
    await expect(approveIssueUnitConversion(f.db, confirmed, 9)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("blocks inconsistent lots and requires a new preview after stock changes", async () => {
    const f = fixture();
    const preview = await previewIssueUnitConversion(f.db, input);
    f.lots[0].quantity = "2.000";
    expect((await previewIssueUnitConversion(f.db, input)).blockers[0]).toContain("مجموع أرصدة اللوتات 2");
    await expect(approveIssueUnitConversion(f.db, { ...input, confirmationToken: preview.confirmationToken }, 9)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.writes).toHaveLength(0);
  });

  it("prevents mixing earlier supplier returns with a different lot unit", async () => {
    const f = fixture({ supplierReturnNumber: "RTN-55" });
    const preview = await previewIssueUnitConversion(f.db, input);
    expect(preview.blockers).toEqual([expect.stringContaining("RTN-55")]);
    await expect(approveIssueUnitConversion(f.db, { ...input, confirmationToken: preview.confirmationToken }, 9))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.writes).toHaveLength(0);
  });

  it("allows recording approval at factor one and makes matching the catalog a distinct action", async () => {
    const f = fixture();
    const sameUnit = { ...input, issueUnit: "كرتون", factor: 1 };
    const preview = await previewIssueUnitConversion(f.db, sameUnit);
    await approveIssueUnitConversion(f.db, { ...sameUnit, confirmationToken: preview.confirmationToken }, 9);
    expect(f.writes.some(write => write.table === "inventory_lot_balances")).toBe(false);
    expect(f.writes.some(write => write.table.includes("UPDATE catalog_items"))).toBe(false);
    f.item.issueUnit = "حبة";
    await expect(matchCatalogIssueUnit(f.db, { inventoryId: 10, expectedCatalogUnit: "علبة" }, 9)).rejects.toMatchObject({ code: "CONFLICT" });
    await matchCatalogIssueUnit(f.db, { inventoryId: 10, expectedCatalogUnit: "كرتون" }, 9);
    expect(f.writes).toContainEqual({ table: "catalog_audit_logs", values: expect.objectContaining({ entityId: 21 }) });
  });

  it("grants the three endpoints to active warehouse accounts among guarded roles", () => {
    const endpoints = [
      ["query", "inventory.previewIssueUnitConversion"], ["mutation", "inventory.approveIssueUnitConversion"],
      ["mutation", "inventory.matchCatalogIssueUnit"],
    ] as const;
    for (const [type, path] of endpoints) {
      expect(businessRpcAllowed({ id: 9, role: "warehouse", isActive: 1 }, type, path)).toBe(true);
      expect(businessRpcAllowed({ id: 9, role: "warehouse", isActive: 0 }, type, path)).toBe(false);
      expect(businessRpcAllowed({ id: 9, role: "accountant", isActive: 1 }, type, path)).toBe(false);
    }
  });
});
