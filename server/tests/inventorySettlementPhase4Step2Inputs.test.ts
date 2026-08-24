import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Main Phase 4 / Step 2 / 4.2.1 — settlement schema and inputs", () => {
  it("synchronizes the code schema to the already-existing nullable Live DB financial fields", () => {
    const schema = read("drizzle/schema.ts");

    expect(schema).toContain("unitCostUsed: decimal({ precision: 12, scale: 4 })");
    expect(schema).toContain("adjustmentValue: decimal({ precision: 14, scale: 2 })");
    expect(schema).toContain("reference: varchar({ length: 255 })");
  });

  it("accepts an optional bounded settlement reference without changing the current UI workflow", () => {
    const router = read("server/routers/inventory/inventoryCount.router.ts");
    const ui = read("client/src/pages/inventory/InventoryOperations.tsx");

    expect(router).toContain("reference: z.string().trim().max(255");
    expect(router).toContain("reference: input.reference");
    expect(ui).not.toContain("settlementReference");
  });

  it("persists reference on new supported settlement headers while leaving absent values null", () => {
    const source = read("server/_core/db/invoice-drafts.ts");
    const applyStart = source.indexOf("export async function applySettlement");
    const listStart = source.indexOf("export async function listSettlements");
    const applyBlock = source.slice(applyStart, listStart);

    expect(applyBlock).toContain("reference?: string");
    expect(applyBlock).toContain("reference: params.reference?.trim() || null");
  });
});
