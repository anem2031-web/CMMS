import { describe, expect, it, vi } from "vitest";
import { canRoleAccessPath, APP_ROLE } from "../../shared/roles";
import { isOwnerAdminOnlyHttpPath } from "../../shared/restricted-module-policy";
import { protectedProcedure, router } from "../_core/trpc";

const roles = Object.values(APP_ROLE);
const allowed = new Set([APP_ROLE.OWNER, APP_ROLE.ADMIN]);
const pagePaths = [
  "/construction",
  "/construction/projects",
  "/construction/projects/7/edit",
  "/construction/reports",
  "/preventive",
  "/preventive/7",
  "/predictive",
  "/reports/preventive",
];

describe("owner/admin-only legacy modules", () => {
  it.each(roles)("enforces direct page access for %s", role => {
    for (const path of pagePaths) expect(canRoleAccessPath(role, path), `${role}:${path}`).toBe(allowed.has(role as any));
  });

  it.each(roles)("enforces Construction and Preventive RPC access for %s", async role => {
    const constructionResolver = vi.fn(() => "construction");
    const preventiveResolver = vi.fn(() => "preventive");
    const api = router({
      construction: router({ projects: router({ list: protectedProcedure.query(constructionResolver) }) }),
      preventive: router({ listPlans: protectedProcedure.query(preventiveResolver) }),
    });
    const caller = api.createCaller({ user: { id: 1, role, isActive: 1 } } as any);
    if (allowed.has(role as any)) {
      await expect(caller.construction.projects.list()).resolves.toBe("construction");
      await expect(caller.preventive.listPlans()).resolves.toBe("preventive");
    } else {
      await expect(caller.construction.projects.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller.preventive.listPlans()).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(constructionResolver).not.toHaveBeenCalled();
      expect(preventiveResolver).not.toHaveBeenCalled();
    }
  });

  it("does not change PM V2 page or RPC namespaces", async () => {
    expect(canRoleAccessPath(APP_ROLE.MAINTENANCE_MANAGER, "/scheduled-maintenance")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.TECHNICIAN, "/scheduled-maintenance/my-tasks")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.WAREHOUSE, "/scheduled-maintenance/warehouse-requests")).toBe(true);
    const resolver = vi.fn(() => "pmv2");
    const api = router({ pmv2: router({ fixture: protectedProcedure.query(resolver) }) });
    await expect(api.createCaller({ user: { id: 1, role: APP_ROLE.MAINTENANCE_MANAGER, isActive: 1 } } as any).pmv2.fixture()).resolves.toBe("pmv2");
  });

  it("identifies only legacy preventive HTTP exports", () => {
    expect(isOwnerAdminOnlyHttpPath("/api/export/preventive-plans")).toBe(true);
    expect(isOwnerAdminOnlyHttpPath("/api/export/pm-work-orders")).toBe(true);
    expect(isOwnerAdminOnlyHttpPath("/api/export/pm-work-order/7")).toBe(true);
    expect(isOwnerAdminOnlyHttpPath("/api/export/purchase-orders")).toBe(false);
  });
});
