export const TICKET_MATERIAL_REQUEST_EVENT = "ticket_team_material_request";
export const WAREHOUSE_REQUESTS_PATH =
  "/scheduled-maintenance/warehouse-requests";

export function warehouseRequestsLink(ticketId?: number | null): string {
  const query = new URLSearchParams({ source: "tickets" });
  if (ticketId != null && Number.isSafeInteger(ticketId) && ticketId > 0)
    query.set("ticketId", String(ticketId));
  return `${WAREHOUSE_REQUESTS_PATH}?${query}`;
}

export function warehouseRequestsSelection(search: string) {
  const query = new URLSearchParams(search);
  const ticketId = Number(query.get("ticketId"));
  return {
    source:
      query.get("source") === "tickets"
        ? ("tickets" as const)
        : ("pmv2" as const),
    ticketId:
      Number.isSafeInteger(ticketId) && ticketId > 0 ? ticketId : undefined,
  };
}

export function ticketTeamNotificationPath(
  eventKey?: string | null,
  ticketId?: number | null
) {
  if (eventKey === TICKET_MATERIAL_REQUEST_EVENT)
    return warehouseRequestsLink(ticketId);
  if (eventKey === "ticket_team_action") return "/maintenance-team-tickets";
  return undefined;
}
