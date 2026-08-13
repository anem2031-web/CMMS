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

// ⚠️ 2026-08-13: مدير الإنشاءات والمشتريات يرى الآن تبويب "الكل" أيضًا —
// قرار صريح من صاحب المشروع لتمكينه من استعراض كل البلاغات (بلا اقتصار على
// جهته). البلاغات خارج نطاقه تُعرض له للقراءة فقط تلقائيًا عبر
// isTicketReadOnlyForUser/canManageTicketWorkflow بالسيرفر — لم تتغيّر هذه
// الحراس هنا، فقط الرؤية (Visibility) اتُّسعت. راجع
// docs/CONSTRUCTION_MANAGER_TICKET_READ_ACCESS.md.
export function canSeeAllTicketsTab(role?: string | null): boolean {
  return true;
}

export function canSeeConstructionTicketsTab(role?: string | null): boolean {
  return !!role && CONSTRUCTION_TAB_ROLES.has(role);
}

export function resolveTicketListTab(
  role: string | null | undefined,
  requestedTab: string | null | undefined,
): TicketListTab {
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
