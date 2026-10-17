import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

function fixture(stock = 40, lots = true) {
  const source = fs.readFileSync("server/routers/purchase/purchase-orders.router.ts", "utf8");
  const start = source.indexOf("  confirmDeliveryToRequester:") + "  confirmDeliveryToRequester:".length;
  const code = "module.exports=" + source.slice(start, source.indexOf("\n  incrementPrintCount:", start)).trim().replace(/,$/, "") + ";";
  const written: any[] = [], queries: any[] = [], order = { id: 5, purchaseOrderId: 6, quantity: 2, unit: "كرتون", status: "delivered_to_warehouse" };
  const module = { exports: null as any };
  vm.runInNewContext(transformSync(code, { loader: "ts", format: "cjs", target: "es2022" }).code, {
    module, exports: module.exports, z, TRPCError, sql,
    issueCostAllocationsSchema: z.array(z.any()),
    warehouseProcedure: { input: (schema: any) => ({ mutation: (handler: any) => (args: any) => handler({ ...args, input: schema.parse(args.input) }) }) },
    isInventoryLotsEnabled: () => lots,
    assertCanPerformItemStatusPOAction: () => {}, assertActualDeliveryRecipient: async () => ({ id: 8 }),
    syncPathBTicketFromPurchaseOrder: async () => {},
    db: { getPOItemById: async () => order, getPurchaseOrderById: async () => ({ id: 6, ticketId: null }),
      getInventoryByPOItemId: async () => ({ id: 3, quantity: stock, unit: "حبة" }),
      getDb: async () => ({ execute: async (query: any) => { queries.push(new MySqlDialect().sqlToQuery(query)); return [[{ quantity: "40.000" }]]; } }),
      issueDelivery: async (input: any) => { written.push(input); return { inventoryTransactionId: 1, deliveryNumber: "D1" }; },
      createAuditLog: async () => {},
    },
  });
  return { written, queries, order, run: (quantity: number) => module.exports({ ctx: { user: { id: 9, role: "warehouse" } }, input: { itemId: 5, deliveredToId: 8, deliveryQty: quantity, deliveryUnit: "حبة", lotTrackingToken: "token" } }) };
}
test("two purchased cartons received as 40 pieces allow a three-piece delivery without changing the original PO unit", async () => {
  const f = fixture(); await f.run(3);
  assert.equal(f.written[0].quantity, 3); assert.equal(f.written[0].unit, "حبة");
  assert.equal(f.order.quantity, 2); assert.equal(f.order.unit, "كرتون");
  assert.match(f.queries[0].sql, /SUM\(originalQuantity\)/);
});
test("converted PO delivery cannot exceed its physical received quantity or current stock", async () => {
  for (const [stock, qty] of [[100, 41], [5, 6]]) {
    const f = fixture(stock); await assert.rejects(f.run(qty), /أكبر من المتاح/); assert.equal(f.written.length, 0);
  }
});
test("legacy non-lot delivery preserves the previous PO quantity bound without a new query", async () => {
  const f = fixture(40, false); await assert.rejects(f.run(3), /أكبر من المتاح/);
  assert.equal(f.written.length, 0); assert.equal(f.queries.length, 0);
});
