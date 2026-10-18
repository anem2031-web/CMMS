import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import * as costing from "../../server/_core/inventory-costing";
import * as signing from "../../shared/documentSignatureSnapshot";
import * as operational from "../../server/services/operational-issues/issue-reference";

// Executes the actual central writer with strictly injected boundaries.
// No application, environment, schema module or database client is imported.
function fixture(options: { enabled?: boolean; fail?: string; unit?: string } = {}) {
  let state = { stock: 10, lot: 10, writes: [] as Array<{ table: string; value: any }> };
  const schema = new Proxy({}, { get: (_target, name) => new Proxy({ name: String(name) }, { get: (table, key) => key === "name" ? table.name : { table: table.name, key } }) });
  const sql: any = (strings: TemplateStringsArray, ...args: any[]) => ({ text: strings.join("?"), args });
  sql.join = (values: any[]) => values;
  const operator = (...args: any[]) => ({ args });
  const orm = new Proxy({ sql }, { get: (target: any, name) => target[name] || operator });
  const tx: any = {
    execute: async () => [[]],
    select: () => {
      let table = "";
      const rows = () => table === "sites" ? [{ id: 1, isActive: 1 }]
        : table === "sections" ? [{ id: 2, siteId: 1, isActive: 1 }] : [];
      const query: any = { from(value: any) { table = value.name; return query; }, where() { return query; }, limit() { return Promise.resolve(rows()); }, then(resolve: any) { return Promise.resolve(rows()).then(resolve); } };
      return query;
    },
    update: () => ({ set: () => ({ where: async () => { state.stock -= 3; return [{ affectedRows: 1 }]; } }) }),
    insert: (table: any) => ({ values: async (value: any) => {
      if (options.fail === table.name) throw new Error(`forced:${table.name}`);
      state.writes.push({ table: table.name, value }); return [{ insertId: state.writes.length + 100 }];
    } }),
  };
  const database = { transaction: async (work: any) => { const before = structuredClone(state); try { return await work(tx); } catch (error) { state = before; throw error; } } };
  const imports: any = {
    "drizzle-orm": orm, "drizzle-orm/mysql2": {}, "drizzle-orm/mysql-core": { alias: (value: any) => value }, "mysql2/promise": {},
    "../../../drizzle/schema": schema, "../env": { ENV: {} }, "./client": { getDb: async () => database },
    "./deletes": { getInventoryItemById: async () => ({ id: 1, quantity: state.stock, averageCost: "12.0000", unit: "حبة", itemName: "لمبة" }), getUserById: async () => ({ name: "المستخدم" }) },
    "./purchase": {}, "./warehouse-receipts": { getNextDeliveryNumber: async () => "DLV-TEST" },
    "../inventory-costing": costing,
    "../inventory-lots": { isInventoryLotsEnabled: () => true, consumeInventoryLotForIssue: async () => { state.lot -= 3; return { lotId: 10, issueUnitCost: 15, lotCode: "LOT-TEST", trackingToken: "token" }; } },
    "../../services/material-costs/feature": { materialExecutionCostsEnabled: () => options.enabled !== false },
    "../../services/material-costs/context": { resolveExecutionCostContext: async () => ({ executionSource: "ticket_named", executionId: 4, executionItemId: 5, executionNumber: "MT-4", ticketId: 4 }) },
    "../catalog-unit-governance": { getActiveCatalogUnitCanonicalName: async (unit: string) => unit },
    "../../../shared/documentSignatureSnapshot": signing,
    "../../services/operational-issues/issue-reference": operational,
  };
  const module = { exports: {} as any };
  const code = transformSync(fs.readFileSync("server/_core/db/warehouse-returns.ts", "utf8"), { loader: "ts", format: "cjs", target: "es2022" }).code;
  vm.runInNewContext(code, { module, exports: module.exports, console, Date, require(id: string) {
    if (!(id in imports)) throw new Error(`Blocked runtime import ${id}`);
    return imports[id];
  } });
  return { get state() { return state; }, issue: () => module.exports.issueDelivery({ inventoryId: 1, quantity: 3, unit: options.unit || "حبة", performedById: 8, deliveredToId: 9, lotTrackingToken: "token",
    costAllocations: [{ beneficiarySiteId: 1, beneficiarySectionId: 2, quantity: 3 }] }) };
}

test("central issue writes operational lot cost, original financial average and ticket context atomically", async () => {
  const f = fixture(); const result = await f.issue();
  assert.equal(f.state.stock, 7); assert.equal(f.state.lot, 7);
  const movement = f.state.writes.find(row => row.table === "inventoryTransactions")!.value;
  const allocation = f.state.writes.find(row => row.table === "inventoryIssueCostAllocations")!.value[0];
  const context = f.state.writes.find(row => row.table === "materialExecutionCostContexts")!.value;
  const delivery = f.state.writes.find(row => row.table === "deliveryDocuments")!.value;
  assert.equal(movement.totalCost, "36.00"); assert.equal(movement.ticketId, 4);
  assert.equal(allocation.allocatedCostTotal, "45.00"); assert.equal(allocation.lotIssueUnitCostSnapshot, "15.0000");
  assert.equal(context.inventoryTransactionId, allocation.inventoryTransactionId); assert.equal(context.executionId, 4);
  assert.equal(delivery.ticketId, 4); assert.equal(delivery.ticketNumber, "MT-4");
  assert.equal(result.allocatedCostTotal, 45);
});
for (const table of ["inventoryIssueCostAllocations", "materialExecutionCostContexts", "deliveryDocuments"]) test(`failure in ${table} rolls back stock, lots, financial and source writes`, async () => {
  const f = fixture({ fail: table }); await assert.rejects(f.issue(), /forced/);
  assert.equal(f.state.stock, 10); assert.equal(f.state.lot, 10); assert.equal(f.state.writes.length, 0);
});
test("feature off never touches the new context table and keeps old issue behavior", async () => {
  const f = fixture({ enabled: false, fail: "materialExecutionCostContexts" }); await f.issue();
  assert.equal(f.state.stock, 7); assert.equal(f.state.writes.some(row => row.table === "materialExecutionCostContexts"), false);
  assert.equal(f.state.writes.find(row => row.table === "inventoryTransactions")!.value.totalCost, "36.00");
});
test("a carton label cannot turn a piece-based stock issue into a different physical quantity", async () => {
  const f = fixture({ unit: "كرتون" }); await assert.rejects(f.issue(), /تطابق وحدة المخزون/);
  assert.equal(f.state.stock, 10); assert.equal(f.state.lot, 10); assert.equal(f.state.writes.length, 0);
});
