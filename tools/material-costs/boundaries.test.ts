import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { MySqlDialect, getTableConfig } from "drizzle-orm/mysql-core";
import * as orm from "drizzle-orm";
import { z } from "zod";
import { resolveExecutionCostContext } from "../../server/services/material-costs/context";
import { readMaterialCostIssues } from "../../server/services/material-costs/reader";
const dialect = new MySqlDialect();
const compile = (query: any) => dialect.sqlToQuery(query);
function connection(results: any[][]) {
  const queries: any[] = [];
  return { queries, execute: async (query: any) => { const compiled = compile(query); queries.push(compiled); assert.match(compiled.sql, /^SELECT\b/i); return [results.shift() || []]; } };
}
const base = { beneficiarySiteId: 1, beneficiarySectionId: 2, beneficiaryAssetId: null };
const named = { id: 1, ticketNumber: "MT-1", status: "in_progress", workflowModel: "sub_ticket", siteId: 1, sectionId: 2, assetId: null, itemId: 3, itemStatus: "in_progress" };
test("independent issue creates an explicit source without guessing from supplier/PO", async () => {
  assert.equal((await resolveExecutionCostContext(connection([]), base)).executionSource, "independent");
});
test("named reference and number are obtained from server-side ticket/item identity", async () => {
  const result = await resolveExecutionCostContext(connection([[named], []]), { ...base, selectedTicketItemId: 3 });
  assert.deepEqual(result, { executionSource: "ticket_named", executionId: 1, executionItemId: 3, executionNumber: "MT-1", ticketId: 1 });
});
test("manual issue cannot steal another PO ticket's source or fake destination", async () => {
  await assert.rejects(resolveExecutionCostContext(connection([[named]]), { ...base, selectedTicketItemId: 3, ticketId: 999 }), /غير صالح/);
  await assert.rejects(resolveExecutionCostContext(connection([[named]]), { ...base, selectedTicketItemId: 3, beneficiarySiteId: 999 }), /تطابق/);
});
test("closed items, organizational parents and invalid references are rejected", async () => {
  for (const row of [undefined, { ...named, status: "closed" }, { ...named, itemStatus: "closed" }, { ...named, workflowModel: "department_tasks" }]) {
    await assert.rejects(resolveExecutionCostContext(connection([row ? [row] : []]), { ...base, selectedTicketItemId: 3 }));
  }
});
test("generic manual issue cannot bypass a ticket-team material need", async () => {
  await assert.rejects(resolveExecutionCostContext(connection([[named], [{ id: 10 }]]), { ...base, selectedTicketItemId: 3 }), /احتياج الفريق/);
  assert.equal((await resolveExecutionCostContext(connection([[named], [{ id: 10 }]]), { ...base, ticketId: 1, ticketItemId: 3 })).executionSource, "ticket_team");
});
test("PMV2 remains its own task and cannot be charged to a ticket simultaneously", async () => {
  const result = await resolveExecutionCostContext(connection([[{ id: 9, taskNumber: "PMV2-9", itemId: 3 }]]), { ...base, pmv2TaskItemId: 3 });
  assert.equal(result.executionSource, "pmv2"); assert.equal(result.executionId, 9);
  await assert.rejects(resolveExecutionCostContext(connection([]), { ...base, pmv2TaskItemId: 3, ticketId: 1 }), /معًا/);
});
test("report reader is SELECT-only and uses original snapshots and physical return references", async () => {
  const db = connection([[{ id: 1, transactionId: 10, deliveryId: 20, source: "ticket_named", sourceId: 1, sourceItemId: 3, siteId: 1, sectionId: 2, assetId: null }], [{ id: 30, deliveryId: 20, number: "R", quantity: 1 }]]);
  const issues = await readMaterialCostIssues(db, { source: "ticket", from: "2026-10-15", to: "2026-11-01" });
  assert.equal(issues[0].returns[0].id, 30);
  assert.match(db.queries[0].sql, /INNER JOIN material_execution_cost_contexts/);
  assert.match(db.queries[0].sql, /lotIssueUnitCostSnapshot/);
  assert.doesNotMatch(db.queries[0].sql, /actualTotalCost|estimatedCost/);
  assert.match(db.queries[1].sql, /sourceDeliveryDocumentId/);
  assert.doesNotMatch(db.queries[1].sql, /2026-/);
});
test("receipt API requires explicit positive conversion and a stock unit, not a default of one", () => {
  const source = fs.readFileSync("server/routers/inventory/receipts.v2.router.ts", "utf8");
  const code = source.slice(source.indexOf("const receivedItemSchema"), source.indexOf("export const receiptsV2Router")) + "\nmodule.exports=receivedItemSchema;";
  const module = { exports: {} as any };
  vm.runInNewContext(transformSync(code, { loader: "ts", format: "cjs" }).code, { module, exports: module.exports, z, INVALID_CONVERSION_MESSAGE: "invalid" });
  const schema = module.exports;
  const item = { itemName: "لمبات", receivedQuantity: 1, purchaseUnit: "كرتون", issueUnit: "حبة", unitCost: "300" };
  for (const conversionFactor of [undefined, 0, -1, NaN, Infinity]) assert.equal(schema.safeParse({ ...item, conversionFactor }).success, false);
  assert.equal(schema.safeParse({ ...item, conversionFactor: 20 }).success, true);
  assert.equal(schema.safeParse({ ...item, issueUnit: undefined, conversionFactor: 20 }).success, false);
});
test("manual installation is additive and ORM metadata matches its named movement FK without changing old allocation columns", async () => {
  const schema = await import("../../drizzle/schema");
  const config = getTableConfig(schema.materialExecutionCostContexts);
  assert.equal(config.name, "material_execution_cost_contexts");
  assert.equal(config.foreignKeys[0].getName(), "fk_material_execution_movement");
  assert.equal(orm.getTableName(config.foreignKeys[0].reference().foreignTable), "inventory_transactions");
  assert.equal(getTableConfig(schema.inventoryIssueCostAllocations).columns.some(column => column.name === "executionSource"), false);
  for (const file of ["01-check-before-install.sql", "02-create-context-table.sql", "03-verify-install.sql"]) {
    const statement = fs.readFileSync(`docs/material-costs/${file}`, "utf8").replace(/^--.*$/gm, "");
    assert.equal((statement.match(/;/g) || []).length, 1);
    assert.doesNotMatch(statement, /\b(ALTER|UPDATE|DELETE|TRUNCATE|INSERT|DROP)\s+(TABLE|FROM|INTO|inventory|tickets)/i);
  }
});
