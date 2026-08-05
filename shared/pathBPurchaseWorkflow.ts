/** Purchase-order statuses that still participate in the active Path B cycle. */
export const ACTIVE_PATH_B_PURCHASE_ORDER_STATUSES = new Set<string>([
  "draft",
  "pending_review",
  "pending_estimate",
  "pending_accounting",
  "pending_management",
  "approved",
  "partial_purchase",
  "purchased",
  "received",
  "revision_needed",
]);

const TERMINAL_ITEM_STATUSES = new Set<string>(["cancelled", "rejected"]);
const PURCHASED_ITEM_STATUSES = new Set<string>([
  "purchased",
  "delivered_to_warehouse",
  "delivered_to_requester",
]);

function purchaseOrderStageRank(status: string): number {
  switch (status) {
    case "draft": return 0;
    case "pending_review": return 1;
    case "pending_estimate": return 2;
    case "pending_accounting": return 3;
    case "pending_management": return 4;
    case "approved": return 5;
    case "partial_purchase": return 6;
    case "purchased":
    case "received": return 7;
    case "revision_needed": return 1;
    default: return 1;
  }
}

function ticketStatusForPurchaseRank(rank: number): string {
  switch (rank) {
    case 0: return "work_approved";
    case 1: return "needs_purchase";
    case 2: return "purchase_pending_estimate";
    case 3: return "purchase_pending_accounting";
    case 4: return "purchase_pending_management";
    case 5: return "purchase_approved";
    case 6: return "partial_purchase";
    default: return "purchased";
  }
}

export interface PathBPurchaseSnapshot {
  purchaseOrders: Array<{ id: number; status: string }>;
  items: Array<{ purchaseOrderId: number; status: string }>;
}

/**
 * Derives one ticket stage from every active linked purchase order.
 * Warehouse receipt alone does not release repair; all active items must be
 * delivered to the requester/technician first.
 */
export function derivePathBTicketPurchaseStatus(snapshot: PathBPurchaseSnapshot): string {
  const activeOrders = snapshot.purchaseOrders.filter((po) =>
    ACTIVE_PATH_B_PURCHASE_ORDER_STATUSES.has(po.status)
  );
  if (activeOrders.length === 0) return "work_approved";

  const activeOrderIds = new Set(activeOrders.map((po) => po.id));
  const activeItems = snapshot.items.filter((item) =>
    activeOrderIds.has(item.purchaseOrderId) && !TERMINAL_ITEM_STATUSES.has(item.status)
  );

  if (activeItems.length === 0) return "work_approved";
  if (activeItems.every((item) => item.status === "delivered_to_requester")) {
    return "received_warehouse";
  }

  const earliestRank = Math.min(...activeOrders.map((po) => purchaseOrderStageRank(po.status)));
  // With legacy multiple linked orders, keep the ticket at the earliest pending
  // approval stage instead of letting one advanced order hide another one.
  if (earliestRank < 5) return ticketStatusForPurchaseRank(earliestRank);

  const purchasedCount = activeItems.filter((item) => PURCHASED_ITEM_STATUSES.has(item.status)).length;
  if (purchasedCount > 0) {
    return purchasedCount === activeItems.length ? "purchased" : "partial_purchase";
  }

  return ticketStatusForPurchaseRank(earliestRank);
}
