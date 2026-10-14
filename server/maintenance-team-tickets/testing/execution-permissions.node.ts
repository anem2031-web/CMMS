import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemo } from "./fixture";
import {
  TeamTicketError,
  type Assignment,
} from "../../../shared/maintenance-team-tickets/model";
import { TICKET_TEAM_EXECUTION_OVERRIDE_ROLES } from "../../../shared/maintenance-team-tickets/execution-permissions";
import { canRoleAccessPath } from "../../../shared/roles";

let operation = 0;
test("construction execution window does not unlock maintenance team management", () => {
  assert.equal(
    canRoleAccessPath(
      "construction_procurement_manager",
      "/maintenance-team-tickets"
    ),
    true
  );
  assert.equal(
    canRoleAccessPath("construction_procurement_manager", "/maintenance-teams"),
    false
  );
  assert.equal(
    canRoleAccessPath("accountant", "/maintenance-team-tickets"),
    false
  );
});
const cmd = (a: Assignment) => ({
  assignmentId: a.id,
  expectedRevision: a.revision,
  operationKey: `override:${++operation}`,
});
const denied = (work: Promise<unknown>) =>
  assert.rejects(
    work,
    e => e instanceof TeamTicketError && e.code === "FORBIDDEN"
  );
async function setup(role: string, active = true) {
  const d = createDemo();
  await d.store.transaction(async s => {
    s.users.push({ id: 90, name: "المنفذ الفعلي", role, active });
  });
  const t = (await d.store.read()).tickets[0];
  const a = await d.service.assign(1, { ...t, teamId: 21 });
  return {
    ...d,
    a,
    current: async () => (await d.store.read()).assignments[0],
  };
}

for (const role of TICKET_TEAM_EXECUTION_OVERRIDE_ROLES) {
  test(`${role} sees all teams and executes all outcomes without technical membership`, async () => {
    for (const outcome of ["ok", "fixed", "blocked", "external"] as const) {
      const d = await setup(role);
      const t = (await d.store.read()).tickets[1];
      await d.service.assign(1, { ...t, teamId: 22 });
      assert.equal((await d.service.read(90)).assignments.length, 2);
      await d.service.submitOutcome(90, cmd(d.a), outcome, {
        note: "تفاصيل الإجراء والسبب",
        usages: [],
      });
      const s = await d.store.read();
      assert.equal(s.actions.at(-1)!.actorId, 90);
      assert.equal(s.assignments[0].outcome, outcome);
      assert.equal(
        s.memberships.some(m => m.userId === 90),
        false
      );
    }
  });
  test(`${role} requests, receives and records material usage under the actual account`, async () => {
    const d = await setup(role);
    const needs = [{ catalogItemId: 101, unit: "قطعة", quantity: 2 }];
    const preview = await d.service.previewMaterials(90, d.a.id, needs);
    assert.equal(preview.rows[0].shortage, 0);
    await d.service.requestMaterials(90, cmd(d.a), needs, [101]);
    let s = await d.store.read();
    assert.ok(s.deliveries.length > 0);
    assert.ok(s.deliveries.every(x => x.receivedById === 90));
    await d.service.submitOutcome(90, cmd(await d.current()), "fixed", {
      note: "تم الإصلاح باستخدام قطعة واحدة",
      usages: [{ catalogItemId: 101, used: 1 }],
    });
    s = await d.store.read();
    assert.equal(s.needs[0].used, 1);
    assert.equal(s.actions.at(-1)!.actorId, 90);
    assert.equal(s.assignments[0].stage, "awaiting_review");
    // A separate shortage still uses the warehouse's existing transfer/receipt flow.
    const pending = await setup(role);
    await pending.service.requestMaterials(
      90,
      cmd(pending.a),
      [{ catalogItemId: 102, unit: "قطعة", quantity: 3 }],
      []
    );
    const need = (await pending.store.read()).needs[0];
    await pending.service.provideMaterial(
      2,
      cmd(await pending.current()),
      need.id,
      "transfer"
    );
    await pending.service.issueByWarehouse(2, cmd(await pending.current()), need.id, 90);
    assert.ok(
      (await pending.store.read()).deliveries.every(x => x.receivedById === 90)
    );
    assert.equal((await pending.current()).stage, "ready_to_repair");
  });
  test(`${role} cannot execute if the account or team is disabled`, async () => {
    const inactive = await setup(role, false);
    await denied(inactive.service.read(90));
    await denied(
      inactive.service.submitOutcome(90, cmd(inactive.a), "ok", {
        note: "",
        usages: [],
      })
    );
    const d = await setup(role);
    await d.store.transaction(async s => {
      s.teams[0].active = false;
    });
    await denied(
      d.service.submitOutcome(90, cmd(d.a), "ok", { note: "", usages: [] })
    );
  });
  test(`${role} completes reinstallation after the existing external handover`, async () => {
    const d = await setup(role);
    await d.service.submitOutcome(3, cmd(d.a), "external", {
      note: "إصلاح خارج المنشأة",
      usages: [],
    });
    await d.service.review(
      1,
      cmd(await d.current()),
      "approve_external",
      "اعتماد المسار الحالي"
    );
    await d.service.review(
      2,
      cmd(await d.current()),
      "external_handover",
      "تم التسليم الفعلي للفني",
      3
    );
    await d.service.submitOutcome(90, cmd(await d.current()), "fixed", {
      note: "إعادة التركيب واختبار التشغيل",
      usages: [],
    });
    assert.equal((await d.current()).stage, "awaiting_review");
    assert.equal((await d.store.read()).actions.at(-1)!.actorId, 90);
  });
}

