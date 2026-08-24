import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("purchase order catalog identity link — 2B-1", () => {
  it("stores a nullable catalogItemId on purchase order items without replacing snapshots", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("catalogItemId: int()");
    expect(schema).toContain('itemName: varchar({ length: 300 }).notNull()');
    expect(schema).toContain('unit: varchar({ length: 50 })');
    expect(schema).toContain('index("idx_poi_catalogItemId").on(table.catalogItemId)');
  });

  it("carries the selected catalog id through create and draft flows", () => {
    const page = read("client/src/pages/purchase/CreatePurchaseOrder.tsx");
    const router = read("server/routers/purchase/purchase-orders.router.ts");

    expect(page).toContain("catalogItemId: catalogItem.id");
    expect(page).toContain("catalogItemId: i.catalogItemId");
    expect(page).toContain('catalogItemId: value === "manual" ? null : current.catalogItemId');
    expect(router).toContain("catalogItemId: z.number().int().positive().nullable().optional()");
    expect(router).toContain("await assertValidCatalogItemLinks(input.items)");
  });

  it("does not add the catalog foreign key before the dedicated governance step", () => {
    const migration = read("drizzle/migrations/2026_08_15_po_items_catalog_link.sql");
    expect(migration).toContain("ADD COLUMN catalogItemId INT NULL");
    expect(migration).toContain("CREATE INDEX idx_poi_catalogItemId");
    expect(migration).not.toContain("FOREIGN KEY");
  });
});
