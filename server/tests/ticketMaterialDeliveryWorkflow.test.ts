import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  hasActualDeliveryRecipient,
  shouldExposeTicketMaterialLink,
} from "../../shared/ticketMaterialDelivery";
import { derivePathBTicketPurchaseStatus } from "../../shared/pathBPurchaseWorkflow";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Path B material delivery from inventory", () => {
  it("shows the fixed ticket technician while the purchase item still needs one linked issue", () => {
    expect(shouldExposeTicketMaterialLink({
      ticketId: 10,
      ticketStatus: "purchased",
      maintenancePath: "B",
      assignedTechnicianId: 20,
      purchaseOrderItemId: 30,
      purchaseOrderItemStatus: "delivered_to_warehouse",
    })).toBe(true);
  });

  it("turns the leftover quantity into general inventory after the ticket item is fulfilled", () => {
    expect(shouldExposeTicketMaterialLink({
      ticketId: 10,
      ticketStatus: "received_warehouse",
      maintenancePath: "B",
      assignedTechnicianId: 20,
      purchaseOrderItemId: 30,
      purchaseOrderItemStatus: "delivered_to_requester",
    })).toBe(false);
  });

  it("does not expose an old closed ticket on later stock issues", () => {
    expect(shouldExposeTicketMaterialLink({
      ticketId: 10,
      ticketStatus: "closed",
      maintenancePath: "B",
      assignedTechnicianId: 20,
      purchaseOrderItemId: 30,
      purchaseOrderItemStatus: "delivered_to_warehouse",
    })).toBe(false);
  });

  it("requires an explicit actual recipient even when it is the assigned technician", () => {
    expect(hasActualDeliveryRecipient(undefined)).toBe(false);
    expect(hasActualDeliveryRecipient(null)).toBe(false);
    expect(hasActualDeliveryRecipient(0)).toBe(false);
    expect(hasActualDeliveryRecipient(11640055)).toBe(true);
  });

  it("unlocks repair only after every active item receives its linked delivery", () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      purchaseOrderId: 1,
      status: index < 5 ? "delivered_to_requester" : "delivered_to_warehouse",
    }));

    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [{ id: 1, status: "received" }],
      items,
    })).toBe("purchased");

    items[5].status = "delivered_to_requester";
    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [{ id: 1, status: "received" }],
      items,
    })).toBe("received_warehouse");
  });

  it("enforces the UI and server contract for assigned and actual technicians", () => {
    const page = read("client/src/pages/purchase/PurchaseCycle.tsx");
    const router = read("server/routers/purchase/purchase-orders.router.ts");
    const deliveryService = read("server/_core/db/warehouse-returns.ts");

    expect(page).toContain("الفني المسند للبلاغ");
    expect(page).toContain("الفني المستلم فعليًا *");
    expect(page).toContain('setDeliveryUserId("")');
    expect(page).toContain("!deliveryUserId");
    expect(router).toContain("deliveredToId: z.number()");
    expect(router).toContain("markPurchaseOrderItemDelivered: linkToTicket");
    expect(deliveryService).toContain("ticketId: params.ticketId");
    expect(deliveryService).toContain("assignedTechnicianName: params.assignedTechnicianName");
    expect(deliveryService).toContain("gte(inventory.quantity, params.quantity)");
    expect(deliveryService).toContain("تم استكمال تسليم احتياج هذا الصنف للبلاغ مسبقًا");
  });
});
