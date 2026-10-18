import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { countPendingSubTicketTasks, summarizeSubTicketFamily } from "../../shared/ticketUiRules";
import { APP_ROLE, MAINTENANCE_RESPONSIBLE_DEPARTMENT as DEPT } from "../../shared/roles";
import ar from "../../client/src/i18n/ar";
import en from "../../client/src/i18n/en";
import ur from "../../client/src/i18n/ur";

// No environment, database driver connection, notifications or external services run.
const state = vi.hoisted(() => ({
  parent: {} as any,
  tasks: [] as any[],
  children: [] as any[],
  departments: [] as any[],
  assignees: [] as any[],
  queryRows: [] as any[][],
  selections: [] as any[],
}));
vi.mock("../_core/env", () => ({ ENV: {} }));
vi.mock("../_core/db/client", () => ({ getDb: vi.fn(async () => ({
  select(fields: any) {
    state.selections.push(fields);
    const rows = state.queryRows.shift() ?? [];
    const query: any = { then: (resolve: any, reject: any) => Promise.resolve(rows).then(resolve, reject) };
    for (const method of ["from", "leftJoin", "where", "orderBy", "limit", "offset"]) query[method] = () => query;
    return query;
  },
})) }));
vi.mock("../_core/db", () => ({
  getTicketById: vi.fn(async () => state.parent),
  getTicketDepartments: vi.fn(async () => state.departments),
  getTicketTasks: vi.fn(async () => state.tasks),
  getTaskAssigneesForTasks: vi.fn(async () => state.assignees),
  getSubTicketsByParent: vi.fn(async () => state.children),
  withTransaction: vi.fn(async (work: any) => work({})),
  updateTicket: vi.fn(async () => undefined),
  getTicketItems: vi.fn(async () => []),
  updateTicketItem: vi.fn(async () => undefined),
  updateTicketDepartment: vi.fn(async () => undefined),
  updateTicketTask: vi.fn(async () => undefined),
  addTicketStatusHistory: vi.fn(async () => undefined),
  createAuditLog: vi.fn(async () => undefined),
  createNotification: vi.fn(async () => undefined),
  getTicketWorkflowManagerUsers: vi.fn(async () => []),
}));
vi.mock("../services/translation/translation", () => ({ detectLanguage: vi.fn(async () => "ar") }));
vi.mock("../services/translation/translationEngine", () => ({ queueTranslation: vi.fn() }));
vi.mock("../routers/_shared/router-helpers", () => ({ notifyTicketSupervisor: vi.fn(async () => undefined) }));
vi.mock("../routers/purchase/ticket-purchase-workflow", () => ({ assertPathBMaterialsDeliveredToTechnician: vi.fn() }));
vi.mock("../pmv2/tickets/closure-sync-service", () => ({ pmv2TicketClosureSyncService: { syncClosedTicketWithDb: vi.fn() } }));

import { ticketsWorkflowRouter } from "../routers/tickets/tickets.workflow";
import { ticketsClosureRouter } from "../routers/tickets/tickets.closure";
import { getTicketsPaginated } from "../_core/db/tickets";
import * as db from "../_core/db";

function context(role: string = APP_ROLE.ADMIN) {
  return { user: { id: 101, role, name: "Isolated test", isActive: 1 }, req: {}, res: {} } as any;
}
beforeEach(() => {
  vi.clearAllMocks();
  state.parent = { id: 1, workflowModel: "department_tasks", status: "department_planning", reportedById: 101, assignedToId: 101 };
  state.tasks = [
    { id: 10, ticketDepartmentId: 1, status: "promoted", convertedTicketId: 2 },
    { id: 11, ticketDepartmentId: 2, status: "assigned", convertedTicketId: null },
  ];
  state.children = [{ id: 2, ticketNumber: "MT-TEST-01", status: "closed" }];
  state.departments = [
    { id: 1, department: DEPT.IT, responsibleManagerId: 101 },
    { id: 2, department: DEPT.GENERAL, responsibleManagerId: 102 },
  ];
  state.assignees = [{ taskId: 10, userId: 101 }, { taskId: 11, userId: 102 }];
  state.queryRows = [];
  state.selections = [];
});

