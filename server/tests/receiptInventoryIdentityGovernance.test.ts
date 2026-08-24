import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Receipt Inventory identity governance — future-facing guard", () => {
  it("defines Catalog Item + Warehouse lookup and caps it at two rows to detect legacy ambiguity", () => {
    const inventoryDb = read("server/_core/db/inventory.ts");

    expect(inventoryDb).toContain("getInventoryMatchesByCatalogItemAndWarehouse");
    expect(inventoryDb).toContain("eq(inventory.linkedItemId, catalogItemId)");
    expect(inventoryDb).toContain("eq(inventory.warehouseId, warehouseId)");
    expect(inventoryDb).toContain(".limit(2)");
  });

  it("reuses the single existing Inventory row in receipts.v2 instead of creating a duplicate", () => {
    const router = read("server/routers/inventory/receipts.v2.router.ts");

    expect(router).toContain("if (!inventoryId && item.linkedItemId)");
    expect(router).toContain("db.getInventoryMatchesByCatalogItemAndWarehouse");
    expect(router).toContain("inventoryId = Number(matches[0].id)");
    expect(router).toContain('code: "CONFLICT"');
    expect(router).toContain("لن ينشئ النظام سجلًا جديدًا");
  });

  it("applies the same protection to approved receipt drafts", () => {
    const invoiceDrafts = read("server/_core/db/invoice-drafts.ts");

    expect(invoiceDrafts).toContain("getInventoryMatchesByCatalogItemAndWarehouse");
    expect(invoiceDrafts).toContain("if (!item.inventoryId && item.catalogItemId)");
    expect(invoiceDrafts).toContain("item.inventoryId = Number(matches[0].id)");
    expect(invoiceDrafts).toContain("لن ينشئ النظام سجلًا جديدًا");
  });

  it("does not perform automatic legacy consolidation", () => {
    const router = read("server/routers/inventory/receipts.v2.router.ts");
    const invoiceDrafts = read("server/_core/db/invoice-drafts.ts");

    expect(router).toContain("matches.length > 1");
    expect(invoiceDrafts).toContain("matches.length > 1");
    expect(router).not.toContain("delete(inventory)");
    expect(invoiceDrafts).not.toContain("delete(inventory)");
  });
});
