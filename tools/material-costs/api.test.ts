import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as costCore from "../../shared/material-execution-costs";

function fixture({ enabled = true, team = false, task = false }: { enabled?: boolean; team?: boolean; task?: boolean } = {}) {
  const read: any[] = [], selected: number[] = [];
  const chain: any = { from: () => chain, innerJoin: () => chain, where: () => chain, limit: async () => task ? [{ id: 1 }] : [], then: (resolve: any) => Promise.resolve(task ? [{ id: 1 }] : []).then(resolve) };
  let databaseCalls = 0;
  const database = { execute: async () => [team ? [{ id: 1 }] : []], select: () => chain };
  const procedure = (roles?: string[], schema?: z.ZodTypeAny): any => ({
    input: (nextSchema: z.ZodTypeAny) => procedure(roles, nextSchema), query: (handler: any) => async (args: any) => {
      if (!args.ctx?.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      if (roles && !roles.includes(args.ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
      return handler({ ...args, input: schema ? schema.parse(args.input) : args.input });
    },
  });
  const imports: any = {
    zod: { z }, "drizzle-orm": { sql: () => ({}), eq: () => ({}), and: () => ({}) }, "@trpc/server": { TRPCError },
    "../_shared/procedures": { router: (value: any) => value, protectedProcedure: procedure(), warehouseProcedure: procedure(["owner", "admin", "warehouse"]) },
    "../../_core/db": {
      getDb: async () => { databaseCalls++; return database; },
      getTicketById: async (id: number) => ({ id, workflowModel: id === 100 ? "department_tasks" : "sub_ticket", assignedToId: id === 1 ? 7 : 999 }),
      getSubTicketsByParent: async () => [{ id: 1, assignedToId: 7 }, { id: 2, assignedToId: 999 }],
      getTickets: async () => [{ id: 1 }],
    },
    "../../../drizzle/schema": { pmv2Tasks: { id: "id", teamId: "teamId" } },
    "../../pmv2/security/execution-access": { pmv2ExecutionActor: {}, pmv2ExecutionActorCondition: () => ({}), pmv2ExecutionTeamCondition: () => ({}) },
    "../../services/material-costs/feature": { materialExecutionCostsEnabled: () => enabled },
    "../../services/material-costs/reader": { readMaterialCostIssues: async (_db: any, filter: any) => { selected.push(filter.sourceId); return read.filter(row => !filter.sourceId || row.sourceId === filter.sourceId); } },
    "../../../shared/material-execution-costs": costCore,
    "../tickets/tickets.access": { assertTicketReadable: async (user: any, ticket: any) => {
      if (user.role === "technician" && ticket.assignedToId !== user.id && ticket.workflowModel !== "department_tasks") throw new TRPCError({ code: "FORBIDDEN" });
    } },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(transformSync(fs.readFileSync("server/routers/reports/material-costs.router.ts", "utf8"), { loader: "ts", format: "cjs", target: "es2022" }).code,
    { module, exports: module.exports, Date, Set, require(id: string) { if (!(id in imports)) throw new Error(`Blocked runtime import ${id}`); return imports[id]; } });
  return { router: module.exports.materialCostsRouter, selected, read, get databaseCalls() { return databaseCalls; } };
}
const ctx = (role: string) => ({ user: { id: 7, role } });
test("unsupported roles cannot fetch a global cost report by bypassing the page", async () => {
  const f = fixture(); await assert.rejects(f.router.report({ input: {}, ctx: ctx("delegate") }), (error: any) => error.code === "FORBIDDEN");
  await assert.rejects(f.router.report({ input: {}, ctx: {} }), (error: any) => error.code === "UNAUTHORIZED");
  assert.equal(f.databaseCalls, 0);
});
test("feature disabled makes no database call, so the new table is not required before manual installation", async () => {
  const f = fixture({ enabled: false });
  assert.equal((await f.router.report({ input: {}, ctx: ctx("owner") })).enabled, false);
  assert.equal((await f.router.document({ input: { source: "ticket", id: 99 }, ctx: ctx("technician") })).enabled, false);
  assert.equal(f.databaseCalls, 0);
});
test("technician cannot read a foreign ticket or foreign PMV2 task by changing API IDs", async () => {
  const f = fixture();
  await assert.rejects(f.router.document({ input: { source: "ticket", id: 99 }, ctx: ctx("technician") }), (error: any) => error.code === "FORBIDDEN");
  await assert.rejects(f.router.document({ input: { source: "pmv2", id: 99 }, ctx: ctx("technician") }), (error: any) => error.code === "FORBIDDEN");
  assert.equal(f.selected.length, 0);
});
test("active team membership permits the technician's team-ticket cost read", async () => {
  const f = fixture({ team: true }); await f.router.document({ input: { source: "ticket", id: 99 }, ctx: ctx("technician") });
  assert.deepEqual(f.selected, [99]);
});
test("parent cost view includes authorized children once, never parent plus children", async () => {
  const f = fixture(); await f.router.document({ input: { source: "ticket", id: 100 }, ctx: ctx("technician") });
  assert.deepEqual(f.selected, [1]);
});
test("warehouse target picker does not become a general technician API", async () => {
  const f = fixture(); await assert.rejects(f.router.issueTargets({ input: {}, ctx: ctx("technician") }), (error: any) => error.code === "FORBIDDEN");
});
test("invalid date interval and forged document source are rejected before reading", async () => {
  const f = fixture();
  await assert.rejects(f.router.report({ input: { from: "2026-11-01", to: "2026-10-01" }, ctx: ctx("owner") }));
  await assert.rejects(f.router.report({ input: { from: "2026-02-31" }, ctx: ctx("owner") }));
  await assert.rejects(f.router.document({ input: { source: "purchase", id: 1 }, ctx: ctx("owner") }));
  assert.equal(f.databaseCalls, 0);
});
