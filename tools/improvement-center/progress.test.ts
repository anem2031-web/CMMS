import test from "node:test";
import assert from "node:assert/strict";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import { deriveImprovementExecutionProgress as progress } from "../../shared/improvement-execution";
import { loadImprovementExecutionProgress } from "../../server/services/improvement-ideas/progress";

const idea = { id: 1, executionTrackingVersion: 1, linkedTicketId: 10 };
const root = { id: 10, status: "closed", parentTicketId: null };
const child = { id: 11, status: "closed", parentTicketId: 10 };
const order = { id: 20, ticketId: 11, status: "received" };
const item = { id: 30, purchaseOrderId: 20, status: "delivered_to_warehouse" };
const task = { id: 40, ticketId: 10, status: "new", convertedTicketId: null };

test("unlinked scope is zero, never a vacuous hundred percent", () => {
  assert.deepEqual(progress({ id: 1 }, [], [], [], []), { percent: 0, completed: 0, total: 0, ready: false, missingDocument: false });
});
test("a closed ticket is complete without waiting for the separate impact evaluation", () => {
  assert.equal(progress(idea, [root], [], [], []).percent, 100);
  assert.equal(progress(idea, [{ ...root, status: "requester_confirmed" }], [], [], []).percent, 100);
});
test("open execution never inherits a stored manual percentage", () => {
  assert.equal(progress({ ...idea, implementationProgress: 100 } as any, [{ ...root, status: "under_inspection" }], [], [], []).percent, 0);
});
test("parent closure and executable child closure are both represented", () => {
  for (const tickets of [[{ ...root, status: "department_planning" }, child], [root, { ...child, status: "in_progress" }]]) {
    assert.equal(progress(idea, tickets, [], [], []).percent, 50);
  }
});
test("a new task without a child prevents a misleading hundred percent", () => {
  const result = progress(idea, [root, child], [], [], [task]);
  assert.equal(result.total, 3); assert.equal(result.completed, 2); assert.equal(result.percent, 67); assert.equal(result.ready, false);
});
test("converted task follows its actual target and is not counted twice", () => {
  const result = progress(idea, [root, child], [], [], [{ ...task, status: "promoted", convertedTicketId: 11 }]);
  assert.equal(result.total, 2); assert.equal(result.percent, 100);
});
test("cancelled unconverted tasks are omitted while a missing converted target stays unresolved", () => {
  assert.equal(progress(idea, [root], [], [], [{ ...task, status: "cancelled" }]).percent, 100);
  const missing = progress(idea, [root], [], [], [{ ...task, convertedTicketId: 99 }]);
  assert.equal(missing.missingDocument, true); assert.equal(missing.percent, 50); assert.equal(missing.ready, false);
});
test("cancelled tickets do not count as successfully executed", () => {
  const result = progress(idea, [root, { ...child, status: "cancelled" }], [], [], []);
  assert.equal(result.percent, 50); assert.equal(result.ready, false);
});
test("missing linked ticket or purchase documents cannot appear complete", () => {
  assert.equal(progress(idea, [], [], [], []).missingDocument, true);
  const result = progress({ ...idea, linkedPurchaseOrderId: 99 }, [root], [], [], []);
  assert.equal(result.missingDocument, true); assert.equal(result.total, 2); assert.equal(result.percent, 50);
});
test("fulfilled purchase counts alongside its linked ticket tree", () => {
  assert.equal(progress(idea, [root, child], [order], [item], []).percent, 100);
  assert.equal(progress({ id: 1, linkedPurchaseOrderId: 20 }, [], [order], [item], []).percent, 100);
});
test("rejected and cancelled purchasing scope remains distinct from successful execution", () => {
  for (const purchase of [{ ...order, status: "rejected" }, { ...order, status: "cancelled" }, { ...order, status: "partial_purchase" }]) {
    assert.equal(progress({ id: 1, linkedPurchaseOrderId: 20 }, [], [purchase], [item], []).percent, 0);
  }
  for (const status of ["rejected", "cancelled", "pending_review"]) {
    assert.equal(progress({ id: 1, linkedPurchaseOrderId: 20 }, [], [order], [{ ...item, status }], []).percent, 0);
  }
});
test("empty PO items never satisfy fulfillment; purchased items require the received header", () => {
  const source = { id: 1, linkedPurchaseOrderId: 20 };
  assert.equal(progress(source, [], [order], [], []).percent, 0);
  assert.equal(progress(source, [], [{ ...order, status: "purchased" }], [{ ...item, status: "purchased" }], []).percent, 0);
  assert.equal(progress(source, [], [order], [{ ...item, status: "purchased" }], []).percent, 100);
});
test("joins, task rows and overlapping linked sources are deduplicated", () => {
  const result = progress({ ...idea, linkedPurchaseOrderId: 20 }, [root, child, child], [order, order], [item, item], [task, task]);
  assert.equal(result.total, 4); assert.equal(result.completed, 3); assert.equal(result.percent, 75);
});
test("unrelated records never affect an idea's progress", () => {
  const result = progress(idea, [root, { ...child, id: 99, parentTicketId: null, status: "new" }], [{ ...order, ticketId: 99 }], [item], [{ ...task, ticketId: 99 }]);
  assert.equal(result.total, 1); assert.equal(result.percent, 100);
});
test("rounding cannot promote incomplete execution to one hundred", () => {
  const tickets = [root, ...Array.from({ length: 199 }, (_, index) => ({ id: index + 100, parentTicketId: 10, status: index === 198 ? "in_progress" : "closed" }))];
  assert.equal(progress(idea, tickets, [], [], []).percent, 99);
});
test("cycles are not shown as completed", () => {
  const result = progress(idea, [{ ...root, parentTicketId: 11 }, child], [], [], []);
  assert.equal(result.missingDocument, true); assert.equal(result.percent, 99); assert.equal(result.ready, false);
});

