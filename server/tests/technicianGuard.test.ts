import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { inventoryReadProcedure } from "../routers/_shared/procedures";
import { assertTechnicianRpc } from "../_core/authz/technician-guard";
import { assertTechnicianTranslationAccess } from "../_core/authz/technician-resources";
import { TECHNICIAN_QUERY_PATHS, TECHNICIAN_MUTATION_PATHS, technicianHttpAllowed } from "../../shared/technician-policy";
import { canRoleAccessPath, APP_ROLE } from "../../shared/roles";
import { createTicketTeamExecutionRouter } from "../routers/maintenance-teams/execution.router";
import { createDemo } from "../maintenance-team-tickets/testing/fixture";
import { observerHttpAllowed } from "../../shared/observer-policy";
import { businessHttpAllowed } from "../../shared/business-role-policy";

const calls = vi.hoisted(() => ({ inventory: vi.fn(async () => [{ id: 1, quantity: 7 }]), ticket: vi.fn(), sideEffect: vi.fn() }));
vi.mock("../_core/db", () => ({
  getTicketById: calls.ticket, getTicketItems: async () => [], isUserAssignedToTicketTasks: async () => false,
}));

function astOf(file: string) { return ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS); }
function evaluate(code: string, scope: object) {
  return vm.runInNewContext(ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, scope);
}
const inventoryAst = astOf("server/routers/inventory/inventory.router.ts");
let list = "";
function findList(node: ts.Node) { if (ts.isPropertyAssignment(node) && node.name.getText(inventoryAst) === "list") list = node.initializer.getText(inventoryAst); ts.forEachChild(node, findList); }
findList(inventoryAst);
const api = router({
  inventory: router({ list: evaluate(list, { inventoryReadProcedure, db: { getInventoryItems: calls.inventory } }) }),
  unrelated: router({ publicRead: publicProcedure.query(() => calls.sideEffect()), protectedWrite: protectedProcedure.mutation(() => calls.sideEffect()) }),
  auth: router({ me: publicProcedure.query(({ ctx }) => ctx.user), logout: publicProcedure.mutation(() => true) }),
  translation: router({
    getEntityTranslations: protectedProcedure.input(z.object({ entityType: z.string(), entityId: z.number() })).query(() => calls.sideEffect()),
    getBatchTranslations: protectedProcedure.input(z.object({ entityType: z.string(), entityIds: z.array(z.number()) })).query(() => calls.sideEffect()),
  }),
  attachments: router({ list: protectedProcedure.input(z.any()).query(() => calls.sideEffect()) }),
  tickets: router({ create: protectedProcedure.input(z.any()).mutation(() => calls.sideEffect()) }),
});
const identity = (role = "technician", id = 3, isActive = 1) => ({ id, role, isActive });
function caller(role = "technician", id = 3, isActive = 1, projected = false) {
  const user = identity(role, id, isActive);
  return api.createCaller({ user: projected ? { ...user, role: "admin" } : user, authenticatedUser: user, req: {}, res: {} } as unknown as TrpcContext);
}
beforeEach(() => {
  vi.clearAllMocks();
  calls.ticket.mockImplementation(async (id: number) => ({ id, assignedToId: id === 11 ? 3 : 5, reportedById: 9 }));
});
describe("Technician central API boundary", () => {
  it("closes the demonstrated inventory read through the actual handler and shared middleware", async () => {
    expect(canRoleAccessPath("technician", "/inventory")).toBe(false);
    await expect(caller().inventory.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls.inventory).not.toHaveBeenCalled();
    await expect(caller("warehouse").inventory.list()).resolves.toEqual([{ id: 1, quantity: 7 }]);
    expect(calls.inventory).toHaveBeenCalledOnce();
  });
  it("denies unrelated public reads and protected writes before their handlers", async () => {
    await expect(caller().unrelated.publicRead()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().unrelated.protectedWrite()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls.sideEffect).not.toHaveBeenCalled();
  });
  it("uses the original identity and cannot be bypassed by an admin-looking projection", async () => {
    await expect(caller("technician", 3, 1, true).inventory.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("technician", 3, 1, true).auth.me()).resolves.toMatchObject({ id: 3, role: "technician" });
  });
  it("rejects inactive technicians while retaining logout", async () => {
    await expect(caller("technician", 3, 0).auth.me()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("technician", 3, 0).auth.logout()).resolves.toBe(true);
  });
  it.each(["inventory.list", "users.list", "purchaseOrders.create", "pmv2.management", "ticketTeamExecution.issue", "ticketTeamExecution.review", "pmv2.technician.future", "tickets.getById.extra", "Tickets.getById", "tickets/getById", "tickets.getById%00"])("denies unlisted and lookalike path %s", path => {
    for (const type of ["query", "mutation", "subscription"]) expect(() => assertTechnicianRpc(identity(), type, path)).toThrow();
  });
  it.each(Object.values(APP_ROLE).filter(role => role !== "technician"))("leaves the central technician policy neutral for %s", role => {
    expect(() => assertTechnicianRpc(identity(role), "mutation", "inventory.create", {})).not.toThrow();
    expect(technicianHttpAllowed(identity(role), "POST", "/api/export/html-to-pdf")).toBe(true);
  });
  it("uses exact query/mutation pairs and retains every reviewed task capability", () => {
    const input = { pmv2TaskItemId: 1, entityType: "ticket", kind: "ticket" };
    for (const path of TECHNICIAN_QUERY_PATHS) {
      expect(() => assertTechnicianRpc(identity(), "query", path, input)).not.toThrow();
      expect(() => assertTechnicianRpc(identity(), "mutation", path, input)).toThrow();
    }
    for (const path of TECHNICIAN_MUTATION_PATHS) {
      expect(() => assertTechnicianRpc(identity(), "mutation", path, input)).not.toThrow();
      expect(() => assertTechnicianRpc(identity(), "query", path, input)).toThrow();
    }
  });
  it("allows only PMV2-linked creation and task attachment types", async () => {
    await expect(caller().tickets.create({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().tickets.create({ pmv2TaskItemId: "11" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().attachments.list({ entityType: "catalog_item", entityId: 11 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls.sideEffect).not.toHaveBeenCalled();
    await caller().tickets.create({ pmv2TaskItemId: 11 });
    expect(calls.sideEffect).toHaveBeenCalledOnce();
  });
});
describe("Task translation scope", () => {
  it("checks actual ticket access before returning an authorized translation", async () => {
    await caller().translation.getEntityTranslations({ entityType: "TICKET", entityId: 11 });
    expect(calls.sideEffect).toHaveBeenCalledOnce();
    calls.sideEffect.mockClear();
    await expect(caller().translation.getEntityTranslations({ entityType: "TICKET", entityId: 12 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls.sideEffect).not.toHaveBeenCalled();
  });
  it("rejects mixed authorized/foreign batches atomically", async () => {
    await expect(caller().translation.getBatchTranslations({ entityType: "TICKET", entityIds: [11, 12] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls.sideEffect).not.toHaveBeenCalled();
  });
  it.each(["USER", "PURCHASE_ORDER", "__proto__", "unknown"])("rejects unrelated entity %s without a lookup", async entityType => {
    await expect(caller().translation.getEntityTranslations({ entityType, entityId: 11 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls.ticket).not.toHaveBeenCalled();
  });
  it.each(["TICKET_ITEM", "TICKET_STATUS_HISTORY", "TICKET_DEPARTMENT", "TICKET_TASK", "INSPECTION_RESULT"])("resolves every %s ID to its authorized parent before reading", async entityType => {
    const port = { parents: vi.fn(async () => [{ id: 8, ticketId: 11 }]), assertTicket: vi.fn(async () => {}) };
    await assertTechnicianTranslationAccess(identity(), { entityType, entityIds: [8, 8] }, "batch", port);
    expect(port.parents).toHaveBeenCalledWith(entityType, [8]);
    expect(port.assertTicket).toHaveBeenCalledWith(identity(), 11);
    port.parents.mockResolvedValueOnce([]);
    await expect(assertTechnicianTranslationAccess(identity(), { entityType, entityIds: [8] }, "batch", port)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("cannot authorize a different ID through extra properties that the selected parser strips", async () => {
    await expect(caller().translation.getEntityTranslations({ entityType: "TICKET", entityId: 12, entityIds: [11] } as any)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().translation.getBatchTranslations({ entityType: "TICKET", entityId: 11, entityIds: [12] } as any)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(calls.sideEffect).not.toHaveBeenCalled();
  });
});
describe("Actual team execution stays scoped behind the central gate", () => {
  async function team() {
    const demo = createDemo();
    await demo.service.assign(1, { ticketId: 1001, ticketItemId: 5001, ticketNumber: "SIM-MT-001", title: "عطل لوحة الإنارة", teamId: 21, responsibleManagerId: 1, location: { siteId: 1, sectionId: 11, assetId: 111 } });
    const id = (await demo.store.read()).assignments[0].id;
    const app = router({ ticketTeamExecution: createTicketTeamExecutionRouter(() => demo.service) });
    return { demo, id, call: (userId: number) => app.createCaller({ user: identity("technician", userId), authenticatedUser: identity("technician", userId), req: {}, res: {} } as unknown as TrpcContext).ticketTeamExecution };
  }
  it("keeps own-team execution and rejects a technician from another team", async () => {
    const test = await team();
    await expect(test.call(3).details({ assignmentId: test.id })).resolves.toMatchObject({ assignments: [{ id: test.id }] });
    await expect(test.call(5).details({ assignmentId: test.id })).resolves.toMatchObject({ assignments: [] });
    const revision = (await test.demo.store.read()).assignments[0].revision;
    await test.call(3).startItem({ assignmentId: test.id, expectedRevision: revision, operationKey: "test-start" });
    expect((await test.demo.store.read()).actions.some(action => action.kind === "execution_started")).toBe(true);
    await expect(test.call(5).startItem({ assignmentId: test.id, expectedRevision: revision, operationKey: "foreign-start" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
describe("Authenticated HTTP boundary", () => {
  const source = astOf("server/_core/index.ts");
  const node = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "requireAuthMiddleware")!;
  it.each([
    ["technician", "POST", "/api/upload", true], ["technician", "GET", "/api/tickets/11/pdf", true],
    ["technician", "POST", "/api/export/html-to-pdf", false], ["technician", "GET", "/api/export/my-items-pdf", false],
    ["admin", "POST", "/api/export/html-to-pdf", true], ["warehouse", "POST", "/api/upload", true],
    ["observer", "POST", "/api/upload", false],
  ])("runs actual HTTP middleware for %s %s %s", async (role, method, path, allowed) => {
    const next = vi.fn(), json = vi.fn(), status = vi.fn(() => ({ json }));
    const middleware = evaluate(node.getText(source), {
      sdk: { authenticateRequest: async () => identity(role as string) }, observerHttpAllowed, technicianHttpAllowed, businessHttpAllowed,
      isSessionAuthenticationError: () => false, console,
    });
    await middleware({ method, path }, { status }, next);
    expect(next).toHaveBeenCalledTimes(allowed ? 1 : 0);
    if (!allowed) expect(status).toHaveBeenCalledWith(403);
  });
  it("keeps upload and the guarded task PDF, rejects other exports and aliases", () => {
    expect(technicianHttpAllowed(identity(), "POST", "/api/upload")).toBe(true);
    expect(technicianHttpAllowed(identity(), "GET", "/api/tickets/11/pdf")).toBe(true);
    for (const path of ["/api/upload-url", "/api/export/html-to-pdf", "/api/export/my-items-pdf", "/api/export/po/1/pdf", "/api/tickets/0/pdf", "/api/tickets/11/pdf/extra", "/api/tickets/%31/pdf"]) {
      expect(technicianHttpAllowed(identity(), "GET", path)).toBe(false);
      expect(technicianHttpAllowed(identity(), "POST", path)).toBe(false);
    }
    expect(technicianHttpAllowed(identity("technician", 3, 0), "POST", "/api/upload")).toBe(false);
  });
});
