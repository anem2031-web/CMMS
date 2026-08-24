import { describe, expect, it } from "vitest";
import { buildCatalogItemCandidateValues } from "../_core/catalog-item-candidate";

describe("2B-5 catalog item candidate", () => {
  it("builds a pending Master Data review snapshot without accounting values", () => {
    const values = buildCatalogItemCandidateValues({
      inventoryId: 210129,
      sourceReceiptId: 9001,
      sourceReceiptItemId: 9101,
      purchaseOrderId: 353,
      purchaseOrderItemId: 1234,
      catalogSupplierId: 30002,
      invoiceNumber: " INV-1056 ",
      itemName: " دجاج شاورما امريكي ",
      itemNameAr: " دجاج شاورما امريكي ",
      supplierItemCode: " NEW-001 ",
      purchaseUnit: " carton ",
      createdById: 7,
    });

    expect(values).toMatchObject({
      inventoryId: 210129,
      sourceReceiptId: 9001,
      sourceReceiptItemId: 9101,
      status: "pending",
      itemName: "دجاج شاورما امريكي",
      invoiceNumber: "INV-1056",
      supplierItemCode: "NEW-001",
      purchaseUnit: "carton",
      createdById: 7,
    });
    expect(values).not.toHaveProperty("receivedQuantity");
    expect(values).not.toHaveProperty("unitCost");
  });

  it("keeps unresolved supplier context without inventing a central supplier", () => {
    const values = buildCatalogItemCandidateValues({
      inventoryId: 10,
      sourceReceiptId: 20,
      sourceReceiptItemId: 30,
      supplierCandidateId: 40,
      itemName: "New item",
      createdById: 50,
    });

    expect(values.catalogSupplierId).toBeNull();
    expect(values.supplierCandidateId).toBe(40);
  });

  it("rejects an empty candidate item name", () => {
    expect(() => buildCatalogItemCandidateValues({
      inventoryId: 1,
      sourceReceiptId: 2,
      sourceReceiptItemId: 3,
      itemName: "   ",
      createdById: 4,
    })).toThrow();
  });
});
