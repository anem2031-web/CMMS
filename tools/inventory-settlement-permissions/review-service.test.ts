import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { createInventorySettlementReviewService } from "../../server/services/inventory/settlement-review";
import * as schema from "../../drizzle/schema";

const dialect = new MySqlDialect();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const warehouse = { id: 1, role: "warehouse" };
const otherWarehouse = { id: 2, role: "warehouse" };
const senior = { id: 4, role: "senior_management" };
const admin = { id: 3, role: "admin" };
const tables = {
  count: "inventory_count_operations",
  items: "inventory_count_items",
  snapshots: "inventory_count_snapshots",
  inventory: "inventory",
  drafts: "inventory_settlement_drafts",
  events: "inventory_settlement_draft_events",
  corrections: "inventory_count_corrections",
  settlements: "inventory_settlements",
  settlementItems: "inventory_settlement_items",
  users: "users",
  warehouses: "warehouses",
  lots: "inventory_lots",
};

function harness() {
  let state: Record<string, any[]> = Object.fromEntries(
    Object.values(tables).map(name => [name, []])
  );
  state[tables.count] = [
    {
      id: 10,
      operationNumber: "CNT-10",
      warehouseId: 7,
      countType: "periodic",
      status: "completed",
      completedAt: "2026-10-19 10:00:00",
      totalItemsCounted: 2,
      totalDiscrepancies: 1,
    },
  ];
  state[tables.items] = [
    {
      id: 100,
      operationId: 10,
      inventoryId: 20,
      lotId: 30,
      systemQuantity: "100.000",
      countedQuantity: "90.000",
      diffQuantity: "-10.000",
      countedById: 1,
      countedAt: "2026-10-19 09:00:00",
      lotNumber: "LOT-30",
      expiryDate: null,
      notes: "original observation",
    },
    {
      id: 101,
      operationId: 10,
      inventoryId: 21,
      lotId: 31,
      systemQuantity: "4.000",
      countedQuantity: "4.000",
      diffQuantity: "0.000",
      countedById: 1,
      countedAt: "2026-10-19 09:00:00",
      lotNumber: "LOT-31",
      expiryDate: null,
      notes: null,
    },
  ];
  state[tables.snapshots] = [
    {
      id: 200,
      operationId: 10,
      inventoryId: 20,
      lotId: 30,
      systemQuantity: "100.000",
      averageCostSnapshot: "3.0000",
      expiryDate: null,
    },
    {
      id: 201,
      operationId: 10,
      inventoryId: 21,
      lotId: 31,
      systemQuantity: "4.000",
      averageCostSnapshot: "2.0000",
      expiryDate: null,
    },
  ];
  state[tables.inventory] = [
    {
      id: 20,
      itemName: "Lamp",
      issueUnit: "piece",
      unit: "piece",
      warehouseId: 7,
      quantity: 100,
    },
    {
      id: 21,
      itemName: "Wire",
      issueUnit: "m",
      unit: "m",
      warehouseId: 7,
      quantity: 4,
    },
  ];
  state[tables.users] = [
    { id: 1, name: "Warehouse" },
    { id: 4, name: "Management" },
  ];
  state[tables.warehouses] = [{ id: 7, nameAr: "Test warehouse" }];
  state[tables.lots] = [
    { id: 30, lotCode: "LOT-30" },
    { id: 31, lotCode: "LOT-31" },
  ];
  const logs: string[] = [];
  let failEvent: string | undefined;
  let postingCount = 0;
  let onInventoryLock: (() => void) | undefined;
  let queue = Promise.resolve();
  const value = (column: any, context: Record<string, any>) =>
    column.table
      ? context[getTableName(column.table)]?.[column.name]
      : { ...context[getTableName(column)] };
  const matches = (condition: any, context: Record<string, any>) => {
    if (!condition) return true;
    const statement = dialect.sqlToQuery(condition);
    let index = 0;
    const predicates = [
      ...statement.sql.matchAll(
        /`([^`]+)`\.`([^`]+)`\s*=\s*(\?|`([^`]+)`\.`([^`]+)`)/g
      ),
    ];
    return predicates.every(match => {
      const left = context[match[1]]?.[match[2]];
      const right =
        match[3] === "?"
          ? statement.params[index++]
          : context[match[4]]?.[match[5]];
      return left === right;
    });
  };
  const db: any = {
    select(selection?: Record<string, any>) {
      if (
        selection &&
        Object.values(selection).some(column => column === undefined)
      ) {
        throw new Error(
          "Read DTO contains an undefined physical schema column"
        );
      }
      let table: string;
      let condition: any;
      let max: number | undefined;
      const joins: any[] = [];
      const chain: any = {
        from(input: any) {
          table = getTableName(input);
          return chain;
        },
        where(input: any) {
          condition = input;
          return chain;
        },
        innerJoin(input: any, on: any) {
          joins.push({ name: getTableName(input), on, inner: true });
          return chain;
        },
        leftJoin(input: any, on: any) {
          joins.push({ name: getTableName(input), on, inner: false });
          return chain;
        },
        orderBy() {
          return chain;
        },
        limit(input: number) {
          max = input;
          return chain;
        },
        for() {
          logs.push(`current:${table}`);
          if (table === tables.inventory && onInventoryLock) {
            const callback = onInventoryLock;
            onInventoryLock = undefined;
            callback();
          }
          return chain;
        },
        then(resolve: any, reject: any) {
          try {
            logs.push(`read:${table}`);
            let contexts = state[table].map(row => ({ [table]: row }));
            for (const join of joins)
              contexts = contexts.flatMap(context => {
                const related = state[join.name]
                  .map(row => ({ ...context, [join.name]: row }))
                  .filter(candidate => matches(join.on, candidate));
                return related.length
                  ? related
                  : join.inner
                    ? []
                    : [{ ...context, [join.name]: null }];
              });
            contexts = contexts.filter(context => matches(condition, context));
            if (max) contexts = contexts.slice(0, max);
            const rows = contexts.map(context =>
              selection
                ? Object.fromEntries(
                    Object.entries(selection).map(([key, column]) => [
                      key,
                      value(column, context),
                    ])
                  )
                : { ...context[table] }
            );
            return Promise.resolve(rows).then(resolve, reject);
          } catch (error) {
            return Promise.reject(error).then(resolve, reject);
          }
        },
      };
      return chain;
    },
    insert(table: any) {
      const name = getTableName(table);
      return {
        values: async (values: any) => {
          if (name === tables.events && values.action === failEvent)
            throw new Error("audit failed");
          const id = Math.max(0, ...state[name].map(row => row.id)) + 1;
          state[name].push({
            id,
            createdAt: "2026-10-19 12:00:00",
            updatedAt: "2026-10-19 12:00:00",
            ...clone(values),
          });
          return [{ insertId: id }];
        },
      };
    },
    update(table: any) {
      const name = getTableName(table);
      return {
        set: (values: any) => ({
          where: async (condition: any) => {
            let affectedRows = 0;
            for (const row of state[name])
              if (matches(condition, { [name]: row })) {
                Object.assign(row, clone(values));
                affectedRows++;
              }
            return [{ affectedRows }];
          },
        }),
      };
    },
    execute: async (query: any) => {
      logs.push(dialect.sqlToQuery(query).sql);
      return [[], []];
    },
    transaction(work: any) {
      const run = queue.then(async () => {
        logs.push("begin");
        const before = clone(state);
        try {
          const result = await work(db);
          logs.push("commit");
          return result;
        } catch (error) {
          state = before;
          logs.push("rollback");
          throw error;
        }
      });
      queue = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    },
  };
  const service = createInventorySettlementReviewService({
    getDb: async () => db,
    applySettlementWithWriter: async (params, tx, draftId) => {
      expect(tx).toBe(db);
      expect(draftId).toBeGreaterThan(0);
      postingCount++;
      const [result] = await tx.insert(schema.inventorySettlements).values({
        sourceCountOperationId: params.sourceCountOperationId,
        status: "applied",
        appliedById: params.appliedById,
      });
      for (const item of params.items) {
        const count = state[tables.items].find(
          row =>
            row.inventoryId === item.inventoryId &&
            row.operationId === params.sourceCountOperationId
        );
        state[tables.inventory].find(
          row => row.id === item.inventoryId
        ).quantity += Number(count.diffQuantity);
      }
      return {
        settlementId: result.insertId,
        settlementNumber: `ADJ-${result.insertId}`,
      };
    },
  });
  const row = () => state[tables.drafts][0];
  const create = () =>
    service.saveDraft(warehouse, {
      sourceCountOperationId: 10,
      reason: "Verify original physical count",
    });
  const submit = () =>
    service.submitDraft(warehouse, {
      draftId: row().id,
      expectedVersion: row().version,
    });
  const approve = () =>
    service.approveDraft(senior, {
      draftId: row().id,
      expectedVersion: row().version,
    });
  return {
    service,
    get state() {
      return state;
    },
    logs,
    row,
    create,
    submit,
    approve,
    get postingCount() {
      return postingCount;
    },
    failAudit(action: string) {
      failEvent = action;
    },
    atInventoryLock(callback: () => void) {
      onInventoryLock = callback;
    },
  };
}

