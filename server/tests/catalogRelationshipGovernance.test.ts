import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("2B-10-2B — Catalog relationship & inactive master protection", () => {
  it("requires active Catalog Items for new purchase-order links but preserves unchanged historical draft links", () => {
    const purchaseDb = read("server/_core/db/purchase.ts");
    const router = read("server/routers/purchase/purchase-orders.router.ts");

    expect(purchaseDb).toContain("export async function getActiveCatalogItemIds");
    expect(purchaseDb).toContain("eq(catalogItems.isActive, 1)");
    expect(router).toContain("previousCatalogItemId === submittedCatalogItemId ? [] : [submittedCatalogItemId]");
    expect(router).toContain("await db.getActiveCatalogItemIds(newRelationshipIds)");
    expect(router).toContain("await assertValidCatalogItemLinks(input.items, existingItems)");
  });

  it("blocks new Catalog nodes/items under an inactive taxonomy path", () => {
    const router = read("server/routers/catalog/catalog.router.ts");

    expect(router).toContain("async function assertActiveCatalogNodePath");
    expect(router).toContain("Number(node.isActive) !== 1");
    expect(router).toContain("await assertActiveCatalogNodePath(db, input.parentId)");
    expect(router).toContain("await assertActiveCatalogNodePath(db, input.nodeId)");
  });

  it("requires active Catalog Items for new receipt links while preserving an inherited PO identity", () => {
    const router = read("server/routers/inventory/receipts.v2.router.ts");

    expect(router).toContain("const isHistoricalContinuation = inheritedPoCatalogItemId === linkedId");
    expect(router).toContain("if (!isHistoricalContinuation && !catalogStateById.get(linkedId))");
    expect(router).toContain("allowInactiveCatalogItem: inheritedPoCatalogItemId === Number(item.linkedItemId)");
    expect(router).toContain("if (allowInactiveCatalogItem)");
    expect(router).toContain("return;");
  });

  it("does not create supplier-item memory for a historical candidate whose supplier is now inactive", () => {
    const router = read("server/routers/catalog/catalog.router.ts");

    expect(router).toContain("if (!supplier || Number(supplier.isActive) !== 1) return;");
  });

  it("keeps inactive taxonomy nodes visible only to Owner/Admin management and supports audited reactivation", () => {
    const router = read("server/routers/catalog/catalog.router.ts");
    const ui = read("client/src/components/catalog/TaxonomyManager.tsx");

    expect(router).toContain("includeInactive: z.boolean().optional()");
    expect(router).toContain("const canIncludeInactive = role === APP_ROLE.OWNER || role === APP_ROLE.ADMIN");
    expect(router).toContain("reactivate: catalogAdminProcedure");
    expect(router).toContain("التصنيف معطّل بالفعل");
    expect(router).toContain("التصنيف نشط بالفعل");
    expect(router).toContain("await assertActiveCatalogNodePath(db, Number(existing.parentId))");
    expect(router).toContain('entityType: "node"');
    expect(router).toContain("oldValues: catalogAuditJson({ isActive: false })");
    expect(router).toContain("newValues: catalogAuditJson({ isActive: true })");
    expect(ui).toContain("includeInactive: true");
    expect(ui).toContain("معطّل");
    expect(ui).toContain("إعادة تفعيل");
    expect(ui).toContain('title="تعطيل"');
    expect(ui).toContain("node.level < 6 && !isInactive");
  });

  it("shows inactive Catalog Items only in Owner/Admin catalog management while operational reads stay active-only", () => {
    const router = read("server/routers/catalog/catalog.router.ts");
    const ui = read("client/src/components/catalog/ItemsManager.tsx");

    expect(router).toContain("includeInactive: z.boolean().optional()");
    expect(router).toContain("role === APP_ROLE.OWNER || role === APP_ROLE.ADMIN");
    expect(router).toContain("if (!includeInactive)");
    expect(ui).toContain("includeInactive: isCatalogAdmin || undefined");
    expect(ui).toContain("معطّل");
    expect(ui).toContain("canDelete && Number(item.isActive) === 1");
    expect(ui).toContain("إعادة تفعيل");
    expect(router).toContain("reactivate: catalogAdminProcedure");
    expect(router).toContain("oldValues: catalogAuditJson({ isActive: false })");
    expect(router).toContain("newValues: catalogAuditJson({ isActive: true })");
    expect(router).toContain("await assertActiveCatalogNodePath(db, Number(existing.nodeId))");
    expect(router).toContain("الصنف معطّل بالفعل");
  });

  it("keeps inactive Catalog Units visible only to Owner/Admin and excludes them from future operational choices", () => {
    const router = read("server/routers/catalog/catalog.router.ts");
    const unitsUi = read("client/src/components/catalog/UnitsManager.tsx");
    const purchaseUi = read("client/src/pages/purchase/CreatePurchaseOrder.tsx");
    const purchaseRouter = read("server/routers/purchase/purchase-orders.router.ts");
    const inventoryRouter = read("server/routers/inventory/inventoryCount.router.ts");
    const candidatesUi = read("client/src/components/catalog/CatalogItemCandidatesManager.tsx");

    expect(router).toContain("includeInactive: z.boolean().optional()");
    expect(router).toContain("reactivate: catalogAdminProcedure");
    expect(router).toContain("وحدة القياس معطّلة بالفعل");
    expect(router).toContain("وحدة القياس نشطة بالفعل");
    expect(router).toContain("assertActiveCatalogMasterUnit");
    expect(unitsUi).toContain("includeInactive: isCatalogAdmin || undefined");
    expect(unitsUi).toContain("معطّل");
    expect(unitsUi).toContain("إعادة تفعيل");
    expect(purchaseUi).toContain("تاريخية/معطّلة");
    expect(purchaseUi).toContain('catalogUnit?.nameAr || ""');
    expect(purchaseRouter).toContain("assertNoInactiveCatalogUnitUsage");
    expect(inventoryRouter).toContain("findKnownInactiveCatalogUnitNames");
    expect(candidatesUi).toContain('activeCandidateUnit?.nameAr || ""');
  });

});
