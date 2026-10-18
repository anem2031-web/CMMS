import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  comparePurchaseRequiredDates, purchaseDateOnly, purchaseRequiredDateFromSubmission,
  remainingPurchaseCalendarDays, resolvePurchaseItemNeedTiming, riyadhPurchaseDate,
} from "../../shared/purchaseItemNeedDate";
import { purchaseItemNeedTimingShape, validatePurchaseItemNeedTiming } from "../routers/purchase/item-need-timing";
import { formatRemainingPurchaseDuration } from "../../client/src/lib/purchaseItemTiming";

const schema = z.object(purchaseItemNeedTimingShape).superRefine(validatePurchaseItemNeedTiming);
describe("Purchase item lead time and submission deadlines", () => {
  it("does not start any deadline when saving or reopening a draft", () => {
    const draft = resolvePurchaseItemNeedTiming({ deliveryLeadDays: 3, requiredDate: "2026-10-11" });
    expect(draft).toEqual({ deliveryLeadDays: 3, requiredDate: null });
    expect(resolvePurchaseItemNeedTiming(draft)).toEqual(draft);
    expect(resolvePurchaseItemNeedTiming(draft, new Date("2026-10-15T09:00:00Z"))).toEqual({ deliveryLeadDays: 3, requiredDate: "2026-10-18" });
  });
  it("calculates each item from the same actual submission day", () => {
    const at = new Date("2026-10-15T09:00:00Z");
    expect([0, 2, 3, 5].map(days => purchaseRequiredDateFromSubmission(days, at))).toEqual(["2026-10-15", "2026-10-17", "2026-10-18", "2026-10-20"]);
  });
  it("uses the Riyadh calendar across UTC midnight, regardless of host timezone", () => {
    const at = new Date("2026-10-17T21:01:00Z");
    expect(riyadhPurchaseDate(at)).toBe("2026-10-18");
    expect(purchaseRequiredDateFromSubmission(2, at)).toBe("2026-10-20");
    expect(remainingPurchaseCalendarDays("2026-10-18", at)).toBe(0);
  });
  it.each([
    ["2026-12-31T19:00:00Z", 2, "2027-01-02"],
    ["2028-02-28T09:00:00Z", 2, "2028-03-01"],
    ["2027-02-28T09:00:00Z", 1, "2027-03-01"],
  ])("handles year/month/leap boundaries: %s", (at, days, date) => {
    expect(purchaseRequiredDateFromSubmission(days as number, new Date(at as string))).toBe(date);
  });
  it("keeps historical dates intact when duration is NULL or omitted", () => {
    for (const input of [{ requiredDate: "2026-01-02" }, { deliveryLeadDays: null, requiredDate: "2026-01-02" }]) {
      expect(resolvePurchaseItemNeedTiming(input)).toEqual({ deliveryLeadDays: null, requiredDate: "2026-01-02" });
      expect(resolvePurchaseItemNeedTiming(input, new Date("2026-10-17T12:00:00Z"))).toEqual({ deliveryLeadDays: null, requiredDate: "2026-01-02" });
    }
  });
  it("ignores a supplied date when a valid duration is provided", () => {
    expect(resolvePurchaseItemNeedTiming({ deliveryLeadDays: 2, requiredDate: "2030-01-01" }, new Date("2026-10-17T12:00:00Z"))).toEqual({ deliveryLeadDays: 2, requiredDate: "2026-10-19" });
  });
  it.each([-1, 1.5, NaN, Infinity, 3651, "3", null, undefined])("rejects an invalid duration without a legacy date: %s", deliveryLeadDays => {
    expect(schema.safeParse({ deliveryLeadDays }).success).toBe(false);
  });
  it.each(["2026-02-30", "2026-13-01", "", "2026-10-17T12:00:00Z", "0000-01-01"]) ("rejects invalid calendar dates: %s", requiredDate => {
    expect(purchaseDateOnly(requiredDate)).toBeNull();
    expect(schema.safeParse({ requiredDate }).success).toBe(false);
  });
  it("accepts 0 and retains legacy API date input", () => {
    expect(schema.parse({ deliveryLeadDays: 0 })).toEqual({ deliveryLeadDays: 0 });
    expect(schema.parse({ requiredDate: "2026-10-17" })).toEqual({ requiredDate: "2026-10-17" });
  });
  it("refuses missing timing and invalid clocks", () => {
    expect(() => resolvePurchaseItemNeedTiming({})).toThrow();
    expect(() => purchaseRequiredDateFromSubmission(2, new Date("invalid"))).toThrow();
  });
});

describe("Delegate urgency order and live remaining days", () => {
  it("puts earliest deadlines first, missing dates last, and equal dates in stable ID order", () => {
    const items = [
      { id: 7, requiredDate: null }, { id: 4, requiredDate: "2026-10-20" },
      { id: 3, requiredDate: "2026-10-18" }, { id: 2, requiredDate: "2026-10-18" },
      { id: 1, requiredDate: "2026-10-16" }, { id: 8, requiredDate: "invalid" },
    ];
    expect([...items].sort(comparePurchaseRequiredDates).map(item => item.id)).toEqual([1, 2, 3, 4, 7, 8]);
    expect(items[0].id).toBe(7);
  });
  it("calculates calendar days, not rounded hours", () => {
    const now = new Date("2026-10-17T20:59:00Z");
    expect(remainingPurchaseCalendarDays("2026-10-18", now)).toBe(1);
    expect(remainingPurchaseCalendarDays("2026-10-17", now)).toBe(0);
    expect(remainingPurchaseCalendarDays("2026-10-15", now)).toBe(-2);
    expect(remainingPurchaseCalendarDays(null, now)).toBeNull();
  });
  it.each([
    [3, "ar", "متبقي 3 أيام"], [0, "ar", "مطلوب اليوم"], [-2, "ar", "متأخر يومين"],
    [1, "en", "1 day remaining"], [0, "en", "Due today"], [-3, "en", "3 days late"],
    [3, "ur", "3 دن باقی ہیں"], [0, "ur", "آج درکار ہے"], [-2, "ur", "2 دن تاخیر"],
    [null, "ar", "—"],
  ])("labels %s days in %s", (days, language, label) => {
    expect(formatRemainingPurchaseDuration(days as number | null, language as string)).toBe(label);
  });
});
