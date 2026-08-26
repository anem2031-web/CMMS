import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dbSource = readFileSync(resolve("server/_core/db/invoice-drafts.ts"), "utf8");
const routerSource = readFileSync(resolve("server/routers/inventory/inventoryCount.router.ts"), "utf8");
const uiSource = readFileSync(resolve("client/src/pages/inventory/InventoryOperations.tsx"), "utf8");

describe("inventory count unified search", () => {
  it("keeps periodic Lot search inside the opening snapshot", () => {
    expect(dbSource).toContain("eq(inventoryCountSnapshots.operationId, params.operationId)");
    expect(dbSource).toContain("isNotNull(inventoryCountSnapshots.lotId)");
    expect(dbSource).toContain("like(inventoryLots.lotCode, term)");
    expect(dbSource).toContain("like(inventoryLots.trackingToken, term)");
  });

  it("supports catalog code, Arabic/English names and manufacturer barcode", () => {
    expect(dbSource).toContain("like(catalogItems.code, term)");
    expect(dbSource).toContain("like(catalogItems.nameAr, term)");
    expect(dbSource).toContain("like(catalogItems.nameEn, term)");
    expect(dbSource).toContain("like(inventory.manufacturerBarcode, term)");
    expect(dbSource).toContain("like(catalogItemCandidates.manufacturerBarcode, term)");
  });

  it("exposes tree-filtered search in both periodic and opening-balance UI", () => {
    expect(routerSource).toContain("searchCandidates: inventoryReadProcedure");
    expect(routerSource).toContain("catalogNodeId: z.number().int().positive().optional()");
    expect(uiSource).toContain("periodicCountCatalogNodeId");
    expect(uiSource).toContain("openingCatalogNodeId");
    expect(uiSource).toContain("LOT-2026-00001");
    expect(uiSource).toContain("باركود المصنع");
  });
});
