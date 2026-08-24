import { describe, expect, it } from "vitest";
import { validateCatalogItemDecision } from "../_core/catalog-item-decision";

describe("2B-4 catalog item decision", () => {
  it("accepts an existing catalog item", () => {
    expect(validateCatalogItemDecision({
      itemName: "Silicone",
      linkedItemId: 180281,
      isNewCatalogItem: false,
    })).toEqual({ ok: true });
  });

  it("accepts an explicit new catalog item decision", () => {
    expect(validateCatalogItemDecision({
      itemName: "New invoice item",
      isNewCatalogItem: true,
    })).toEqual({ ok: true });
  });

  it("rejects an undecided line", () => {
    const result = validateCatalogItemDecision({ itemName: "Undecided" });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("صنف جديد");
  });

  it("rejects linked + new at the same time", () => {
    const result = validateCatalogItemDecision({
      itemName: "Conflict",
      linkedItemId: 123,
      isNewCatalogItem: true,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects marking a PO-catalog-linked line as new", () => {
    const result = validateCatalogItemDecision({
      itemName: "PO linked",
      purchaseOrderItemId: 10,
      isNewCatalogItem: true,
    }, 180281);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("طلب الشراء");
  });
  it("rejects replacing an existing PO catalog identity during receipt", () => {
    const result = validateCatalogItemDecision({
      itemName: "PO protected identity",
      purchaseOrderItemId: 10,
      linkedItemId: 180999,
      isNewCatalogItem: false,
    }, 180281);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("هوية Catalog مختلفة");
  });

});
