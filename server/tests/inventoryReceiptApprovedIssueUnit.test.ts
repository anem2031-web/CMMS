
import { describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";

vi.mock("../_core/db/client", () => ({ getDb: vi.fn(() => { throw new Error("Live DB forbidden"); }) }));
import { getInventoryMatchesByCatalogItemAndWarehouse } from "../_core/db/inventory";

const dialect = new MySqlDialect();
const identity = { id: 20, warehouseId: 5, linkedItemId: 18 };
const receiving = { enforceApprovedIssueUnit: true };

function receiptInventoryFixture(rows: {
  matching?: Array<typeof identity & { quantity: number }>;
  approved?: Array<typeof identity & { quantity: number; issueUnit: string; unit: string; matchesUnit: number }>;
  positive?: Array<{ issueUnit: string | null; unit: string }>;
} = {}) {
  const selects: Array<{ kind: "approved" | "matching" | "positive"; sql?: string; lock?: string }> = [];
  const tx = {
    execute: async (statement: any) => {
      const query = dialect.sqlToQuery(statement);
      expect(query.sql).toContain("FOR UPDATE");
      expect(query.params).toEqual([18]);
      return [[{ id: 18 }]];
    },
    select: (fields: object) => {
      const entry: (typeof selects)[number] = {
        kind: "matchesUnit" in fields ? "approved" : "id" in fields ? "matching" : "positive",
      };
      selects.push(entry);
      const query = {
        from: () => query,
        where: (condition: any) => { entry.sql = dialect.sqlToQuery(condition).sql; return query; },
        orderBy: () => query,
        limit: () => query,
        for: async (mode: string) => { entry.lock = mode; return rows[entry.kind] ?? []; },
      };
      return query;
    },
  };
  return { tx, selects };
}

describe("reuse of a warehouse inventory record when receiving an invoice", () => {
  it("checks approval before reusing a matching legacy record", async () => {
    const { tx, selects } = receiptInventoryFixture({
      matching: [{ ...identity, quantity: 5 }],
      approved: [{ ...identity, id: 19, quantity: 0, issueUnit: "حبة", unit: "حبة", matchesUnit: 0 }],
    });
    await expect(getInventoryMatchesByCatalogItemAndWarehouse(18, 5, tx, "كرتون", receiving))
      .rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("حبة") });
    expect(selects).toEqual([
      expect.objectContaining({ kind: "approved", sql: expect.stringContaining("issueUnitApprovedAt"), lock: "update" }),
    ]);
  });

  it("does not start a second positive stock record when the old balance lacks approval and has a different unit", async () => {
    const { tx, selects } = receiptInventoryFixture({ positive: [{ issueUnit: null, unit: "علبة" }] });
    await expect(getInventoryMatchesByCatalogItemAndWarehouse(18, 5, tx, "حبة", receiving))
      .rejects.toMatchObject({ code: "CONFLICT", message: expect.stringContaining("علبة") });
    expect(selects.at(-1)).toMatchObject({ kind: "positive", sql: expect.stringContaining("quantity"), lock: "update" });
  });

  it("does not populate a compatible zero record alongside an existing positive balance", async () => {
    const { tx } = receiptInventoryFixture({
      matching: [{ ...identity, quantity: 0 }],
      positive: [{ issueUnit: "علبة", unit: "علبة" }],
    });
    await expect(getInventoryMatchesByCatalogItemAndWarehouse(18, 5, tx, "حبة", receiving))
      .rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("continues to receive into matching stock and allows a first receipt", async () => {
    const stocked = receiptInventoryFixture({ matching: [{ ...identity, quantity: 3 }] });
    await expect(getInventoryMatchesByCatalogItemAndWarehouse(18, 5, stocked.tx, "حبة", receiving))
      .resolves.toEqual([identity]);
    expect(stocked.selects.map(row => row.kind)).toEqual(["approved", "matching"]);

    const empty = receiptInventoryFixture();
    await expect(getInventoryMatchesByCatalogItemAndWarehouse(18, 5, empty.tx, "حبة", receiving))
      .resolves.toEqual([]);
  });
});
