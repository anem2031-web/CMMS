import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDemo } from "./fixture";
import { TechnicianTicketsPage } from "../../../client/src/features/maintenance-team-tickets/TechnicianTicketsPage";
import { MaintenanceTeamsPage } from "../../../client/src/features/maintenance-team-tickets/MaintenanceTeamsPage";
import { WarehouseMaterialsPage } from "../../../client/src/features/maintenance-team-tickets/WarehouseMaterialsPage";
import { ManagerReviewPage } from "../../../client/src/features/maintenance-team-tickets/ManagerReviewPage";
import type { Assignment } from "../../../shared/maintenance-team-tickets/model";

test("technician view contains all five choices and excludes another team's tasks", async () => {
  const d = createDemo();
  const {
    closed: _c,
    assignmentMode: _m,
    ...ref
  } = (await d.store.read()).tickets[0];
  await d.service.assign(1, { ...ref, teamId: 21 });
  const command = (a: Assignment) => ({
    assignmentId: a.id,
    expectedRevision: a.revision,
    operationKey: "render-only",
  });
  const props = {
    api: d.service,
    actorId: 3,
    state: await d.service.read(3),
    busy: false,
    run: async () => true,
    command,
  };
  const html = renderToStaticMarkup(<TechnicianTicketsPage {...props} />);
  for (const label of [
    "سليم",
    "تم الإصلاح",
    "تحتاج مواد",
    "يوجد عائق",
    "صيانة خارجية",
    "SIM-MT-001",
  ])
    assert.ok(html.includes(label));
  const foreign = renderToStaticMarkup(
    <TechnicianTicketsPage
      {...props}
      actorId={5}
      state={await d.service.read(5)}
    />
  );
  assert.ok(!foreign.includes("SIM-MT-001"));
});
test("team view offers warehouse and technician membership; warehouse view shows pending original-source returns", async () => {
  const d = createDemo();
  const props = {
    api: d.service,
    actorId: 1,
    state: await d.service.read(1),
    busy: false,
    run: async () => true,
    command: (a: Assignment) => ({
      assignmentId: a.id,
      expectedRevision: a.revision,
      operationKey: "render-only",
    }),
  };
  const html = renderToStaticMarkup(<MaintenanceTeamsPage {...props} />);
  assert.ok(html.includes("المستودع المرتبط"));
  assert.ok(html.includes("الفنيون المرتبطون"));
  const warehouse = renderToStaticMarkup(
    <WarehouseMaterialsPage
      {...props}
      actorId={2}
      state={await d.service.read(2)}
    />
  );
  assert.ok(warehouse.includes("مرتجع بانتظار الاستلام"));
});

test("warehouse presents one material return with original lots instead of separate document usage", async () => {
  const d = createDemo();
  const {
    closed: _c,
    assignmentMode: _m,
    ...ref
  } = (await d.store.read()).tickets[0];
  const a = await d.service.assign(1, { ...ref, teamId: 21 });
  let key = 0;
  const command = (assignment: Assignment) => ({
    assignmentId: assignment.id,
    expectedRevision: assignment.revision,
    operationKey: `view:${++key}`,
  });
  await d.service.requestMaterials(
    3,
    command(a),
    [{ catalogItemId: 101, quantity: 4, unit: "قطعة" }],
    [101]
  );
  await d.service.submitOutcome(
    4,
    command((await d.store.read()).assignments[0]),
    "fixed",
    { note: "استبدال القاطع", usages: [{ catalogItemId: 101, used: 2 }] }
  );
  const props = {
    api: d.service,
    actorId: 2,
    state: await d.service.read(2),
    busy: false,
    run: async () => true,
    command,
  };
  const html = renderToStaticMarkup(<WarehouseMaterialsPage {...props} />);
  assert.equal((html.match(/<article/g) ?? []).length, 1);
  for (const expected of [
    "قاطع كهربائي",
    "SIM-DLV-10000",
    "SIM-DLV-10002",
    "وزّع كامل المرتجع",
    "الدفعة #1",
    "الدفعة #2",
  ])
    assert.ok(html.includes(expected), expected);
  assert.ok(!html.includes("المستخدم من SIM-DLV"));
  await d.service.confirmReturn(
    2,
    command((await d.store.read()).assignments[0]),
    (await d.store.read()).needs[0].id,
    [{ lotId: 2, quantity: 2 }]
  );
  const review = renderToStaticMarkup(
    <ManagerReviewPage {...props} actorId={1} state={await d.service.read(1)} />
  );
  assert.ok(review.includes("استبدال القاطع"));
  assert.ok(review.includes("خالد"));
  assert.ok(!review.includes("تأكيد مرتجع فعلي"));
});

test("completed execution label never claims the source ticket was closed", async () => {
  const d = createDemo();
  const {
    closed: _c,
    assignmentMode: _m,
    ...ref
  } = (await d.store.read()).tickets[0];
  const a = await d.service.assign(1, { ...ref, teamId: 21 });
  await d.service.submitOutcome(
    3,
    {
      assignmentId: a.id,
      expectedRevision: a.revision,
      operationKey: "view:healthy",
    },
    "ok",
    { note: "", usages: [] }
  );
  const current = (await d.store.read()).assignments[0];
  await d.service.review(
    1,
    {
      assignmentId: a.id,
      expectedRevision: current.revision,
      operationKey: "view:approved",
    },
    "approve_result",
    "اعتماد النتيجة"
  );
  assert.equal((await d.store.read()).tickets[0].closed, false);
  const { stageLabels } =
    await import("../../../shared/maintenance-team-tickets/model");
  assert.equal(
    stageLabels[(await d.store.read()).assignments[0].stage],
    "اكتمل تنفيذ الفريق"
  );
});
