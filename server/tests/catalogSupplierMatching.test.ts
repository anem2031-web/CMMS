import { describe, expect, it } from "vitest";
import { matchSuppliers, normalizeSupplierIdentifier, normalizeSupplierName } from "../_core/catalog-supplier-matching";

const suppliers = [
  {
    id: 1,
    nameAr: "شركة الأمير للمستلزمات",
    nameEn: "Al Ameer Supplies",
    taxNumber: "310123456700003",
    aliases: ["مؤسسة الأمير"],
  },
  {
    id: 2,
    nameAr: "الأمير للصيانة",
    nameEn: "Al Ameer Maintenance",
    taxNumber: "310999999900003",
    aliases: [],
  },
  {
    id: 3,
    nameAr: "مؤسسة النور التجارية",
    nameEn: "Al Noor Trading",
    taxNumber: "310777777700003",
    aliases: [],
  },
];

describe("catalog supplier matching 2B-2", () => {
  it("normalizes Arabic spelling and punctuation", () => {
    expect(normalizeSupplierName("  شركة الأمِير، للمستلزمات ")).toContain("الامير");
  });

  it("normalizes Arabic digits in supplier identifiers", () => {
    expect(normalizeSupplierIdentifier("٣١٠-١٢٣")).toBe("310123");
  });

  it("prioritizes exact tax-number matching", () => {
    const result = matchSuppliers(suppliers, "اسم مختلف", "310123456700003");
    expect(result[0]?.id).toBe(1);
    expect(result[0]?.score).toBe(100);
    expect(result[0]?.reason).toBe("tax_exact");
  });

  it("recognizes a saved supplier alias before fuzzy name results", () => {
    const result = matchSuppliers(suppliers, "مؤسسة الأمير");
    expect(result[0]?.id).toBe(1);
    expect(result[0]?.reason).toBe("alias_exact");
    expect(result[0]?.score).toBe(99);
  });

  it("suggests close supplier names without inventing a new supplier", () => {
    const result = matchSuppliers(suppliers, "الامير");
    expect(result.map(x => x.id)).toContain(1);
    expect(result.map(x => x.id)).toContain(2);
    expect(result.map(x => x.id)).not.toContain(3);
  });
});
