import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Inventory LOT sequential numbering", () => {
  it("uses an isolated per-year LOT counter and keeps QR tracking token independent", () => {
    const source = read("server/_core/inventory-lots.ts");
    expect(source).toContain("inventory_lot_number_counter");
    expect(source).toContain("ON DUPLICATE KEY UPDATE lastNumber = lastNumber + 1");
    expect(source).toContain('String(sequence).padStart(5, "0")');
    expect(source).toContain("CMMS-LOT-${uuid}");
    expect(source).not.toContain("uuid.slice(0, 8).toUpperCase()");
  });

  it("models the LOT-only counter in project schema and migration", () => {
    const schema = read("drizzle/schema.ts");
    const migration = read("drizzle/migrations/2026_08_25_inventory_lot_number_counter.sql");
    expect(schema).toContain('mysqlTable("inventory_lot_number_counter"');
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS inventory_lot_number_counter");
    expect(migration).toContain("PRIMARY KEY (year)");
  });

  it("does not introduce centralized receipt numbering", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).not.toMatch(/receipt_number_counter/i);
    expect(schema).not.toMatch(/receiptNumberCounter/);
  });
});
