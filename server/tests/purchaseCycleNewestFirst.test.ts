import { describe, expect, it } from "vitest";
import { sortPurchaseCycleItemsNewestFirst } from "../../client/src/pages/purchase/purchaseCycleSorting";

describe("purchase cycle newest-first ordering", () => {
  it("shows the newest item first", () => {
    const items = [
      { id: 1, createdAt: "2026-08-01T08:00:00.000Z" },
      { id: 2, createdAt: "2026-08-03T08:00:00.000Z" },
      { id: 3, createdAt: "2026-08-02T08:00:00.000Z" },
    ];

    expect(sortPurchaseCycleItemsNewestFirst(items).map(item => item.id)).toEqual([2, 3, 1]);
  });

  it("does not mutate the query result array", () => {
    const items = [
      { id: 1, createdAt: "2026-08-01T08:00:00.000Z" },
      { id: 2, createdAt: "2026-08-03T08:00:00.000Z" },
    ];
    const originalOrder = items.map(item => item.id);

    sortPurchaseCycleItemsNewestFirst(items);

    expect(items.map(item => item.id)).toEqual(originalOrder);
  });

  it("keeps equal or missing dates stable and places missing dates last", () => {
    const items = [
      { id: 1, createdAt: null },
      { id: 2, createdAt: "2026-08-03T08:00:00.000Z" },
      { id: 3, createdAt: "2026-08-03T08:00:00.000Z" },
      { id: 4 },
    ];

    expect(sortPurchaseCycleItemsNewestFirst(items).map(item => item.id)).toEqual([2, 3, 1, 4]);
  });

  it("accepts Date and numeric date values", () => {
    const items = [
      { id: 1, createdAt: new Date("2026-08-01T08:00:00.000Z") },
      { id: 2, createdAt: new Date("2026-08-02T08:00:00.000Z").getTime() },
    ];

    expect(sortPurchaseCycleItemsNewestFirst(items).map(item => item.id)).toEqual([2, 1]);
  });
});
