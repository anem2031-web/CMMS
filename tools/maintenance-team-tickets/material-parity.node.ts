import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "../../server/maintenance-team-tickets/testing/fixture";
import { MaintenanceTeamTicketService } from "../../server/maintenance-team-tickets/service";
import { createTicketTeamExecutionRouter } from "../../server/routers/maintenance-teams/execution.router";
import {
  materialSupplyRemaining,
  materialActionMessage,
} from "../../shared/maintenance-team-tickets/material-routing";
import { materialSection } from "../../shared/maintenance-team-tickets/warehouse-materials";
import {
  issued,
  remainingReturn,
} from "../../shared/maintenance-team-tickets/model";

let sequence = 0;
async function setup() {
  const d = createDemo();
  const a = await d.service.assign(1, {
    ...(await d.store.read()).tickets[0],
    teamId: 21,
  });
  const command = async (key = `parity:${++sequence}`) => ({
    assignmentId: a.id,
    expectedRevision: (await d.store.read()).assignments.find(
      x => x.id === a.id
    )!.revision,
    operationKey: key,
  });
  return { ...d, a, command };
}
const item = (catalogItemId = 102, quantity = 3) => ({
  catalogItemId,
  quantity,
  unit: "قطعة",
});

test("needs-material choice persists waiting state and real actor without a purchase, issue or fabricated PMV2 task", async () => {
  const d = await setup(),
    physical = await d.store.inspectPhysical(),
    c = await d.command();
  const result = await d.service.beginMaterialNeed(3, c);
  assert.deepEqual(await d.service.beginMaterialNeed(3, c), result);
  const s = await d.store.read();
  assert.equal(s.assignments[0].stage, "waiting_material");
  assert.equal(s.assignments[0].outcome, "needs_material");
  assert.equal(s.actions.at(-1)!.actorId, 3);
  assert.equal(s.needs.length, 0);
  assert.deepEqual(await d.store.inspectPhysical(), physical);
});
test("full team stock requires explicit receipt and one retry never repeats the physical issue", async () => {
  const d = await setup();
  await d.service.beginMaterialNeed(3, await d.command());
  const c = await d.command();
  await d.service.registerMaterialNeed(3, c, item(101, 4), true);
  const physical = await d.store.inspectPhysical();
  await d.service.registerMaterialNeed(3, c, item(101, 4), true);
  const s = await d.store.read();
  assert.equal(s.needs.length, 1);
  assert.equal(issued(s, s.needs[0].id), 4);
  assert.ok(s.deliveries.every(x => x.receivedById === 3));
  assert.equal(s.assignments[0].stage, "ready_to_repair");
  assert.equal(s.supplies.length, 0);
  assert.deepEqual(await d.store.inspectPhysical(), physical);
});
test("registering an available item without confirmation leaves stock unchanged until self receipt", async () => {
  const d = await setup(),
    before = await d.store.inspectPhysical();
  await d.service.registerMaterialNeed(3, await d.command(), item(101, 2));
  let s = await d.store.read();
  assert.equal(s.assignments[0].stage, "waiting_material");
  assert.equal(materialSupplyRemaining(s, s.needs[0]), 0);
  assert.deepEqual(await d.store.inspectPhysical(), before);
  await d.service.receiveMaterial(3, await d.command(), s.needs[0].id);
  s = await d.store.read();
  assert.equal(issued(s, s.needs[0].id), 2);
});
test("partial team availability requests only the shortage and never issues the available part by default", async () => {
  const d = await setup(),
    before = await d.store.inspectPhysical();
  await d.service.registerMaterialNeed(3, await d.command(), item());
  const s = await d.store.read();
  assert.equal(materialSupplyRemaining(s, s.needs[0]), 2);
  assert.equal(issued(s, s.needs[0].id), 0);
  assert.deepEqual(await d.store.inspectPhysical(), before);
  const h = await d.service.prepareSupply(2, d.a.id, s.needs[0].id, "transfer");
  assert.equal(h.quantity, 2);
  assert.equal(h.ticketId, d.a.ticketId);
  assert.equal(h.ticketItemId, d.a.ticketItemId);
  assert.equal(h.assignmentId, d.a.id);
});
test("each additional material is independently registered while waiting and duplicates retain prior requests", async () => {
  const d = await setup();
  await d.service.beginMaterialNeed(3, await d.command());
  await d.service.registerMaterialNeed(3, await d.command(), item());
  await d.service.registerMaterialNeed(
    4,
    await d.command(),
    item(101, 2),
    true
  );
  const s = await d.store.read();
  assert.equal(s.needs.length, 2);
  assert.equal(s.assignments[0].stage, "waiting_material");
  assert.equal(issued(s, s.needs[0].id), 0);
  assert.equal(issued(s, s.needs[1].id), 2);
  assert.equal(s.needs[1].requestedById, 4);
  await assert.rejects(
    d.service.registerMaterialNeed(3, await d.command(), item()),
    /مكرر/
  );
  assert.deepEqual(await d.store.read(), s);
});
test("stock reduction after preview records the uncovered need rather than a fictitious receipt", async () => {
  const d = await setup();
  const preview = await d.service.previewMaterials(3, d.a.id, [item(101, 4)]);
  assert.equal(preview.rows[0].shortage, 0);
  await d.store.transaction(async (s, gateway) => {
    await gateway.issue({
      operationKey: "competing-stock",
      ticketId: 9999,
      ticketNumber: "other",
      catalogItemId: 101,
      warehouseId: 20,
      quantity: 3,
      unit: "قطعة",
      receiverId: 4,
      location: s.assignments[0].location,
    });
  });
  await d.service.registerMaterialNeed(
    3,
    await d.command(),
    item(101, 4),
    true
  );
  const s = await d.store.read();
  assert.equal(issued(s, s.needs[0].id), 0);
  assert.equal(materialSupplyRemaining(s, s.needs[0]), 2);
  assert.equal(s.assignments[0].stage, "waiting_material");
});
test("technical issue failure rolls back the need, original stock and operation together", async () => {
  const d = await setup(),
    state = await d.store.read(),
    physical = await d.store.inspectPhysical();
  d.store.failNextIssue = true;
  await assert.rejects(
    d.service.registerMaterialNeed(3, await d.command(), item(101, 2), true)
  );
  assert.deepEqual(await d.store.read(), state);
  assert.deepEqual(await d.store.inspectPhysical(), physical);
});
test("unlisted identity preserves the technician's description and recalculates availability after warehouse matching", async () => {
  const d = await setup();
  await d.service.registerMaterialNeed(3, await d.command(), {
    name: "وصف الفني",
    unit: "قطعة",
    quantity: 2,
  });
  let s = await d.store.read();
  assert.equal(s.needs[0].catalogItemId, null);
  assert.equal(materialSupplyRemaining(s, s.needs[0]), 2);
  await d.service.resolveMaterial(
    2,
    await d.command(),
    s.needs[0].id,
    101,
    "مطابقة الوصف بالقاطع"
  );
  s = await d.store.read();
  assert.equal(s.needs[0].originalName, "وصف الفني");
  assert.equal(s.needs[0].catalogItemId, 101);
  assert.equal(materialSupplyRemaining(s, s.needs[0]), 0);
  assert.equal(materialSection(s, s.needs[0], 5), "ready");
  await d.service.receiveMaterial(3, await d.command(), s.needs[0].id);
});
test("warehouse receipt of a purchase alone never becomes a technician receipt; transfer allows self receipt", async () => {
  const d = await setup();
  await d.service.registerMaterialNeed(3, await d.command(), item(103, 2));
  let s = await d.store.read(),
    n = s.needs[0];
  await d.service.provideMaterial(2, await d.command(), n.id, "purchase");
  s = await d.store.read();
  await d.service.receivePurchase(2, await d.command(), s.supplies[0].id);
  await assert.rejects(
    d.service.receiveMaterial(3, await d.command(), n.id),
    /لم يصل/
  );
  await d.service.provideMaterial(2, await d.command(), n.id, "transfer");
  const c = await d.command();
  await d.service.receiveMaterial(3, c, n.id);
  const physical = await d.store.inspectPhysical();
  await d.service.receiveMaterial(3, c, n.id);
  assert.deepEqual(await d.store.inspectPhysical(), physical);
  s = await d.store.read();
  assert.equal(materialSupplyRemaining(s, s.needs[0]), 0);
  assert.equal(s.assignments[0].stage, "ready_to_repair");
});
test("stock delivered for a different ticket does not satisfy this need's own shortage linkage", async () => {
  const d = await setup();
  const other = await d.service.assign(1, {
    ...(await d.store.read()).tickets[1],
    teamId: 21,
  });
  await d.service.registerMaterialNeed(3, await d.command(), item());
  await d.service.registerMaterialNeed(
    3,
    {
      assignmentId: other.id,
      expectedRevision: other.revision,
      operationKey: "other:need",
    },
    item()
  );
  let s = await d.store.read();
  const firstNeed = s.needs.find(n => n.assignmentId === d.a.id)!,
    otherNeed = s.needs.find(n => n.assignmentId === other.id)!;
  await d.service.provideMaterial(
    2,
    await d.command(),
    firstNeed.id,
    "transfer"
  );
  s = await d.store.read();
  assert.equal(materialSupplyRemaining(s, firstNeed), 0);
  assert.equal(materialSupplyRemaining(s, otherNeed), 2);
  assert.equal(materialSection(s, otherNeed, 3), "waiting");
  await assert.rejects(
    d.service.receiveMaterial(
      3,
      {
        assignmentId: other.id,
        expectedRevision: s.assignments.find(a => a.id === other.id)!.revision,
        operationKey: "other:receipt",
      },
      otherNeed.id
    ),
    /لم يصل/
  );
  assert.deepEqual(await d.store.read(), s);
});
test("usage and original lot return remain independent of ticket closure after the material flow", async () => {
  const d = await setup();
  await d.service.registerMaterialNeed(
    3,
    await d.command(),
    item(101, 3),
    true
  );
  await d.service.submitOutcome(3, await d.command(), "fixed", {
    note: "تم الإصلاح والاختبار",
    usages: [{ catalogItemId: 101, used: 2 }],
  });
  let s = await d.store.read();
  assert.equal(s.assignments[0].stage, "awaiting_review");
  assert.equal(remainingReturn(s, s.needs[0].id), 1);
  const original = s.deliveries.find(d => d.quantity > 0)!;
  await d.service.confirmReturn(2, await d.command(), s.needs[0].id, [
    { lotId: original.lotId, quantity: 1 },
  ]);
  s = await d.store.read();
  assert.equal(s.returns[0].sourceDeliveryId, original.deliveryId);
  assert.equal(remainingReturn(s, s.needs[0].id), 0);
});
test("global executors keep their actual identity; outsiders, inactive accounts and warehouse cannot start technician work", async () => {
  for (const role of [
    "owner",
    "admin",
    "maintenance_manager",
    "general_maintenance_manager",
    "construction_procurement_manager",
  ]) {
    const d = await setup();
    await d.store.transaction(async s => {
      s.users.push({ id: 90, name: role, role, active: true });
    });
    await d.service.beginMaterialNeed(90, await d.command());
    await d.service.registerMaterialNeed(
      90,
      await d.command(),
      item(101, 1),
      true
    );
    const s = await d.store.read();
    assert.equal(s.actions.at(-1)!.actorId, 90);
    assert.equal(s.deliveries[0].receivedById, 90);
    assert.equal(
      s.memberships.some(m => m.userId === 90),
      false
    );
  }
  for (const actor of [2, 5, 7]) {
    const d = await setup(),
      before = await d.store.read();
    await assert.rejects(d.service.beginMaterialNeed(actor, await d.command()));
    assert.deepEqual(await d.store.read(), before);
  }
});
test("individual commands validate empty/unit/quantity inputs and wrong revision without effects", async () => {
  const d = await setup(),
    before = await d.store.read();
  for (const input of [
    item(101, 0),
    item(101, 1.5),
    { ...item(), unit: "متر" },
    { quantity: 2, unit: "قطعة", name: "" },
  ]) {
    await assert.rejects(
      d.service.registerMaterialNeed(3, await d.command(), input)
    );
    assert.deepEqual(await d.store.read(), before);
  }
  await assert.rejects(
    d.service.beginMaterialNeed(3, {
      ...(await d.command()),
      expectedRevision: 999,
    }),
    /تغيرت/
  );
});
test("legacy material records remain usable and structured route notes display a readable message", async () => {
  const d = await setup();
  await d.service.requestMaterials(3, await d.command(), [item()]);
  let s = await d.store.read();
  assert.equal(materialSupplyRemaining(s, s.needs[0]), null);
  assert.equal(materialActionMessage("legacy note"), "legacy note");
  await d.service.provideMaterial(
    2,
    await d.command(),
    s.needs[0].id,
    "transfer"
  );
  await d.service.receiveMaterial(3, await d.command(), s.needs[0].id);
  s = await d.store.read();
  assert.equal(s.assignments[0].stage, "ready_to_repair");
  const other = await setup();
  await other.service.registerMaterialNeed(3, await other.command(), item());
  const note = (await other.store.read()).actions.at(-1)!.note;
  assert.equal(
    materialActionMessage(note),
    "تسجيل احتياج المادة وتحديد المتوفر والنقص"
  );
});
test("authenticated router derives the actor and cannot accept forged identity or source fields", async () => {
  const d = await setup();
  let requestedIds: number[] = [];
  const router = createTicketTeamExecutionRouter((_id, _actor, options) => {
    requestedIds = options?.catalogIds ?? [];
    return d.service;
  });
  const caller = router.createCaller({
    user: { id: 3, role: "technician", isActive: 1 },
    req: {},
  } as any);
  await caller.beginMaterialNeed(await d.command());
  await caller.registerMaterialNeed({
    ...(await d.command()),
    need: item(101, 2),
    confirmReceipt: true,
  });
  assert.deepEqual(requestedIds, [101]);
  assert.equal((await d.store.read()).deliveries[0].receivedById, 3);
  await assert.rejects(
    caller.registerMaterialNeed({
      ...(await d.command()),
      need: item(),
      actorId: 4,
    } as any)
  );
  await assert.rejects(
    caller.registerMaterialNeed({
      ...(await d.command()),
      need: { ...item(), taskId: 999 },
    } as any)
  );
});
