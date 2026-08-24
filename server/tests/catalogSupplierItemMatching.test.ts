import { describe, expect, it } from "vitest";
import {
  buildHybridCatalogShortlist,
  buildStrongLocalFallbackMatch,
  compareMeasurements,
  extractNormalizedMeasurements,
  mergeAiSemanticDiscoveryResults,
  normalizeCatalogItemText,
  rankCatalogItemMatches,
  shouldExpandHybridSearch,
} from "../_core/catalog-item-matching";

describe("2B-3 catalog supplier item matching", () => {
  it("normalizes equivalent metric sizes", () => {
    expect(extractNormalizedMeasurements("0.2 cm")[0]?.value).toBeCloseTo(2, 6);
    expect(extractNormalizedMeasurements("٠.٢ سم")[0]?.value).toBeCloseTo(2, 6);
    expect(extractNormalizedMeasurements("٠٫٢ سم")[0]?.value).toBeCloseTo(2, 6);
    expect(compareMeasurements("رباط شاش 2 mm", "Gauze Bandage 0.2 cm").status).toBe("compatible");
  });

  it("flags a real size conflict after unit conversion", () => {
    const result = compareMeasurements("رباط شاش 2 mm", "Gauze Bandage 0.02 cm");
    expect(result.status).toBe("conflict");
  });

  it("recognizes Arabic/English gauze-bandage semantics while respecting size", () => {
    const ranked = rankCatalogItemMatches({
      query: { itemName: "شاش باندينج 2 ملي" },
      catalogItems: [
        { id: 1, nameAr: "رباط شاش 2 مم", nameEn: "Gauze Bandage 2 mm" },
        { id: 2, nameAr: "رباط شاش 5 مم", nameEn: "Gauze Bandage 5 mm" },
      ],
    });

    expect(ranked[0]?.catalogItemId).toBe(1);
    expect(ranked.find(row => row.catalogItemId === 2)?.measurementStatus).toBe("conflict");
  });

  it("auto-selects a previously confirmed supplier SKU when specifications do not conflict", () => {
    const aliasName = 'MASKING TAPE WHITE 2"';
    const ranked = rankCatalogItemMatches({
      query: { itemName: "اسم مختلف", supplierItemCode: "MT-W2" },
      catalogItems: [
        { id: 10, nameAr: "شريط لاصق أبيض 2 بوصة", nameEn: "Masking Tape White 2 inch" },
      ],
      supplierAliases: [
        {
          id: 1,
          supplierId: 7,
          catalogItemId: 10,
          supplierItemName: aliasName,
          normalizedName: normalizeCatalogItemText(aliasName),
          supplierItemCode: "MT-W2",
          normalizedItemCode: "MTW2",
        },
      ],
    });

    expect(ranked[0]?.catalogItemId).toBe(10);
    expect(ranked[0]?.reason).toBe("supplier_code_exact");
    expect(ranked[0]?.autoSelect).toBe(true);
  });

  it("builds a bounded hybrid shortlist and keeps the relevant catalog item near the top", () => {
    const catalogItems = [
      { id: 21, nameAr: "كرتون سيليكون شفاف", nameEn: "Clear Silicone Sealant Box" },
      { id: 22, nameAr: "سرير دبل أصلي", nameEn: "Original Double Bed" },
      ...Array.from({ length: 70 }, (_, index) => ({
        id: 100 + index,
        nameAr: `صنف تجريبي ${index}`,
        nameEn: `Generic Test Item ${index}`,
      })),
    ];

    const shortlist = buildHybridCatalogShortlist({
      query: { itemName: "سيليكون شفاف أصلي" },
      catalogItems,
    });

    expect(shortlist.items.length).toBeLessThanOrEqual(100);
    expect(shortlist.items.slice(0, 5).some(item => item.id === 21)).toBe(true);
    expect(shortlist.topRetrievalScore).toBeGreaterThan(0.34);
  });


  it("expands a medium local score instead of trusting a 53% lexical signal", () => {
    expect(shouldExpandHybridSearch(0.53)).toBe(true);
    expect(shouldExpandHybridSearch(0.71)).toBe(true);
    expect(shouldExpandHybridSearch(0.72)).toBe(false);
    expect(shouldExpandHybridSearch(0.88)).toBe(false);
  });

  it("uses AI-expanded bilingual terms to recover a semantic synonym without scanning the full catalog", () => {
    const catalogItems = [
      { id: 31, nameAr: "كرتون سيليكون شفاف", nameEn: "Clear Silicone Sealant Box" },
      { id: 32, nameAr: "قماش بيج شفاف", nameEn: "Transparent Beige Fabric" },
      ...Array.from({ length: 60 }, (_, index) => ({
        id: 200 + index,
        nameAr: `قطعة متنوعة ${index}`,
        nameEn: `Miscellaneous Part ${index}`,
      })),
    ];

    const shortlist = buildHybridCatalogShortlist({
      query: { itemName: "مادة مانعة للتسرب شفافة" },
      catalogItems,
      extraSearchTerms: ["سيليكون شفاف", "clear silicone sealant"],
      size: 120,
    });

    expect(shortlist.items.slice(0, 3).some(item => item.id === 31)).toBe(true);
    expect(shortlist.items.length).toBeLessThanOrEqual(120);
  });

  it("lets AI discover a catalog item that deterministic matching did not shortlist", () => {
    const merged = mergeAiSemanticDiscoveryResults({
      query: { itemName: "مادة مانعة للتسرب شفافة" },
      catalogItems: [
        { id: 21, nameAr: "كرتون سيليكون شفاف", nameEn: "Clear Silicone Sealant (Box)" },
        { id: 22, nameAr: "سرير دبل أصلي", nameEn: "Original Double Bed" },
      ],
      deterministicCandidates: [],
      aiScores: [
        { catalogItemId: 21, semanticScore: 0.91 },
        { catalogItemId: 22, semanticScore: 0.22 },
      ],
      limit: 5,
    });

    expect(merged[0]?.catalogItemId).toBe(21);
    expect(merged[0]?.reason).toBe("ai_semantic");
    expect(merged[0]?.score).toBeGreaterThanOrEqual(75);
    expect(merged[0]?.autoSelect).toBe(false);
    expect(merged.some(row => row.catalogItemId === 22)).toBe(false);
  });

  it("keeps a strong AI semantic candidate visible but never auto-selects a measurement conflict", () => {
    const merged = mergeAiSemanticDiscoveryResults({
      query: { itemName: "رباط شاش 2 mm" },
      catalogItems: [
        { id: 31, nameAr: "رباط شاش 0.2 mm", nameEn: "Gauze Bandage 0.2 mm" },
      ],
      deterministicCandidates: [],
      aiScores: [{ catalogItemId: 31, semanticScore: 0.96 }],
    });

    expect(merged[0]?.catalogItemId).toBe(31);
    expect(merged[0]?.measurementStatus).toBe("conflict");
    expect(merged[0]?.score).toBeGreaterThanOrEqual(75);
    expect(merged[0]?.autoSelect).toBe(false);
  });

  it("keeps a strong local retrieval candidate visible when DeepSeek is conservative", () => {
    const shortlist = buildHybridCatalogShortlist({
      query: { itemName: "سيليكون شفاف اصلي" },
      catalogItems: [
        { id: 180281, nameAr: "كرتون سيليكون شفاف", nameEn: "Clear Silicone Sealant Box" },
        { id: 44, nameAr: "سرير دبل أصلي", nameEn: "Original Double Bed" },
      ],
      extraSearchTerms: ["سيليكون شفاف", "clear silicone sealant"],
      size: 120,
    });

    const fallback = buildStrongLocalFallbackMatch({
      query: { itemName: "سيليكون شفاف اصلي" },
      shortlist,
    });

    expect(shortlist.topRetrievalScore).toBeGreaterThanOrEqual(0.85);
    expect(fallback?.catalogItemId).toBe(180281);
    expect(fallback?.reason).toBe("catalog_local_strong");
    expect(fallback?.score).toBeGreaterThanOrEqual(85);
    expect(fallback?.autoSelect).toBe(false);
  });

  it("does not expose a weak local retrieval candidate as a trusted fallback", () => {
    const shortlist = buildHybridCatalogShortlist({
      query: { itemName: "وصف بعيد تماما" },
      catalogItems: [
        { id: 1, nameAr: "سرير دبل أصلي", nameEn: "Original Double Bed" },
      ],
    });

    expect(buildStrongLocalFallbackMatch({
      query: { itemName: "وصف بعيد تماما" },
      shortlist,
    })).toBeNull();
  });

});
