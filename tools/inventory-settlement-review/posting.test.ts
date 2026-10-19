import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { and, eq, getTableName, isNull, sql } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";
import * as schema from "../../drizzle/schema";
import { calculateInventoryValue, calculateMovementTotal, normalizeInventoryQuantity, roundTo } from "../../server/_core/inventory-costing";

// Evaluate only the real posting functions. Importing invoice-drafts itself would
// load the application's database/environment modules, which are forbidden here.
function declaration(file: string, name: string) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const node = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  if (!node) throw new Error(`Missing real posting function: ${name}`);
  return node.getText(source).replace(/^export\s+/, "");
}
const postingFile = "server/_core/db/invoice-drafts.ts";
const postingFunctions = [
  declaration(postingFile, "generateSettlementNumberWith"),
  declaration(postingFile, "applySettlement"),
  declaration(postingFile, "withLockedMutableCount"),
  declaration(postingFile, "recordCountItem"),
  declaration(postingFile, "completeCountOperation"),
  declaration("server/_core/inventory-lots.ts", "applyInventoryLotCountAdjustment"),
].join("\n");
type Row = Record<string, any>;
type Trace = { action: string; table?: string; id?: number; locking?: boolean };
const dialect = new MySqlDialect();
const same = (left: any, right: any) => left === right || (left != null && right != null && String(left) !== "" && String(right) !== "" && Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Number(left) === Number(right));

function whereMatches(condition: any, row: Row) {
  if (!condition) return true;
  const query = dialect.sqlToQuery(condition);
  let index = 0;
  for (const match of query.sql.matchAll(/`[^`]+`\.`([^`]+)`\s*=\s*\?/g)) {
    if (!same(row[match[1]], query.params[index++])) return false;
  }
  for (const match of query.sql.matchAll(/`[^`]+`\.`([^`]+)`\s+is\s+null/gi)) {
    if (row[match[1]] != null) return false;
  }
  return true;
}

class FakeWriter {
  tables: Record<string, Row[]>;
  readonly trace: Trace[];
  readonly locks = new Set<string>();
  onCountLock?: (writer: FakeWriter, operationId: number) => void;
  onInventoryLock?: (writer: FakeWriter, inventoryId: number) => void;
  failOnInsert?: string;
  transaction = vi.fn(async <T>(work: (tx: FakeWriter) => Promise<T>): Promise<T> => {
    const tx = new FakeWriter(structuredClone(this.tables), this.trace);
    tx.onCountLock = this.onCountLock;
    tx.onInventoryLock = this.onInventoryLock;
    tx.failOnInsert = this.failOnInsert;
    this.trace.push({ action: "begin" });
    try {
      const result = await work(tx);
      this.tables = tx.tables;
      this.trace.push({ action: "commit" });
      return result;
    } catch (error) {
      this.trace.push({ action: "rollback" });
      throw error;
    }
  });
  constructor(tables: Record<string, Row[]> = {}, trace: Trace[] = []) {
    this.tables = tables;
    this.trace = trace;
  }
  rows(table: any) { return this.tables[getTableName(table)] ??= []; }
  async execute(statement: any) {
    const query = dialect.sqlToQuery(statement);
    const match = query.sql.match(/FROM\s+`?(\w+)`?\s+WHERE/i);
    if (!match || !/FOR UPDATE/i.test(query.sql)) throw new Error(`Unexpected raw SQL in posting fixture: ${query.sql}`);
    const table = match[1], id = Number(query.params[0]);
    if (table === "inventory_count_operations" && !this.locks.has(`${table}:${id}`)) this.onCountLock?.(this, id);
    if (table === "inventory" && !this.locks.has(`${table}:${id}`)) this.onInventoryLock?.(this, id);
    this.locks.add(`${table}:${id}`);
    this.trace.push({ action: "lock", table, id });
    return [[{ id }], []];
  }
  select(fields?: Record<string, any>) {
    let table: any, condition: any, take = Infinity, locking = false;
    const read = async () => {
      const name = getTableName(table);
      const selected = this.rows(table).filter(row => whereMatches(condition, row)).slice(0, take);
      this.trace.push({ action: "read", table: name, id: selected[0]?.id, locking });
      if (name === "inventory") {
        for (const row of selected) {
          if (!this.locks.has(`${name}:${row.id}`)) throw new Error("Inventory value was read before its row lock");
        }
      }
      if (fields?.total) return [{ total: selected.reduce((sum, row) => sum + Number(row.quantity), 0) }];
      return selected.map(row => fields
        ? Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column.name]]))
        : { ...row });
    };
    const query: any = {
      from: (value: any) => { table = value; return query; },
      where: (value: any) => { condition = value; return query; },
      limit: (value: number) => { take = value; return query; },
      for: () => { locking = true; return query; },
      then: (resolve: any, reject: any) => read().then(resolve, reject),
    };
    return query;
  }
  insert(table: any) {
    return { values: async (value: Row) => {
      const name = getTableName(table);
      if (this.failOnInsert === name) throw new Error(`Fixture ${name} write failed`);
      const rows = this.rows(table);
      const id = Math.max(0, ...rows.map(row => Number(row.id))) + 1;
      rows.push({ ...value, id });
      this.trace.push({ action: "insert", table: name, id });
      return [{ insertId: id, affectedRows: 1 }];
    } };
  }
  update(table: any) {
    return { set: (values: Row) => ({ where: async (condition: any) => {
      const rows = this.rows(table).filter(row => whereMatches(condition, row));
      for (const row of rows) Object.assign(row, values);
      this.trace.push({ action: "update", table: getTableName(table), id: rows[0]?.id });
      return [{ affectedRows: rows.length }];
    } }) };
  }
}

