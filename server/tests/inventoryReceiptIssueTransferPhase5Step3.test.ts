import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const receiptsRouter = () => read("server/routers/inventory/receipts.v2.router.ts");
const standaloneReceive = () => read("client/src/pages/inventory/InventoryStandaloneReceive.tsx");
const poReceive = () => read("client/src/pages/inventory/WarehouseReceiveV2.tsx");
const invoiceDrafts = () => read("server/_core/db/invoice-drafts.ts");
const returnsDb = () => read("server/_core/db/warehouse-returns.ts");
const warehousesDb = () => read("server/_core/db/warehouses.ts");
const receiptsDb = () => read("server/_core/db/warehouse-receipts.ts");


describe("Main Phase 5 / 5.3 — Receipt / Issue / Transfer hardening", () => {
  it("removes fixed warehouse id 1 from current receipt input paths", () => {
    const router = receiptsRouter();
    expect(router).toContain("warehouseId:          z.number().optional()");
    expect(router).toContain('eq(warehouses.type, "main")');
    expect(router).toContain('eq(warehouses.isActive, 1)');
    expect(router).toContain("receiptWarehouseId");
    expect(router).not.toContain("const warehouseId = Number(item.warehouseId || 1)");
    expect(router).not.toContain("warehouseId:          item.warehouseId || 1");
    expect(standaloneReceive()).not.toContain("warehouseId:         1");
    expect(poReceive()).not.toContain("warehouseId:         1");
  });

  it("keeps receipt valuation on a locked Aggregate Inventory row", () => {
    const source = receiptsRouter();
    const start = source.indexOf("async function processReceiptItem");
    const block = source.slice(start, source.indexOf("async function enrichItemsWithInventoryData", start));
    expect(block).toContain("FOR UPDATE");
    expect(block).toContain("calculateMovingWeightedAverage");
    expect(block).toContain("calculateInventoryValue(newQty, newAverageCost)");
  });

  it("hardens the legacy draft receipt path without inventing a warehouse id", () => {
    const source = invoiceDrafts();
    const start = source.indexOf("export async function processApprovedReceiptItems");
    const end = source.indexOf("export async function", start + 10);
    const block = source.slice(start, end > start ? end : undefined);
    expect(block).toContain('eq(warehouses.type, "main")');
    expect(block).toContain('eq(warehouses.isActive, 1)');
    expect(block).toContain("FOR UPDATE");
    expect(block).toContain("warehouseId:     await getReceiptWarehouseId()");
    expect(block).not.toContain("historically creates stock in warehouse 1");
  });

  it("locks Aggregate Inventory before delivery quantity/cost are read", () => {
    const source = returnsDb();
    const start = source.indexOf("export async function issueDelivery");
    const end = source.indexOf("export async function updateDeliveryDocumentPdf", start);
    const block = source.slice(start, end);
    const lockAt = block.indexOf("FOR UPDATE");
    const readAt = block.indexOf("const item = await getInventoryItemById");
    expect(lockAt).toBeGreaterThanOrEqual(0);
    expect(readAt).toBeGreaterThan(lockAt);
    expect(block).toContain('transactionType: "delivery"');
    expect(block).toContain("documentUrl: deliveryNumber");
  });

  it("locks source and existing destination inventory for both transfer paths", () => {
    const source = warehousesDb();
    const start = source.indexOf("export async function createWarehouseTransfer");
    const end = source.indexOf("export async function getWarehouseTransfers", start);
    const block = source.slice(start, end);
    expect(block).toContain("SELECT id FROM inventory WHERE id = ${params.fromInventoryId} FOR UPDATE");
    expect(block).toContain("SELECT id FROM inventory WHERE id = ${dest.id} FOR UPDATE");
    expect(block).not.toContain("if (lotsEnabled) {\n      await tx.execute(sql`SELECT id FROM inventory WHERE id = ${params.fromInventoryId} FOR UPDATE`)");
  });

  it("uses one TRF reference on the transfer header and both inventory movements", () => {
    const source = warehousesDb();
    const start = source.indexOf("export async function createWarehouseTransfer");
    const end = source.indexOf("export async function getWarehouseTransfers", start);
    const block = source.slice(start, end);
    expect(block).toContain("const transferNumber = await generateTransferNumber(tx)");
    expect((block.match(/documentUrl: transferNumber/g) || []).length).toBeGreaterThanOrEqual(4);
    expect(block).toContain("transferNumber,");
  });

  it("retains existing RCV numbering and does not introduce a partial new counter", () => {
    const source = receiptsDb();
    expect(source).toContain("export async function getNextReceiptNumber(tx?: any)");
    expect(source).toContain("warehouseReceipts.receiptNumber");
    expect(source).not.toContain("receiptNumberCounter");
  });
});
