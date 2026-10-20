import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { eq, desc, and, inArray } from "drizzle-orm";
import { inventory, inventoryTransactions, warehouseReceipts, warehouseReceiptItems } from "../../drizzle/schema";
import { router } from "../routers/_shared/procedures";
import { createCatalogStockProcedure } from "../routers/inventory/catalog-stock.procedure";

// Execute the current reader's AST with a disposable fake transport. Never import
// its DB client or environment. This measures round trips, not database latency.
const source = ts.createSourceFile("inventory.ts", readFileSync(new URL("../_core/db/inventory.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const fn = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "getInventoryItems");
if (!fn) throw Error("Inventory list reader not found");
const code = ts.transpileModule(fn.getText(source).replace(/^export\s+/, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

describe("Inventory read round trips without a live database", () => {
  it.each([1, 100, 1000])("keeps the inventory reader at four queries for %i items", async size => {
    const items = Array.from({ length: size }, (_, index) => ({ id: index + 1, quantity: "10" }));
    const datasets = [items,
      items.map(item => ({ inventoryId: item.id, receiptId: item.id, purchaseOrderItemId: item.id, invoiceDate: null, unitCost: "2" })),
      items.map(item => ({ inventoryId: item.id, createdAt: null })),
      items.map(item => ({ inventoryId: item.id, receiptId: item.id, purchaseOrderItemId: item.id, unitCost: "20" })),
    ];
    let calls = 0;
    const database = { select() {
      const data = datasets[calls++];
      const query: any = { from: () => query, where: () => query, orderBy: () => query, leftJoin: () => query,
        then: (resolve: any, reject: any) => Promise.resolve(data).then(resolve, reject) };
      return query;
    } };
    const read = new Function("getDb", "inventory", "inventoryTransactions", "warehouseReceipts", "warehouseReceiptItems", "eq", "desc", "and", "inArray", `${code}; return getInventoryItems;`)(
      async () => database, inventory, inventoryTransactions, warehouseReceipts, warehouseReceiptItems, eq, desc, and, inArray);
    const result = await read();
    expect(calls).toBe(4);
    expect(result).toHaveLength(size);
    expect(result.every((item: any) => item.lastPurchasePrice === "20")).toBe(true);
  });

  it.each([1, 100, 500])("reads availability with two queries for %i catalog IDs", async size => {
    let calls = 0;
    const database = { select() {
      calls++;
      const query: any = { from: () => query, where: () => query, leftJoin: () => query,
        then: (resolve: any, reject: any) => Promise.resolve([]).then(resolve, reject) };
      return query;
    } };
    const api = router({ inventory: router({ catalogStock: createCatalogStockProcedure(async () => database) }) });
    await api.createCaller({ user: { id: 101, role: "warehouse", isActive: 1 } } as any).inventory.catalogStock({ catalogItemIds: Array.from({ length: size }, (_, index) => index + 1) });
    expect(calls).toBe(2);
  });
});