for (const role of [
  "maintenance_manager",
  "general_maintenance_manager",
  "construction_procurement_manager",
]) {
  test(`${role} gains execution but no foreign approval, external approval or warehouse authority`, async () => {
    const d = await setup(role);
    await d.service.submitOutcome(90, cmd(d.a), "ok", { note: "", usages: [] });
    await denied(
      d.service.review(90, cmd(await d.current()), "approve_result", "اعتماد")
    );
    await denied(
      d.service.review(90, cmd(await d.current()), "return_to_team", "إعادة")
    );
    const external = await setup(role);
    await external.service.submitOutcome(90, cmd(external.a), "external", {
      note: "فحص ورشة خارجية",
      usages: [],
    });
    await denied(
      external.service.review(
        90,
        cmd(await external.current()),
        "approve_external",
        "اعتماد"
      )
    );
    const materials = await setup(role);
    await materials.service.requestMaterials(
      90,
      cmd(materials.a),
      [{ catalogItemId: 103, unit: "قطعة", quantity: 1 }],
      []
    );
    await denied(
      materials.service.provideMaterial(
        90,
        cmd(await materials.current()),
        (await materials.store.read()).needs[0].id,
        "purchase"
      )
    );
  });
}
test("warehouse and unsupported roles gain no technician execution; outsider technician remains denied", async () => {
  for (const role of ["warehouse", "accountant", "operator", "technician"]) {
    const d = await setup(role);
    await denied(
      d.service.submitOutcome(90, cmd(d.a), "ok", { note: "", usages: [] })
    );
  }
});
test("global executor remains subject to repair detail validation and optimistic revisions", async () => {
  const d = await setup("construction_procurement_manager");
  await assert.rejects(
    d.service.submitOutcome(90, cmd(d.a), "fixed", { note: "", usages: [] }),
    e => e instanceof TeamTicketError && e.code === "INVALID"
  );
  await d.service.submitOutcome(3, cmd(d.a), "ok", { note: "", usages: [] });
  await assert.rejects(
    d.service.submitOutcome(90, cmd(d.a), "blocked", {
      note: "عائق",
      usages: [],
    }),
    e => e instanceof TeamTicketError && e.code === "CONFLICT"
  );
});