describe("Parent completion includes work not yet promoted", () => {
  it("reports one completed child and one unpromoted task as 50%, not 100%", () => {
    expect(summarizeSubTicketFamily(state.children, countPendingSubTicketTasks(state.tasks)))
      .toMatchObject({ total: 2, finished: 1, confirmed: 0, pendingTaskCount: 1, percent: 50, allFinished: false });
  });
  it("counts pending assignment as unfinished and ignores cancelled work", () => {
    expect(countPendingSubTicketTasks([
      { status: "pending_assignment", convertedTicketId: null },
      { status: "assigned", convertedTicketId: null },
      { status: "cancelled", convertedTicketId: null },
      { status: "promoted", convertedTicketId: 2 },
      { status: "completed", convertedTicketId: 3 },
    ])).toBe(2);
  });
  it("does not count a promoted task twice", () => {
    const tasks = [...state.tasks]; tasks[1] = { ...tasks[1], convertedTicketId: 3, status: "promoted" };
    expect(summarizeSubTicketFamily([...state.children, { status: "in_progress" }], countPendingSubTicketTasks(tasks)))
      .toMatchObject({ total: 2, finished: 1, percent: 50, allFinished: false });
  });
  it("reports 100% only when all children finish, without requiring requester confirmation", () => {
    expect(summarizeSubTicketFamily([{ status: "closed" }, { status: "requester_confirmed" }]))
      .toMatchObject({ total: 2, finished: 2, confirmed: 1, percent: 100, allFinished: true });
  });
  it("never treats an empty or not-yet-promoted family as complete", () => {
    for (const children of [null, undefined, []]) {
      expect(summarizeSubTicketFamily(children)).toMatchObject({ total: 0, percent: 0, allFinished: false });
      expect(summarizeSubTicketFamily(children, 2)).toMatchObject({ total: 2, percent: 0, allFinished: false });
    }
  });
  it("does not round an incomplete large family to 100%", () => {
    expect(summarizeSubTicketFamily(Array.from({ length: 200 }, () => ({ status: "closed" })), 1))
      .toMatchObject({ percent: 99, allFinished: false });
  });
  it("keeps legacy families without a task plan working", () => {
    expect(summarizeSubTicketFamily([{ status: "closed" }])).toMatchObject({ total: 1, percent: 100, allFinished: true });
    expect(summarizeSubTicketFamily([{ status: "under_inspection" }])).toMatchObject({ percent: 0, allFinished: false });
  });
});

describe("Actual departmentPlan query and closure guard", () => {
  it.each([APP_ROLE.ADMIN, APP_ROLE.TECHNICIAN, APP_ROLE.IT_MANAGER, APP_ROLE.GENERAL_MAINTENANCE_MANAGER])(
    "includes all pending work while retaining task visibility for %s", async role => {
      const plan = await ticketsWorkflowRouter.createCaller(context(role)).departmentPlan({ ticketId: 1 });
      expect(plan.subTicketsSummary).toMatchObject({ total: 2, percent: 50, pendingTaskCount: 1, allFinished: false });
      if (role === APP_ROLE.TECHNICIAN || role === APP_ROLE.IT_MANAGER) {
        expect(plan.tasks.map((task: { id: number }) => task.id)).toEqual([10]);
        expect(plan.assignees.map((assignee: { userId: number }) => assignee.userId)).toEqual([101]);
      }
      if (role === APP_ROLE.GENERAL_MAINTENANCE_MANAGER) expect(plan.tasks).toEqual([]);
      expect(db.getTicketTasks).toHaveBeenCalledTimes(1);
    },
  );
  it("stops counting a cancelled task without changing the finished child", async () => {
    state.tasks[1].status = "cancelled";
    const plan = await ticketsWorkflowRouter.createCaller(context()).departmentPlan({ ticketId: 1 });
    expect(plan.subTicketsSummary).toMatchObject({ total: 1, percent: 100, allFinished: true, pendingTaskCount: 0 });
  });
  it("preserves the server rejection of premature closure and performs no writes", async () => {
    await expect(ticketsClosureRouter.createCaller(context()).closeParentTicket({ id: 1 }))
      .rejects.toThrow("توجد مهام لم تتحول إلى بلاغات تنفيذ بعد");
    expect(db.withTransaction).not.toHaveBeenCalled();
    expect(db.updateTicket).not.toHaveBeenCalled();
  });
  it("still rejects closure while a promoted child is open", async () => {
    state.tasks[1].convertedTicketId = 3;
    state.children.push({ id: 3, ticketNumber: "MT-TEST-02", status: "in_progress" });
    await expect(ticketsClosureRouter.createCaller(context()).closeParentTicket({ id: 1 })).rejects.toThrow("MT-TEST-02");
    expect(db.withTransaction).not.toHaveBeenCalled();
  });
  it("allows the existing authorized closure when remaining work is cancelled", async () => {
    state.tasks[1].status = "cancelled";
    await ticketsClosureRouter.createCaller(context()).closeParentTicket({ id: 1 });
    expect(db.updateTicket).toHaveBeenCalledWith(1, expect.objectContaining({ status: "closed" }), expect.anything());
  });
});

