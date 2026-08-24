import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const disposalBlock = () => {
  const source = read("server/_core/db/warehouse-receipts.ts");
  const start = source.indexOf("// عمليات الاستبعاد — Disposal Operations");
  const end = source.indexOf("// 4) قائمة عمليات الاستبعاد للجدول الرئيسي", start);
  return source.slice(start, end);
};

describe("Main Phase 5 / 5.1 — Disposal atomic posting and valuation protection", () => {
  it("allocates the disposal number through the active transaction writer", () => {
    const block = disposalBlock();

    expect(block).toContain("async function generateDisposalNumberWith(writer: any)");
    expect(block).toContain("await writer.insert(disposalNumberCounter)");
    expect(block).toContain("const operationNumber = await generateDisposalNumberWith(tx)");
    expect(block).not.toContain("const operationNumber = await generateDisposalNumber();");
  });

  it("keeps the legacy non-Lot workflow but posts it inside one transaction", () => {
    const block = disposalBlock();
    const legacyStart = block.indexOf("if (!lotsEnabled)");
    const lotsStart = block.indexOf("// عند تفعيل Lots:", legacyStart);
    const legacy = block.slice(legacyStart, lotsStart);

    expect(legacy).toContain("return db.transaction(async (tx: any) => {");
    expect(legacy).toContain("await tx.insert(disposalOperations)");
    expect(legacy).toContain("await tx.insert(disposalItems)");
    expect(legacy).toContain("await issueDisposalWith(tx, disposalOperationId)");
    expect(legacy).not.toContain("await issueDisposal(disposalOperationId)");
  });

  it("re-reads and locks current Inventory state before legacy disposal posting", () => {
    const block = disposalBlock();
    const issueStart = block.indexOf("async function issueDisposalWith");
    const createStart = block.indexOf("export async function createDisposal", issueStart);
    const issue = block.slice(issueStart, createStart);

    expect(issue).toContain("FOR UPDATE");
    expect(issue).toContain("const averageCost = parseFloat(inv.averageCost || \"0\")");
    expect(issue).toContain("const movementTotalCost = calculateMovementTotal(qty, averageCost)");
    expect(issue).toContain("gte(inventory.quantity, qty)");
    expect(issue).toContain("transactionType: \"disposal\"");
    expect(issue).toContain("unitCost:        averageCost.toFixed(4)");
    expect(issue).toContain("totalCost:       movementTotalCost.toFixed(2)");
  });

  it("keeps the Lot-aware path atomic and server-valued", () => {
    const block = disposalBlock();
    const lotsStart = block.indexOf("// عند تفعيل Lots:");
    const lots = block.slice(lotsStart);

    expect(lots).toContain("return db.transaction(async (tx: any) => {");
    expect(lots).toContain("resolveInventoryLotForDisposal");
    expect(lots).toContain("consumeInventoryLotForIssue");
    expect(lots).toContain("FOR UPDATE");
    expect(lots).toContain("const averageCost = parseFloat(inv.averageCost || \"0\")");
    expect(lots).toContain("unitCost:      averageCost.toFixed(4)");
    expect(lots).toContain("totalCost:     movementTotalCost.toFixed(2)");
    expect(lots).toContain("transactionType:  \"disposal\"");
  });

  it("does not introduce an approval or new disposal workflow in the router", () => {
    const router = read("server/routers/inventory/disposal.router.ts");

    expect(router).toContain('reason:       z.enum(["damaged", "expired", "missing", "other"])');
    expect(router).not.toContain("approval");
    expect(router).not.toContain("approvedBy");
    expect(router).not.toContain("writeoffUnitCost");
  });
});
