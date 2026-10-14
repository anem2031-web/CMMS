import { describe, expect, it } from "vitest";
import {
  isValidPurchaseRequiredDate,
  looksLikeRawValidationError,
  parsePurchaseOrderValidationIssues,
} from "./purchaseOrderValidation";

describe("purchase order validation helpers", () => {
  it("parses a raw Zod item path", () => {
    const message = JSON.stringify([
      { code: "too_small", path: ["items", 1, "itemName"], message: "Too small" },
    ]);
    expect(parsePurchaseOrderValidationIssues(message)).toEqual([
      { code: "too_small", path: ["items", 1, "itemName"], message: "Too small" },
    ]);
  });

  it("parses a Zod array embedded in a tRPC message", () => {
    const message = `Invalid input: ${JSON.stringify([
      { code: "invalid_type", path: ["siteId"], message: "Expected number" },
    ])}`;
    expect(parsePurchaseOrderValidationIssues(message)[0]?.path).toEqual(["siteId"]);
  });

  it("does not classify normal API errors as raw validation output", () => {
    expect(looksLikeRawValidationError("طلب الشراء غير موجود")).toBe(false);
    expect(looksLikeRawValidationError('[{"code":"too_small","path":["items",0,"itemName"]}]')).toBe(true);
  });

  it("validates real calendar dates", () => {
    expect(isValidPurchaseRequiredDate("2026-10-05")).toBe(true);
    expect(isValidPurchaseRequiredDate("2026-02-31")).toBe(false);
    expect(isValidPurchaseRequiredDate("")).toBe(false);
  });
});
