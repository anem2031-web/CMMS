
import { getTableName, type Table } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  connection: null as any,
  lotsEnabled: false,
  stock: [] as Array<{ id: number; warehouseId: number; isFrozen: number; itemName: string; issueUnit: string | null; issueUnitApprovedAt: string | null; quantity: number; averageCost: string }>,
  writes: [] as Array<{ table: string; rows: any[] }>,
  locks: [] as string[],
}));

vi.mock("../_core/db/client", () => ({ getDb: async () => fixture.connection }));
vi.mock("../_core/db/deletes", () => ({ getInventoryItemById: vi.fn(), getUserById: vi.fn() }));
vi.mock("../_core/db/warehouse-receipts", () => ({ getNextInventoryCode: vi.fn(), getNextItemBarcode: vi.fn() }));
vi.mock("../_core/db/warehouse-returns", () => ({ createInventoryItemV2: vi.fn() }));
vi.mock("../_core/db/inventory", () => ({ getInventoryMatchesByCatalogItemAndWarehouse: vi.fn() }));
vi.mock("../_core/inventory-lots", () => ({
  isInventoryLotsEnabled: () => fixture.lotsEnabled,
  applyInventoryLotCountAdjustment: vi.fn(),
  createReceiptInventoryLot: vi.fn(),
  createOpeningBalanceInventoryLot: vi.fn(),
  resolveInventoryLotForCount: vi.fn(),
}));
vi.mock("../services/purchase-specifications", () => ({ assertSpecificationReceiptTracking: vi.fn() }));

import { createCountOperation } from "../_core/db/invoice-drafts";

const dialect = new MySqlDialect();
const open = () => createCountOperation({ scope: "full", warehouseId: 11, createdById: 2 });

beforeEach(() => {
  fixture.lotsEnabled = false;
  fixture.writes = [];
  fixture.locks = [];
  fixture.stock = [
    { id: 1, warehouseId: 11, isFrozen: 0, itemName: "لاصق", issueUnit: "حبة", issueUnitApprovedAt: "2026-11-11 10:00:00.000", quantity: 60, averageCost: "5.0000" },
    { id: 2, warehouseId: 12, isFrozen: 0, itemName: "مستودع آخر", issueUnit: null, issueUnitApprovedAt: null, quantity: 2, averageCost: "6.0000" },
    { id: 3, warehouseId: 11, isFrozen: 1, itemName: "مجمّد", issueUnit: null, issueUnitApprovedAt: null, quantity: 2, averageCost: "6.0000" },
  ];

  fixture.connection = {
    transaction: async (work: (tx: any) => Promise<unknown>) => {
      const writes: typeof fixture.writes = [];
      const result = await work({
        insert: (table: Table) => ({
          values: async (rows: any) => {
            writes.push({ table: getTableName(table), rows: Array.isArray(rows) ? rows : [rows] });
            return [{ insertId: writes.length }];
          },
        }),
        select: () => {
          let table = "";
          let conditions: unknown[] = [];
          const query = {
            from: (target: Table) => { table = getTableName(target); return query; },
            innerJoin: () => query,
            orderBy: () => query,
            where: (condition: any) => { conditions = dialect.sqlToQuery(condition).params; return query; },
            for: async (mode: string) => {
              expect(mode).toBe("update");
              fixture.locks.push(table);
              const scoped = fixture.stock.filter(row => conditions.includes(row.warehouseId) && conditions.includes(row.isFrozen));
              if (table === "inventory") return scoped;
              if (table === "inventory_lot_balances") {
                return scoped.map(row => ({
                  inventoryId: row.id, lotId: row.id + 10, systemQuantity: row.quantity,
                  averageCostSnapshot: row.averageCost, unitSnapshot: row.issueUnit, expiryDate: null,
                }));
              }
              throw new Error("Unexpected table in isolated count fixture");
            },
          };
          return query;
        },
      });
      fixture.writes = writes;
      return result;
    },
  };
});

describe("opening a new count in approved stock units", () => {
  it("rolls back the count when a scoped item has a legacy unit but lacks approval", async () => {
    fixture.stock[0].issueUnitApprovedAt = null;
    await expect(open()).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("لاصق") });
    expect(fixture.writes).toEqual([]);
  });

  it("opens a periodic lot count with the approved unit and a historical opening snapshot", async () => {
    fixture.lotsEnabled = true;
    await expect(open()).resolves.toMatchObject({ itemCount: 1 });
    expect(fixture.locks).toEqual(["inventory", "inventory_lot_balances"]);
    expect(fixture.writes).toEqual(expect.arrayContaining([
      { table: "inventory_count_snapshots", rows: [expect.objectContaining({ inventoryId: 1, lotId: 11, systemQuantity: "60.000", unitSnapshot: "حبة" })] },
      { table: "inventory_count_items", rows: [expect.objectContaining({ inventoryId: 1, systemQuantity: "60.000", unitSnapshot: "حبة" })] },
    ]));
  });
});

