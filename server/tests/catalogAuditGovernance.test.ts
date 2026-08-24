import { describe, expect, it } from "vitest";
import { catalogAuditJson, pickAuditValues } from "../_core/catalog-audit";

describe("2B-10-2A catalog audit governance helpers", () => {
  it("captures previous values only for fields included in the update patch", () => {
    const before = {
      id: 17,
      nameAr: "قديم",
      nameEn: "Old",
      code: "711",
      isActive: 1,
    };
    const patch = { nameAr: "جديد", code: "712" };

    expect(pickAuditValues(before, patch)).toEqual({
      nameAr: "قديم",
      code: "711",
    });
  });

  it("uses null for a requested field missing from the pre-change snapshot", () => {
    expect(pickAuditValues({ nameAr: "صنف" }, { manufacturer: "ACME" })).toEqual({
      manufacturer: null,
    });
  });

  it("serializes catalog audit snapshots for the live TEXT columns", () => {
    expect(catalogAuditJson({ isActive: false })).toBe('{"isActive":false}');
    expect(catalogAuditJson(null)).toBeNull();
  });
});
