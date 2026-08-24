import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Main Phase 3 / Step 1 — inventory count opening snapshot", () => {
  it("defines a dedicated immutable opening snapshot with quantity and 4-decimal moving average cost", () => {
    const schema = read("drizzle/schema.ts");
    const migration = read("drizzle/migrations/2026_08_20_inventory_count_opening_snapshot.sql");

    expect(schema).toContain('export const inventoryCountSnapshots = mysqlTable("inventory_count_snapshots"');
    expect(schema).toContain("averageCostSnapshot: decimal({ precision: 12, scale: 4 }).notNull()");
    expect(schema).toContain("systemQuantity: decimal({ precision: 12, scale: 3 }).notNull()");
    expect(migration).toContain("`averageCostSnapshot` DECIMAL(12,4) NOT NULL");
    expect(migration).toContain("`systemQuantity` DECIMAL(12,3) NOT NULL");
  });

  it("captures periodic Lot quantity and Inventory averageCost when the operation opens", () => {
    const source = read("server/_core/db/invoice-drafts.ts");
    const createStart = source.indexOf("export async function createCountOperation");
    const scanStart = source.indexOf("export async function scanCountItem");
    const createBlock = source.slice(createStart, scanStart);

    expect(createBlock).toContain("averageCostSnapshot: inventory.averageCost");
    expect(createBlock).toContain("systemQuantity: inventoryLotBalances.quantity");
    expect(createBlock).toContain("await db.insert(inventoryCountSnapshots).values");

    // Manual QR counts must save the opening snapshot before returning an empty UI target list.
    const snapshotInsert = createBlock.indexOf("await db.insert(inventoryCountSnapshots).values(openingSnapshots.map");
    const manualReturn = createBlock.indexOf('if (effectiveScope === "partial" && !params.catalogNodeId)');
    expect(snapshotInsert).toBeGreaterThan(-1);
    expect(manualReturn).toBeGreaterThan(snapshotInsert);
  });

  it("uses the opening snapshot rather than the current Lot balance when a QR is scanned later", () => {
    const source = read("server/_core/db/invoice-drafts.ts");
    const scanStart = source.indexOf("export async function scanCountLot");
    const addStart = source.indexOf("export async function addItemToCount");
    const scanBlock = source.slice(scanStart, addStart);

    expect(scanBlock).toContain("getCountOpeningSnapshotForLot");
    expect(scanBlock).toContain("COUNT_LOT_NOT_IN_OPENING_SNAPSHOT");
    expect(scanBlock).toContain("systemQuantity: Number(openingSnapshot.systemQuantity || 0).toFixed(3)");
    expect(scanBlock).not.toContain("systemQuantity: lot.balanceQuantity.toFixed(3)");
    expect(scanBlock).toContain("averageCostSnapshot: Number(openingSnapshot.averageCostSnapshot || 0)");
  });

  it("preserves the same opening-time rule for the legacy non-Lot manual path", () => {
    const source = read("server/_core/db/invoice-drafts.ts");

    expect(source).toContain("getCountOpeningSnapshotForInventory");
    expect(source).toContain("COUNT_ITEM_NOT_IN_OPENING_SNAPSHOT");
    expect(source).toContain("const openingSystemQuantity = Number(openingSnapshot.systemQuantity || 0)");
  });

  it("deletes snapshot rows when an in-progress count operation is deleted", () => {
    const source = read("server/_core/db/invoice-drafts.ts");
    expect(source).toContain("await db.delete(inventoryCountSnapshots).where(eq(inventoryCountSnapshots.operationId, operationId))");
  });

  it("shows friendly messages for Lots/items that were not part of the opening snapshot", () => {
    const router = read("server/routers/inventory/inventoryCount.router.ts");
    const ui = read("client/src/pages/inventory/InventoryOperations.tsx");
    const ar = read("client/src/i18n/ar.ts");

    expect(router).toContain("db.COUNT_LOT_NOT_IN_OPENING_SNAPSHOT");
    expect(router).toContain("db.COUNT_ITEM_NOT_IN_OPENING_SNAPSHOT");
    expect(ui).toContain('e.message === "COUNT_LOT_NOT_IN_OPENING_SNAPSHOT"');
    expect(ui).toContain('e.message === "COUNT_ITEM_NOT_IN_OPENING_SNAPSHOT"');
    expect(ar).toContain("countLotNotInOpeningSnapshot");
    expect(ar).toContain("countItemNotInOpeningSnapshot");
  });
});
