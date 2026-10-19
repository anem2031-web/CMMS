import { beforeEach, describe, expect, it, vi } from "vitest";
// Every application boundary is mocked before the router loads. No root router,
// database adapter, authentication SDK, storage client or server is imported.
const mocks = vi.hoisted(() => ({ idea: {} as any, summary: {} as any, completes: [] as any[], audits: [] as any[], sqlAudits: [] as any[], role: "maintenance_manager", tx: {} as any, failAudit: false, visibleOrders: [] as any[], approvedIdeas: [] as any[] }));
vi.mock("../../server/routers/_shared/procedures", async () => {
  const { initTRPC, TRPCError } = await import("@trpc/server");
  const t = initTRPC.context<any>().create();
  const protectedProcedure = t.procedure;
  const restrict = (roles: string[]) => protectedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN" });
    return next();
  });
  return { router: t.router, protectedProcedure, ideaTriageProcedure: restrict(["maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "owner", "admin"]), managementProcedure: restrict(["owner", "admin", "senior_management", "executive_director"]) };
});
vi.mock("../../server/_core/db", () => ({
  withTransaction: async (work: any) => {
    const snapshot = mocks.completes.length;
    try { return await work(mocks.tx); } catch (error) { mocks.completes.length = snapshot; throw error; }
  },
  createAuditLog: async (data: any) => mocks.audits.push(data),
  createNotification: async () => {},
  getOperationalManagerUsers: async () => [],
}));
vi.mock("../../server/services/improvement-ideas/improvementIdeas", () => ({
  getImprovementIdeaById: async () => mocks.idea,
  getApprovedIdeas: async () => mocks.approvedIdeas,
  completeImprovementIdea: async (...args: any[]) => mocks.completes.push(args),
  decideImprovementIdea: vi.fn(),
}));
vi.mock("../../server/services/translation/translation", () => ({ detectLanguage: async () => "ar" }));
vi.mock("../../server/routers/tickets/tickets.access", () => ({ assertTicketReadable: async () => {} }));
vi.mock("../../server/_core/authz/guard", () => ({ assertCanViewPurchaseOrder: async () => {}, filterVisiblePurchaseOrders: async () => mocks.visibleOrders }));
vi.mock("../../server/services/improvement-ideas/execution", () => ({ validateIdeaLocation: vi.fn(), executionReference: vi.fn(), improvementExecutionSummary: async () => mocks.summary }));
import { improvementIdeasRouter } from "../../server/routers/improvement-ideas/improvement-ideas.router";
const caller = (role = mocks.role) => improvementIdeasRouter.createCaller({ user: { id: 8, role } } as any);
const evaluation = { id: 9, resultRating: "achieved" as const, resultNotes: "The target was reached" };
beforeEach(() => {
  mocks.idea = { id: 9, requestNumber: "IMP-9", submittedById: 3, title: "Improve", status: "in_progress", executionTrackingVersion: 1, costStudyRequired: 1, targetValue: null };
  mocks.summary = { executionDone: true, complete: true, total: 4300, lines: [{ key: "purchase-item:3" }], orders: [] };
  mocks.completes = []; mocks.audits = []; mocks.sqlAudits = []; mocks.visibleOrders = []; mocks.approvedIdeas = []; mocks.failAudit = false;
  mocks.tx = { execute: async (query: any) => {
    const { MySqlDialect } = await import("drizzle-orm/mysql-core");
    const statement = new MySqlDialect().sqlToQuery(query);
    if (statement.sql.startsWith("SELECT")) return [[mocks.idea], []];
    if (mocks.failAudit) throw Error("audit failed");
    mocks.sqlAudits.push(statement); return [{ affectedRows: 1 }, []];
  } };
});

describe("derived progress is a scoped read, separate from saved plan and outcome", () => {
  it("returns fresh derived details without changing the stored manual field or outcome", async () => {
    mocks.idea = { ...mocks.idea, linkedTicketId: 10, implementationProgress: 0, resultRating: null };
    const statements: string[] = [];
    mocks.tx.execute = async (query: any) => {
      const { MySqlDialect } = await import("drizzle-orm/mysql-core");
      const statement = new MySqlDialect().sqlToQuery(query).sql;
      statements.push(statement);
      return [statement.startsWith("SELECT id,status,parentTicketId FROM tickets") ? [{ id: 10, status: "closed", parentTicketId: null }] : [], []];
    };
    const result = await caller().getById({ id: 9 });
    expect(result.executionProgress?.percent).toBe(100);
    expect(result.implementationProgress).toBe(0); expect(result.resultRating).toBeNull();
    expect(mocks.idea.implementationProgress).toBe(0);
    expect(statements.every(query => query.startsWith("SELECT"))).toBe(true);
  });

  it("does not query progress or expose it to an employee reading their own idea", async () => {
    mocks.idea = { ...mocks.idea, submittedById: 8, linkedTicketId: 10, executionProgress: { percent: 100 } };
    const execute = vi.fn(); mocks.tx.execute = execute;
    const result = await caller("operator").getById({ id: 9 });
    expect(result.executionProgress).toBeUndefined(); expect(result.implementationProgress).toBeUndefined();
    expect(execute).not.toHaveBeenCalled();
  });

  it("retains employee ownership checks before execution reads", async () => {
    const execute = vi.fn(); mocks.tx.execute = execute;
    await expect(caller("operator").getById({ id: 9 })).rejects.toThrow("لا يمكنك الاطلاع");
    await expect(caller("operator").getApproved()).rejects.toThrow();
    expect(execute).not.toHaveBeenCalled();
  });

  it("keeps legacy manual progress without querying the execution graph", async () => {
    mocks.idea = { ...mocks.idea, executionTrackingVersion: 0, implementationProgress: 45 };
    const execute = vi.fn(); mocks.tx.execute = execute;
    expect((await caller().getById({ id: 9 })).implementationProgress).toBe(45);
    mocks.approvedIdeas = [mocks.idea];
    expect((await caller().getApproved())[0].implementationProgress).toBe(45);
    expect(execute).not.toHaveBeenCalled();
  });

  it("batches shared approved execution and keeps legacy rows unchanged", async () => {
    mocks.approvedIdeas = [{ ...mocks.idea, id: 1, linkedTicketId: 10 }, { ...mocks.idea, id: 2, linkedTicketId: 10 }, { ...mocks.idea, id: 3, executionTrackingVersion: 0, implementationProgress: 30 }];
    const execute = vi.fn(async (query: any) => {
      const { MySqlDialect } = await import("drizzle-orm/mysql-core");
      const statement = new MySqlDialect().sqlToQuery(query).sql;
      return [statement.startsWith("SELECT id,status,parentTicketId FROM tickets") ? [{ id: 10, status: "closed", parentTicketId: null }] : [], []];
    });
    mocks.tx.execute = execute;
    const result = await caller().getApproved();
    expect(result.map(row => row.executionProgress?.percent)).toEqual([100, 100, undefined]);
    expect(result[2].implementationProgress).toBe(30);
    expect(execute).toHaveBeenCalledTimes(4);
  });
});
describe("completion controller without application or database runtime", () => {
  it("takes actual cost from source records and audits inside the same transaction", async () => {
    await caller().complete({ ...evaluation, actualCost: 1 });
    expect(mocks.completes[0][1].actualCost).toBe(4300);
    expect(mocks.completes[0][2]).toBe(mocks.tx);
    expect(mocks.sqlAudits).toHaveLength(1); expect(mocks.audits).toHaveLength(0);
  });
  it.each([{ executionDone: false }, { complete: false }, { total: 1000000000000 }])("rejects incomplete/unreconciled or overflowing cost %j", async change => {
    Object.assign(mocks.summary, change);
    await expect(caller().complete(evaluation)).rejects.toThrow(); expect(mocks.completes).toHaveLength(0);
  });
  it("rejects missing evaluation and target measurement", async () => {
    await expect(caller().complete({ id: 9 })).rejects.toThrow();
    mocks.idea.targetValue = "10"; await expect(caller().complete(evaluation)).rejects.toThrow();
  });
  it("blocks concurrent repeat completion after reading fresh locked state", async () => {
    mocks.tx.execute = async () => [[{ ...mocks.idea, status: "completed" }], []];
    await expect(caller().complete(evaluation)).rejects.toThrow(); expect(mocks.completes).toHaveLength(0);
  });
  it("rolls back finalization if the transaction audit fails", async () => {
    mocks.failAudit = true;
    await expect(caller().complete(evaluation)).rejects.toThrow("audit failed"); expect(mocks.completes).toHaveLength(0);
  });
  it("retains manual cost completion for v3 and old ideas", async () => {
    mocks.idea.executionTrackingVersion = 0;
    await expect(caller().complete(evaluation)).rejects.toThrow();
    await caller().complete({ ...evaluation, actualCost: 100 });
    expect(mocks.completes[0][1].actualCost).toBe(100); expect(mocks.completes[0][2]).toBeUndefined(); expect(mocks.audits).toHaveLength(1);
  });
  it("does not allow technician completion or financial summary", async () => {
    await expect(caller("technician").complete(evaluation)).rejects.toThrow();
    await expect(caller("technician").executionSummary({ id: 9 })).rejects.toThrow();
  });
  it("financial summary respects existing document visibility", async () => {
    mocks.summary.orders = [{ id: 2, status: "draft" }];
    await expect(caller("senior_management").executionSummary({ id: 9 })).rejects.toThrow();
    mocks.visibleOrders = mocks.summary.orders;
    expect((await caller().executionSummary({ id: 9 })).total).toBe(4300);
  });
  it("new approval requires complete study and old approvals retain rules", async () => {
    Object.assign(mocks.idea, { status: "classified", costStudiedAt: "2026-10-10" });
    await expect(caller("senior_management").decide({ id: 9, decision: "approved" })).rejects.toThrow();
    Object.assign(mocks.idea, { executionTrackingVersion: 0, costStudyRequired: 0 });
    await caller("senior_management").decide({ id: 9, decision: "approved" });
  });
});
