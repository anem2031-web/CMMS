import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../../server/maintenance-team-tickets/testing/fixture";
import { createTicketTeamExecutionRouter } from "../../server/routers/maintenance-teams/execution.router";
import { searchTicketIdentityCandidates, type IdentityReaders } from "../../server/maintenance-team-tickets/material-identity-reader";
import { materialSupplyRemaining } from "../../shared/maintenance-team-tickets/material-routing";
import { materialSection } from "../../shared/maintenance-team-tickets/warehouse-materials";
import type { TicketIdentityContext } from "../../shared/catalog-material-identity";
import { rankTicketMaterialCandidates } from "../../server/maintenance-team-tickets/material-catalog-search";
import { router as rootRouter } from "../../server/routers/_shared/procedures";

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
test("identity link accepts a different unit without changing quantities or permitting unconverted stock operations", async () => {
  const d = await setup(); const before = await d.store.read(); const physical = await d.store.inspectPhysical();
  await d.store.transaction(async s => { s.catalog.push({ id: 999, name: "زيت", unit: "لتر", active: true }); });
  await d.service.resolveMaterial(2, await d.command(), d.need.id, 999, "مطابقة");
  const linked = (await d.store.read()).needs[0];
  assert.equal(linked.catalogItemId, 999); assert.equal(linked.unit, before.needs[0].unit);
  assert.equal(linked.requested, before.needs[0].requested); assert.equal(linked.originalName, before.needs[0].originalName);
  assert.equal(materialSection(await d.store.read(), linked, 9999), "waiting");
  for (const kind of ["purchase", "transfer"] as const) {
    await assert.rejects(d.service.provideMaterial(2, await d.command(), d.need.id, kind), /وحدة/);
    await assert.rejects(d.service.prepareSupply(2, d.a.id, d.need.id, kind), /وحدة/);
  }
  await assert.rejects(d.service.receiveMaterial(3, await d.command(), d.need.id));
  assert.deepEqual(await d.store.inspectPhysical(), physical);
});
test("identity linking still denies duplicate catalog identities", async () => {
  const d = await setup();
  await d.store.transaction(async s => { s.needs.push({ ...s.needs[0], id: 999, catalogItemId: 101 }); });
  await assert.rejects(d.service.resolveMaterial(2, await d.command(), d.need.id, 101, "مطابقة"), /موجود/);
  assert.equal((await d.store.read()).needs[0].catalogItemId, null);
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
  const router = rootRouter({ ticketTeamExecution: createTicketTeamExecutionRouter(() => d.service, reader) });
  const ctx = (role: string, id: number) => ({ user: { role, id, isActive: 1 }, req: { ip: "test", get: () => "test" } } as any);
  const input = { assignmentId: d.a.id, needId: d.need.id, search: "CAT" };
  await assert.rejects(router.createCaller(ctx("warehouse", 2)).ticketTeamExecution.searchMaterialIdentityCandidates({ ...input, warehouseId: 99 } as any)); assert.equal(calls, 0);
  await assert.rejects(router.createCaller(ctx("technician", 3)).ticketTeamExecution.searchMaterialIdentityCandidates(input)); assert.equal(calls, 0);
  const result = await router.createCaller(ctx("warehouse", 2)).ticketTeamExecution.searchMaterialIdentityCandidates(input); assert.equal(result.items.length, 2); assert.equal(result.request.warehouseId, 20);
});

