import { describe, expect, it } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import { loadImprovementExecutionProgress } from "../services/improvement-ideas/progress";
import { improvementExecutionSummary } from "../services/improvement-ideas/execution";

const root = { id: 10, parentTicketId: null, ticketNumber: "MT-10", title: "Root", actualCost: "999", status: "closed" };
const child = { ...root, id: 11, parentTicketId: 10, ticketNumber: "MT-11", actualCost: "15" };
const idea = { id: 1, linkedTicketId: 10, executionTrackingVersion: 1, estimatedMaterialsCost: "20" };
function fixture(tickets = [root, child], tasks: any[] = []) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const tx = { execute: async (query: SQL) => {
    const statement = new MySqlDialect().sqlToQuery(query); queries.push(statement);
    if (statement.sql.includes(" FROM tickets WHERE")) {
      const children = statement.sql.includes("WHERE parentTicketId IN");
      return [tickets.filter(row => statement.params.includes(children ? row.parentTicketId : row.id)), []];
    }
    if (statement.sql.includes(" FROM ticket_tasks")) return [tasks.filter(task => statement.params.includes(task.ticketId)), []];
    if (statement.sql.includes(" FROM purchase_orders") || statement.sql.includes(" FROM inventory_transactions")) return [[], []];
    throw Error(`Unexpected query: ${statement.sql}`);
  } };
  return { tx, queries };
}

describe("improvement read graph round trips and existing completion rules", () => {
  it("reads a two-level progress tree in three ticket queries instead of four", async () => {
    const { tx, queries } = fixture();
    const results = await loadImprovementExecutionProgress(tx, [idea, { ...idea, id: 2 }]);
    expect(results.get(1)).toMatchObject({ percent: 100, total: 2, ready: true });
    expect(results.get(2)).toEqual(results.get(1));
    expect(queries.filter(query => query.sql.includes(" FROM tickets WHERE"))).toHaveLength(3);
    expect(queries.every(query => query.sql.startsWith("SELECT"))).toBe(true);
  });

  it("keeps root control totals excluded and unconverted work incomplete", async () => {
    const { tx, queries } = fixture(undefined, [{ id: 2, ticketId: 10, status: "new", convertedTicketId: null }]);
    const summary = await improvementExecutionSummary(tx, idea);
    expect(summary.total).toBe(15);
    expect(summary.tickets.map(ticket => ticket.id)).toEqual([10, 11]);
    expect(summary.executionProgress).toMatchObject({ total: 3, percent: 67, ready: false });
    expect(queries.filter(query => query.sql.includes(" FROM tickets WHERE"))).toHaveLength(3);
  });

  it("preserves missing-document handling without inventing a complete graph", async () => {
    const { tx } = fixture([]);
    expect((await improvementExecutionSummary(tx, idea)).missingDocument).toBe(true);
    const progress = await loadImprovementExecutionProgress(tx, [idea]);
    expect(progress.get(1)).toMatchObject({ missingDocument: true, ready: false });
  });

  it("retains cycle and size limits in the financial summary", async () => {
    const cyclic = fixture([{ ...root, parentTicketId: 11 }, child]);
    await expect(improvementExecutionSummary(cyclic.tx, idea)).rejects.toThrow(/دورة/);
    const oversized = fixture([root, ...Array.from({ length: 2000 }, (_, index) => ({ ...child, id: index + 100 }))]);
    await expect(improvementExecutionSummary(oversized.tx, idea)).rejects.toThrow(/حد التحقق/);
  });
});
