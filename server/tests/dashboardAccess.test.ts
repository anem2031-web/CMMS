import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { buildDashboard } from "../../shared/dashboard-overview";
import { APP_ROLE } from "../../shared/roles";
import { fixture, FILTERS, NOW } from "../../tools/dashboard-development/fixture";
const mocks = vi.hoisted(() => ({ load: vi.fn(), legacy: vi.fn().mockResolvedValue({ openTickets: 1 }) }));
vi.mock("../services/dashboard/overview", () => ({ loadDashboard: mocks.load }));
vi.mock("../_core/db", () => ({ getDashboardStats: mocks.legacy, getDb: vi.fn() }));
import { router } from "../_core/trpc";
import { dashboardRouter } from "../routers/system/dashboard.router";
const api = router({ dashboard: dashboardRouter });
const caller = (role: string | null, active = 1, projected = false, id = 42) => api.createCaller({
  req: {}, res: {}, user: role ? { id, role: projected ? "admin" : role, isActive: active } : null,
  ...(projected ? { authenticatedUser: { id, role, isActive: active } } : {}),
} as TrpcContext).dashboard;
beforeEach(() => { vi.clearAllMocks(); mocks.load.mockImplementation(async filters => buildDashboard(fixture(), filters, NOW)); });
describe("administrative dashboard API gates", () => {
  it.each(["owner", "admin", "observer"])("allows real read queries for %s", async role => {
    expect((await caller(role).overview(FILTERS)).counts.open_execution).toBe(3);
    const details = await caller(role).details({ ...FILTERS, metric: "received_value" });
    expect(details.total).toBe(2);
    expect(details.receivedValue).toBe(50.1);
  });
  it.each(Object.values(APP_ROLE).filter(role => !["owner", "admin", "observer"].includes(role)))("rejects %s before reading", async role => {
    await expect(caller(role).overview(FILTERS)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(role).details({ ...FILTERS, metric: "open_execution" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(role).stats()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.legacy).not.toHaveBeenCalled();
  });
  it("keeps the observer's original identity active check before the admin read projection", async () => {
    await expect(caller("observer", 0, true).overview(FILTERS)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("rejects an anonymous caller", async () => {
    await expect(caller(null).overview(FILTERS)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it.each([
    { ...FILTERS, siteId: -1 },
    { ...FILTERS, period: "custom", dateFrom: "2026-02-30", dateTo: "2026-03-01" },
    { ...FILTERS, period: "custom", dateFrom: "2026-10-13", dateTo: "2026-10-01" },
    { ...FILTERS, period: "custom" },
  ])("rejects invalid filters before reading", async input => {
    await expect(caller("admin").overview(input as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("uses the same manager detail bucket as its displayed count", async () => {
    const overview = await caller("admin").overview(FILTERS);
    const manager = overview.managers.find(m => m.managerId === 11)!;
    const details = await caller("admin").details({ ...FILTERS, metric: "open_execution", managerKey: manager.key, managerBucket: "aged_inside" });
    expect(details.total).toBe(manager.agedInside);
  });
  it.each(["owner", "admin", "observer"])("reuses %s overview data while checking authorization on every detail call", async role => {
    const overview = await caller(role).overview(FILTERS);
    const details = await caller(role).details({ ...FILTERS, metric: "received_value", snapshotId: overview.snapshotId });
    expect(details.generatedAt).toBe(overview.generatedAt);
    expect(details.receivedValue).toBe(overview.receivedValue);
    expect(mocks.load).toHaveBeenCalledTimes(1);
    await expect(caller("warehouse").details({ ...FILTERS, metric: "open_execution", snapshotId: overview.snapshotId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.load).toHaveBeenCalledTimes(1);
  });
  it("scopes snapshots to the original observer identity, not its admin projection", async () => {
    const overview = await caller("observer", 1, true).overview(FILTERS);
    await caller("observer").details({ ...FILTERS, metric: "open_execution", snapshotId: overview.snapshotId });
    expect(mocks.load).toHaveBeenCalledTimes(1);
    await caller("admin").details({ ...FILTERS, metric: "open_execution", snapshotId: overview.snapshotId });
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
  it("does not share one admin account's snapshot with a second account", async () => {
    const overview = await caller("admin").overview(FILTERS);
    await caller("admin", 1, false, 43).details({ ...FILTERS, metric: "open_execution", snapshotId: overview.snapshotId });
    expect(mocks.load).toHaveBeenCalledTimes(2);
  });
  it("does not expose a database-backed mutation from the new layer", () => {
    for (const path of ["overview", "details"] as const) expect(dashboardRouter._def.procedures[path]._def.type).toBe("query");
  });
});
