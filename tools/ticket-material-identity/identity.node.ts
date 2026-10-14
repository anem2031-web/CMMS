import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../../server/maintenance-team-tickets/testing/fixture";
import { createTicketTeamExecutionRouter } from "../../server/routers/maintenance-teams/execution.router";
import { searchTicketIdentityCandidates, type IdentityReaders } from "../../server/maintenance-team-tickets/material-identity-reader";
import { materialSupplyRemaining } from "../../shared/maintenance-team-tickets/material-routing";
import type { TicketIdentityContext } from "../../shared/catalog-material-identity";

let seq = 0;
async function setup() {
  const d = createDemo(); const a = await d.service.assign(1, { ...(await d.store.read()).tickets[0], teamId: 21 });
  const command = async () => ({ assignmentId: a.id, expectedRevision: (await d.store.read()).assignments[0].revision, operationKey: `identity:${++seq}` });
  await d.service.registerMaterialNeed(3, await command(), { name: "فلتر زيت كبير احمر تجربة", quantity: 3, unit: "قطعة" });
  const need = (await d.store.read()).needs[0]; return { ...d, a, need, command };
}
function readers() {
  const calls: any[] = [];
  const deps: IdentityReaders = {
    searchCatalog: async (search, limit) => { calls.push(["catalog", search, limit]); return [
      { id: 101, nameAr: "قاطع", nameEn: "Breaker", code: "CAT-101", unit: "قطعة" },
      { id: 102, nameAr: "زيت", nameEn: "Oil", code: "CAT-102", unit: "لتر" },
    ]; },
    requireWarehouse: async id => { calls.push(["warehouse", id]); return { id }; }, mainWarehouse: async () => ({ id: 10 }),
    balances: async (ids, warehouseId) => { calls.push(["balances", ids, warehouseId]); return [{ catalogItemId: 101, warehouseId, inventoryId: warehouseId + 1, availableQuantity: warehouseId === 20 ? 5 : 9, unit: "قطعة", ambiguous: false }]; },
  };
  return { deps, calls };
}
test("identity context retains original technician wording, total quantity and ticket reference without changing stock", async () => {
  const d = await setup(); const physical = await d.store.inspectPhysical(); const before = await d.store.read();
  const context = await d.service.materialIdentityContext(2, d.a.id, d.need.id);
  assert.equal(context.originalName, "فلتر زيت كبير احمر تجربة"); assert.equal(context.requestedQuantity, 3); assert.equal(context.ticketNumber, d.a.ticketNumber); assert.equal(context.warehouseId, 20);
  assert.deepEqual(await d.store.inspectPhysical(), physical); assert.deepEqual(await d.store.read(), before);
});
test("technicians/managers/outside users/inactive accounts cannot read warehouse identity context", async () => {
  const d = await setup(); for (const id of [1, 3, 5, 7]) await assert.rejects(d.service.materialIdentityContext(id, d.a.id, d.need.id));
});
for (const role of ["warehouse", "owner", "admin"]) test(`${role} can identify material with fresh active-account authority`, async () => {
  const d = await setup(); await d.store.transaction(async s => { s.users.push({ id: 9, role, active: true, name: role }); });
  assert.equal((await d.service.materialIdentityContext(9, d.a.id, d.need.id)).needId, d.need.id);
  await d.store.transaction(async s => { s.users.find(u => u.id === 9)!.active = false; }); await assert.rejects(d.service.materialIdentityContext(9, d.a.id, d.need.id));
});
test("identity lookup rejects other need, old material round, ended ticket and already resolved catalog identity", async () => {
  for (const alteration of ["other", "round", "closed", "resolved", "stage"]) {
    const d = await setup(); await d.store.transaction(async s => {
      if (alteration === "round") s.needs[0].round = 99;
      if (alteration === "closed") s.tickets[0].closed = true;
      if (alteration === "resolved") s.needs[0].catalogItemId = 101;
      if (alteration === "stage") s.assignments[0].stage = "awaiting_review";
    });
    await assert.rejects(d.service.materialIdentityContext(2, d.a.id, alteration === "other" ? 999 : d.need.id));
  }
});
test("candidate lookup searches independently and batches both authoritative warehouse balances, with no unit filtering", async () => {
  const d = await setup(); const context = await d.service.materialIdentityContext(2, d.a.id, d.need.id); const r = readers();
  const result = await searchTicketIdentityCandidates(context, "  Duracell  ", r.deps);
  assert.deepEqual(r.calls.find(x => x[0] === "catalog"), ["catalog", "Duracell", 30]); assert.equal(r.calls.filter(x => x[0] === "balances").length, 2);
  assert.equal(result.items.length, 2); assert.equal(result.items[0].teamAvailability.availableQuantity, 5); assert.equal(result.items[0].mainWarehouseAvailability.availableQuantity, 9);
  assert.equal(result.items[1].unit, "لتر"); assert.equal(result.items[1].teamAvailability.availableQuantity, 0);
});
test("empty results skip stock reads; ambiguous inventory remains visible for review", async () => {
  const d = await setup(); const context = await d.service.materialIdentityContext(2, d.a.id, d.need.id); const r = readers(); r.deps.searchCatalog = async () => [];
  assert.equal((await searchTicketIdentityCandidates(context, "missing", r.deps)).items.length, 0); assert.equal(r.calls.filter(x => x[0] === "balances").length, 0);
  const r2 = readers(); r2.deps.balances = async (_ids, warehouseId) => [{ catalogItemId: 101, warehouseId, inventoryId: null, availableQuantity: 0, unit: "قطعة", ambiguous: true }];
  assert.equal((await searchTicketIdentityCandidates(context, "", r2.deps)).items[0].teamAvailability.ambiguous, true);
});
test("catalog/reference reader errors do not turn into false zero availability", async () => {
  const d = await setup(); const context = await d.service.materialIdentityContext(2, d.a.id, d.need.id); const r = readers();
  r.deps.balances = async () => { throw new Error("read failed"); }; await assert.rejects(searchTicketIdentityCandidates(context, "", r.deps), /read failed/);
});
test("confirm identity still rejects unit mismatch and duplicate catalog, retaining original need and stock", async () => {
  const d = await setup(); const before = await d.store.read(); const physical = await d.store.inspectPhysical();
  await d.store.transaction(async s => { s.catalog.push({ id: 999, name: "زيت", unit: "لتر", active: true }); });
  await assert.rejects(d.service.resolveMaterial(2, await d.command(), d.need.id, 999, "مطابقة"), /الوحدة|وحدة/);
  assert.equal((await d.store.read()).needs[0].catalogItemId, null); assert.deepEqual(await d.store.inspectPhysical(), physical);
  await d.store.transaction(async s => { s.needs.push({ ...s.needs[0], id: 999, catalogItemId: 101 }); });
  await assert.rejects(d.service.resolveMaterial(2, await d.command(), d.need.id, 101, "مطابقة"), /موجود/);
  assert.equal((await d.store.read()).needs[0].originalName, before.needs[0].originalName);
});
test("linking only identifies and recalculates shortage; retry cannot create a duplicate match or move inventory", async () => {
  const d = await setup(); const physical = await d.store.inspectPhysical(); const c = await d.command();
  const result = await d.service.resolveMaterial(2, c, d.need.id, 101, "مطابقة وصف الفني بالصنف الصحيح");
  assert.deepEqual(await d.service.resolveMaterial(2, c, d.need.id, 101, "مطابقة وصف الفني بالصنف الصحيح"), result);
  const s = await d.store.read(); assert.equal(s.needs[0].catalogItemId, 101); assert.equal(s.needs[0].name, "قاطع كهربائي"); assert.equal(s.needs[0].originalName, "فلتر زيت كبير احمر تجربة");
  assert.equal(materialSupplyRemaining(s, s.needs[0]), 0); assert.equal(s.assignments[0].stage, "waiting_material"); assert.deepEqual(await d.store.inspectPhysical(), physical);
});
test("authenticated search API rejects forged warehouse/actor fields and technician before querying candidates", async () => {
  const d = await setup(); let calls = 0;
  const reader = async (context: TicketIdentityContext, search: string) => { calls++; return searchTicketIdentityCandidates(context, search, readers().deps); };
  const router = createTicketTeamExecutionRouter(() => d.service, reader);
  const ctx = (role: string, id: number) => ({ user: { role, id, isActive: 1 }, req: { ip: "test", get: () => "test" } } as any);
  const input = { assignmentId: d.a.id, needId: d.need.id, search: "CAT" };
  await assert.rejects(router.createCaller(ctx("warehouse", 2)).searchMaterialIdentityCandidates({ ...input, warehouseId: 99 } as any)); assert.equal(calls, 0);
  await assert.rejects(router.createCaller(ctx("technician", 3)).searchMaterialIdentityCandidates(input)); assert.equal(calls, 0);
  const result = await router.createCaller(ctx("warehouse", 2)).searchMaterialIdentityCandidates(input); assert.equal(result.items.length, 2); assert.equal(result.request.warehouseId, 20);
});
