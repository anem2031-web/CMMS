import { describe, expect, it } from "vitest";
import {
  formatCatalogCodeSegment,
  isCatalogNodeCodeForParent,
  isHierarchicalCatalogNodeCode,
  isReadableCatalogNodeCode,
  nextCatalogChildCode,
  nextCatalogRootCode,
} from "../_core/catalog-code-format";
import { nextCatalogItemCode } from "../_core/catalog-item-code";
import { buildTaxonomyMovePlan } from "../_core/catalog-taxonomy-restructure";
import { boundedDistinctCatalogCodeAliasEntityIds, buildCatalogCodeAliasIndex, resolveUniqueCatalogCodeAlias } from "../_core/catalog-code-alias";

describe("hierarchical catalog codes", () => {
  it("starts with two digits and expands naturally after 99", () => {
    expect(formatCatalogCodeSegment(1)).toBe("01");
    expect(formatCatalogCodeSegment(99)).toBe("99");
    expect(formatCatalogCodeSegment(100)).toBe("100");
    expect(nextCatalogRootCode(["01", "19", "99"], new Set())).toBe("02");
    expect(nextCatalogRootCode(
      Array.from({ length: 99 }, (_, index) => String(index + 1).padStart(2, "0")),
      new Set(),
    )).toBe("100");
    expect(nextCatalogRootCode(["1", "2", "9901"], new Set(["03"]))).toBe("04");
    expect(nextCatalogChildCode("01", ["01-01", "01-99"], new Set())).toBe("01-100");
  });

  it("validates exact parent boundaries and generates item sequences", () => {
    expect(isHierarchicalCatalogNodeCode("01-100-01")).toBe(true);
    expect(isCatalogNodeCodeForParent("01-100-01", "01-100")).toBe(true);
    expect(isCatalogNodeCodeForParent("01-100-01-01", "01-100")).toBe(false);
    expect(nextCatalogItemCode("01-100-01", [])).toBe("01-100-01-001");
  });

  it("keeps legacy roots readable while creating and moving transitional children", () => {
    expect(isHierarchicalCatalogNodeCode("1-08")).toBe(false);
    expect(isReadableCatalogNodeCode("1-08")).toBe(true);
    expect(isCatalogNodeCodeForParent("1-08", "1")).toBe(true);

    const plan = buildTaxonomyMovePlan({
      nodeId: 2,
      targetParentId: null,
      nodes: [
        { id: 1, parentId: null, code: "1", nameAr: "رئيسي قديم", level: 1, isActive: 1 },
        { id: 2, parentId: 1, code: "1-08", nameAr: "فرع انتقالي", level: 2, isActive: 1 },
      ],
      items: [],
    });

    expect(plan.newRootCode).toBe("02");
    expect(plan.nodeChanges[0]?.newCode).toBe("02");
  });

  it("promotes a legacy subtree and renumbers nodes and items in the new format", () => {
    const plan = buildTaxonomyMovePlan({
      nodeId: 2,
      targetParentId: null,
      nodes: [
        { id: 1, parentId: null, code: "1", nameAr: "رئيسي", level: 1, isActive: 1 },
        { id: 2, parentId: 1, code: "11", nameAr: "فرع", level: 2, isActive: 1 },
        { id: 3, parentId: 2, code: "111", nameAr: "فرع أدنى", level: 3, isActive: 1 },
      ],
      items: [{ id: 10, nodeId: 3, code: "111-001", nameAr: "صنف" }],
    });

    expect(plan.newRootCode).toBe("02");
    expect(plan.nodeChanges.map(change => change.newCode)).toEqual(["02", "02-01"]);
    expect(plan.itemChanges[0]?.newCode).toBe("02-01-001");
  });

  it("preserves duplicate legacy codes per entity and refuses ambiguous resolution", () => {
    const aliases = buildCatalogCodeAliasIndex([
      { entityType: "node", entityId: 540004, oldCode: "11" },
      { entityType: "node", entityId: 150002, oldCode: "11" },
      { entityType: "node", entityId: 270012, oldCode: "711" },
      { entityType: "node", entityId: 270014, oldCode: "711" },
      { entityType: "item", entityId: 99, oldCode: "711" },
    ], "node");

    expect(aliases.get("11")).toEqual(new Set([540004, 150002]));
    expect(() => resolveUniqueCatalogCodeAlias(aliases, "711", "تصنيف"))
      .toThrow("يطابق أكثر من تصنيف");
    expect(resolveUniqueCatalogCodeAlias(aliases, "999", "تصنيف")).toBeUndefined();
  });

  it("bounds and deduplicates historical-code search IDs before list enrichment", () => {
    const rows = Array.from({ length: 900 }, (_, index) => ({
      entityId: index < 50 ? 42 : index,
    }));
    const ids = boundedDistinctCatalogCodeAliasEntityIds(rows, 500);

    expect(ids).toHaveLength(500);
    expect(ids[0]).toBe(42);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
