import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../../server/maintenance-team-tickets/testing/fixture";
import { MaintenanceTeamTicketService } from "../../server/maintenance-team-tickets/service";
import { createTicketTeamExecutionRouter } from "../../server/routers/maintenance-teams/execution.router";
import { ticketExecutionSession, TICKET_EXECUTION_PROTOCOL } from "../../shared/maintenance-team-tickets/execution-session";
import { remainingReturn } from "../../shared/maintenance-team-tickets/model";
import { persistExecution } from "../../server/routers/maintenance-teams/execution.repository";
import { SqlTicketTeamAssignmentRepository } from "../../server/routers/maintenance-teams/assignment.repository";
import { MySqlDialect } from "drizzle-orm/mysql-core";
let seq = 0;
async function setup() {
  const d = createDemo();
  const a = await d.service.assign(1, { ...(await d.store.read()).tickets[0], teamId: 21 });
  await d.store.transaction(async s => {
    s.actions.push({ id: s.nextId++, assignmentId: a.id, actorId: 1, kind: TICKET_EXECUTION_PROTOCOL, note: '{"version":1}', revision: 0, at: new Date().toISOString(), operationKey: `protocol:${a.id}` });
  });
  const command = async (key = `session:${++seq}`) => ({ assignmentId: a.id, expectedRevision: (await d.store.read()).assignments[0].revision, operationKey: key });
  const session = async () => { const s = await d.store.read(); return ticketExecutionSession(s, s.assignments[0]); };
  return { ...d, a, command, session };
}
const need = { catalogItemId: 101, quantity: 4, unit: "قطعة" };
test("new ticket APIs cannot bypass start using outcome, begin-material or legacy request endpoints", async () => {
  const d = await setup(); const physical = await d.store.inspectPhysical();
  await assert.rejects(d.service.submitOutcome(3, await d.command(), "ok", { note: "", usages: [] }), /ابدأ التنفيذ/);
  await assert.rejects(d.service.beginMaterialNeed(3, await d.command()), /ابدأ التنفيذ/);
  await assert.rejects(d.service.requestMaterials(3, await d.command(), [need]), /ابدأ التنفيذ/);
  await assert.rejects(d.service.registerMaterialNeed(3, await d.command(), need, true), /ابدأ التنفيذ/);
  assert.deepEqual(await d.store.inspectPhysical(), physical);
  assert.equal((await d.session()).visits.length, 0);
});
test("start creates a durable leader visit; retries never duplicate visits or touch stock", async () => {
  const d = await setup(); const before = await d.store.inspectPhysical(); const c = await d.command();
  const result = await d.service.startExecution(3, c);
  assert.deepEqual(await d.service.startExecution(3, c), result);
  const session = await d.session(); assert.equal(session.visits.length, 1); assert.equal(session.openVisit?.leaderId, 3);
  assert.deepEqual(session.openVisit?.memberIds, [3]); assert.equal(session.working, true);
  assert.deepEqual(await d.store.inspectPhysical(), before);
  await assert.rejects(d.service.startExecution(3, await d.command()), /مشارك بالفعل/);
});
test("joining records the second technician, denies unjoined outcomes, and only leader can end after result", async () => {
  const d = await setup(); await d.service.startExecution(3, await d.command());
  await assert.rejects(d.service.submitOutcome(4, await d.command(), "ok", { note: "", usages: [] }), /انضم/);
  await d.service.startExecution(4, await d.command());
  assert.deepEqual((await d.session()).openVisit?.memberIds, [3, 4]);
  await assert.rejects(d.service.endVisit(3, await d.command()), /سجّل نتيجة/);
  await assert.rejects(d.service.endVisit(4, await d.command()), /قائد/);
  await d.service.submitOutcome(4, await d.command(), "ok", { note: "", usages: [] });
  const c = await d.command(); const end = await d.service.endVisit(3, c);
  assert.deepEqual(await d.service.endVisit(3, c), end);
  assert.equal((await d.session()).openVisit, null); assert.equal((await d.session()).visits.length, 1);
  assert.equal((await d.store.read()).assignments[0].stage, "awaiting_review");
  assert.equal((await d.store.read()).tickets[0].closed, false);
});
test("material receipt -> resume -> fixed usage -> original-Lot return keeps manager approval and ticket closure independent", async () => {
  const d = await setup(); await d.service.startExecution(3, await d.command());
  await d.service.beginMaterialNeed(3, await d.command()); await d.service.endVisit(3, await d.command());
  // Like PMV2, needs can be registered against the original visit while waiting away from site.
  await d.service.registerMaterialNeed(3, await d.command(), need, true);
  assert.equal((await d.store.read()).assignments[0].stage, "ready_to_repair");
  await assert.rejects(d.service.submitOutcome(3, await d.command(), "fixed", { note: "إصلاح", usages: [{ catalogItemId: 101, used: 3 }] }), /استكمل العمل/);
  await d.service.startExecution(3, await d.command(), true);
  assert.equal((await d.session()).visits.length, 2);
  await assert.rejects(d.service.submitOutcome(3, await d.command(), "fixed", { note: "", usages: [{ catalogItemId: 101, used: 3 }] }), /تفاصيل الإصلاح/);
  await d.service.submitOutcome(3, await d.command(), "fixed", { note: "استبدال القاطع واختبار التشغيل", usages: [{ catalogItemId: 101, used: 3 }] });
  let s = await d.store.read(); assert.equal(remainingReturn(s, s.needs[0].id), 1);
  await d.service.review(1, await d.command(), "approve_result", "اعتماد الإصلاح");
  await d.service.endVisit(3, await d.command());
  await d.service.confirmReturn(2, await d.command(), s.needs[0].id, [{ lotId: 2, quantity: 1 }]);
  s = await d.store.read(); assert.equal(remainingReturn(s, s.needs[0].id), 0);
  assert.equal(s.assignments[0].stage, "closed"); assert.equal(s.tickets[0].closed, false);
  assert.equal((await d.store.inspectPhysical()).receipts[0].lotId, 2);
});
test("waiting material cannot resume before receiving every requirement; partial stock routes only the shortage", async () => {
  const d = await setup(); await d.service.startExecution(3, await d.command());
  await d.service.beginMaterialNeed(3, await d.command());
  await d.service.registerMaterialNeed(3, await d.command(), { catalogItemId: 102, quantity: 3, unit: "قطعة" });
  await assert.rejects(d.service.startExecution(3, await d.command(), true), /المرحلة الحالية/);
  const s = await d.store.read(); assert.equal(s.needs[0].requested, 3); assert.equal(s.deliveries.length, 0);
  assert.match(s.actions.at(-1)!.note, /"shortage":2/);
});
test("returning from a blocker requires a new start and preserves the existing obstacle workflow", async () => {
  const d = await setup(); await d.service.startExecution(3, await d.command());
  await d.service.submitOutcome(3, await d.command(), "blocked", { note: "تعذر الوصول", usages: [] });
  assert.equal((await d.store.read()).assignments[0].stage, "blocked");
  await d.service.endVisit(3, await d.command()); await d.service.review(1, await d.command(), "return_to_team", "تم توفير الوصول");
  await assert.rejects(d.service.submitOutcome(3, await d.command(), "ok", { note: "", usages: [] }), /ابدأ التنفيذ/);
  await d.service.startExecution(3, await d.command()); assert.equal((await d.session()).visits.length, 2);
});
test("external request remains on existing manager-approved C path and requires its original mandatory details", async () => {
  const d = await setup(); await d.service.startExecution(3, await d.command());
  await assert.rejects(d.service.submitOutcome(3, await d.command(), "external", { note: "", usages: [] }), /السبب والتفاصيل/);
  await d.service.submitOutcome(3, await d.command(), "external", { note: "إصلاح اللوحة لدى متخصص", usages: [] });
  await d.service.endVisit(3, await d.command()); await d.service.review(1, await d.command(), "approve_external", "اعتماد المسار الحالي");
  assert.equal((await d.store.read()).assignments[0].stage, "external_in_progress");
});
test("outsider, inactive technician, warehouse and observer cannot start or end execution", async () => {
  const d = await setup(); await d.store.transaction(async s => { s.users.push({ id: 8, role: "observer", name: "Observer", active: true }); });
  for (const id of [2, 5, 7, 8]) await assert.rejects(d.service.startExecution(id, await d.command()));
  await d.service.startExecution(3, await d.command());
  for (const id of [2, 5, 7, 8]) await assert.rejects(d.service.endVisit(id, await d.command()));
});
for (const role of ["owner", "admin", "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager"]) test(`${role} executes without membership and retains actual performer identity`, async () => {
  const d = await setup(); await d.store.transaction(async s => { s.users.push({ id: 9, role, name: role, active: true }); });
  await d.service.startExecution(9, await d.command());
  await d.service.submitOutcome(9, await d.command(), "fixed", { note: "تفاصيل الإصلاح", usages: [] });
  assert.equal((await d.store.read()).actions.at(-1)!.actorId, 9); assert.equal((await d.session()).openVisit?.leaderId, 9);
  await d.service.endVisit(9, await d.command());
});
test("same-revision concurrent starts yield one visit and one conflict", async () => {
  const d = await setup(); const c = await d.command();
  const results = await Promise.allSettled([d.service.startExecution(3, c), d.service.startExecution(4, { ...c, operationKey: c.operationKey + ":other" })]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1); assert.equal((await d.session()).visits.length, 1);
});
test("failure after a session event rolls back its visit, revision, operations and stock", async () => {
  const d = await setup(); const before = await d.store.read();
  const service = new MaintenanceTeamTicketService({ read: () => d.store.read(), transaction: work => d.store.transaction(async (s, gateway) => { await work(s, gateway); throw new Error("injected persistence failure"); }) });
  await assert.rejects(service.startExecution(3, await d.command()), /injected persistence/); assert.deepEqual(await d.store.read(), before);
});
test("strict session APIs use authenticated actor and reject forged fields before touching the factory", async () => {
  const d = await setup(); let calls = 0;
  const router = createTicketTeamExecutionRouter(() => { calls++; return d.service; });
  const caller = router.createCaller({ user: { id: 3, role: "technician", isActive: 1 }, req: { ip: "test", get: () => "test" } } as any);
  const c = await d.command(); await assert.rejects(caller.startItem({ ...c, actorId: 1 } as any)); assert.equal(calls, 0);
  await caller.startItem(c); assert.equal((await d.session()).openVisit?.leaderId, 3);
});
test("historical assignments preserve their prior API while explicit start opts them into visit guards", async () => {
  const d = createDemo(); const a = await d.service.assign(1, { ...(await d.store.read()).tickets[0], teamId: 21 });
  await d.service.submitOutcome(3, { assignmentId: a.id, expectedRevision: a.revision, operationKey: "legacy:ok" }, "ok", { note: "", usages: [] });
  assert.equal((await d.store.read()).assignments[0].stage, "awaiting_review");
});
test("visit projection is assignment-scoped and ignores malformed event payloads without mutating history", async () => {
  const d = await setup(); await d.service.startExecution(3, await d.command()); const s = await d.store.read();
  for (const note of ["null", "not-json", '{"version":1,"visitKey":123}']) s.actions.push({ ...s.actions.at(-1)!, id: s.nextId++, revision: 999, note });
  s.actions.push({ ...s.actions.at(-1)!, assignmentId: 999, note: '{"version":1,"visitKey":"foreign"}' });
  const before = structuredClone(s); const session = ticketExecutionSession(s, s.assignments[0]);
  assert.equal(session.visits.length, 1); assert.deepEqual(s, before);
});
test("existing SQL serializer persists visit event, audit, optimistic revision and retry result without new tables", async () => {
  const d = await setup(); const before = await d.store.read(); await d.service.startExecution(3, await d.command()); const after = await d.store.read();
  const writes: any[] = []; const dialect = new MySqlDialect();
  await persistExecution({ execute: async query => { writes.push(dialect.sqlToQuery(query)); return [{ insertId: 900, affectedRows: 1 }, []]; } } as any, before, after, { id: 3, role: "technician", active: true });
  const event = writes.find(q => q.sql.startsWith("INSERT INTO ticket_team_actions")); assert.equal(event.params[2], "execution_started");
  assert.equal(JSON.parse(event.params[3]).visitKey, after.actions.at(-1)!.operationKey);
  assert.ok(writes.some(q => q.sql.startsWith("INSERT INTO audit_logs"))); assert.ok(writes.some(q => q.sql.startsWith("INSERT INTO ticket_team_operations")));
  assert.ok(writes.some(q => q.sql.startsWith("UPDATE ticket_team_assignments") && q.sql.includes("AND revision=")));
  assert.ok(writes.every(q => !/pmv2|CREATE|ALTER/.test(q.sql)));
});
test("normal queue batches ticket visit history and derives in-progress/open-visit flags without changing stored workflow stage", async () => {
  const d = await setup(); await d.service.startExecution(3, await d.command()); const s = await d.store.read(); const dialect = new MySqlDialect(); const reads: any[] = [];
  const repo = new SqlTicketTeamAssignmentRepository(async () => ({ db: { execute: async (query: any) => {
    const q = dialect.sqlToQuery(query); reads.push(q);
    const values = q.sql.includes("FROM ticket_team_assignments a") ? [{ assignmentId: d.a.id, ticketId: 1001, ticketNumber: "MOCK-MT", stage: "action_required", teamId: 21 }] : s.actions.map(x => ({ ...x, createdAt: x.at }));
    return [values, []];
  } } } as any));
  const rows = await repo.queue({ id: 3, role: "technician", active: true }); assert.equal(reads.length, 2); assert.equal(rows[0].executionInProgress, true); assert.equal(rows[0].hasOpenVisit, true); assert.equal(rows[0].stage, "action_required");
});