describe("inventory settlement review — in-memory transactions, no live clients/configuration", () => {
  it("reads warehouse and lot context using actual physical schema selections", async () => {
    const h = harness();
    await h.create();
    const detail = await h.service.detail(senior, 1);
    const list = await h.service.list(senior);
    expect(detail.sourceCount.warehouseName).toBe("Test warehouse");
    expect(detail.items[0].lotCode).toBe("LOT-30");
    expect(list[0].warehouseName).toBe("Test warehouse");
  });
  it("preparation, submission, return and resubmission never post stock", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    await h.service.returnDraft(senior, {
      draftId: 1,
      expectedVersion: 2,
      reason: "Please correct the reference first",
    });
    await h.service.saveDraft(warehouse, {
      draftId: 1,
      expectedVersion: 3,
      sourceCountOperationId: 10,
      reason: "Updated reason for the difference",
      reference: "REF-1",
    });
    await h.submit();
    expect(h.row().status).toBe("pending_review");
    expect(h.row().version).toBe(5);
    expect(h.state[tables.inventory][0].quantity).toBe(100);
    expect(h.postingCount).toBe(0);
    expect(h.state[tables.events].map(row => row.action)).toEqual([
      "created",
      "submitted",
      "returned",
      "edited",
      "submitted",
    ]);
  });
  it("approval posts through the same writer once, and exact/concurrent retries are idempotent", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    const input = { draftId: 1, expectedVersion: 2 };
    const [first, retry] = await Promise.all([
      h.service.approveDraft(senior, input),
      h.service.approveDraft(senior, input),
    ]);
    expect(first.settlementId).toBe(1);
    expect(retry.alreadyApplied).toBe(true);
    expect(h.postingCount).toBe(1);
    expect(h.state[tables.inventory][0].quantity).toBe(90);
    expect(h.row().approvedById).toBe(4);
    expect(h.row().status).toBe("applied");
    const begin = h.logs.lastIndexOf("begin");
    expect(h.logs[begin + 1]).toContain("inventory_count_operations");
    expect(h.logs[begin + 1]).toContain("FOR UPDATE");
  });
  it("rolls back the physical posting and draft when its immutable audit fails", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    h.failAudit("applied");
    await expect(h.approve()).rejects.toThrow("audit failed");
    expect(h.state[tables.inventory][0].quantity).toBe(100);
    expect(h.state[tables.settlements]).toHaveLength(0);
    expect(h.row().status).toBe("pending_review");
    expect(h.row().version).toBe(2);
  });
  it.each([
    "technician",
    "delegate",
    "observer",
    "accountant",
    "food_warehouse_assistant",
    "executive_director",
    "user",
  ])("denies unassigned role %s at the service boundary", async role => {
    const h = harness();
    await expect(h.service.list({ id: 8, role })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      h.service.saveDraft(
        { id: 8, role },
        { sourceCountOperationId: 10, reason: "Cannot prepare this count" }
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(h.logs).toHaveLength(0);
  });
  it("allows senior review/read but denies preparation; warehouse cannot approve or return", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    await expect(
      h.service.saveDraft(senior, {
        sourceCountOperationId: 10,
        reason: "not the preparation role",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      h.service.approveDraft(warehouse, { draftId: 1, expectedVersion: 2 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      h.service.returnDraft(warehouse, {
        draftId: 1,
        expectedVersion: 2,
        reason: "warehouse cannot review",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await h.service.list(senior)).length).toBe(1);
  });
  it("denies self approval even for owner/admin and last submitter", async () => {
    const h = harness();
    await h.service.saveDraft(admin, {
      sourceCountOperationId: 10,
      reason: "Prepared by administrator",
    });
    await h.service.submitDraft(admin, { draftId: 1, expectedVersion: 1 });
    await expect(
      h.service.approveDraft(admin, { draftId: 1, expectedVersion: 2 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await h.approve();
    expect(h.postingCount).toBe(1);
  });
  it("denies approval to an administrator who edited another user's draft", async () => {
    const h = harness();
    await h.create();
    await h.service.saveDraft(admin, {
      draftId: 1,
      expectedVersion: 1,
      sourceCountOperationId: 10,
      reason: "Administrator contributed revised data",
    });
    await h.submit();
    await expect(
      h.service.approveDraft(admin, { draftId: 1, expectedVersion: 3 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await h.approve();
    expect(h.postingCount).toBe(1);
  });
  it("denies approval to an administrator who corrected count data, while the correction requester can review", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    await h.service.requestCountCorrection(senior, {
      draftId: 1,
      expectedVersion: 2,
      reason: "Correct original clerical error",
      countItemIds: [100],
    });
    await h.service.saveCountCorrection(admin, {
      requestId: 1,
      reason: "Administrator corrected the old entry",
      items: [{ countItemId: 100, countedQuantity: 95 }],
    });
    await h.submit();
    await expect(
      h.service.approveDraft(admin, {
        draftId: 1,
        expectedVersion: h.row().version,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await h.approve();
    expect(h.row().approvedById).toBe(4);
  });
  it("prevents editing or submitting another warehouse user's draft", async () => {
    const h = harness();
    await h.create();
    await expect(
      h.service.submitDraft(otherWarehouse, { draftId: 1, expectedVersion: 1 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      h.service.saveDraft(otherWarehouse, {
        draftId: 1,
        expectedVersion: 1,
        sourceCountOperationId: 10,
        reason: "Cannot edit foreign draft",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects stale versions and duplicate drafts", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    await expect(
      h.service.returnDraft(senior, {
        draftId: 1,
        expectedVersion: 1,
        reason: "stale reviewer version",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(h.create()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(h.state[tables.events]).toHaveLength(2);
  });
  it("freezes submitted facts and rejects changed source or invented corrections", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    const snapshot = clone(h.row().submittedSnapshot);
    h.state[tables.items][0].countedQuantity = "95.000";
    h.state[tables.items][0].diffQuantity = "-5.000";
    await expect(h.approve()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(h.row().submittedSnapshot).toEqual(snapshot);
    await expect(
      h.service.requestCountCorrection(senior, {
        draftId: 1,
        expectedVersion: 2,
        reason: "A requested correction reason",
        countItemIds: [999],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("allows renaming display metadata without invalidating reviewed quantities", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    h.state[tables.inventory][0].itemName = "Translated lamp";
    h.state[tables.inventory][0].averageCost = "99.0000";
    await h.approve();
    expect(h.row().status).toBe("applied");
  });
  it("opening-balance review shows current writer cost and rejects a changed cost before approval", async () => {
    const h = harness();
    h.state[tables.count][0].countType = "opening_balance";
    h.state[tables.snapshots] = [];
    for (const row of h.state[tables.items]) {
      row.systemQuantity = "0.000";
      row.diffQuantity = row.countedQuantity;
      row.lotId = null;
    }
    for (const row of h.state[tables.inventory]) {
      row.quantity = 0;
      row.averageCost = "3.0000";
    }
    await h.create();
    await h.submit();
    const detail = await h.service.detail(senior, 1);
    expect(detail.items[0].averageCostSnapshot).toBe(3);
    expect(detail.items[0].diffValue).toBe(270);
    h.state[tables.inventory][0].averageCost = "4.0000";
    await expect(h.approve()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(h.postingCount).toBe(0);
  });
  it("checks current opening cost after the inventory lock, including a change while approval waits", async () => {
    const h = harness();
    h.state[tables.count][0].countType = "opening_balance";
    h.state[tables.snapshots] = [];
    for (const row of h.state[tables.items]) {
      row.systemQuantity = "0.000";
      row.diffQuantity = row.countedQuantity;
      row.lotId = null;
    }
    for (const row of h.state[tables.inventory]) {
      row.quantity = 0;
      row.averageCost = "3.0000";
    }
    await h.create();
    await h.submit();
    h.atInventoryLock(() => {
      h.state[tables.inventory][0].averageCost = "4.0000";
    });
    await expect(h.approve()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(h.postingCount).toBe(0);
    expect(h.logs).toContain("current:inventory");
  });
  it("does not invent historical cost when a periodic discrepancy has no snapshot", async () => {
    const h = harness();
    h.state[tables.snapshots] = [];
    await expect(h.create()).rejects.toThrow("لقطة تكلفة");
    expect(h.state[tables.drafts]).toHaveLength(0);
  });
  it("links a new finalized count to its prior applied settlement without modifying the prior record", async () => {
    const h = harness();
    const previous = {
      id: 50,
      sourceCountOperationId: 9,
      status: "applied",
      reason: "Original applied settlement",
    };
    h.state[tables.settlements].push(previous);
    h.state[tables.settlementItems].push({
      id: 51,
      settlementId: 50,
      inventoryId: 20,
      lotId: 30,
    });
    // A full count may include unrelated rows with zero difference: these are not corrective posting lines.
    await h.service.saveDraft(warehouse, {
      sourceCountOperationId: 10,
      correctsSettlementId: 50,
      reason: "New observation correcting old settlement",
    });
    await h.submit();
    await h.approve();
    expect(h.row().correctsSettlementId).toBe(50);
    expect(h.state[tables.settlements][0]).toEqual(previous);
    expect(
      h.state[tables.events].find(row => row.action === "applied").payload
        .correctsSettlementId
    ).toBe(50);
  });
  it("rejects links to an unrelated prior settlement or additional unrelated variances", async () => {
    const h = harness();
    h.state[tables.settlements].push({
      id: 50,
      sourceCountOperationId: 9,
      status: "applied",
    });
    h.state[tables.settlementItems].push({
      id: 51,
      settlementId: 50,
      inventoryId: 21,
      lotId: 31,
    });
    await expect(
      h.service.saveDraft(warehouse, {
        sourceCountOperationId: 10,
        correctsSettlementId: 50,
        reason: "Cannot link unrelated settlement",
      })
    ).rejects.toThrow("دفعات التسوية السابقة");
    h.state[tables.settlementItems][0].inventoryId = 20;
    h.state[tables.settlementItems][0].lotId = 30;
    h.state[tables.items][1].countedQuantity = "3.000";
    h.state[tables.items][1].diffQuantity = "-1.000";
    await expect(
      h.service.saveDraft(warehouse, {
        sourceCountOperationId: 10,
        correctsSettlementId: 50,
        reason: "Cannot hide unrelated variance",
      })
    ).rejects.toThrow("دفعات التسوية السابقة");
  });
  it("corrects only reviewer-authorized rows, preserving original quantity/cost/timestamp audit", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    const originalSnapshot = clone(h.state[tables.snapshots]);
    const completedAt = h.state[tables.count][0].completedAt;
    await h.service.requestCountCorrection(senior, {
      draftId: 1,
      expectedVersion: 2,
      reason: "Original entry should have been 95",
      countItemIds: [100],
    });
    expect(h.row().status).toBe("returned");
    await expect(h.submit()).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      h.service.saveCountCorrection(warehouse, {
        requestId: 1,
        reason: "Changing unauthorized second row",
        items: [{ countItemId: 101, countedQuantity: 3 }],
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await h.service.saveCountCorrection(warehouse, {
      requestId: 1,
      reason: "Clerical correction, original count was95",
      items: [{ countItemId: 100, countedQuantity: 95 }],
    });
    expect(h.state[tables.items][0].countedQuantity).toBe("95.000");
    expect(h.state[tables.items][0].diffQuantity).toBe("-5.000");
    expect(h.state[tables.snapshots]).toEqual(originalSnapshot);
    expect(h.state[tables.count][0].completedAt).toBe(completedAt);
    expect(h.state[tables.count][0].status).toBe("completed");
    expect(h.state[tables.inventory][0].quantity).toBe(100);
    const correction = h.state[tables.corrections][0];
    expect(correction.beforeSnapshot.items[0].countedQuantity).toBe(90);
    expect(correction.afterSnapshot.items[0].countedQuantity).toBe(95);
    await h.submit();
    await h.approve();
    expect(h.state[tables.inventory][0].quantity).toBe(95);
  });
  it("rolls back count correction if its audit cannot persist", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    await h.service.requestCountCorrection(senior, {
      draftId: 1,
      expectedVersion: 2,
      reason: "Correct original clerical error",
      countItemIds: [100],
    });
    h.failAudit("count_corrected");
    await expect(
      h.service.saveCountCorrection(warehouse, {
        requestId: 1,
        reason: "Correct original quantity90to95",
        items: [{ countItemId: 100, countedQuantity: 95 }],
      })
    ).rejects.toThrow("audit failed");
    expect(h.state[tables.items][0].countedQuantity).toBe("90.000");
    expect(h.state[tables.corrections][0].status).toBe("pending");
  });
  it("closes a corrected zero-difference review with no stock posting or empty settlement", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    await h.service.requestCountCorrection(senior, {
      draftId: 1,
      expectedVersion: 2,
      reason: "Correct count entry from90to100",
      countItemIds: [100],
    });
    await h.service.saveCountCorrection(warehouse, {
      requestId: 1,
      reason: "Original physical countwas100",
      items: [{ countItemId: 100, countedQuantity: 100 }],
    });
    await h.submit();
    const result = await h.approve();
    expect(result.noAdjustment).toBe(true);
    expect(h.row().status).toBe("no_adjustment");
    expect(h.postingCount).toBe(0);
    expect(h.state[tables.settlements]).toHaveLength(0);
    expect(h.state[tables.inventory][0].quantity).toBe(100);
  });
  it("rejects corrections and reviews against any count already posted", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    h.state[tables.settlements].push({
      id: 99,
      sourceCountOperationId: 10,
      status: "applied",
    });
    await expect(
      h.service.requestCountCorrection(senior, {
        draftId: 1,
        expectedVersion: 2,
        reason: "Cannot change posted observation",
        countItemIds: [100],
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(h.approve()).rejects.toMatchObject({ code: "CONFLICT" });
  });
  it.each([-1, Infinity, NaN, 1.2345, 1000000000])(
    "rejects invalid corrected quantity %s",
    async countedQuantity => {
      const h = harness();
      await expect(
        h.service.saveCountCorrection(warehouse, {
          requestId: 1,
          reason: "Invalid corrected quantity",
          items: [{ countItemId: 100, countedQuantity }],
        })
      ).rejects.toThrow("الكمية");
      expect(h.logs).toHaveLength(0);
    }
  );
  it("rejects incomplete/empty source counts", async () => {
    const h = harness();
    h.state[tables.count][0].status = "in_progress";
    await expect(h.create()).rejects.toThrow("حفظ الجرد");
    h.state[tables.count][0].status = "completed";
    h.state[tables.items] = [];
    await expect(h.create()).rejects.toThrow("فارغ");
  });
  it("keeps a submitted correction trace visible through the real detail reader", async () => {
    const h = harness();
    await h.create();
    await h.submit();
    await h.service.requestCountCorrection(senior, {
      draftId: 1,
      expectedVersion: 2,
      reason: "Please check the original transcription",
      countItemIds: [100],
    });
    const result = await h.service.detail(warehouse, 1);
    expect(result.pendingCorrection.allowedCountItemIds).toEqual([100]);
    expect(result.history).toHaveLength(3);
    expect(result.items[0].diffValue).toBe(-30);
    expect(result.draft.submittedSnapshot.items[0].countedQuantity).toBe(90);
  });
});
