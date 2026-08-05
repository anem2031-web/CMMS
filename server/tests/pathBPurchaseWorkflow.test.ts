import { describe, expect, it } from "vitest";
import { derivePathBTicketPurchaseStatus } from "../../shared/pathBPurchaseWorkflow";

describe("Path B ticket status derived from linked purchase orders", () => {
  it("keeps the ticket ready for a new request when no active order remains", () => {
    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [{ id: 1, status: "rejected" }],
      items: [{ purchaseOrderId: 1, status: "rejected" }],
    })).toBe("work_approved");
  });

  it("tracks review, pricing, accounting and management stages", () => {
    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [{ id: 1, status: "pending_review" }],
      items: [{ purchaseOrderId: 1, status: "pending" }],
    })).toBe("needs_purchase");
    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [{ id: 1, status: "pending_estimate" }],
      items: [{ purchaseOrderId: 1, status: "pending" }],
    })).toBe("purchase_pending_estimate");
    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [{ id: 1, status: "pending_accounting" }],
      items: [{ purchaseOrderId: 1, status: "estimated" }],
    })).toBe("purchase_pending_accounting");
    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [{ id: 1, status: "pending_management" }],
      items: [{ purchaseOrderId: 1, status: "estimated" }],
    })).toBe("purchase_pending_management");
  });

  it("distinguishes partial purchase from full purchase", () => {
    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [{ id: 1, status: "approved" }],
      items: [
        { purchaseOrderId: 1, status: "purchased" },
        { purchaseOrderId: 1, status: "approved" },
      ],
    })).toBe("partial_purchase");
    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [{ id: 1, status: "purchased" }],
      items: [
        { purchaseOrderId: 1, status: "purchased" },
        { purchaseOrderId: 1, status: "delivered_to_warehouse" },
      ],
    })).toBe("purchased");
  });

  it("does not release repair when materials are only in the warehouse", () => {
    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [{ id: 1, status: "received" }],
      items: [
        { purchaseOrderId: 1, status: "delivered_to_warehouse" },
        { purchaseOrderId: 1, status: "delivered_to_warehouse" },
      ],
    })).toBe("purchased");
  });

  it("releases repair only after every active item is delivered to the technician", () => {
    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [{ id: 1, status: "received" }],
      items: [
        { purchaseOrderId: 1, status: "delivered_to_requester" },
        { purchaseOrderId: 1, status: "delivered_to_requester" },
      ],
    })).toBe("received_warehouse");
  });

  it("aggregates all active linked orders instead of advancing from one completed order", () => {
    expect(derivePathBTicketPurchaseStatus({
      purchaseOrders: [
        { id: 1, status: "received" },
        { id: 2, status: "pending_accounting" },
      ],
      items: [
        { purchaseOrderId: 1, status: "delivered_to_requester" },
        { purchaseOrderId: 2, status: "estimated" },
      ],
    })).not.toBe("received_warehouse");
  });
});
