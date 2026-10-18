export type OperationalActor = { id: number; role: string; isActive?: number };
export const OPERATIONAL_CREATE_ROLES = ["maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "owner", "admin"];
export const OPERATIONAL_WAREHOUSE_ROLES = ["warehouse", "owner", "admin"];
export function canCreateOperationalIssue(role?: string | null) { return OPERATIONAL_CREATE_ROLES.includes(role || ""); }
export function canProcessOperationalIssue(role?: string | null) { return OPERATIONAL_WAREHOUSE_ROLES.includes(role || ""); }
export function canReadOperationalIssue(role?: string | null) { return canCreateOperationalIssue(role) || canProcessOperationalIssue(role) || role === "observer"; }
export type OperationalOrder = {
  id: number; orderNumber: string; createdById: number; creatorName: string; collectorId: number; collectorName: string;
  siteId: number; siteName: string; sectionId: number; sectionName: string; reason: string;
  status: "pending" | "approved" | "completed"; revision: number; createdAt: string;
};
export type OperationalLine = {
  id: number; orderId: number; catalogItemId: number; itemName: string; unit: string;
  quantity: number; issuedQuantity: number;
};
export type OperationalDelivery = {
  id: number; orderItemId: number; deliveryDocumentId: number; deliveryNumber: string; quantity: number;
  lotUnitCost: number; cost: number; returnedQuantity: number; lotCode: string; createdAt: string;
};
export function operationalNetCost(deliveries: OperationalDelivery[]) {
  const cents = (value: number) => Math.round(value * 100);
  let issued = 0, returned = 0;
  for (const row of deliveries) {
    issued += cents(Number(row.cost));
    const quantity = Math.min(Number(row.quantity), Math.max(0, Number(row.returnedQuantity)));
    returned += quantity === Number(row.quantity) ? cents(Number(row.cost)) : cents(quantity * Number(row.lotUnitCost));
  }
  return { issued: issued / 100, returned: returned / 100, net: (issued - returned) / 100 };
}