describe("Actual paginated list projection, without database connections", () => {
  it("returns the pending count with the existing page query and keeps child scope", async () => {
    state.queryRows = [[{ total: 1 }], [{ ticket: state.parent, pendingTaskCount: "1" }], [{ ticket: { ...state.children[0], parentTicketId: 1 } }]];
    const page = await getTicketsPaginated(undefined, 1, 10, { groupSubTickets: true, childVisibilityFilters: { assignedToId: 101 } });
    expect(state.selections).toHaveLength(3);
    expect(page.tickets[0]).toMatchObject({ pendingTaskCount: 1, subTickets: [expect.objectContaining({ id: 2 })] });
    const query = new MySqlDialect().sqlToQuery(state.selections[1].pendingTaskCount);
    expect(query.sql).toContain("`ticket_tasks`.`ticketId` = `tickets`.`id`");
    expect(query.sql).toContain("`ticket_tasks`.`status` <> 'cancelled'");
    expect(query.sql).toContain("`ticket_tasks`.`convertedTicketId` is null");
    expect(summarizeSubTicketFamily((page.tickets[0] as any).subTickets, (page.tickets[0] as any).pendingTaskCount))
      .toMatchObject({ percent: 50, allFinished: false });
  });
  it("leaves ungrouped lists without the additional correlated projection", async () => {
    state.queryRows = [[{ total: 1 }], [{ ticket: state.parent }]];
    const page = await getTicketsPaginated(undefined, 1, 10);
    expect(state.selections).toHaveLength(2);
    expect(state.selections[1]).not.toHaveProperty("pendingTaskCount");
    expect(page.tickets[0]).not.toHaveProperty("pendingTaskCount");
  });
});

// Render the actual completion panel expression from TicketDetail, rather than
// duplicating its button conditions in a test-only component.
const source = readFileSync("client/src/pages/tickets/TicketDetail.tsx", "utf8");
const ast = ts.createSourceFile("TicketDetail.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let panelExpression = "";
function findPanel(node: ts.Node) {
  if (ts.isCallExpression(node) && ts.isParenthesizedExpression(node.expression) && ts.isArrowFunction(node.expression.expression)
    && node.expression.expression.body.getText(ast).includes("const summary = (departmentPlan")) panelExpression = node.getText(ast);
  ts.forEachChild(node, findPanel);
}
findPanel(ast);
const panelJs = ts.transpileModule(`(${panelExpression})`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
function renderPanel(summary: ReturnType<typeof summarizeSubTicketFamily>, translation: any = ar, manager = true) {
  if (!panelExpression) throw new Error("Actual completion panel not found");
  const panel = vm.runInNewContext(panelJs, {
    React, departmentPlan: { subTicketsSummary: summary, pendingSubTickets: [] },
    ticket: { status: "department_planning" }, isManager: manager, isSupervisor: false,
    ticketId: 1, language: "ar", t: translation,
    closeParentTicketMut: { isPending: false, mutate: vi.fn() },
    Button: ({ children, ...props }: any) => React.createElement("button", props, children),
    CheckCircle2: () => null, Loader2: () => null,
  });
  return renderToStaticMarkup(panel);
}
describe("Actual parent completion panel", () => {
  it("shows 50% and pending task explanation, with no premature close button", () => {
    const html = renderPanel(summarizeSubTicketFamily(state.children, 1));
    expect(html).toContain("50%");
    expect(html).toContain("اكتمال مهام البلاغ الرئيسي");
    expect(html).toContain("1 / 2");
    expect(html).toContain("1 مهام بانتظار التحويل");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("اكتملت كل الفروع");
  });
  it("shows the authorized close button only after all work finishes", () => {
    const summary = summarizeSubTicketFamily([{ status: "closed" }, { status: "requester_confirmed" }]);
    expect(renderPanel(summary)).toContain("إغلاق البلاغ الرئيسي");
    expect(renderPanel(summary)).toContain("100%");
    expect(renderPanel(summary, ar, false)).not.toContain("<button");
  });
  it.each([ar, en, ur])("renders the pending explanation in each supported language", translation => {
    const html = renderPanel(summarizeSubTicketFamily([], 1), translation);
    expect(html).toContain(translation.workflow.ticket.parentTaskCompletion);
    expect(html).toContain(translation.workflow.ticket.pendingTaskPromotion.replace("{count}", "1"));
    expect(html).not.toContain("<button");
  });
});