function fixture(lots = false) {
  const writer = new FakeWriter({
    inventory: [{ id: 1, quantity: 10, averageCost: "10.0000", totalCostValue: "100.00", itemName: "Fixture", warehouseId: 1 }],
    inventory_count_operations: [{ id: 7, countType: "periodic", status: "completed", warehouseId: 1 }],
    inventory_count_items: [{ id: 71, operationId: 7, inventoryId: 1, lotId: lots ? 11 : null, systemQuantity: lots ? "5.000" : "10.000", countedQuantity: lots ? "7.000" : "12.000", diffQuantity: "2.000" }],
    inventory_count_snapshots: [{ id: 72, operationId: 7, inventoryId: 1, lotId: lots ? 11 : null, systemQuantity: lots ? "5.000" : "10.000", averageCostSnapshot: "3.0000" }],
    inventory_lots: [{ id: 11, remainingQuantity: "5.000" }, { id: 12, remainingQuantity: "5.000" }],
    inventory_lot_balances: [{ id: 81, inventoryId: 1, lotId: 11, quantity: "5.000" }, { id: 82, inventoryId: 1, lotId: 12, quantity: "5.000" }],
  });
  const getDb = vi.fn(async () => writer);
  const context = {
    ...schema, and, eq, isNull, sql,
    calculateInventoryValue, calculateMovementTotal, normalizeInventoryQuantity, roundTo,
    getDb, isInventoryLotsEnabled: () => lots,
    createOpeningBalanceInventoryLot: () => { throw new Error("Opening balance is outside this fixture"); },
  };
  const code = ts.transpileModule(`${postingFunctions}\n;({ applySettlement, withLockedMutableCount, recordCountItem, completeCountOperation });`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const actual = vm.runInNewContext(code, context);
  return { writer, getDb, ...actual };
}
const request = (patch: Row = {}) => ({
  sourceType: "from_count", sourceCountOperationId: 7, reason: "Documented fixture count variance", appliedById: 9,
  items: [{ inventoryId: 1, afterQuantity: 12 }], ...patch,
});

describe("Actual settlement posting reused by the approval transaction", () => {
  it("uses the supplied transaction without importing a database client or committing independently", async () => {
    const { writer, getDb, applySettlement } = fixture();
    const result = await applySettlement(request(), { writer });
    expect(result.settlementId).toBe(1);
    expect(getDb).not.toHaveBeenCalled();
    expect(writer.transaction).not.toHaveBeenCalled();
    expect(writer.rows(schema.inventorySettlementItems)[0]).toMatchObject({ unitCostUsed: "3.0000", adjustmentValue: "6.00" });
  });
  it("retains a single autonomous transaction for the existing direct posting path", async () => {
    const { writer, getDb, applySettlement } = fixture();
    await applySettlement(request());
    expect(getDb).toHaveBeenCalledOnce();
    expect(writer.transaction).toHaveBeenCalledOnce();
    expect(writer.trace.filter(row => row.action === "commit")).toHaveLength(1);
  });
  it("rolls all posting effects back if the outer approval/audit fails afterward", async () => {
    const { writer, applySettlement } = fixture();
    writer.tables.inventory_settlement_drafts = [{ id: 13, sourceCountOperationId: 7, status: "pending_review" }];
    await expect(writer.transaction(async tx => {
      const posted = await applySettlement(request(), { writer: tx, reviewDraftId: 13 });
      await tx.update(schema.inventorySettlementDrafts).set({ status: "applied", appliedSettlementId: posted.settlementId }).where(eq(schema.inventorySettlementDrafts.id, 13));
      throw new Error("Fixture approval audit failed");
    })).rejects.toThrow("Fixture approval audit failed");
    expect(writer.tables.inventory[0]).toMatchObject({ quantity: 10, totalCostValue: "100.00" });
    expect(writer.rows(schema.inventorySettlements)).toHaveLength(0);
    expect(writer.rows(schema.inventorySettlementItems)).toHaveLength(0);
    expect(writer.rows(schema.inventoryTransactions)).toHaveLength(0);
    expect(writer.tables.inventory_settlement_drafts[0].status).toBe("pending_review");
    expect(writer.transaction).toHaveBeenCalledOnce();
  });
  it("also rolls back a posting write failure before the approval completes", async () => {
    const { writer, applySettlement } = fixture();
    writer.failOnInsert = "inventory_transactions";
    await expect(applySettlement(request())).rejects.toThrow("write failed");
    expect(writer.tables.inventory[0].quantity).toBe(10);
    expect(writer.rows(schema.inventorySettlements)).toHaveLength(0);
    expect(writer.rows(schema.inventorySettlementItems)).toHaveLength(0);
  });
});

describe("Direct posting cannot bypass a prepared review or correction", () => {
  it.each(["draft", "pending_review", "returned"])("rejects an existing %s draft before numbering or stock writes", async status => {
    const { writer, applySettlement } = fixture();
    writer.tables.inventory_settlement_drafts = [{ id: 13, sourceCountOperationId: 7, status }];
    await expect(applySettlement(request(), { writer })).rejects.toThrow("مسودة تسوية");
    expect(writer.rows(schema.inventorySettlements)).toHaveLength(0);
    expect(writer.rows(schema.inventorySettlementNumberCounter)).toHaveLength(0);
    expect(writer.trace[1]).toMatchObject({ action: "lock", table: "inventory_count_operations", id: 7 });
  });
  it("allows only the exact server-authorized pending review ID", async () => {
    const { writer, applySettlement } = fixture();
    writer.tables.inventory_settlement_drafts = [{ id: 13, sourceCountOperationId: 7, status: "pending_review" }];
    await expect(applySettlement(request(), { writer, reviewDraftId: 99 })).rejects.toThrow();
    await expect(applySettlement(request(), { writer, reviewDraftId: 13 })).resolves.toMatchObject({ settlementId: 1 });
  });
  it.each([undefined, 13])("rejects pending count corrections even with reviewed draft ID %s", async reviewDraftId => {
    const { writer, applySettlement } = fixture();
    if (reviewDraftId) writer.tables.inventory_settlement_drafts = [{ id: 13, sourceCountOperationId: 7, status: "pending_review" }];
    writer.tables.inventory_count_corrections = [{ id: 21, operationId: 7, status: "pending" }];
    await expect(applySettlement(request(), { writer, reviewDraftId })).rejects.toThrow("تصحيح");
    expect(writer.rows(schema.inventorySettlements)).toHaveLength(0);
  });
  it("rejects duplicate submitted inventory/lot identities before any transaction starts", async () => {
    const { writer, applySettlement } = fixture(true);
    await expect(applySettlement(request({ items: [{ inventoryId: 1, lotId: 11, afterQuantity: 7 }, { inventoryId: 1, lotId: 11, afterQuantity: 7 }] }))).rejects.toThrow("تكرار");
    expect(writer.transaction).not.toHaveBeenCalled();
    expect(writer.trace).toHaveLength(0);
  });
  it("retains the existing rejection of a second applied settlement", async () => {
    const { writer, applySettlement } = fixture();
    await applySettlement(request(), { writer });
    await expect(applySettlement(request(), { writer })).rejects.toThrow("مسبقاً");
    expect(writer.rows(schema.inventorySettlements)).toHaveLength(1);
  });
});

describe("Valuation reads follow inventory locks and retain the existing cost basis", () => {
  it("executes the real Lot adjustment and preserves other lots plus frozen snapshot cost", async () => {
    const { writer, applySettlement } = fixture(true);
    await applySettlement(request({ items: [{ inventoryId: 1, lotId: 11, afterQuantity: 999 }] }), { writer });
    expect(writer.tables.inventory[0]).toMatchObject({ quantity: 12, totalCostValue: "106.00", averageCost: "8.8333" });
    expect(writer.tables.inventory_lot_balances.map(row => row.quantity)).toEqual(["7.000", "5.000"]);
    expect(writer.tables.inventory_lots.map(row => row.remainingQuantity)).toEqual(["7.000", "5.000"]);
    expect(writer.rows(schema.inventorySettlementItems)[0]).toMatchObject({ beforeQuantity: "5.000", afterQuantity: "7.000", diffQuantity: "2.000", unitCostUsed: "3.0000", adjustmentValue: "6.00" });
    expect(writer.rows(schema.inventoryTransactions)[0]).toMatchObject({ quantity: 2, unitCost: "3.0000", totalCost: "6.00", transactionType: "adjustment" });
  });
  it("does not lose receipt value committed before the aggregate lock is acquired", async () => {
    const { writer, applySettlement } = fixture(true);
    writer.onInventoryLock = tx => {
      Object.assign(tx.tables.inventory[0], { quantity: 12, totalCostValue: "140.00", averageCost: "11.6667" });
      tx.tables.inventory_lot_balances[1].quantity = "7.000";
      tx.tables.inventory_lots[1].remainingQuantity = "7.000";
    };
    await applySettlement(request({ items: [{ inventoryId: 1, lotId: 11, afterQuantity: 7 }] }));
    expect(writer.tables.inventory[0]).toMatchObject({ quantity: 14, totalCostValue: "146.00", averageCost: "10.4286" });
    const lockIndex = writer.trace.findIndex(row => row.action === "lock" && row.table === "inventory");
    const valueReadIndex = writer.trace.findIndex(row => row.action === "read" && row.table === "inventory");
    expect(lockIndex).toBeLessThan(valueReadIndex);
    expect(writer.trace[valueReadIndex].locking).toBe(true);
  });
  it("locks aggregates in canonical order even when submitted items are reversed", async () => {
    const { writer, applySettlement } = fixture();
    writer.tables.inventory.push({ id: 2, quantity: 5, averageCost: "2.0000", totalCostValue: "10.00" });
    await applySettlement(request({ sourceType: "manual", sourceCountOperationId: undefined, items: [{ inventoryId: 2, afterQuantity: 6 }, { inventoryId: 1, afterQuantity: 11 }] }));
    expect(writer.trace.filter(row => row.action === "lock" && row.table === "inventory").map(row => row.id)).toEqual([1, 2]);
    expect(writer.tables.inventory[0]).toMatchObject({ quantity: 11, totalCostValue: "110.00", averageCost: "10.0000" });
    expect(writer.tables.inventory[1]).toMatchObject({ quantity: 6, totalCostValue: "12.00", averageCost: "2.0000" });
  });
  it("keeps manual aggregate settlement blocked while lots are enabled", async () => {
    const { writer, applySettlement } = fixture(true);
    await expect(applySettlement(request({ sourceType: "manual", sourceCountOperationId: undefined }))).rejects.toThrow("موقوفة");
    expect(writer.transaction).not.toHaveBeenCalled();
  });
});

describe("Existing count writers serialize with finalization and financial review", () => {
  it("locks the count before its authoritative state read and supplies the same writer", async () => {
    const { writer, withLockedMutableCount } = fixture();
    writer.tables.inventory_count_operations[0].status = "in_progress";
    const work = vi.fn(async (tx: FakeWriter) => {
      expect(tx).not.toBe(writer);
      expect(tx.locks.has("inventory_count_operations:7")).toBe(true);
      await tx.update(schema.inventoryCountItems).set({ notes: "Saved under the count lock" }).where(eq(schema.inventoryCountItems.id, 71));
      return "saved";
    });
    await expect(withLockedMutableCount(7, work)).resolves.toBe("saved");
    expect(work).toHaveBeenCalledOnce();
    const lock = writer.trace.findIndex(row => row.action === "lock" && row.table === "inventory_count_operations");
    const stateRead = writer.trace.findIndex(row => row.action === "read" && row.table === "inventory_count_operations");
    expect(lock).toBeLessThan(stateRead);
    expect(writer.trace[stateRead].locking).toBe(true);
    expect(writer.tables.inventory_count_items[0].notes).toBe("Saved under the count lock");
    expect(writer.transaction).toHaveBeenCalledOnce();
  });
  it.each(["completed", "cancelled"])("rejects a currently %s count without executing the mutation", async status => {
    const { writer, withLockedMutableCount } = fixture();
    writer.tables.inventory_count_operations[0].status = status;
    const work = vi.fn();
    await expect(withLockedMutableCount(7, work)).rejects.toThrow("لا يمكن التعديل");
    expect(work).not.toHaveBeenCalled();
    expect(writer.trace.some(row => row.action === "update")).toBe(false);
  });
  it("rejects an absent count without executing a mutation", async () => {
    const { writer, withLockedMutableCount } = fixture();
    const work = vi.fn();
    await expect(withLockedMutableCount(700, work)).rejects.toThrow("غير موجودة");
    expect(work).not.toHaveBeenCalled();
    expect(writer.trace.at(-1)?.action).toBe("rollback");
  });
  it("rejects an old record request when finalization finishes while it waits for the count lock", async () => {
    const { writer, recordCountItem } = fixture();
    writer.tables.inventory_count_operations[0].status = "in_progress";
    writer.onCountLock = tx => {
      // Simulate another transaction committing finalization immediately before
      // this request obtains its lock, after the record request's outer item peek.
      Object.assign(writer.tables.inventory_count_operations[0], { status: "completed", totalDiscrepancies: 1 });
      Object.assign(tx.tables.inventory_count_operations[0], writer.tables.inventory_count_operations[0]);
    };
    await expect(recordCountItem({ countItemId: 71, countedQuantity: 900, countedById: 6 })).rejects.toThrow("لا يمكن التعديل");
    expect(writer.tables.inventory_count_items[0].countedQuantity).toBe("12.000");
    expect(writer.tables.inventory_count_operations[0].status).toBe("completed");
    expect(writer.trace.some(row => row.action === "update")).toBe(false);
    const peek = writer.trace.findIndex(row => row.action === "read" && row.table === "inventory_count_items");
    const lock = writer.trace.findIndex(row => row.action === "lock" && row.table === "inventory_count_operations");
    expect(peek).toBeLessThan(lock);
  });
  it("rereads the count item under the lock instead of calculating from the old item peek", async () => {
    const { writer, recordCountItem } = fixture();
    writer.tables.inventory_count_operations[0].status = "in_progress";
    writer.onCountLock = tx => { tx.tables.inventory_count_items[0].systemQuantity = "11.000"; };
    await expect(recordCountItem({ countItemId: 71, countedQuantity: 13, countedById: 6, notes: "Current row used" })).resolves.toMatchObject({ diffQuantity: 2 });
    expect(writer.tables.inventory_count_items[0]).toMatchObject({ countedQuantity: "13.000", diffQuantity: "2.000", countedById: 6, notes: "Current row used" });
    const itemReads = writer.trace.filter(row => row.action === "read" && row.table === "inventory_count_items");
    expect(itemReads.map(row => row.locking)).toEqual([false, true]);
    expect(writer.rows(schema.inventoryCountSnapshots)[0]).toMatchObject({ systemQuantity: "10.000", averageCostSnapshot: "3.0000" });
  });
  it("finalizes using the current items under the same lock without posting inventory", async () => {
    const { writer, completeCountOperation, recordCountItem } = fixture();
    writer.tables.inventory_count_operations[0].status = "in_progress";
    writer.tables.inventory_count_items.push({ id: 73, operationId: 7, inventoryId: 2, systemQuantity: "3.000", countedQuantity: null, diffQuantity: null });
    writer.onCountLock = tx => {
      // A previously committed count-item write must be included in the totals.
      Object.assign(tx.tables.inventory_count_items[1], { countedQuantity: "3.000", diffQuantity: "0.000" });
    };
    await expect(completeCountOperation(7)).resolves.toEqual({ totalItemsCounted: 2, totalDiscrepancies: 1 });
    expect(writer.tables.inventory_count_operations[0]).toMatchObject({ status: "completed", totalItemsCounted: 2, totalDiscrepancies: 1 });
    const lock = writer.trace.findIndex(row => row.action === "lock" && row.table === "inventory_count_operations");
    const itemsRead = writer.trace.findIndex(row => row.action === "read" && row.table === "inventory_count_items");
    expect(lock).toBeLessThan(itemsRead);
    expect(writer.tables.inventory[0]).toMatchObject({ quantity: 10, totalCostValue: "100.00" });
    expect(writer.rows(schema.inventorySettlements)).toHaveLength(0);
    expect(writer.rows(schema.inventoryTransactions)).toHaveLength(0);
    await expect(recordCountItem({ countItemId: 71, countedQuantity: 1, countedById: 6 })).rejects.toThrow("لا يمكن التعديل");
    await expect(completeCountOperation(7)).rejects.toThrow("لا يمكن التعديل");
    expect(writer.tables.inventory_count_items[0].countedQuantity).toBe("12.000");
  });
});
