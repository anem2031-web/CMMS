import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import { TicketTeamManagementService } from "../team-management/service";
import { createMaintenanceTeamsRouter } from "../../routers/maintenance-teams/router";
import {
  SqlTeamManagementRepository,
  type TeamDatabase,
} from "../../routers/maintenance-teams/repository";
import { TeamsManagementView } from "../../../client/src/features/maintenance-team-tickets/TeamsManagementView";
import { canRoleAccessPath } from "../../../shared/roles";
import { TeamTicketError } from "../../../shared/maintenance-team-tickets/model";
import type {
  TeamManagementActor,
  TeamManagementAudit,
  TeamManagementData,
  TeamManagementRepository,
  TeamManagementTransaction,
  SaveTeamInput,
} from "../../../shared/maintenance-team-tickets/team-management";
import { teamManagementSnapshot } from "../../../shared/maintenance-team-tickets/team-management";

const manager: TeamManagementActor = {
  id: 11,
  role: "maintenance_manager",
  active: true,
  ipAddress: "127.0.0.1",
  userAgent: "mock",
};
function initial(): TeamManagementData {
  return {
    teams: [
      {
        id: 21,
        name: "الكهرباء",
        warehouseId: 40,
        active: true,
        createdById: 11,
        updatedById: 11,
      },
    ],
    memberships: [31, 32].map(userId => ({
      teamId: 21,
      userId,
      active: true,
      joinedAt: "2026-10-01",
      leftAt: null,
      updatedById: 11,
    })),
    technicians: [
      { id: 31, name: "أحمد", role: "technician", active: true },
      { id: 32, name: "خالد", role: "technician", active: true },
      { id: 33, name: "معطل", role: "technician", active: false },
      { id: 34, name: "مستودع", role: "warehouse", active: true },
      { id: 35, name: "عضو تقنية المعلومات", role: "it_member", active: true },
    ],
    warehouses: [
      { id: 40, name: "الفرعي", type: "branch", active: true },
      { id: 41, name: "الرئيسي", type: "main", active: true },
      { id: 42, name: "فرعي معطل", type: "branch", active: false },
    ],
  };
}
/** Test-only serialized memory transaction; no default provider or application bootstrap. */
class MemoryRepository implements TeamManagementRepository {
  data = initial();
  auditEntries: Array<{
    actor: TeamManagementActor;
    entry: TeamManagementAudit;
  }> = [];
  open = false;
  failAudit = false;
  failMemberFor: number | null = null;
  touches = 0;
  private tail = Promise.resolve();
  async readData() {
    this.touches++;
    return structuredClone(this.data);
  }
  async transaction<T>(work: (tx: TeamManagementTransaction) => Promise<T>) {
    this.touches++;
    const before = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => {
      release = resolve;
    });
    await before;
    const data = structuredClone(this.data),
      audits = structuredClone(this.auditEntries);
    const tx: TeamManagementTransaction = {
      findTeam: async id => data.teams.find(t => t.id === id) ?? null,
      findTeamByName: async name =>
        data.teams.find(
          t => t.name.toLocaleLowerCase() === name.toLocaleLowerCase()
        ) ?? null,
      findWarehouse: async id => data.warehouses.find(w => w.id === id) ?? null,
      findUser: async id => data.technicians.find(u => u.id === id) ?? null,
      findMembership: async (teamId, userId) =>
        data.memberships.find(
          m => m.teamId === teamId && m.userId === userId
        ) ?? null,
      membershipsForTeam: async teamId =>
        data.memberships.filter(m => m.teamId === teamId),
      updateTeamProfile: async (teamId, name, warehouseId, actorId) => {
        Object.assign(data.teams.find(t => t.id === teamId)!, {
          name,
          warehouseId,
          updatedById: actorId,
        });
      },
      remainingActiveMemberCount: async (teamId, excluded) =>
        data.memberships.filter(
          m =>
            m.teamId === teamId &&
            m.userId !== excluded &&
            m.active &&
            data.technicians.some(
              u => u.id === m.userId && u.active && u.role === "technician"
            )
        ).length,
      hasOpenExecution: async () => this.open,
      createTeam: async (name, warehouseId, actorId) => {
        const id = Math.max(0, ...data.teams.map(t => t.id)) + 1;
        data.teams.push({
          id,
          name,
          warehouseId,
          active: true,
          createdById: actorId,
          updatedById: actorId,
        });
        return id;
      },
      setTeamActive: async (id, active, actorId) => {
        Object.assign(data.teams.find(t => t.id === id)!, {
          active,
          updatedById: actorId,
        });
      },
      setMembership: async (teamId, userId, active, actorId) => {
        if (this.failMemberFor === userId) throw new Error("membership failed");
        const m = data.memberships.find(
          m => m.teamId === teamId && m.userId === userId
        );
        if (m)
          Object.assign(m, {
            active,
            leftAt: active ? null : "now",
            updatedById: actorId,
          });
        else
          data.memberships.push({
            teamId,
            userId,
            active,
            joinedAt: "now",
            leftAt: null,
            updatedById: actorId,
          });
      },
      audit: async (actor, entry) => {
        if (this.failAudit) throw new Error("audit failed");
        audits.push({ actor, entry });
      },
    };
    try {
      const value = await work(tx);
      this.data = data;
      this.auditEntries = audits;
      return value;
    } finally {
      release();
    }
  }
}
const fixture = () => {
  const repo = new MemoryRepository();
  return { repo, service: new TicketTeamManagementService(repo) };
};
const code = (expected: string) => (e: unknown) =>
  e instanceof TeamTicketError && e.code === expected;
