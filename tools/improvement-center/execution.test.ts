import test from "node:test";
import assert from "node:assert/strict";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { type SQL } from "drizzle-orm";
import { aggregateImprovementCosts as costs, moneyCents, hasCompleteCostStudy } from "../../shared/improvement-execution";
import { validateIdeaLocation, prepareIdeaExecution, linkCreatedExecution, executionReference, improvementExecutionSummary, validateDirectIdeaPurchaseContext, assertNotTrackedIdeaSource } from "../../server/services/improvement-ideas/execution";
const ticket = { id: 1, ticketNumber: "MT-1", status: "closed", actualCost: null };
const order = { id: 2, poNumber: "PR-2", ticketId: 1, status: "received" };
const item = { id: 3, purchaseOrderId: 2, itemName: "Bearing", status: "delivered_to_warehouse", actualTotalCost: "100.00", purchasedAt: "2026-10-10" };
const issue = { id: 4, ticketId: 1, purchaseOrderItemId: null, type: "out", transactionType: "delivery", totalCost: "50.00" };
const study = { costStudiedAt: "2026-10-10", costStudyById: 1, costStudyNotes: "Benefits", estimatedMaterialsCost: "100", estimatedLaborCost: "0", estimatedServicesCost: "0" };
const idea = { id: 9, requestNumber: "IMP-9", executionTrackingVersion: 1, costStudyRequired: 1, status: "approved", ...study, implementationOwner: "Manager", implementationDueDate: "2026-11-01", siteId: 1, sectionId: 2, assetId: null };
const actor = { id: 8, role: "maintenance_manager" };
const location = { siteId: 1, sectionId: 2 };
const dialect = new MySqlDialect();
class FakeSql {
  queries: { sql: string; params: unknown[] }[] = [];
  constructor(private responses: any[]) {}
  async execute(query: SQL) {
    this.queries.push(dialect.sqlToQuery(query));
    if (!this.responses.length) throw Error("Unexpected SQL query");
    const result = this.responses.shift();
    if (result instanceof Error) throw result;
    return [result, []];
  }
}
const masters = [[{ id: 1, isActive: 1 }], [{ id: 2, siteId: 1, isActive: 1 }]];
test("exact cents, invalid values and explicit zero", () => {
  assert.equal(moneyCents("0"), 0); assert.equal(moneyCents("0.01"), 1);
  assert.equal(moneyCents("999999999999.99"), 99999999999999);
  for (const value of [null, "", "1.001", "-2", "NaN", "1e3"]) assert.equal(moneyCents(value), null);
});
test("study requires all costs, rationale and author", () => {
  assert.equal(hasCompleteCostStudy(study), true);
  for (const field of Object.keys(study)) assert.equal(hasCompleteCostStudy({ ...study, [field]: null }), false);
});
test("purchase plus issue of same lot counted once", () => {
  const result = costs([ticket], [order], [item, item], [{ ...issue, purchaseOrderItemId: 3 }, { ...issue, id: 5, type: "in", transactionType: "return", purchaseOrderItemId: 3 }]);
  assert.equal(result.total, 100); assert.equal(result.lines.length, 1); assert.equal(result.complete, true);
});
test("existing stock issues minus returns and duplicate document joins", () => {
  const result = costs([ticket], [], [], [issue, issue, { ...issue, id: 5, type: "in", transactionType: "return", totalCost: "10.01" }]);
  assert.equal(result.total, 39.99); assert.equal(result.lines.length, 2);
});
test("estimates and unrelated sources are excluded", () => {
  assert.equal(costs([ticket], [order], [{ ...item, status: "approved" }, { ...item, id: 6, purchaseOrderId: 999 }], [{ ...issue, ticketId: 999 }, { ...issue, transactionType: "transfer" }]).total, 0);
});
test("missing purchase cost remains incomplete instead of zero", () => {
  const result = costs([ticket], [order], [{ ...item, actualTotalCost: null }], []);
  assert.equal(result.complete, false); assert.equal(result.issues[0].code, "missing_value");
});
test("authorized receipt with actual cost can precede purchasedAt", () => {
  assert.equal(costs([ticket], [order], [{ ...item, purchasedAt: null, receivedAt: "2026-10-10" }], []).total, 100);
  assert.equal(costs([ticket], [order], [{ ...item, purchasedAt: null }], []).complete, false);
});
test("recorded ticket TOTAL adds only maintenance remainder", () => {
  const result = costs([{ ...ticket, actualCost: "180" }], [order], [item], [issue]);
  assert.equal(result.total, 180); assert.equal(result.lines.find(line => line.documentKind === "ticket")?.amount, 30);
});
test("ticket total smaller than components requires reconciliation", () => {
  assert.equal(costs([{ ...ticket, actualCost: "10" }], [], [], [issue]).complete, false);
});
test("missing inventory value and negative aggregate reject closing", () => {
  assert.equal(costs([ticket], [], [], [{ ...issue, totalCost: null }]).complete, false);
  assert.throws(() => costs([ticket], [], [], [{ ...issue, type: "in", transactionType: "return" }]));
});
test("location validates hierarchy and optional asset", async () => {
  await validateIdeaLocation(new FakeSql([...masters, [{ id: 3, siteId: 1, sectionId: 2 }]]), { ...location, assetId: 3 });
  await assert.rejects(validateIdeaLocation(new FakeSql([]), {}));
  await assert.rejects(validateIdeaLocation(new FakeSql([masters[0], [{ id: 2, siteId: 8, isActive: 1 }]]), location));
  await assert.rejects(validateIdeaLocation(new FakeSql([...masters, [{ id: 3, siteId: 1, sectionId: 7 }]]), { ...location, assetId: 3 }));
});
test("only authorized actor transforms, before any SQL", async () => {
  const tx = new FakeSql([]);
  await assert.rejects(prepareIdeaExecution(tx, 9, { ...actor, role: "technician" }, location));
  assert.equal(tx.queries.length, 0);
});
test("approved source is locked and validates new context", async () => {
  const tx = new FakeSql([[idea], ...masters]);
  assert.equal((await prepareIdeaExecution(tx, 9, actor, location)).id, 9);
  assert.match(tx.queries[0].sql, /FOR UPDATE/); assert.deepEqual(tx.queries[0].params, [9]);
});
test("already linked, unapproved, incomplete study or missing plan rejected", async () => {
  for (const change of [{ linkedTicketId: 1 }, { status: "in_progress" }, { costStudyById: null }, { implementationOwner: " " }]) await assert.rejects(prepareIdeaExecution(new FakeSql([[{ ...idea, ...change }]]), 9, actor, location));
});
test("tampered location rejected; legacy source has no new location constraint", async () => {
  await assert.rejects(prepareIdeaExecution(new FakeSql([[idea]]), 9, actor, { siteId: 8, sectionId: 2 }));
  await prepareIdeaExecution(new FakeSql([[{ ...idea, executionTrackingVersion: 0, costStudyRequired: 0 }]]), 9, actor, {});
});
test("link and audit are bound SQL, lost state or audit failure aborts", async () => {
  const tx = new FakeSql([{ affectedRows: 1 }, { affectedRows: 1 }]);
  await linkCreatedExecution(tx, idea, "ticket", 1, actor.id);
  assert.match(tx.queries[0].sql, /linkedTicketId/); assert.match(tx.queries[1].sql, /audit_logs/);
  await assert.rejects(linkCreatedExecution(new FakeSql([{ affectedRows: 0 }]), idea, "purchase", 2, actor.id));
  await assert.rejects(linkCreatedExecution(new FakeSql([{ affectedRows: 1 }, Error("Audit failure")]), idea, "purchase", 2, actor.id));
});
test("inherited idea reference follows PO -> child -> parent", async () => {
  const tx = new FakeSql([[], [{ ticketId: 11 }], [{ parentTicketId: 1 }], [{ parentTicketId: null }], [{ id: 9, requestNumber: "IMP-9" }]]);
  assert.equal((await executionReference(tx, "purchase", 2))?.requestNumber, "IMP-9");
  assert.deepEqual(tx.queries.at(-1)?.params, [11, 1]);
});
test("direct PO source, ambiguity, cycles and unlinked document", async () => {
  assert.equal((await executionReference(new FakeSql([[{ id: 9 }]]), "purchase", 2))?.id, 9);
  await assert.rejects(executionReference(new FakeSql([[{ id: 9 }, { id: 10 }]]), "purchase", 2));
  await assert.rejects(executionReference(new FakeSql([[{ parentTicketId: 1 }]]), "ticket", 1));
  assert.equal(await executionReference(new FakeSql([[], [{ ticketId: null }]]), "purchase", 2), null);
});
test("summary includes child docs but excludes organizational parent cost", async () => {
  const tx = new FakeSql([[{ ...ticket, actualCost: "999", parentTicketId: null }], [{ id: 11 }], [{ ...ticket, id: 11, parentTicketId: 1, actualCost: "150" }], [], [{ ...order, ticketId: 11 }], [item], [{ ...issue, ticketId: 11, purchaseOrderItemId: 3 }], []]);
  const result = await improvementExecutionSummary(tx, { ...idea, linkedTicketId: 1 });
  assert.equal(result.total, 150); assert.equal(result.executionDone, true); assert.equal(result.estimatedTotal, 100);
  assert.match(tx.queries.at(-2)!.sql, /COALESCE\(x.purchaseOrderItemId,l.purchaseOrderItemId\)/);
  assert.match(tx.queries.at(-2)!.sql, /warehouse_returns/);
  assert.equal(result.executionProgress?.percent, 100);
});
test("empty or missing documents cannot complete; PO unresolved items cannot complete", async () => {
  assert.equal((await improvementExecutionSummary(new FakeSql([[]]), idea)).executionDone, false);
  assert.equal((await improvementExecutionSummary(new FakeSql([[], [], []]), { ...idea, linkedTicketId: 1 })).missingDocument, true);
  assert.equal((await improvementExecutionSummary(new FakeSql([[order], []]), { ...idea, linkedPurchaseOrderId: 2 })).executionDone, false);
  assert.equal((await improvementExecutionSummary(new FakeSql([[order], [{ ...item, status: "pending" }]]), { ...idea, linkedPurchaseOrderId: 2 })).executionDone, false);
});
test("new direct PO context cannot drift, ordinary/legacy orders unaffected", async () => {
  await validateDirectIdeaPurchaseContext(new FakeSql([[]]), 2, {});
  await validateDirectIdeaPurchaseContext(new FakeSql([[location]]), 2, location);
  await assert.rejects(validateDirectIdeaPurchaseContext(new FakeSql([[location]]), 2, { siteId: 9, sectionId: 2 }));
});
test("source document protection applies only to newly tracked links", async () => {
  const tx = new FakeSql([[]]);
  await assertNotTrackedIdeaSource(tx, "ticket", 1);
  assert.match(tx.queries[0].sql, /executionTrackingVersion=1/);
  await assert.rejects(assertNotTrackedIdeaSource(new FakeSql([[{ id: 9 }]]), "purchase", 2));
});
