import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { router } from "../_core/trpc";
import { adminOwnerProcedure } from "../routers/_shared/procedures";
import { canViewMaterialCostDocument } from "../../shared/material-execution-costs";
import { businessRpcAllowed, BUSINESS_GUARDED_ROLES } from "../../shared/business-role-policy";
import { technicianRpcAllowed } from "../../shared/technician-policy";
import { observerRpcAllowed } from "../../shared/observer-policy";

const handler = vi.fn(() => ({ enabled: false }));
const api = router({ materialCosts: router({
  document: adminOwnerProcedure.input(z.object({ source: z.enum(["ticket", "pmv2"]), id: z.number().int().positive() })).query(handler),
}) });
const caller = (role: string) => api.createCaller({ user: { id: 71, role, isActive: 1 }, req: {}, res: {} } as any);

describe("Execution material-cost document visibility", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["owner", "admin"])("allows %s through the central endpoint guard", async role => {
    expect(canViewMaterialCostDocument(role)).toBe(true);
    await expect(caller(role).materialCosts.document({ source: "pmv2", id: 1 })).resolves.toMatchObject({ enabled: false });
  });

  it.each([
    "technician", "it_manager", "it_member", "maintenance_manager", "general_maintenance_manager",
    "construction_procurement_manager", "warehouse", "accountant", "senior_management",
    "executive_director", "observer", "delegate",
  ])("rejects %s before loading task or ticket cost data", async role => {
    expect(canViewMaterialCostDocument(role)).toBe(false);
    await expect(caller(role).materialCosts.document({ source: "ticket", id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(handler).not.toHaveBeenCalled();
  });

  it("removes the endpoint from every central non-admin allowlist", () => {
    expect(technicianRpcAllowed({ id: 1, role: "technician", isActive: 1 }, "query", "materialCosts.document")).toBe(false);
    expect(observerRpcAllowed("observer", "query", "materialCosts.document")).toBe(false);
    for (const role of BUSINESS_GUARDED_ROLES) {
      expect(businessRpcAllowed({ id: 1, role, isActive: 1 }, "query", "materialCosts.document"), role).toBe(false);
    }
  });

  it("binds the production document endpoint to the owner/admin guard", () => {
    const source = readFileSync("server/routers/reports/material-costs.router.ts", "utf8");
    expect(source).toMatch(/document:\s*adminOwnerProcedure\.input/);
  });
});
