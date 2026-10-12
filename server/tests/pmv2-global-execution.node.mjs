import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import * as realOrm from 'drizzle-orm';
import * as realMysql from 'drizzle-orm/mysql-core';

// All runtime boundaries are injected. This test never imports the application,
// database client, environment configuration, inventory writer or live schema.
const root = fileURLToPath(new URL('../../', import.meta.url));
const source = p => fs.readFileSync(path.join(root, p), 'utf8');
function evaluate(code, imports) {
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, console, require(id) {
    if (!(id in imports)) throw new Error(`Blocked runtime import: ${id}`);
    return imports[id];
  } });
  return module.exports;
}
const outsideScope = () => { throw new Error('Unexpected ticket-team policy call in PMV2 test'); };
const roles = evaluate(transformSync(source('shared/roles.ts'), { loader: 'ts', format: 'cjs' }).code, {
  './maintenance-team-tickets/team-management': { canManageTicketTeams: outsideScope },
  './maintenance-team-tickets/execution-permissions': { canReadTicketTeamExecution: outsideScope },
});
const globalRoles = ['owner', 'admin', 'maintenance_manager', 'general_maintenance_manager', 'construction_procurement_manager'];
const ordinaryRoles = ['technician', 'it_manager', 'it_member'];
const schema = new Proxy({}, { get(_target, name) { return table(String(name)); } });
function table(name, origin = name) {
  return new Proxy({ name, origin }, { get(target, key) {
    return key in target ? target[key] : { col: true, table: name, key };
  } });
}
const op = kind => (...args) => ({ kind, args });
const sql = (strings, ...args) => ({ kind: 'sql', text: strings.join('?'), args });
const orm = Object.fromEntries(['and', 'or', 'eq', 'ne', 'lte', 'inArray', 'notInArray', 'isNull', 'asc', 'desc'].map(k => [k, op(k)]));
orm.sql = sql;
const core = { alias: (t, name) => table(name, t.origin) };
function load(file, extra = {}) {
  return evaluate(transformSync(source(file), { loader: 'ts', format: 'cjs', target: 'es2022' }).code,
    { 'drizzle-orm': orm, 'drizzle-orm/mysql-core': core, '../../../drizzle/schema': schema,
      '../../../shared/roles': roles, ...extra });
}
const access = load('server/pmv2/security/execution-access.ts');

function containsSubquery(condition) {
  return condition?.kind === 'sql' && /\bselect\b/i.test(condition.text) ||
    Boolean(condition?.args?.some(arg => containsSubquery(arg)));
}

