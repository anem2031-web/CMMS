import { APP_ROLE } from "@shared/roles";

export const TICKET_LIST_TAB = {
  ALL: "all",
  CONSTRUCTION: "construction",
} as const;

export type TicketListTab = (typeof TICKET_LIST_TAB)[keyof typeof TICKET_LIST_TAB];

const CONSTRUCTION_TAB_ROLES = new Set<string>([
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
]);

export function canSeeAllTicketsTab(role?: string | null): boolean {
  return role !== APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER;
}

export function canSeeConstructionTicketsTab(role?: string | null): boolean {
  return !!role && CONSTRUCTION_TAB_ROLES.has(role);
}

export function resolveTicketListTab(
  role: string | null | undefined,
  requestedTab: string | null | undefined,
): TicketListTab {
  if (role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER) {
    return TICKET_LIST_TAB.CONSTRUCTION;
  }

  if (
    requestedTab === TICKET_LIST_TAB.CONSTRUCTION &&
    canSeeConstructionTicketsTab(role)
  ) {
    return TICKET_LIST_TAB.CONSTRUCTION;
  }

  return TICKET_LIST_TAB.ALL;
}

export function ticketListUrl(tab: TicketListTab): string {
  return tab === TICKET_LIST_TAB.CONSTRUCTION
    ? "/tickets?tab=construction"
    : "/tickets";
}
export function ticketInboxUrl(tab: TicketListTab): string {
  return tab === TICKET_LIST_TAB.CONSTRUCTION
    ? "/tickets/inbox?tab=construction"
    : "/tickets/inbox";
}
