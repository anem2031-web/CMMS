import { describe, expect, it } from "vitest";
import { refreshPurchaseExecution } from "../../client/src/lib/purchaseExecutionRefresh";

function fixture(failRefresh = false) {
  const events: string[] = [];
  const orders = new Map([[1, { id: 1, status: "approved", items: [{ id: 10, status: "approved" }, { id: 11, status: "approved" }] }]]);
  const lists: Record<string, any[] | undefined> = {
    pendingPurchaseItems: [{ id: 10, purchaseOrderId: 1, status: "approved" }, { id: 20, purchaseOrderId: 2 }],
    pendingWarehouseItems: [], pendingDeliveryItems: [],
    myItems: [{ id: 10, status: "approved" }, { id: 20, status: "purchased" }],
  };
  const methods = (name: string) => ({
    cancel: async () => { events.push(`cancel:${name}`); },
    invalidate: async () => { events.push(`invalidate:${name}`); if (failRefresh) throw Error("offline"); },
    getData: () => lists[name],
    setData: (_: unknown, update: any) => { events.push(`set:${name}`); lists[name] = update(lists[name]); },
  });
  const po: any = Object.fromEntries([
    "getById", "myItems", "pendingPurchaseItems", "pendingWarehouseItems", "pendingDeliveryItems", "list", "actionableForMe", "actionableItemsForMe", "supplyTracking",
  ].map(name => [name, methods(name)]));
  po.getById.setData = ({ id }: any, update: any) => { events.push("set:getById"); orders.set(id, update(orders.get(id))); };
  const utils = { purchaseOrders: po, purchasePackages: { getById: methods("package"), cards: methods("cards") } };
  return { utils, events, orders, lists };
}
describe("confirmed purchase execution refresh", () => {
  it("updates the acknowledged item/head, removes its action and invalidates linked views without reload", async () => {
    const f = fixture();
    expect(await refreshPurchaseExecution(f.utils, { itemId: 10, purchaseOrderId: 1, itemStatus: "purchased", purchaseOrderStatus: "partial_purchase" }, { purchasedPhotoUrl: "saved" })).toBe(true);
    expect(f.orders.get(1)).toMatchObject({ status: "partial_purchase", items: [{ id: 10, status: "purchased", purchasedPhotoUrl: "saved" }, { id: 11, status: "approved" }] });
    expect(f.lists.pendingPurchaseItems?.map(item => item.id)).toEqual([20]);
    expect(f.lists.pendingWarehouseItems?.map(item => item.id)).toEqual([10]);
    expect(f.lists.myItems).toMatchObject([{id:10,status:'purchased'},{id:20,status:'purchased'}]);
    expect(f.events.indexOf("set:getById")).toBeGreaterThan(f.events.indexOf("cancel:pendingDeliveryItems"));
    for (const name of ["actionableForMe", "actionableItemsForMe", "supplyTracking", "package", "cards"]) expect(f.events).toContain(`invalidate:${name}`);
  });
  it("moves warehouse receipt once, retaining invoice and quantity without touching another item", async () => {
    const f = fixture();
    f.lists.pendingWarehouseItems = [{ id: 10, purchaseOrderId: 1 }, { id: 20, purchaseOrderId: 2 }];
    const result = { itemId: 10, purchaseOrderId: 1, itemStatus: "delivered_to_warehouse" as const, purchaseOrderStatus: "received" };
    await refreshPurchaseExecution(f.utils, result, { supplierInvoiceNumber: "INV-1", receivedQuantity: 3 });
    await refreshPurchaseExecution(f.utils, result, { supplierInvoiceNumber: "INV-1", receivedQuantity: 3 });
    expect(f.lists.pendingWarehouseItems?.map(item => item.id)).toEqual([20]);
    expect(f.lists.pendingDeliveryItems).toHaveLength(1);
    expect(f.lists.pendingDeliveryItems?.[0]).toMatchObject({ id: 10, supplierInvoiceNumber: "INV-1", receivedQuantity: 3, status: "delivered_to_warehouse" });
  });
  it("does not create a hidden/uncached record and does not turn refresh failure into a failed write", async () => {
    const f = fixture(true);
    expect(await refreshPurchaseExecution(f.utils, { itemId: 99, purchaseOrderId: 9, itemStatus: "purchased" }, {})).toBe(false);
    expect(f.orders.get(9)).toBeUndefined();
    expect(f.lists.pendingWarehouseItems).toEqual([]);
    expect(f.lists.pendingPurchaseItems).toHaveLength(2);
  });
});