// Minimal injected Drizzle-shaped builder; predicates come from the actual
// services. Array fixtures model records, with transactional rollback on error.
class FixtureStore {
  constructor(records) { this.records = structuredClone(records); this.audit = []; this.writes = []; }
  rows(t) { return this.records[t.origin] || []; }
  value(node, record, group = [record]) {
    if (node?.col) return record[node.table]?.[node.key] ?? null;
    if (!node?.kind) return node;
    const v = n => this.value(n, record, group);
    const a = node.args;
    switch (node.kind) {
      case 'eq': return v(a[0]) === v(a[1]);
      case 'ne': return v(a[0]) !== v(a[1]);
      case 'lte': return v(a[0]) <= v(a[1]);
      case 'inArray': return a[1].includes(v(a[0]));
      case 'notInArray': return !a[1].includes(v(a[0]));
      case 'and': return a.every(n => !n || v(n));
      case 'or': return a.some(n => n && v(n));
      case 'isNull': return v(a[0]) == null;
      case 'sql': {
        if (/exists/.test(node.text) && a[1]?.kind === 'and') {
          return this.rows(a[0]).some(row => this.value(a[1], { ...record, [a[0].name]: row }));
        }
        if (/exists/.test(node.text)) {
          return this.rows(a[0]).some(row => row.taskId === v(a[2]) && row.endedAt == null);
        }
        if (/^count/.test(node.text)) return group.filter(r => this.value(a[0], r) != null).length;
        if (/coalesce\(sum/.test(node.text)) return group.filter(r => this.value(a[0], r) === 'completed').length;
        if (/CURRENT_TIMESTAMP/.test(node.text)) return '2026-10-11T12:00:00Z';
        throw new Error(`Unmodelled SQL: ${node.text}`);
      }
      default: throw new Error(`Unmodelled operation: ${node.kind}`);
    }
  }
  select(fields) {
    const store = this;
    let records = [], condition, groups, ordering = [], limit = Infinity;
    const q = {
      from(t) { records = store.rows(t).map(row => ({ [t.name]: row })); return q; },
      innerJoin(t, on) { return join(t, on, false); },
      leftJoin(t, on) { return join(t, on, true); },
      where(c) { condition = c; return q; },
      groupBy(...g) { groups = g; return q; },
      orderBy(...o) { ordering = o; return q; },
      limit(n) { limit = n; return q; },
      then(resolve, reject) {
        try {
          const filtered = records.filter(r => !condition || store.value(condition, r));
          const grouped = new Map();
          for (const [i, r] of filtered.entries()) {
            const key = groups ? JSON.stringify(groups.map(g => store.value(g, r))) : i;
            const list = grouped.get(key) || []; list.push(r); grouped.set(key, list);
          }
          let data = Array.from(grouped.values());
          data.sort((a, b) => {
            for (const o of ordering) {
              const x = store.value(o.col ? o : o.args[0], a[0]), y = store.value(o.col ? o : o.args[0], b[0]);
              if (x !== y) return (x < y ? -1 : 1) * (o.kind === 'desc' ? -1 : 1);
            }
            return 0;
          });
          resolve(data.slice(0, limit).map(g => Object.fromEntries(Object.entries(fields)
            .map(([key, val]) => [key, store.value(val, g[0], g)]))));
        } catch (error) { reject(error); }
      },
    };
    function join(t, on, left) {
      // TiDB rejects subqueries in JOIN ON even when the administrative OR
      // branch would be true. Validate SQL shape before evaluating fixtures.
      assert.equal(containsSubquery(on), false, "JOIN ON must not contain a subquery");
      records = records.flatMap(r => {
        const matches = store.rows(t).map(row => ({ ...r, [t.name]: row })).filter(row => store.value(on, row));
        return matches.length ? matches : left ? [{ ...r, [t.name]: null }] : [];
      }); return q;
    }
    return q;
  }
  insert(t) { return { values: async data => {
    assert.notEqual(t.name, 'pmv2TeamMembers', 'must not create permanent team memberships');
    const rows = this.records[t.origin] ||= [];
    const id = Math.max(0, ...rows.map(r => r.id)) + 1;
    rows.push({ id, startedAt: '2026-10-11T10:00:00Z', endedAt: null, ...data });
    this.writes.push({ table: t.name, ...data }); return [{ insertId: id }];
  } }; }
  update(t) { return { set: data => ({ where: async condition => {
    for (const row of this.rows(t)) if (this.value(condition, { [t.name]: row })) {
      for (const [key, val] of Object.entries(data)) row[key] = this.value(val, { [t.name]: row });
    }
  } }) }; }
  async execute(statement) { assert.match(statement.text, /FOR UPDATE/); return []; }
  async transaction(fn) {
    const before = structuredClone(this.records), audit = this.audit.length, writes = this.writes.length;
    try { return await fn(this); } catch (error) {
      this.records = before; this.audit.length = audit; this.writes.length = writes; throw error;
    }
  }
}
function fixture(role, options = {}) {
  const db = new FixtureStore({
    users: [{ id: 1, role, isActive: options.active ?? 1, name: 'Actual executor' }, { id: 9, role: 'technician', isActive: 1 }],
    pmv2TeamMembers: options.member ? [{ id: 1, teamId: options.memberTeam ?? 20, userId: 1, isActive: options.memberActive ?? 1 }] : [],
    pmv2Tasks: [{ id: 10, teamId: 20, programTargetId: 30, taskNumber: 'PMV2-10', dueDate: '2026-10-11', status: 'pending' }],
    pmv2Teams: [{ id: 20, code: 'TEAM-20', warehouseId: 60 }],
    pmv2ProgramTargets: [{ id: 30, siteId: 40, sectionId: 50, assetId: null }],
    sites: [{ id: 40, name: 'Site' }], sections: [{ id: 50, siteId: 40, name: 'Section', isActive: 1 }],
    pmv2TaskItems: [{ id: 100, taskId: 10, status: 'pending', result: null, titleSnapshot: 'Inspect' }],
    pmv2Visits: [], pmv2VisitMembers: [], pmv2ItemActions: [],
  });
  const settlement = [];
  const common = {
    '../security/execution-access': access, '../../_core/db/client': { getDb: async () => db },
    '../audit/service': { writePmv2AuditWithDb: async (_tx, event) => db.audit.push(event) },
    '../translation-queue': { queuePmv2Translation: async () => {} },
    '../scheduler/utils': { getRiyadhDateOnly: () => '2026-10-11' },
    '../adapters/current-system': { currentTicketAdapter: { getTicketsByIds: async () => [] } },
  };
  const read = load('server/pmv2/technician/read-service.ts', common);
  const execution = load('server/pmv2/technician/execution-service.ts', { ...common, './read-service': read,
    '../materials/team-issue-handoff-service': { pmv2TeamIssueHandoffService: {
      declareConsumptionWithDb: async (_tx, actor, task, item, visit, usages) => {
        settlement.push({ actor, task, item, visit, usages }); return { pendingReturnQuantity: 0, declarations: [] };
      },
    } },
  });
  return { db, common, settlement, read: new read.Pmv2TechnicianReadService(), execution: new execution.Pmv2TechnicianExecutionService() };
}

for (const role of globalRoles) {
  test(`${role}: sees a foreign team once and executes with actual identity without membership`, async () => {
    const f = fixture(role);
    assert.equal(roles.canRoleExecutePmv2Technician(role), true);
    assert.equal(roles.canRoleAccessPath(role, '/scheduled-maintenance/my-tasks'), true);
    const feed = await f.read.listTodayTasks(1);
    assert.equal(feed.items.length, 1); assert.equal(feed.items[0].itemCount, 1);
    assert.equal((await f.read.listTaskItems(1, 10)).length, 1);
    await f.execution.startItem(1, { taskId: 10, taskItemId: 100 });
    assert.equal((await f.read.getVisitState(1, 10)).isLeader, true);
    await f.execution.submitBasicResult(1, { taskId: 10, taskItemId: 100, result: 'fixed', note: 'Repair recorded' });
    await f.execution.endVisit(1, { taskId: 10 });
    assert.equal(f.db.records.pmv2TaskItems[0].status, 'completed');
    assert.equal(f.db.records.pmv2Visits[0].endedAt, '2026-10-11T12:00:00Z');
    assert.ok(f.db.records.pmv2ItemActions.every(a => a.performedById === 1));
    assert.ok(f.db.audit.every(a => a.actorUserId === 1));
    assert.equal(f.db.records.pmv2TeamMembers.length, 0);
  });
  test(`${role}: inactive account loses team execution access`, async () => {
    const f = fixture(role, { active: 0 });
    assert.equal((await f.read.listTodayTasks(1)).items.length, 0);
    await assert.rejects(f.execution.startItem(1, { taskId: 10, taskItemId: 100 }), { name: 'Pmv2TechnicianAccessError' });
  });
}
for (const role of ordinaryRoles) {
  test(`${role}: active membership still executes; foreign/inactive membership denied`, async () => {
    const own = fixture(role, { member: true });
    assert.equal((await own.read.listTodayTasks(1)).items.length, 1);
    await own.execution.startItem(1, { taskId: 10, taskItemId: 100 });
    await own.execution.submitBasicResult(1, { taskId: 10, taskItemId: 100, result: 'ok' });
    for (const opts of [{}, { member: true, memberTeam: 21 }, { member: true, memberActive: 0 }]) {
      const f = fixture(role, opts);
      assert.equal((await f.read.listTodayTasks(1)).items.length, 0);
      await assert.rejects(f.execution.startItem(1, { taskId: 10, taskItemId: 100 }), { name: 'Pmv2TechnicianAccessError' });
    }
  });
}
test('unsupported roles do not acquire execution from membership; management and warehouse scopes stay separate', async () => {
  for (const role of Object.values(roles.APP_ROLE).filter(r => !globalRoles.includes(r) && !ordinaryRoles.includes(r))) {
    assert.equal(roles.canRoleExecutePmv2Technician(role), false, role);
    const f = fixture(role, { member: true });
    assert.equal((await f.read.listTodayTasks(1)).items.length, 0, role);
  }
  assert.deepEqual(Array.from(roles.PMV2_MANAGEMENT_ROLES), globalRoles.slice(0, 4));
  assert.deepEqual(Array.from(roles.PMV2_WAREHOUSE_ROLES), ['warehouse', 'owner', 'admin']);
  assert.deepEqual(Array.from(roles.PMV2_TECHNICIAN_EXECUTION_ROLES), ordinaryRoles);
  assert.equal(roles.canRoleManagePmv2('construction_procurement_manager'), false);
  assert.equal(roles.canRoleAccessPmv2Warehouse('maintenance_manager'), false);
});
test('fresh account role is checked on every write, including after an earlier successful read', async () => {
  const f = fixture('admin'); assert.equal((await f.read.listTodayTasks(1)).items.length, 1);
  f.db.records.users[0].role = 'user';
  await assert.rejects(f.execution.startItem(1, { taskId: 10, taskItemId: 100 }), { name: 'Pmv2TechnicianAccessError' });
  assert.equal(f.db.writes.length, 0);
});
test('global execution preserves exact task/item pairing and cancelled-task guards', async () => {
  const f = fixture('owner');
  f.db.records.pmv2TaskItems.push({ id: 101, taskId: 11, status: 'pending' });
  await assert.rejects(f.execution.startItem(1, { taskId: 10, taskItemId: 101 }), { name: 'Pmv2TechnicianAccessError' });
  f.db.records.pmv2Tasks[0].status = 'cancelled';
  assert.equal((await f.read.listTodayTasks(1)).items.length, 0);
  await assert.rejects(f.execution.startItem(1, { taskId: 10, taskItemId: 100 }), { name: 'Pmv2TechnicianTransitionError' });
  assert.equal(f.db.writes.length, 0);
});
test('today feed keeps date/carry-over/open-visit behavior without duplicate rows', async () => {
  const f = fixture('admin');
  f.db.records.pmv2Tasks.push(...[
    { id: 11, dueDate: '2026-10-12', status: 'pending' },
    { id: 12, dueDate: '2026-10-10', status: 'waiting_material' },
    { id: 13, dueDate: '2026-10-10', status: 'completed' },
    { id: 14, dueDate: '2026-10-10', status: 'completed' },
  ].map(t => ({ teamId: 20, programTargetId: 30, taskNumber: `PMV2-${t.id}`, ...t })));
  f.db.records.pmv2Visits.push({ id: 1, taskId: 14, endedAt: null });
  f.db.records.pmv2TaskItems.push({ id: 101, taskId: 10, status: 'pending' });
  const feed = await f.read.listTodayTasks(1);
  assert.deepEqual(Array.from(feed.items, t => t.id).sort((a, b) => a - b), [10, 12, 14]);
  assert.equal(feed.todayCount, 1); assert.equal(feed.carryOverCount, 2);
  assert.equal(feed.items.find(t => t.id === 10).itemCount, 2);
});
test('global actor can join an existing visit but cannot finish another leader\'s visit', async () => {
  const f = fixture('owner');
  f.db.records.pmv2Visits.push({ id: 7, taskId: 10, endedAt: null });
  f.db.records.pmv2VisitMembers.push({ id: 8, visitId: 7, userId: 9, isLeader: 1 });
  await f.execution.startItem(1, { taskId: 10, taskItemId: 100 });
  assert.equal((await f.read.getVisitState(1, 10)).isLeader, false);
  await f.execution.submitBasicResult(1, { taskId: 10, taskItemId: 100, result: 'ok' });
  await assert.rejects(f.execution.endVisit(1, { taskId: 10 }), { name: 'Pmv2TechnicianLeaderRequiredError' });
  assert.equal(f.db.records.pmv2Visits[0].endedAt, null);
});
test('in-progress items and results-before-start remain blocked', async () => {
  const f = fixture('admin');
  await assert.rejects(f.execution.submitBasicResult(1, { taskId: 10, taskItemId: 100, result: 'ok' }), { name: 'Pmv2TechnicianTransitionError' });
  await f.execution.startItem(1, { taskId: 10, taskItemId: 100 });
  await assert.rejects(f.execution.endVisit(1, { taskId: 10 }), { name: 'Pmv2TechnicianTransitionError' });
});
test('needs-material resumption records actual executor and keeps original consumption boundary', async () => {
  const f = fixture('general_maintenance_manager');
  f.db.records.pmv2Tasks[0].status = 'ready_to_complete';
  Object.assign(f.db.records.pmv2TaskItems[0], { status: 'ready_to_complete', result: 'needs_material' });
  await f.execution.resumeItem(1, { taskId: 10, taskItemId: 100 });
  await assert.rejects(f.execution.submitBasicResult(1, { taskId: 10, taskItemId: 100, result: 'ok' }), { name: 'Pmv2TechnicianTransitionError' });
  await f.execution.submitBasicResult(1, { taskId: 10, taskItemId: 100, result: 'fixed', materialUsages: [{ catalogItemId: 90, usedQuantity: 2 }] });
  assert.equal(f.settlement.length, 1); assert.equal(f.settlement[0].actor, 1);
  assert.equal(f.settlement[0].usages[0].usedQuantity, 2);
});
for (const result of ['needs_material', 'needs_ticket']) test(`${result}: global actor retains dependency state and actual actor`, async () => {
  const f = fixture('construction_procurement_manager');
  await f.execution.startItem(1, { taskId: 10, taskItemId: 100 });
  await f.execution.submitDependencyResult(1, { taskId: 10, taskItemId: 100, result, note: 'Dependency details' });
  assert.equal(f.db.records.pmv2TaskItems[0].result, result);
  assert.equal(f.db.records.pmv2ItemActions.at(-1).performedById, 1);
  await f.execution.endVisit(1, { taskId: 10 });
});
test('PMV2 ticket source context allows global actor, preserves technician team scope', async () => {
  for (const role of ['owner', 'construction_procurement_manager', 'technician']) {
    const f = fixture(role);
    const service = new (load('server/pmv2/tickets/handoff-service.ts', f.common).Pmv2TicketHandoffService)();
    if (role === 'technician') await assert.rejects(service.getCreateContext(1, 100), { name: 'Pmv2TicketHandoffError' });
    else { const context = await service.getCreateContext(1, 100); assert.equal(context.taskId, 10); assert.equal(context.siteId, 40); }
  }
});

function materialService(f, adapters = {}) {
  return new (load('server/pmv2/materials/team-issue-handoff-service.ts', { ...f.common,
    '../adapters/current-system': adapters, './usage-validation': { validatePmv2MaterialUsageWrite() {} },
    '../../../shared/pmv2MaterialQuantity': { getPmv2MaterialQuantityValidationMessage() {} },
  }).Pmv2TeamIssueHandoffService)();
}
function materialFixture(role, requester = 1, options = {}) {
  const f = fixture(role, options);
  Object.assign(f.db.records.pmv2TaskItems[0], { status: 'waiting_material', result: 'needs_material' });
  f.db.records.pmv2Tasks[0].status = 'waiting_material';
  f.db.records.pmv2ItemActions.push({ id: 200, taskItemId: 100, visitId: 7, performedById: requester,
    action: 'material_route_decision', note: JSON.stringify({ version: 1, route: 'team_inventory', catalogItemId: 90,
      itemNameSnapshot: 'Spare part', requestedQuantity: 3, unit: 'piece', teamWarehouseId: 60, availableQuantity: 3,
      shortageQuantity: 0, inventoryId: 70, lotsRequired: true }) });
  const issues = [], deliveries = [];
  const lots = [{ id: 80, lotCode: 'LOT-80', trackingToken: 'original-lot-token', quantity: 3 }];
  const adapters = {
    currentCatalogAdapter: { getItemsByIds: async () => [{ id: 90, nameAr: 'Spare part', code: 'PART-90' }] },
    currentInventoryAdapter: { getCatalogAvailability: async () => ({ inventoryId: 70, availableQuantity: 3, ambiguous: false }),
      listAvailableLots: async () => lots },
    currentMaintenanceTargetAdapter: { listSections: async () => [{ id: 50, siteId: 40, name: 'Section' }] },
    currentDeliveryAdapter: { getDeliveryByNumber: async number => deliveries.find(d => d.deliveryNumber === number) },
    currentInventoryIssueAdapter: { issueDelivery: async input => {
      issues.push(input);
      const delivery = { id: 300, deliveryDocumentId: 300, deliveryNumber: 'DEL-300', inventoryTransactionId: 301,
        inventoryLotId: 80, lotCode: 'LOT-80', inventoryId: 70, warehouseId: 60, catalogItemId: 90,
        quantity: input.quantity, deliveredToId: input.deliveredToId, unit: input.unit };
      deliveries.push(delivery); return delivery;
    } },
  };
  return { ...f, adapters, issues, deliveries, lots, service: materialService(f, adapters) };
}
test('material intake preserves available-stock/shortage routes and actual requester identity', async () => {
  const validation = load('server/pmv2/materials/request-item-validation.ts');
  const quantity = load('shared/pmv2MaterialQuantity.ts');
  for (const available of [3, 1]) {
    const f = fixture('maintenance_manager');
    await f.execution.startItem(1, { taskId: 10, taskItemId: 100 });
    await f.execution.submitDependencyResult(1, { taskId: 10, taskItemId: 100, result: 'needs_material' });
    const svc = new (load('server/pmv2/materials/request-service.ts', { ...f.common,
      '../technician/read-service': { Pmv2TechnicianAccessError: class Pmv2TechnicianAccessError extends Error {} },
      '../../../shared/pmv2MaterialQuantity': quantity, './request-item-validation': validation,
      '../adapters/current-system': {
        currentCatalogAdapter: { requireActiveItem: async () => ({ id: 90, nameAr: 'Spare part' }) },
        currentWarehouseAdapter: { requireActiveWarehouse: async () => ({ id: 60 }) },
        currentInventoryAdapter: { getCatalogAvailability: async () => ({ inventoryId: 70, availableQuantity: available, unit: 'piece', lotsRequired: true }) },
        Pmv2ExternalReferenceError: class Pmv2ExternalReferenceError extends Error {},
      },
    }).Pmv2MaterialRequestService)();
    const result = await svc.submitMaterialNeed(1, { taskId: 10, taskItemId: 100, catalogItemId: 90, quantity: 3, unit: 'piece' });
    assert.equal(result.route, available === 3 ? 'team_inventory' : 'material_request');
    assert.equal(result.shortageQuantity || 0, 3 - available);
    if (available === 1) {
      assert.equal(f.db.records.pmv2MaterialRequests[0].requestedById, 1);
      assert.equal(f.db.records.pmv2MaterialRequestItems[0].requestedQuantity, 2);
    }
    assert.equal(f.db.records.pmv2ItemActions.at(-1).performedById, 1);
    assert.equal(f.db.records.pmv2TeamMembers.length, 0);
  }
});
test('execution predicate renders a singleton actual-account join and correlated membership SQL without connecting', () => {
  const users = realMysql.mysqlTable('users', { id: realMysql.int(), isActive: realMysql.int(), role: realMysql.varchar({ length: 50 }) });
  const members = realMysql.mysqlTable('pmv2_team_members', { teamId: realMysql.int(), userId: realMysql.int(), isActive: realMysql.int() });
  const tasks = realMysql.mysqlTable('pmv2_tasks', { teamId: realMysql.int() });
  const predicate = load('server/pmv2/security/execution-access.ts', { 'drizzle-orm': realOrm, 'drizzle-orm/mysql-core': realMysql,
    '../../../drizzle/schema': { users, pmv2TeamMembers: members } });
  const query = new realMysql.MySqlDialect().sqlToQuery(predicate.pmv2ExecutionTeamCondition(17, tasks.teamId));
  assert.match(query.sql, /`pmv2ExecutionActor`\.`id` = \?/);
  assert.match(query.sql, /exists \(select 1 from `pmv2_team_members`/);
  assert.match(query.sql, /`pmv2_team_members`\.`teamId` = `pmv2_tasks`\.`teamId`/);
  for (const role of [...globalRoles, ...ordinaryRoles]) assert.ok(query.params.includes(role));
  assert.equal(query.params.filter(v => v === 17).length, 2);
});
test('actual task and material-attention queries compile with plain JOIN ON and team authorization in WHERE', async () => {
  const files = ['server/pmv2/technician/read-service.ts', 'server/pmv2/materials/technician-attention-service.ts'];
  const code = files.map(source).join('\n');
  const tableNames = ['assets', 'attachments', 'pmv2ItemActions', 'pmv2ProgramTargets', 'pmv2TaskItems', 'pmv2TaskTicketLinks',
    'pmv2Tasks', 'pmv2Teams', 'pmv2VisitMembers', 'pmv2Visits', 'sections', 'sites', 'pmv2MaterialRequestItems', 'pmv2MaterialRequests'];
  const actualSchema = Object.fromEntries(tableNames.map(name => {
    const columns = new Set(Array.from(code.matchAll(new RegExp(`\\b${name}\\.(\\w+)`, 'g')), m => m[1]));
    return [name, realMysql.mysqlTable(name.replace(/[A-Z]/g, ch => `_${ch.toLowerCase()}`),
      Object.fromEntries(Array.from(columns, column => [column, realMysql.varchar({ length: 200 })])))];
  }));
  actualSchema.users = realMysql.mysqlTable('users', { id: realMysql.int(), isActive: realMysql.int(), role: realMysql.varchar({ length: 50 }) });
  actualSchema.pmv2TeamMembers = realMysql.mysqlTable('pmv2_team_members', { teamId: realMysql.int(), userId: realMysql.int(), isActive: realMysql.int() });
  const captured = [], builder = new realMysql.QueryBuilder();
  const db = { select(fields) { return { from(table) {
    const query = builder.select(fields).from(table);
    // A real Drizzle SQL builder with no session or connector. Only compile;
    // resolving an empty fixture never executes the query.
    query.then = (resolve, reject) => {
      try { captured.push(query.toSQL()); return Promise.resolve([]).then(resolve, reject); }
      catch (error) { return Promise.reject(error).then(resolve, reject); }
    };
    return query;
  } }; } };
  const actualAccess = load('server/pmv2/security/execution-access.ts', { 'drizzle-orm': realOrm,
    'drizzle-orm/mysql-core': realMysql, '../../../drizzle/schema': actualSchema });
  const common = { 'drizzle-orm': realOrm, '../../../drizzle/schema': actualSchema,
    '../security/execution-access': actualAccess, '../../_core/db/client': { getDb: async () => db },
    '../scheduler/utils': { getRiyadhDateOnly: () => '2026-10-11' }, '../adapters/current-system': {},
    './team-issue-handoff-service': { pmv2TeamIssueHandoffService: {} } };
  const read = new (load(files[0], common).Pmv2TechnicianReadService)();
  const attention = new (load(files[1], common).Pmv2TechnicianMaterialAttentionService)();
  await read.listTodayTasks(60723); await attention.list(60723);
  assert.equal(captured.length, 2);
  for (const query of captured) {
    const beforeWhere = query.sql.split(/\bwhere\b/i)[0];
    assert.doesNotMatch(beforeWhere.slice(beforeWhere.indexOf('inner join')), /\b(?:exists|select)\b/i);
    assert.match(beforeWhere, /join `users` `pmv2ExecutionActor` on/);
    assert.match(query.sql, /where[\s\S]+exists \(select 1 from `pmv2_team_members`/i);
    assert.ok(query.params.includes(60723));
    for (const role of [...globalRoles, ...ordinaryRoles]) assert.ok(query.params.includes(role));
  }
});
for (const role of globalRoles) test(`${role}: original lot issue and PMV2 delivery linkage retain actual actor/recipient`, async () => {
  const f = materialFixture(role);
  const queue = await f.service.listReadyToIssueQueue();
  assert.equal(queue.length, 1); assert.equal(queue[0].defaultRecipientUserId, 1);
  assert.equal(queue[0].technicians.length, 1); assert.equal(queue[0].canIssue, true);
  const result = await f.service.issueReadyRequirementToSelf(1, { routeDecisionActionId: 200 });
  assert.equal(result.completed, true); assert.equal(result.recipientUserId, 1);
  assert.equal(f.issues.length, 1); assert.equal(f.issues[0].performedById, 1); assert.equal(f.issues[0].deliveredToId, 1);
  assert.equal(f.issues[0].lotTrackingToken, 'original-lot-token');
  assert.equal(f.issues[0].costTarget.beneficiarySectionId, 50);
  const note = JSON.parse(f.db.records.pmv2ItemActions.find(a => a.action === 'material_issue_linked').note);
  assert.equal(note.recipientUserId, 1); assert.equal(note.inventoryLotId, 80);
  assert.equal(f.db.records.pmv2TaskItems[0].status, 'ready_to_complete');
  assert.equal(f.db.records.pmv2TeamMembers.length, 0);
});
test('global self receipt handles a team with no ordinary members and a different requester', async () => {
  const f = materialFixture('admin', 9);
  const queue = await f.service.listReadyToIssueQueue();
  assert.equal(queue[0].canIssue, false); assert.equal(queue[0].canIssueToAuthorizedExecutor, true);
  assert.equal((await f.service.listTechnicianReadyReceipts(1, 10, 100))[0].canReceive, true);
  const result = await f.service.issueReadyRequirementToSelf(1, { routeDecisionActionId: 200 });
  assert.equal(result.completed, true); assert.equal(f.issues[0].deliveredToId, 1);
});
test('global self receipt keeps lot shortage blockers and rejects inactive recipient', async () => {
  const f = materialFixture('admin'); f.lots[0].quantity = 1;
  await assert.rejects(f.service.issueReadyRequirementToSelf(1, { routeDecisionActionId: 200 }), /Lots/);
  assert.equal(f.issues.length, 0);
  f.lots[0].quantity = 3; f.db.records.users[0].isActive = 0;
  await assert.rejects(f.service.issueReadyRequirementToSelf(1, { routeDecisionActionId: 200 }), /المستلم/);
  assert.equal(f.issues.length, 0);
});
test('material attention includes other requesters only for global actors', async () => {
  for (const role of ['owner', 'technician']) {
    const f = materialFixture(role, 9, { member: true });
    const service = new (load('server/pmv2/materials/technician-attention-service.ts', { ...f.common,
      '../adapters/current-system': f.adapters, './team-issue-handoff-service': { pmv2TeamIssueHandoffService: f.service },
    }).Pmv2TechnicianMaterialAttentionService)();
    const result = await service.list(1);
    assert.equal(result.count, role === 'owner' ? 1 : 0);
    if (role === 'owner') assert.equal(result.items[0].canReceive, true);
  }
});
test('evidence access grants global execution while keeping own-action and open-visit rules', async () => {
  const f = fixture('construction_procurement_manager');
  f.db.records.pmv2Visits.push({ id: 7, taskId: 10, endedAt: null });
  f.db.records.pmv2ItemActions.push({ id: 200, taskItemId: 100, visitId: 7, performedById: 1 });
  const evidence = load('server/pmv2/technician/evidence-access.ts', { ...f.common, '../security/policy': {
    canAccessPmv2TechnicianExecution: roles.canRoleExecutePmv2Technician, canManagePmv2Foundation: roles.canRoleManagePmv2,
  } });
  const user = { id: 1, role: 'construction_procurement_manager' };
  await evidence.assertPmv2ItemActionEvidenceAccess(user, 200, 'write');
  f.db.records.pmv2ItemActions[0].performedById = 9;
  await assert.rejects(evidence.assertPmv2ItemActionEvidenceAccess(user, 200, 'write'), /نفذته أنت/);
  f.db.records.pmv2ItemActions[0].performedById = 1; f.db.records.pmv2Visits[0].endedAt = 'ended';
  await assert.rejects(evidence.assertPmv2ItemActionEvidenceAccess(user, 200, 'write'), /إنهاء الزيارة/);
  f.db.records.pmv2Visits[0].endedAt = null; f.db.records.users[0].isActive = 0;
  await assert.rejects(evidence.assertPmv2ItemActionEvidenceAccess(user, 200, 'write'), /صلاحية/);
});
test('evidence team proof in WHERE preserves ordinary technician scope and administrative review', async () => {
  for (const [role, member, expected] of [['technician', true, true], ['technician', false, false], ['it_member', false, false], ['admin', false, true]]) {
    const f = fixture(role, { member });
    f.db.records.pmv2Visits.push({ id: 7, taskId: 10, endedAt: null });
    f.db.records.pmv2ItemActions.push({ id: 200, taskItemId: 100, visitId: 7, performedById: 1 });
    const service = load('server/pmv2/technician/evidence-access.ts', { ...f.common, '../security/policy': {
      canAccessPmv2TechnicianExecution: roles.canRoleExecutePmv2Technician, canManagePmv2Foundation: roles.canRoleManagePmv2,
    } });
    const run = () => service.assertPmv2ItemActionEvidenceAccess({ id: 1, role }, 200, 'write');
    if (expected) await run(); else await assert.rejects(run(), /صلاحية/);
    if (role === 'admin') {
      f.db.records.users[0].isActive = 0;
      // Preserve the pre-existing review-only management exception; write still rechecks activity.
      await service.assertPmv2ItemActionEvidenceAccess({ id: 1, role }, 200, 'read');
      await assert.rejects(run(), /صلاحية/);
    }
  }
});
test('ready receipts scope all teams only for active global actors and preserve stock blockers', async () => {
  const queue = [{ taskId: 10, taskItemId: 100, teamId: 20, technicians: [{ id: 9 }], canIssue: true },
    { taskId: 10, taskItemId: 101, teamId: 20, technicians: [{ id: 9 }], canIssue: true }];
  for (const role of ['admin', 'technician']) {
    const f = fixture(role); const service = materialService(f); service.listReadyToIssueQueue = async () => queue;
    assert.equal((await service.listTechnicianReadyReceipts(1, 10, 100)).length, role === 'admin' ? 1 : 0);
  }
  const f = fixture('owner'); const service = materialService(f);
  service.listReadyToIssueQueue = async () => [{ ...queue[0], technicians: [], canIssue: false,
    canIssueToAuthorizedExecutor: true, blocker: 'No active ordinary recipient' }];
  const ready = await service.listTechnicianReadyReceipts(1, 10, 100);
  assert.equal(ready[0].canReceive, true); assert.equal(ready[0].blocker, null);
  service.listReadyToIssueQueue = async () => [{ ...queue[0], canIssue: false, canIssueToAuthorizedExecutor: false, blocker: 'Insufficient lot balance' }];
  assert.equal((await service.listTechnicianReadyReceipts(1, 10, 100))[0].canReceive, false);
  f.db.records.users[0].isActive = 0;
  assert.equal((await service.listTechnicianReadyReceipts(1, 10, 100)).length, 0);
});
test('self receipt rechecks actual recipient access and never issues when stock guard blocks', async () => {
  for (const [role, member, canIssue, expected] of [
    ['user', false, true, /المستلم/], ['admin', false, false, /Stock blocked/], ['technician', false, true, /المستلم/],
  ]) {
    const f = fixture(role, { member }); let writes = 0;
    const service = materialService(f, { currentInventoryIssueAdapter: { issueDelivery: async () => { writes++; } } });
    service.listReadyToIssueQueue = async () => [{ routeDecisionActionId: 200, teamId: 20, inventoryId: 70, canIssue,
      canIssueToAuthorizedExecutor: false, blocker: 'Stock blocked', defaultRecipientUserId: 9 }];
    await assert.rejects(service.issueReadyRequirementToSelf(1, { routeDecisionActionId: 200 }), expected);
    assert.equal(writes, 0);
  }
});
test('all execution read/write scopes use the shared actual-account predicate; no permanent membership writes', () => {
  for (const [file, expected] of [
    ['technician/read-service.ts', 4], ['technician/execution-service.ts', 5], ['materials/request-service.ts', 3],
    ['materials/technician-attention-service.ts', 1], ['materials/team-issue-handoff-service.ts', 1],
    ['tickets/handoff-service.ts', 1], ['tracking/timeline-service.ts', 1], ['technician/evidence-access.ts', 1],
  ]) {
    const code = source(`server/pmv2/${file}`);
    assert.equal((code.match(/pmv2ExecutionTeamCondition\([^\n]+(?:pmv2Tasks\.teamId|Number\(row\.teamId\))/g) || []).length, expected, file);
    assert.doesNotMatch(code, /\.(?:innerJoin|leftJoin)\(\s*pmv2ExecutionActor,\s*pmv2ExecutionTeamCondition/, file);
    assert.doesNotMatch(code, /\.insert\(pmv2TeamMembers\)/, file);
  }
  assert.match(source('server/routers/pmv2/technician.ts'), /pmv2TechnicianProcedure/);
  assert.match(source('server/pmv2/security/procedures.ts'), /canAccessPmv2TechnicianExecution\(ctx\.user\.role\)/);
  assert.match(source('server/pmv2/security/policy.ts'), /canRoleExecutePmv2Technician/);
});