const matchingItems = [
  { id: 1, nameAr: "مسمار 80 مم", nameEn: "Screw 80 mm", unit: "كرتون", code: "01-001" },
  { id: 2, nameAr: "مسمار 10 سم", nameEn: "Screw 100 mm", unit: "حبة", code: "01-002" },
  { id: 3, nameAr: "أسلاك كهربائية حمراء", nameEn: "Red electrical wires", unit: "لفة", code: "02-001" },
];
test("name search normalizes Arabic letters/digits and compares converted measurements without unit filtering", () => {
  const rows = rankTicketMaterialCandidates(matchingItems, "مسمار ٨ سم");
  assert.deepEqual(rows.map(row => row.id), [1, 2]);
  assert.equal(rows[0].measurementStatus, "compatible");
  assert.equal(rows[1].measurementStatus, "conflict");
  assert.equal(rows[0].unit, "كرتون");
  assert.equal(rankTicketMaterialCandidates(matchingItems, "حمراء اسلاك كهربائية")[0].id, 3);
  assert.equal(rankTicketMaterialCandidates(matchingItems, "electrical red wires")[0].id, 3);
  assert.equal(rankTicketMaterialCandidates(matchingItems, "Screw 8 cm")[0].measurementStatus, "compatible");
  assert.equal(rankTicketMaterialCandidates(matchingItems, "01-001")[0].id, 1);
  assert.deepEqual(rankTicketMaterialCandidates(matchingItems, "كرتون"), []);
});
test("large catalog is shortlisted before constant batched balances; consecutive searches do not share results", async () => {
  const d = await setup(), r = readers(), context = await d.service.materialIdentityContext(2, d.a.id, d.need.id);
  const catalog = Array.from({ length: 2000 }, (_, i) => ({ ...matchingItems[0], id: i + 1 }));
  let metadataReads = 0;
  r.deps.searchCatalog = async (search, limit) => { metadataReads++; return rankTicketMaterialCandidates(catalog, search, limit); };
  assert.equal((await searchTicketIdentityCandidates(context, "مسمار 8 سم", r.deps)).items.length, 30);
  assert.equal(metadataReads, 1);
  assert.deepEqual(r.calls.filter(c => c[0] === "balances").map(c => c[1].length), [30, 30]);
  assert.equal((await searchTicketIdentityCandidates(context, "غير موجود", r.deps)).items.length, 0);
  assert.equal(metadataReads, 2); assert.equal(r.calls.filter(c => c[0] === "balances").length, 2);
});
test("units API uses explicit technician capability plus fresh assignment membership, denies forged and missing IDs", async () => {
  const d = await setup(); let reads = 0;
  const api = rootRouter({ ticketTeamExecution: createTicketTeamExecutionRouter(() => d.service, undefined, async () => {
    reads++; return [{ id: 1, nameAr: "حبة", nameEn: "Piece" }];
  }) });
  const caller = (id: number, role = "technician", isActive = 1) => api.createCaller({ user: { id, role, isActive }, req: {} } as any).ticketTeamExecution;
  assert.equal((await caller(3).units({ assignmentId: d.a.id }))[0].nameAr, "حبة");
  for (const id of [5, 7]) await assert.rejects(caller(id).units({ assignmentId: d.a.id }));
  for (const role of ["warehouse", "accountant", "delegate", "gate_guard"]) await assert.rejects(caller(2, role).units({ assignmentId: d.a.id }));
  await assert.rejects(caller(3).units({ assignmentId: 999 }));
  await assert.rejects(caller(3).units({ assignmentId: d.a.id, userId: 1 } as any));
  await assert.rejects(caller(3, "technician", 0).units({ assignmentId: d.a.id }));
  assert.equal(reads, 1);
  await d.store.transaction(async s => { s.memberships.find(m => m.userId === 3)!.active = false; });
  await assert.rejects(caller(3).units({ assignmentId: d.a.id })); assert.equal(reads, 1);
});
for (const role of ["it_member", "it_manager"]) test(`${role} reads units only for their assigned IT work`, async () => {
  const d = await setup();
  await d.store.transaction(async s => { s.users.find(u => u.id === 3)!.role = role;
    s.tickets[0].responsibleDepartment = "maintenance_report_department_it"; s.tickets[0].assignedToId = 3; });
  let reads = 0;
  const api = rootRouter({ ticketTeamExecution: createTicketTeamExecutionRouter(() => d.service, undefined, async () => {
    reads++; return [{ id: 1, nameAr: "حبة", nameEn: "Piece" }];
  }) });
  const caller = api.createCaller({ user: { id: 3, role, isActive: 1 }, req: {} } as any).ticketTeamExecution;
  assert.equal((await caller.units({ assignmentId: d.a.id }))[0].id, 1);
  await d.store.transaction(async s => { s.tickets[0].assignedToId = 4; });
  await assert.rejects(caller.units({ assignmentId: d.a.id })); assert.equal(reads, 1);
});
test("unit options deny a closed or missing parent even if an assignment survives", async () => {
  for (const missing of [false, true]) {
    const d = await setup();
    await d.store.transaction(async s => { if (missing) s.tickets = []; else s.tickets[0].closed = true; });
    await assert.rejects(d.service.materialUnitsContext(3, d.a.id));
  }
});
