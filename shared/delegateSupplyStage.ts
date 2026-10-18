export type DelegateSupplyItem = {
  status: string; batchId?: number | null; pricingBatchStatus?: string | null;
  purchaseOrderStatus?: string | null; isExternalMaintenance?: boolean;
  externalMaintenanceStatus?: string | null; externalWarehouseReceivedAt?: string | null;
};
export function isDelegateSupplyItemOpen(item: DelegateSupplyItem) {
  return !["delivered_to_warehouse", "delivered_to_requester", "rejected", "cancelled", "needs_item_revision", "purchase_cancelled"].includes(item.status)
    && !(item.isExternalMaintenance && (item.externalWarehouseReceivedAt || ["waiting_technician_handover", "delivered_for_reinstall", "reinstall_in_progress", "ready_for_closure", "closed"].includes(item.externalMaintenanceStatus || "")));
}
export function delegateSupplyStage(item: DelegateSupplyItem): string {
  if (item.isExternalMaintenance && item.externalMaintenanceStatus && item.externalMaintenanceStatus !== "purchase_cycle") return `external_${item.externalMaintenanceStatus}`;
  if (item.status === "purchased") return "warehouse_delivery";
  if (["approved", "funded"].includes(item.status)) return item.isExternalMaintenance ? "external_execution" : "purchase";
  if (item.batchId) {
    const batch = item.pricingBatchStatus || item.purchaseOrderStatus;
    if (batch === "pending_accounting") return "accounting";
    if (batch === "pending_management") return "management";
    if (batch === "rejected") return "pricing_returned";
    return "unknown";
  }
  if (item.status === "pending_review") return "review";
  if (item.status === "estimated") return "bundle";
  if (item.status === "pending") return "pricing";
  return "unknown";
}