class FakeSql {
  queries: { sql: string; params: unknown[] }[] = [];
  constructor(private responses: any[]) {}
  async execute(query: SQL) {
    this.queries.push(new MySqlDialect().sqlToQuery(query));
    if (!this.responses.length) throw new Error("Unexpected database call");
    const result = this.responses.shift();
    if (result instanceof Error) throw result;
    return [result, []];
  }
}
test("batch loader shares graph reads and isolates each idea's result", async () => {
  const second = { ...idea, id: 2, linkedTicketId: 12 };
  const tx = new FakeSql([[root, { ...root, id: 12 }], [child], [], [order], [item], [task]]);
  const result = await loadImprovementExecutionProgress(tx, [idea, second]);
  assert.equal(result.get(1)?.percent, 75); assert.equal(result.get(2)?.percent, 100);
  assert.equal(tx.queries.length, 6); assert.deepEqual(tx.queries[0].params, [10, 12]);
  assert.ok(tx.queries.every(query => !/actualCost|actualTotalCost|inventory_transactions|UPDATE|INSERT/.test(query.sql)));
});
test("legacy and unlinked tracked ideas require no execution SQL", async () => {
  const tx = new FakeSql([]);
  const result = await loadImprovementExecutionProgress(tx, [{ ...idea, executionTrackingVersion: 0 }, { id: 2, executionTrackingVersion: 1 }]);
  assert.equal(result.has(1), false); assert.equal(result.get(2)?.percent, 0); assert.equal(tx.queries.length, 0);
});
test("loader failures propagate rather than returning a fabricated complete result", async () => {
  await assert.rejects(loadImprovementExecutionProgress(new FakeSql([new Error("read failed")]), [idea]), /read failed/);
});
test("the document safety limit applies per idea, not to the union of a large approved list", async () => {
  const ideas = Array.from({ length: 2001 }, (_, index) => ({ ...idea, id: index + 1, linkedTicketId: index + 1 }));
  let reads = 0;
  const tx = { execute: async (query: SQL) => {
    const statement = new MySqlDialect().sqlToQuery(query);
    reads++;
    assert.ok(statement.params.length <= 500);
    return [statement.sql.startsWith("SELECT id,status,parentTicketId FROM tickets WHERE id IN") ? statement.params.map(id => ({ id: Number(id), status: "closed", parentTicketId: null })) : [], []];
  } };
  const result = await loadImprovementExecutionProgress(tx, ideas);
  assert.equal(result.size, 2001); assert.ok(Array.from(result.values()).every(row => row.percent === 100));
  assert.equal(reads, 20);
});
test("a single oversized execution graph still fails closed", () => {
  const tickets = [root, ...Array.from({ length: 2000 }, (_, index) => ({ id: index + 100, parentTicketId: 10, status: "closed" }))];
  assert.throws(() => progress(idea, tickets, [], [], []), /حد التحقق/);
});
