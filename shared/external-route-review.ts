export const EXTERNAL_ROUTE_REVIEW_ROLES = ["owner", "admin", "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "it_manager", "supervisor"] as const;
export const isExternalRouteReviewer = (role: string) => (EXTERNAL_ROUTE_REVIEW_ROLES as readonly string[]).includes(role);
export const ownsExternalRouteReview = (role: string, actorId: number, reviewerId: number) =>
  isExternalRouteReviewer(role) && (["owner", "admin"].includes(role) || actorId === reviewerId);
export type ExternalRoute = "A" | "B" | "C";
export type ExternalRouteReview = { ticketId: number; ticketItemId: number; itemNumber: number; returnId: number; reason: string; reviewerId: number };
