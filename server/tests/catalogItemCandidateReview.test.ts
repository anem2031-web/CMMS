import { describe, expect, it } from "vitest";
import {
  candidateReviewDisplayName,
  findExactCatalogDuplicate,
  findExactPendingCandidateDuplicate,
  normalizeCandidatePair,
  sameItemGroupIds,
  sameItemPrimaryForCandidate,
  decidedPeerIds,
} from "../_core/catalog-item-candidate-review";
import { nextCatalogItemCode } from "../_core/catalog-item-code";

const items = [
  { id: 1, code: "CAT-001", nameAr: "رباط شاش 2 مم", nameEn: "Gauze Bandage 2mm" },
  { id: 2, code: "CAT-002", nameAr: "سيليكون شفاف", nameEn: "Clear Silicone" },
];

describe("catalog item candidate review", () => {
  it("detects exact Arabic duplicate after normalization", () => {
    expect(findExactCatalogDuplicate({ nameAr: "رِباط شاش 2 مم" }, items)?.id).toBe(1);
  });

  it("detects exact English duplicate case-insensitively", () => {
    expect(findExactCatalogDuplicate({ nameEn: "clear silicone" }, items)?.id).toBe(2);
  });

  it("detects duplicate catalog code", () => {
    expect(findExactCatalogDuplicate({ code: "cat-001" }, items)?.id).toBe(1);
  });

  it("allows a genuinely different item", () => {
    expect(findExactCatalogDuplicate({ nameAr: "ذراع طبي جديد" }, items)).toBeNull();
  });

  it("prefers Arabic snapshot as review display name", () => {
    expect(candidateReviewDisplayName({ itemName: "fallback", itemNameAr: "اسم عربي", itemNameEn: "English" })).toBe("اسم عربي");
  });

  it("detects another pending candidate with the same normalized name", () => {
    const duplicate = findExactPendingCandidateDuplicate({
      nameAr: "سمك شاورما",
      nameEn: "Fish Shawarma",
      catalogSupplierId: 30002,
    }, [
      { id: 1, itemName: "سمك شاورما", itemNameAr: "سمك شاورما", itemNameEn: null, catalogSupplierId: 30002 },
      { id: 2, itemName: "ذراع طبي", itemNameAr: "ذراع طبي", itemNameEn: null, catalogSupplierId: 30002 },
    ]);
    expect(duplicate?.id).toBe(1);
  });

  it("uses supplier SKU as an exact pending duplicate only for the same supplier", () => {
    const duplicate = findExactPendingCandidateDuplicate({
      nameAr: "اسم مختلف",
      code: "SKU-77",
      catalogSupplierId: 30002,
    }, [
      { id: 3, itemName: "وصف آخر", supplierItemCode: "SKU77", catalogSupplierId: 30002 },
      { id: 4, itemName: "وصف مورد آخر", supplierItemCode: "SKU77", catalogSupplierId: 30003 },
    ]);
    expect(duplicate?.id).toBe(3);
  });


  it("normalizes candidate pair IDs deterministically", () => {
    expect(normalizeCandidatePair(9, 3)).toEqual({ candidateLowId: 3, candidateHighId: 9 });
  });

  it("identifies the secondary candidate primary in a same-item decision", () => {
    const decisions = [{ candidateLowId: 1, candidateHighId: 3, decision: "same_item" as const, primaryCandidateId: 1 }];
    expect(sameItemPrimaryForCandidate(3, decisions)).toBe(1);
    expect(sameItemPrimaryForCandidate(1, decisions)).toBeNull();
  });

  it("builds all same-item members for the primary candidate", () => {
    const decisions = [
      { candidateLowId: 1, candidateHighId: 3, decision: "same_item" as const, primaryCandidateId: 1 },
      { candidateLowId: 1, candidateHighId: 5, decision: "same_item" as const, primaryCandidateId: 1 },
      { candidateLowId: 2, candidateHighId: 8, decision: "not_same_item" as const, primaryCandidateId: null },
    ];
    expect(sameItemGroupIds(1, decisions).sort((a, b) => a - b)).toEqual([1, 3, 5]);
  });

  it("returns already-decided peers so duplicate suggestions do not loop", () => {
    const decisions = [
      { candidateLowId: 1, candidateHighId: 3, decision: "same_item" as const, primaryCandidateId: 1 },
      { candidateLowId: 1, candidateHighId: 7, decision: "not_same_item" as const, primaryCandidateId: null },
    ];
    expect(decidedPeerIds(1, decisions).sort((a, b) => a - b)).toEqual([3, 7]);
  });

  it("starts an empty leaf with category code + 0001", () => {
    expect(nextCatalogItemCode("111", [])).toBe("1110001");
  });

  it("increments a four-digit suffix while preserving its width", () => {
    expect(nextCatalogItemCode("111", [
      { id: 1, code: "1110001" },
      { id: 2, code: "1110002" },
      { id: 3, code: "1110003" },
    ])).toBe("1110004");
  });

  it("preserves an existing three-digit suffix pattern", () => {
    expect(nextCatalogItemCode("111", [
      { id: 1, code: "111001" },
      { id: 2, code: "111002" },
      { id: 3, code: "111003" },
    ])).toBe("111004");
  });

  it("uses the latest valid suffix width when legacy widths are mixed", () => {
    expect(nextCatalogItemCode("111", [
      { id: 1, code: "1110008" },
      { id: 2, code: "111009" },
      { id: 3, code: "111010" },
    ])).toBe("111011");
  });

});
