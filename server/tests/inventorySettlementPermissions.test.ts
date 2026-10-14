import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const storage = vi.hoisted(() => ({
  applySettlement: vi.fn().mockResolvedValue({ id: 1, settlementNumber: "ADJ-TEST" }),
  createCountOperation: vi.fn().mockResolvedValue({ operationId: 12 }),
  recordCountItem: vi.fn().mockResolvedValue({ success: true }),
  completeCountOperation: vi.fn().mockResolvedValue({ success: true }),
  listSettlements: vi.fn().mockResolvedValue([{ id: 1, settlementNumber: "ADJ-TEST" }]),
  getSettlementDetails: vi.fn().mockResolvedValue({ settlement: { id: 1 }, items: [] }),
  getCountOperationDetails: vi.fn().mockResolvedValue({ operation: { id: 12 }, items: [] }),
}));

// No real storage, environment, inventory adapter or import service is loaded.
vi.mock("../_core/db", () => storage);
vi.mock("../_core/inventory-lots", () => ({ isInventoryLotsEnabled: () => false }));
vi.mock("../_core/catalog-unit-governance", () => ({
  findKnownInactiveCatalogUnitNames: vi.fn().mockResolvedValue([]),
}));
vi.mock("../services/inventory/openingBalanceBulkExcel.service", () => ({
  createOpeningBalanceTemplate: vi.fn(),
  previewOpeningBalanceImport: vi.fn(),
  commitOpeningBalanceImport: vi.fn(),
  exportOpeningBalanceOperation: vi.fn(),
}));

import { router } from "../_core/trpc";
import { inventoryCountRouter } from "../routers/inventory/inventoryCount.router";
import { APP_ROLE } from "../../shared/roles";

const testRouter = router({ inventoryCount: inventoryCountRouter });
const caller = (role: string | null, actualRole?: string) => {
  const user = role ? { id: 42, role, isActive: 1 } : null;
  return testRouter.createCaller({
    user,
    ...(actualRole ? { authenticatedUser: { id: 42, role: actualRole, isActive: 1 } } : {}),
    req: {},
    res: {},
  } as TrpcContext).inventoryCount;
};
const input = (sourceType: "manual" | "from_count") => ({
  sourceType,
  ...(sourceType === "from_count" ? { sourceCountOperationId: 12 } : {}),
  reason: "Documented stock discrepancy",
  items: [{ inventoryId: 501, afterQuantity: 5 }],
});

beforeEach(() => vi.clearAllMocks());

describe("inventory settlement authorization through the real tRPC guards", () => {
  it.each(["manual", "from_count"] as const)(
    "denies warehouse %s posting before any storage operation",
    async sourceType => {
      await expect(caller("warehouse").applySettlement(input(sourceType)))
        .rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(storage.applySettlement).not.toHaveBeenCalled();
    }
  );

  it("does not accept a forged privileged role or actor from the input", async () => {
    await expect(caller("warehouse").applySettlement({
      ...input("manual"), role: "owner", appliedById: 999,
    } as any)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storage.applySettlement).not.toHaveBeenCalled();
  });

  it.each(["owner", "admin"])("keeps both posting sources available to %s", async role => {
    for (const sourceType of ["manual", "from_count"] as const) {
      await expect(caller(role).applySettlement(input(sourceType)))
        .resolves.toEqual({ id: 1, settlementNumber: "ADJ-TEST" });
      expect(storage.applySettlement).toHaveBeenLastCalledWith({
        ...input(sourceType),
        sourceCountOperationId: sourceType === "from_count" ? 12 : undefined,
        reference: undefined,
        appliedById: 42,
      });
    }
  });

  it.each(Object.values(APP_ROLE).filter(role => role !== "owner" && role !== "admin"))(
    "does not grant posting to %s", async role => {
      await expect(caller(role).applySettlement(input("from_count")))
        .rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(storage.applySettlement).not.toHaveBeenCalled();
    }
  );

  it("keeps observer forbidden even with an admin presentation identity", async () => {
    await expect(caller("admin", "observer").applySettlement(input("manual")))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(storage.applySettlement).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated caller", async () => {
    await expect(caller(null).applySettlement(input("manual")))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(storage.applySettlement).not.toHaveBeenCalled();
  });
});

describe("warehouse retains count execution and settlement reading", () => {
  it("still starts counts, records quantities and finalizes counts", async () => {
    const api = caller("warehouse");
    await api.createOperation({ scope: "full", warehouseId: 7 });
    await api.recordItem({ countItemId: 20, countedQuantity: 5 });
    await api.completeOperation({ operationId: 12 });
    expect(storage.createCountOperation).toHaveBeenCalledWith(expect.objectContaining({ createdById: 42 }));
    expect(storage.recordCountItem).toHaveBeenCalledWith(expect.objectContaining({ countedById: 42, countedQuantity: 5 }));
    expect(storage.completeCountOperation).toHaveBeenCalledWith(12);
    expect(storage.applySettlement).not.toHaveBeenCalled();
  });

  it("still reads settlement lists/details and count details", async () => {
    const api = caller("warehouse");
    await expect(api.listSettlements()).resolves.toHaveLength(1);
    await expect(api.settlementDetails({ settlementId: 1 })).resolves.toHaveProperty("items");
    await expect(api.operationDetails({ operationId: 12 })).resolves.toHaveProperty("operation.id", 12);
    expect(storage.applySettlement).not.toHaveBeenCalled();
  });
});
