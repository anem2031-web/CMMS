import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_ROLE, canRoleAccessPath } from "../../shared/roles";

const service = vi.hoisted(() => ({
  list: vi.fn(async () => []), detail: vi.fn(async () => ({ draft: { id: 4 } })),
  saveDraft: vi.fn(async () => ({ draftId: 4, version: 1 })),
  submitDraft: vi.fn(async () => ({ draftId: 4, version: 2 })),
  returnDraft: vi.fn(async () => ({ draftId: 4, version: 3 })),
  approveDraft: vi.fn(async () => ({ draftId: 4, version: 3, settlementId: 12 })),
  requestCountCorrection: vi.fn(async () => ({ requestId: 7, draftId: 4 })),
  saveCountCorrection: vi.fn(async () => ({ draftId: 4, version: 4 })),
}));
vi.mock("../services/inventory/settlement-review", () => ({ createInventorySettlementReviewService: () => service }));
vi.mock("../_core/db", () => ({ getDb: vi.fn(), applySettlement: vi.fn() }));
vi.mock("../_core/inventory-lots", () => ({ isInventoryLotsEnabled: () => false }));
vi.mock("../_core/catalog-unit-governance", () => ({ findKnownInactiveCatalogUnitNames: vi.fn() }));
vi.mock("../services/inventory/openingBalanceBulkExcel.service", () => ({
  createOpeningBalanceTemplate: vi.fn(), previewOpeningBalanceImport: vi.fn(),
  commitOpeningBalanceImport: vi.fn(), exportOpeningBalanceOperation: vi.fn(),
}));
import { router } from "../_core/trpc";
import { inventoryCountRouter } from "../routers/inventory/inventoryCount.router";

const api = router({ inventoryCount: inventoryCountRouter });
function caller(role?: string, projectedRole?: string) {
  const actor = role ? { id: 31, role, isActive: 1 } : null;
  return api.createCaller({
    user: projectedRole ? { ...actor, role: projectedRole } : actor,
    ...(projectedRole ? { authenticatedUser: actor } : {}), req: {}, res: {},
  } as any).inventoryCount;
}
const version = { draftId: 4, expectedVersion: 2 };
const reason = "تصحيح موثق لغرض اختبار الصلاحيات";
const creators = ["warehouse", "admin", "owner"];
const reviewers = ["senior_management", "admin", "owner"];
beforeEach(() => vi.clearAllMocks());

describe("settlement review passes through real central and role guards", () => {
  it.each(Object.values(APP_ROLE))("enforces creator and approver boundaries for %s", async role => {
    const c = caller(role);
    const prepare = c.saveSettlementDraft({ sourceCountOperationId: 9, reason });
    if (creators.includes(role)) await expect(prepare).resolves.toHaveProperty("draftId", 4);
    else await expect(prepare).rejects.toMatchObject({ code: "FORBIDDEN" });
    const approve = c.approveSettlementDraft(version);
    if (reviewers.includes(role)) await expect(approve).resolves.toHaveProperty("settlementId", 12);
    else await expect(approve).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it.each(Object.values(APP_ROLE))("restricts returns and count correction authorization for %s", async role => {
    const c = caller(role);
    const check = async (work: Promise<unknown>) => {
      if (reviewers.includes(role)) await expect(work).resolves.toBeDefined();
      else await expect(work).rejects.toMatchObject({ code: "FORBIDDEN" });
    };
    await check(c.returnSettlementDraft({ ...version, reason }));
    await check(c.requestCountCorrection({ ...version, reason, countItemIds: [71] }));
  });
  it.each(Object.values(APP_ROLE))("restricts preparation, resubmission and named corrections for %s", async role => {
    const c = caller(role);
    const check = async (work: Promise<unknown>) => {
      if (creators.includes(role)) await expect(work).resolves.toBeDefined();
      else await expect(work).rejects.toMatchObject({ code: "FORBIDDEN" });
    };
    await check(c.submitSettlementDraft(version));
    await check(c.correctCount({ requestId: 7, reason, items: [{ countItemId: 71, countedQuantity: 95 }] }));
  });
  it.each(Object.values(APP_ROLE))("bounds review page and read APIs for %s", async role => {
    const allowed = [...creators, ...reviewers, "observer"].includes(role);
    expect(canRoleAccessPath(role, "/inventory-settlement-review")).toBe(allowed);
    if (allowed) {
      await expect(caller(role).settlementDrafts()).resolves.toEqual([]);
      await expect(caller(role).settlementDraftDetails({ draftId: 4 })).resolves.toHaveProperty("draft.id", 4);
    } else {
      await expect(caller(role).settlementDrafts()).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(caller(role).settlementDraftDetails({ draftId: 4 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
  it("rejects projected admin identity and client-supplied approval actors", async () => {
    await expect(caller("warehouse", "admin").approveSettlementDraft(version)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("senior_management").approveSettlementDraft({ ...version, approvedById: 999 } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.approveDraft).not.toHaveBeenCalled();
  });
  it("takes the preparer identity exclusively from the authenticated context", async () => {
    await caller("warehouse").saveSettlementDraft({ sourceCountOperationId: 9, reason });
    expect(service.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ id: 31, role: "warehouse" }), { sourceCountOperationId: 9, reason });
  });
  it("requires return explanation and rejects forged count and financial fields", async () => {
    await expect(caller("senior_management").returnSettlementDraft({ ...version, reason: " " })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller("warehouse").saveSettlementDraft({ sourceCountOperationId: 9, reason, items: [{ afterQuantity: 1000, unitCostUsed: 0 }] } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller("warehouse").correctCount({ requestId: 7, reason, items: [{ countItemId: 71, countedQuantity: 95, inventoryId: 999 }] } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.returnDraft).not.toHaveBeenCalled();
    expect(service.saveDraft).not.toHaveBeenCalled();
    expect(service.saveCountCorrection).not.toHaveBeenCalled();
  });
  it("rejects unauthenticated use", async () => {
    await expect(caller().settlementDrafts()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller().approveSettlementDraft(version)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(service.list).not.toHaveBeenCalled();
    expect(service.approveDraft).not.toHaveBeenCalled();
  });
  it("does not expose internal database queries through a review error", async () => {
    service.approveDraft.mockRejectedValueOnce(new Error("Failed query: secret internal SQL"));
    const result = caller("senior_management").approveSettlementDraft(version);
    await expect(result).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    await expect(result).rejects.not.toHaveProperty("message", expect.stringContaining("Failed query"));
  });
});