function caller(
  service: TicketTeamManagementService,
  role = "maintenance_manager",
  isActive = 1
) {
  return createMaintenanceTeamsRouter(service).createCaller({
    user: { id: 11, role, isActive },
    req: { ip: "127.0.0.1", get: () => "mock" },
    res: {},
  } as any);
}

test("management roles are enforced before repository access and reflected in route access", async () => {
  for (const role of [
    "technician",
    "warehouse",
    "user",
    "it_manager",
    "construction_procurement_manager",
  ]) {
    const { repo, service } = fixture();
    const actor = { ...manager, role };
    await assert.rejects(service.list(actor), code("FORBIDDEN"));
    await assert.rejects(
      service.create(actor, { name: "فريق", warehouseId: 40 }),
      code("FORBIDDEN")
    );
    await assert.rejects(
      service.setActive(actor, { teamId: 21, active: false }),
      code("FORBIDDEN")
    );
    await assert.rejects(
      service.setMembership(actor, { teamId: 21, userId: 31, active: false }),
      code("FORBIDDEN")
    );
    assert.equal(repo.touches, 0);
    assert.equal(canRoleAccessPath(role, "/maintenance-teams"), false);
  }
  for (const role of [
    "owner",
    "admin",
    "maintenance_manager",
    "general_maintenance_manager",
  ]) {
    const { service } = fixture();
    assert.equal((await service.list({ ...manager, role })).teams.length, 1);
    assert.equal(canRoleAccessPath(role, "/maintenance-teams"), true);
  }
});
test("inactive manager is denied before any data access", async () => {
  const { repo, service } = fixture();
  await assert.rejects(
    service.list({ ...manager, active: false }),
    code("FORBIDDEN")
  );
  assert.equal(repo.touches, 0);
});
test("create trims names, reuses existing warehouse, and audits authenticated actor", async () => {
  const { repo, service } = fixture();
  const references = structuredClone({
    technicians: repo.data.technicians,
    warehouses: repo.data.warehouses,
  });
  const result = await service.create(manager, {
    name: "  التكييف  ",
    warehouseId: 40,
  });
  assert.equal(repo.data.teams.find(t => t.id === result.id)?.name, "التكييف");
  assert.deepEqual(
    { technicians: repo.data.technicians, warehouses: repo.data.warehouses },
    references
  );
  assert.equal(repo.auditEntries[0].actor.id, 11);
  assert.equal(repo.auditEntries[0].entry.entityId, result.id);
});
test("main, inactive, nonexistent warehouses and invalid names are rejected", async () => {
  const { repo, service } = fixture();
  for (const warehouseId of [41, 42, 999, 0, -1, 1.5])
    await assert.rejects(
      service.create(manager, { name: "اختبار", warehouseId }),
      code("INVALID")
    );
  for (const name of ["   ", "a".repeat(101)])
    await assert.rejects(
      service.create(manager, { name, warehouseId: 40 }),
      code("INVALID")
    );
  assert.equal(repo.data.teams.length, 1);
  assert.equal(repo.auditEntries.length, 0);
});
test("duplicate team name returns conflict without creating a second row", async () => {
  const { repo, service } = fixture();
  await assert.rejects(
    service.create(manager, { name: "الكهرباء", warehouseId: 40 }),
    code("CONFLICT")
  );
  assert.equal(repo.data.teams.length, 1);
});
test("membership permits active maintenance and IT executors only", async () => {
  const { repo, service } = fixture();
  for (const userId of [33, 34, 999])
    await assert.rejects(
      service.setMembership(manager, { teamId: 21, userId, active: true }),
      code("INVALID")
    );
  await service.setMembership(manager, {
    teamId: 21,
    userId: 31,
    active: false,
  });
  const joinedAt = repo.data.memberships[0].joinedAt;
  await service.setMembership(manager, {
    teamId: 21,
    userId: 31,
    active: true,
  });
  assert.equal(repo.data.memberships.length, 2);
  assert.equal(repo.data.memberships[0].joinedAt, joinedAt);
  assert.equal(repo.data.memberships[0].leftAt, null);
  await service.setMembership(manager, {
    teamId: 21,
    userId: 35,
    active: true,
  });
  assert.ok(
    repo.data.memberships.some(
      membership => membership.userId === 35 && membership.active
    )
  );
});
test("repeating an active membership or team status does not duplicate audit", async () => {
  const { repo, service } = fixture();
  assert.deepEqual(
    await service.setMembership(manager, {
      teamId: 21,
      userId: 31,
      active: true,
    }),
    { changed: false }
  );
  assert.deepEqual(
    await service.setActive(manager, { teamId: 21, active: true }),
    { changed: false }
  );
  assert.equal(repo.auditEntries.length, 0);
});
test("team cannot be disabled during open execution or reactivated with an inactive warehouse", async () => {
  const { repo, service } = fixture();
  repo.open = true;
  await assert.rejects(
    service.setActive(manager, { teamId: 21, active: false }),
    code("CONFLICT")
  );
  repo.open = false;
  await service.setActive(manager, { teamId: 21, active: false });
  repo.data.warehouses[0].active = false;
  await assert.rejects(
    service.setActive(manager, { teamId: 21, active: true }),
    code("INVALID")
  );
  await assert.rejects(
    service.setMembership(manager, { teamId: 21, userId: 33, active: true }),
    code("INVALID")
  );
});
test("concurrent membership removals retain one valid technician for open execution", async () => {
  const { repo, service } = fixture();
  repo.open = true;
  const results = await Promise.allSettled(
    [31, 32].map(userId =>
      service.setMembership(manager, { teamId: 21, userId, active: false })
    )
  );
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(repo.data.memberships.filter(m => m.active).length, 1);
});
test("inactive linked user can be removed while another valid technician remains", async () => {
  const { repo, service } = fixture();
  repo.open = true;
  repo.data.technicians[0].active = false;
  await service.setMembership(manager, {
    teamId: 21,
    userId: 31,
    active: false,
  });
  await assert.rejects(
    service.setMembership(manager, { teamId: 21, userId: 32, active: false }),
    code("CONFLICT")
  );
});
test("audit failure rolls back create, membership and activation changes", async () => {
  for (const operation of ["create", "member", "active"]) {
    const { repo, service } = fixture();
    const before = structuredClone(repo.data);
    repo.failAudit = true;
    await assert.rejects(
      operation === "create"
        ? service.create(manager, { name: "جديد", warehouseId: 40 })
        : operation === "member"
          ? service.setMembership(manager, {
              teamId: 21,
              userId: 31,
              active: false,
            })
          : service.setActive(manager, { teamId: 21, active: false }),
      /audit failed/
    );
    assert.deepEqual(repo.data, before);
    assert.equal(repo.auditEntries.length, 0);
  }
});
test("API denies unauthenticated, inactive and nonmanager callers without repository access", async () => {
  const { repo, service } = fixture();
  await assert.rejects(
    createMaintenanceTeamsRouter(service)
      .createCaller({ user: null } as any)
      .list(),
    (e: any) => e.code === "UNAUTHORIZED"
  );
  for (const api of [
    caller(service, "technician"),
    caller(service, "owner", 0),
  ]) {
    for (const work of [
      () => api.list(),
      () => api.create({ name: "فريق", warehouseId: 40 }),
      () => api.setActive({ teamId: 21, active: false }),
      () => api.setMembership({ teamId: 21, userId: 31, active: false }),
    ])
      await assert.rejects(work(), (e: any) => e.code === "FORBIDDEN");
  }
  assert.equal(repo.touches, 0);
});
test("API rejects actor spoofing and bad identifiers and returns domain conflicts", async () => {
  const { repo, service } = fixture();
  const api = caller(service);
  await assert.rejects(
    api.create({ name: "جديد", warehouseId: 40, actorId: 999 } as any),
    (e: any) => e.code === "BAD_REQUEST"
  );
  await assert.rejects(
    api.setMembership({ teamId: 0, userId: 31, active: true }),
    (e: any) => e.code === "BAD_REQUEST"
  );
  await assert.rejects(
    api.create({ name: "الكهرباء", warehouseId: 40 }),
    (e: any) => e.code === "CONFLICT"
  );
  await api.create({ name: "من API", warehouseId: 40 });
  assert.equal(repo.auditEntries[0].actor.id, 11);
});

