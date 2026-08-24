import { describe, expect, it } from "vitest";
import { filterStockCardItems, resolveStockCardItemFromSearch } from "@/lib/stockCardItemSearch";

const items = [
  { key: "code:INV-2026-210274", internalCode: "INV-2026-210274", itemName: "سيكا رابيد 2 مواد سرعة تصلب" },
  { key: "code:INV-2026-210275", internalCode: "INV-2026-210275", itemName: "ايبوكسي ماجيك لاصق" },
  { key: "code:INV-TEST-1", internalCode: "INV-TEST-1", itemName: "سيكا اختبار أول" },
];

describe("Main Phase 6.2.4 Stock Card item search", () => {
  it("selects a unique exact Arabic item-name match", () => {
    expect(resolveStockCardItemFromSearch(items, "سيكا رابيد 2 مواد سرعة تصلب")?.key)
      .toBe("code:INV-2026-210274");
  });

  it("selects a unique exact internal-code match", () => {
    expect(resolveStockCardItemFromSearch(items, "INV-2026-210275")?.key)
      .toBe("code:INV-2026-210275");
  });

  it("selects a single partial match but never guesses between ambiguous matches", () => {
    expect(resolveStockCardItemFromSearch(items, "ماجيك")?.key)
      .toBe("code:INV-2026-210275");
    expect(resolveStockCardItemFromSearch(items, "سيكا")).toBeNull();
  });

  it("filters the Stock Card item chooser with the same search text", () => {
    expect(filterStockCardItems(items, "210274").map((item) => item.key))
      .toEqual(["code:INV-2026-210274"]);
  });
});
