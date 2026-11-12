import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  converted: false,
  stockId: 31,
  db: null as any,
}));

vi.mock("../_core/db/client", () => ({ getDb: async () => state.db }));
vi.mock("../_core/catalog-unit-governance", () => ({
  findCatalogUnitByName: async (name: string) => [
    { id: 1, nameAr: "كرتون", nameEn: "Carton", isActive: 1 },
    { id: 2, nameAr: "حبة", nameEn: "Each", isActive: 1 },
  ].find(unit => unit.nameAr === name || unit.nameEn === name),
}));
vi.mock("../pmv2/adapters/current-system", () => ({
  currentCatalogAdapter: { requireActiveItem: async () => ({ id: 5, unit: "كرتون", nameAr: "صنف" }) },
  currentWarehouseAdapter: { requireSingleActiveMainWarehouse: async () => ({ id: 20 }) },
  currentInventoryAdapter: { getCatalogAvailability: async () => ({ inventoryId: state.stockId,
    unit: state.converted ? "حبة" : "كرتون", availableQuantity: state.converted ? 20 : 1, ambiguous: false }) },
  currentPurchaseAdapter: {},
  Pmv2ExternalReferenceError: class extends Error {},
}));
vi.mock("../pmv2/materials/replacement-coverage", () => ({
  assertPmv2CompensationSettled: async () => {},
  Pmv2ReplacementCoverageError: class extends Error {},
}));
vi.mock("../pmv2/audit/service", () => ({ writePmv2AuditWithDb: async () => {} }));

import { pmv2WarehousePurchaseHandoffService as handoffService } from "../pmv2/materials/warehouse-purchase-handoff-service";

beforeEach(() => {
  state.converted = false;
  state.stockId = 31;
  state.db = {
    execute: async () => [[]],
    select(projection: Record<string, unknown>) {
      const route = { route: "material_request", materialRequestItemId: 10, catalogItemId: 5,
        unit: state.converted ? "حبة" : "كرتون",
        ...(state.converted ? { approvedStockUnit: { inventoryId: 31, warehouseId: 20, unit: "حبة" } } : {}),
      };
      if ("note" in projection) return {
        from: () => ({ where: () => ({ orderBy: async () => [{ note: JSON.stringify(route) }] }) }),
      };
      if ("requestItemId" in projection) return {
        from: () => ({ innerJoin() { return this; }, where: () => ({ limit: async () => [{ requestItemId: 10,
          requestId: 6, catalogItemId: 5, taskItemId: 11, unitSnapshot: route.unit, status: "waiting_warehouse",
          requestedQuantity: state.converted ? 60 : 3, issuedToTeamQuantity: 0 }] }) }),
      };
      return { from: () => ({ where: async () => [] }) };
    },
  };
});

const create = (quantity: number, unit: string) => handoffService.prepareAtomicPurchaseCreation(state.db, {
  requestItemId: 10, purchaseItem: { catalogItemId: 5, quantity, unit },
});

describe("PMV2 purchases for warehouse-converted material requests", () => {
  it("continues to select and require the catalog unit for ordinary PMV2 requests", async () => {
    await expect(handoffService.preparePurchaseHandoff(10)).resolves.toMatchObject({ unit: "كرتون", unitId: 1,
      approvedStockUnit: null, purchaseMinimumQuantity: 2 });
    await expect(create(2, "كرتون")).resolves.toMatchObject({ linkedQuantity: 2 });
    await expect(create(2, "حبة")).rejects.toThrow("Master Data");
  });

  it("uses the approved stock unit and quantity even when the catalog is still in cartons", async () => {
    state.converted = true;
    await expect(handoffService.preparePurchaseHandoff(10)).resolves.toMatchObject({ unit: "حبة", unitId: 2,
      approvedStockUnit: "حبة", purchaseMinimumQuantity: 40 });
    await expect(create(40, "Each")).resolves.toMatchObject({ linkedQuantity: 40, handoff: { approvedStockUnit: "حبة" } });
    await expect(create(40, "كرتون")).rejects.toThrow("اعتماد المستودع");
  });

  it("refuses to use a converted unit if the recorded stock source was replaced", async () => {
    state.converted = true;
    state.stockId = 99;
    await expect(create(40, "حبة")).rejects.toThrow("تغير رصيد المستودع");
  });
});