const dialect = new MySqlDialect();
function sqlFixture(
  answer: (text: string, params: unknown[]) => unknown = () => [[], []]
) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  let providerCalls = 0,
    transactions = 0;
  const tx = {
    execute: async (query: SQL) => {
      const q = dialect.sqlToQuery(query);
      statements.push(q);
      return answer(q.sql, q.params);
    },
  };
  const db: TeamDatabase = {
    ...tx,
    transaction: async work => {
      transactions++;
      return work(tx);
    },
  };
  const repo = new SqlTeamManagementRepository(async () => {
    providerCalls++;
    return db;
  });
  return { repo, statements, stats: () => ({ providerCalls, transactions }) };
}
test("SQL repository construction is lazy; injected list reads only approved masters/new tables", async () => {
  const f = sqlFixture();
  assert.deepEqual(f.stats(), { providerCalls: 0, transactions: 0 });
  await f.repo.readData();
  assert.deepEqual(f.stats(), { providerCalls: 1, transactions: 1 });
  assert.equal(f.statements.length, 4);
  for (const q of f.statements) {
    assert.match(q.sql, /^SELECT/);
    assert.doesNotMatch(
      q.sql,
      /password|email|SELECT \*|pmv2_|inventory|deliveries|purchase_orders/i
    );
  }
});
test("SQL create and audit share one injected transaction and bind hostile names as data", async () => {
  const f = sqlFixture(sql =>
    sql.startsWith("INSERT INTO maintenance_teams")
      ? [{ insertId: 77 }]
      : [[], []]
  );
  const name = "x'); DROP TABLE users; --";
  await f.repo.transaction(async tx => {
    assert.equal(await tx.createTeam(name, 40, 11), 77);
    await tx.audit(manager, {
      action: "create_ticket_maintenance_team",
      entityId: 77,
      oldValues: null,
      newValues: { name },
    });
  });
  assert.deepEqual(f.stats(), { providerCalls: 1, transactions: 1 });
  assert.equal(f.statements.length, 2);
  assert.ok(f.statements[0].params.includes(name));
  assert.ok(!f.statements[0].sql.includes(name));
  assert.match(f.statements[1].sql, /INSERT INTO audit_logs/);
  assert.equal(f.statements[1].params[0], manager.id);
});
test("SQL locks parent team, preserves membership history, excludes removed user in final-member count", async () => {
  const f = sqlFixture(sql =>
    /COUNT\(\*\)/.test(sql) ? [[{ total: "1" }], []] : [[], []]
  );
  await f.repo.transaction(async tx => {
    await tx.findTeam(21);
    await tx.setMembership(21, 31, true, 11);
    assert.equal(await tx.remainingActiveMemberCount(21, 31), 1);
    await tx.setMembership(21, 31, false, 11);
  });
  assert.match(f.statements[0].sql, /FOR UPDATE$/);
  assert.match(
    f.statements[1].sql,
    /ON DUPLICATE KEY UPDATE isActive=1, leftAt=NULL/
  );
  assert.doesNotMatch(
    f.statements[1].sql.split("ON DUPLICATE KEY UPDATE")[1],
    /joinedAt/
  );
  assert.match(f.statements[2].sql, /m.userId<>\?/);
  assert.deepEqual(f.statements[2].params, [21, 31]);
  for (const q of f.statements)
    assert.doesNotMatch(
      q.sql,
      /(UPDATE|INSERT INTO|DELETE FROM)\s+(users|warehouses|tickets|ticket_items|pmv2_|inventory)/
    );
});
test("SQL duplicate-key errors are converted into a domain conflict", async () => {
  const f = sqlFixture(() => {
    throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
  });
  await assert.rejects(
    f.repo.transaction(tx => tx.createTeam("فريق", 40, 11)),
    code("CONFLICT")
  );
});
const saveInput = (
  repo: MemoryRepository,
  changes: Partial<SaveTeamInput> = {}
): SaveTeamInput => {
  const expected = teamManagementSnapshot(repo.data, 21);
  return {
    teamId: 21,
    name: expected.name,
    warehouseId: expected.warehouseId,
    memberIds: [...expected.memberIds],
    expected,
    ...changes,
  };
};
test("create saves the team and all selected technicians atomically with one audit", async () => {
  const { repo, service } = fixture();
  const { id } = await service.create(manager, {
    name: "التكييف",
    warehouseId: 40,
    memberIds: [31, 32],
  });
  assert.deepEqual(
    repo.data.memberships.filter(m => m.teamId === id).map(m => m.userId),
    [31, 32]
  );
  assert.equal(repo.touches, 1);
  assert.equal(repo.auditEntries.length, 1);
  assert.deepEqual(
    (repo.auditEntries[0].entry.newValues as any).memberIds,
    [31, 32]
  );
});
test("failure on the second selected technician leaves no partial team or membership", async () => {
  const { repo, service } = fixture();
  const before = structuredClone(repo.data);
  repo.failMemberFor = 32;
  await assert.rejects(
    service.create(manager, {
      name: "جديد",
      warehouseId: 40,
      memberIds: [31, 32],
    }),
    /membership failed/
  );
  assert.deepEqual(repo.data, before);
  assert.equal(repo.auditEntries.length, 0);
});
test("create rejects duplicate, inactive, foreign-role and nonexistent selected technicians", async () => {
  for (const ids of [[31, 31], [31, 33], [34], [999], [0]]) {
    const { repo, service } = fixture();
    const before = structuredClone(repo.data);
    await assert.rejects(
      service.create(manager, {
        name: "جديد",
        warehouseId: 40,
        memberIds: ids,
      }),
      code("INVALID")
    );
    assert.deepEqual(repo.data, before);
  }
});
test("save commits profile and membership together and audit preserves the old profile", async () => {
  const { repo, service } = fixture();
  repo.data.warehouses.push({
    id: 43,
    name: "فرعي آخر",
    type: "branch",
    active: true,
  });
  await service.save(
    manager,
    saveInput(repo, {
      name: "  كهرباء وتكييف  ",
      warehouseId: 43,
      memberIds: [32],
    })
  );
  assert.equal(repo.data.teams[0].name, "كهرباء وتكييف");
  assert.equal(repo.data.teams[0].warehouseId, 43);
  assert.deepEqual(
    repo.data.memberships.filter(m => m.active).map(m => m.userId),
    [32]
  );
  assert.deepEqual(repo.auditEntries[0].entry.oldValues, {
    name: "الكهرباء",
    warehouseId: 40,
    memberIds: [31, 32],
  });
  assert.equal(repo.auditEntries.length, 1);
});
test("save profile and memberships roll back together on audit or membership failure", async () => {
  for (const failAudit of [true, false]) {
    const { repo, service } = fixture();
    const before = structuredClone(repo.data);
    repo.failAudit = failAudit;
    repo.failMemberFor = failAudit ? null : 31;
    await assert.rejects(
      service.save(
        manager,
        saveInput(repo, { name: "تعديل", memberIds: [32] })
      ),
      /failed/
    );
    assert.deepEqual(repo.data, before);
    assert.equal(repo.auditEntries.length, 0);
  }
});
test("batch save allows replacement of the last technician during open execution", async () => {
  const { repo, service } = fixture();
  repo.open = true;
  repo.data.technicians.push({
    id: 35,
    name: "بديل",
    role: "technician",
    active: true,
  });
  await service.save(manager, saveInput(repo, { memberIds: [35] }));
  assert.deepEqual(
    repo.data.memberships.filter(m => m.active).map(m => m.userId),
    [35]
  );
  await assert.rejects(
    service.save(manager, saveInput(repo, { memberIds: [] })),
    code("CONFLICT")
  );
});
test("warehouse changes are blocked during execution, and invalid warehouse choices never save", async () => {
  const { repo, service } = fixture();
  repo.open = true;
  await assert.rejects(
    service.save(manager, saveInput(repo, { warehouseId: 41 })),
    code("CONFLICT")
  );
  repo.open = false;
  for (const warehouseId of [41, 42, 999])
    await assert.rejects(
      service.save(manager, saveInput(repo, { warehouseId })),
      code("INVALID")
    );
  assert.equal(repo.data.teams[0].warehouseId, 40);
});
test("stale membership, name and active status cannot be overwritten by a draft", async () => {
  for (const change of ["membership", "name", "active"]) {
    const { repo, service } = fixture();
    const input = saveInput(repo, { name: "مسودة" });
    if (change === "membership") repo.data.memberships[0].active = false;
    if (change === "name") repo.data.teams[0].name = "تعديل آخر";
    if (change === "active") repo.data.teams[0].active = false;
    const before = structuredClone(repo.data);
    await assert.rejects(service.save(manager, input), code("CONFLICT"));
    assert.deepEqual(repo.data, before);
  }
});
test("concurrent saves from the same snapshot accept one and reject the stale one", async () => {
  const { repo, service } = fixture();
  const base = saveInput(repo);
  const results = await Promise.allSettled(
    ["مسودة أولى", "مسودة ثانية"].map(name =>
      service.save(manager, { ...base, name })
    )
  );
  assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
  assert.equal(repo.auditEntries.length, 1);
});
test("unchanged save is idempotent; disabled-team memberships cannot be edited", async () => {
  const { repo, service } = fixture();
  assert.deepEqual(await service.save(manager, saveInput(repo)), {
    changed: false,
  });
  assert.equal(repo.auditEntries.length, 0);
  repo.data.teams[0].active = false;
  await assert.rejects(
    service.save(manager, saveInput(repo, { memberIds: [32] })),
    code("INVALID")
  );
  await service.save(manager, saveInput(repo, { name: "اسم معطل" }));
  assert.equal(repo.data.teams[0].active, false);
});
test("batch save validates technician additions but permits retaining existing inactive links", async () => {
  const { repo, service } = fixture();
  repo.data.technicians[0].active = false;
  await service.save(manager, saveInput(repo, { name: "تحديث الاسم" }));
  for (const memberIds of [[31, 32, 33], [31, 32, 34], [31, 31], [999]])
    await assert.rejects(
      service.save(manager, saveInput(repo, { memberIds })),
      code("INVALID")
    );
});
test("save API rejects unauthorized callers, forged actors and missing expected snapshot", async () => {
  const { repo, service } = fixture();
  const input = saveInput(repo, { name: "اسم جديد" });
  await assert.rejects(
    caller(service, "technician").save(input),
    (e: any) => e.code === "FORBIDDEN"
  );
  await assert.rejects(
    caller(service).save({ ...input, actorId: 99 } as any),
    (e: any) => e.code === "BAD_REQUEST"
  );
  await assert.rejects(
    caller(service).save({ ...input, expected: undefined } as any),
    (e: any) => e.code === "BAD_REQUEST"
  );
  assert.equal(repo.touches, 0);
  await caller(service).save(input);
  assert.equal(repo.auditEntries[0].actor.id, manager.id);
});
test("profile SQL binds values and membership snapshot uses current row locks", async () => {
  const f = sqlFixture();
  await f.repo.transaction(async tx => {
    await tx.membershipsForTeam(21);
    await tx.updateTeamProfile(21, "x'; --", 43, 11);
  });
  assert.match(
    f.statements[0].sql,
    /WHERE teamId=\? ORDER BY userId FOR UPDATE$/
  );
  assert.match(
    f.statements[1].sql,
    /^UPDATE maintenance_teams SET name=\?, warehouseId=\?, updatedById=\? WHERE id=\?/
  );
  assert.deepEqual(f.statements[1].params, ["x'; --", 43, 11, 21]);
});
test("production view shows collapsed team rows and read-only details without immediate membership writes", () => {
  const html = renderToStaticMarkup(
    <TeamsManagementView
      data={initial()}
      busy={false}
      onCreate={async () => true}
      onSave={async () => true}
      onActive={async () => {}}
    />
  );
  assert.match(html, /<details/);
  assert.match(html, /<summary/);
  assert.match(html, /تعديل الفريق/);
  assert.match(html, /إضافة منفذين/);
  assert.doesNotMatch(html, /<input|<select|<details[^>]* open/);
  assert.doesNotMatch(html, /value="41"|value="42"|SIM-MT|إسناد تذكرة تجريبية/);
  assert.match(html, /أحمد/);
  assert.match(html, /خالد/);
  assert.doesNotMatch(html, />معطل<|>مستودع</);
  const english = renderToStaticMarkup(
    <TeamsManagementView
      data={initial()}
      language="en"
      busy={true}
      onCreate={async () => true}
      onSave={async () => true}
      onActive={async () => {}}
    />
  );
  assert.match(english, /Maintenance Teams/);
  assert.match(english, /Edit team/);
  assert.match(english, /button[^>]*disabled/);
});
