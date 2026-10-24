import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { canRoleAccessPath } from "../../shared/roles";
import { delegateDirectoryRpcAllowed } from "../../shared/delegate-directory-policy";

const directory = vi.fn(() => [{ id: 30, name: "Private profile", email: "private@example.test", phone: "private", role: "admin" }]);
const doc = vi.fn(() => ({ id: 1, requestedByName: "Document requester", items: [{ id: 2, delegateId: 3 }] }));
const translation = vi.fn(() => ({ notes: "Document translation" }));
const api = router({
  users: router({
    list: protectedProcedure.query(directory),
    byRole: protectedProcedure.input(z.object({ role: z.string() })).query(directory),
    listTechnicians: protectedProcedure.query(directory),
    update: protectedProcedure.input(z.any()).mutation(directory),
  }),
  audit: router({ list: protectedProcedure.query(directory), recordPwaUpdateDecision: protectedProcedure.mutation(() => true) }),
  translation: router({
    getEntityTranslations: protectedProcedure.input(z.any()).query(translation),
    getBatchTranslations: protectedProcedure.input(z.any()).query(translation),
    getVersionHistory: protectedProcedure.input(z.any()).query(translation),
    getJobs: protectedProcedure.input(z.any()).query(directory),
    queueTranslation: protectedProcedure.input(z.any()).mutation(translation),
    setLanguage: protectedProcedure.input(z.any()).mutation(() => true),
  }),
  purchaseOrders: router({ getById: protectedProcedure.input(z.object({ id: z.number() })).query(doc) }),
  purchasePackages: router({ getById: protectedProcedure.input(z.object({ id: z.number() })).query(doc) }),
  tickets: router({ inboxCounts: protectedProcedure.query(directory) }),
  auth: router({ logout: protectedProcedure.mutation(() => true) }),
  reports: router({ technicianMonthlyReport: protectedProcedure.input(z.any()).query(directory), technicianPerformance: protectedProcedure.input(z.any()).query(directory) }),
  maintenanceReports: router({ technicianMonthlyReport: protectedProcedure.input(z.any()).query(directory), technicianPerformance: protectedProcedure.input(z.any()).query(directory) }),
  ai: router({ analyze: protectedProcedure.input(z.any()).mutation(directory) }),
});
const identity = (role: string) => ({ id: 3, role, isActive: 1 });
function caller(role = "delegate", projected = false) {
  return api.createCaller({ user: identity(projected ? "admin" : role), authenticatedUser: identity(role) } as any);
}

describe("Delegate directory denial at the central API boundary", () => {
  it.each([false, true])("denies all directory forms before reading profiles, admin projection=%s", async projected => {
    directory.mockClear();
    const client = caller("delegate", projected);
    for (const read of [() => client.users.list(), () => client.users.byRole({ role: "owner" }), () => client.users.listTechnicians(), () => client.users.update({ id: 30, role: "owner" })]) {
      await expect(read()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(directory).not.toHaveBeenCalled();
  });
  it("blocks the audit and translation-job copies of private directory data", async () => {
    directory.mockClear();
    await expect(caller().audit.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().translation.getJobs({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(directory).not.toHaveBeenCalled();
  });
  it("blocks global staff-directory copies in monthly reports and the AI context", async () => {
    directory.mockClear();
    for (const read of [() => caller().reports.technicianMonthlyReport({}), () => caller().maintenanceReports.technicianMonthlyReport({}), () => caller().reports.technicianPerformance({}), () => caller().maintenanceReports.technicianPerformance({}), () => caller().ai.analyze({ question: "List all users" })]) {
      await expect(read()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(directory).not.toHaveBeenCalled();
  });
  it("blocks the delegate from the general ticket inbox API", async () => {
    directory.mockClear();
    await expect(caller().tickets.inboxCounts()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(directory).not.toHaveBeenCalled();
  });
  it.each(["owner", "admin", "operator", "maintenance_manager", "senior_management"])("preserves the ticket inbox for %s", async role => {
    await expect(caller(role).tickets.inboxCounts()).resolves.toHaveLength(1);
    expect(canRoleAccessPath(role, "/tickets/inbox")).toBe(true);
    expect(delegateDirectoryRpcAllowed(role, "tickets.inboxCounts")).toBe(true);
  });
  it.each(["USER", "user", " User "])("blocks user-name enumeration and queued user text through translation type %s", async entityType => {
    translation.mockClear();
    const input = { entityType, entityId: 30, entityIds: [30, 31], fieldName: "name", fieldNames: ["name"], languageCode: "en" };
    for (const read of [() => caller().translation.getEntityTranslations(input), () => caller().translation.getBatchTranslations(input), () => caller().translation.getVersionHistory(input), () => caller().translation.queueTranslation(input)]) {
      await expect(read()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(translation).not.toHaveBeenCalled();
  });
  it("keeps purchase document reads, their display translations, logout and language controls available", async () => {
    await expect(caller().purchaseOrders.getById({ id: 1 })).resolves.toMatchObject({ requestedByName: "Document requester" });
    await expect(caller().purchasePackages.getById({ id: 1 })).resolves.toMatchObject({ id: 1 });
    await expect(caller().translation.getBatchTranslations({ entityType: "PO_ITEM", entityIds: [2] })).resolves.toEqual({ notes: "Document translation" });
    await expect(caller().translation.setLanguage({ language: "en" })).resolves.toBe(true);
    await expect(caller().auth.logout()).resolves.toBe(true);
    await expect(caller().audit.recordPwaUpdateDecision()).resolves.toBe(true);
  });
  it.each(["owner", "admin", "warehouse", "accountant", "senior_management", "executive_director"])("retains %s's existing directory query behavior", async role => {
    await expect(caller(role).users.list()).resolves.toHaveLength(1);
  });
  it.each(["/users", "/users?search=name", "/users/30", "/audit-log", "/translation-monitor", "/reports/technicians", "/ai-assistant", "/tickets/inbox", "/tickets/inbox?tab=open"])("rejects delegate direct page %s", page => {
    expect(canRoleAccessPath("delegate", page)).toBe(false);
  });
  it("retains delegate purchase pages and the other roles' user-page decisions", () => {
    for (const page of ["/purchase-orders", "/purchase-orders/new", "/purchase-orders/1", "/purchase-packages/1", "/delegate-pricing-bundles"]) expect(canRoleAccessPath("delegate", page)).toBe(true);
    for (const role of ["owner", "admin", "warehouse", "observer"]) expect(canRoleAccessPath(role, "/users")).toBe(true);
    expect(delegateDirectoryRpcAllowed("delegate", "users.futureRead")).toBe(false);
  });
});
