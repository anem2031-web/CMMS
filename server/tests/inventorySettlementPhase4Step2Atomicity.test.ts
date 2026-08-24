import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const settlementBlock = () => {
  const source = read("server/_core/db/invoice-drafts.ts");
  const start = source.indexOf("export async function applySettlement");
  const end = source.indexOf("export async function listSettlements", start);
  return source.slice(start, end);
};

describe("Main Phase 4 / Step 2 / 4.2.3 — settlement atomicity and regression protection", () => {
  it("runs every supported Settlement posting path through one DB transaction", () => {
    const block = settlementBlock();

    expect(block).toContain("const result = await db.transaction(async (tx) => applyWith(tx));");
    expect(block).not.toContain("const result = await applyWith(db)");
  });

  it("allocates the settlement number with the transaction writer instead of before the transaction", () => {
    const source = read("server/_core/db/invoice-drafts.ts");
    const block = settlementBlock();

    expect(source).toContain("async function generateSettlementNumberWith(writer: any)");
    expect(source).toContain("await writer.insert(inventorySettlementNumberCounter)");
    expect(block).toContain("const settlementNumber = await generateSettlementNumberWith(writer)");
    expect(block).not.toContain("await generateSettlementNumber();");
  });

  it("locks and re-validates Count finalization inside the posting transaction", () => {
    const block = settlementBlock();

    expect(block).toContain("FOR UPDATE");
    expect(block).toContain('lockedCount.status !== "completed"');
    expect(block).toContain("يجب إنهاء عملية الجرد وحفظها نهائياً قبل تطبيق التسوية");
  });

  it("keeps Settlement header/items, Inventory value, and Inventory transaction writes on the transaction writer", () => {
    const block = settlementBlock();

    expect(block).toContain("await writer.insert(inventorySettlements)");
    expect(block).toContain("await writer.insert(inventorySettlementItems)");
    expect(block).toContain("await writer.update(inventory).set(");
    expect(block).toContain("await writer.insert(inventoryTransactions)");
    expect(block).not.toContain("await db.insert(inventorySettlements)");
    expect(block).not.toContain("await db.insert(inventorySettlementItems)");
    expect(block).not.toContain("await db.insert(inventoryTransactions)");
  });

  it("preserves the Phase 3 and Phase 4 approved workflow guards", () => {
    const block = settlementBlock();
    const router = read("server/routers/inventory/inventoryCount.router.ts");

    expect(block).toContain("تم تطبيق تسوية لهذا الجرد مسبقاً");
    expect(block).toContain("frozenDiff !== normalizeInventoryQuantity(countedAfter - expectedBalance)");
    expect(block).toContain("يجب تطبيق التسوية على جميع فروقات الجرد المحفوظة معاً");
    expect(block).toContain("التسوية اليدوية القديمة موقوفة عند تفعيل Lots");
    expect(block).toContain("readCountSnapshotCost(writer, item.inventoryId, Number(item.lotId))");
    expect(block).toContain("adjustmentValue = roundTo(adjustment.diffQuantity * unitCostUsed, 2)");
    expect(router).not.toContain("unitCostUsed: z.");
    expect(router).not.toContain("adjustmentValue: z.");
  });
});
