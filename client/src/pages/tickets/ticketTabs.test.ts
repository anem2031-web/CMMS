import { describe, expect, it } from "vitest";
import { APP_ROLE } from "@shared/roles";
import {
  TICKET_LIST_TAB,
  canSeeAllTicketsTab,
  canSeeConstructionTicketsTab,
  resolveTicketListTab,
  ticketInboxUrl,
  ticketListUrl,
} from "./ticketTabs";

describe("ticket list tabs", () => {
  it("forces the construction/procurement manager into the construction tab", () => {
    expect(canSeeAllTicketsTab(APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER)).toBe(false);
    expect(canSeeConstructionTicketsTab(APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER)).toBe(true);
    expect(resolveTicketListTab(APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER, null)).toBe(
      TICKET_LIST_TAB.CONSTRUCTION,
    );
    expect(resolveTicketListTab(APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER, "all")).toBe(
      TICKET_LIST_TAB.CONSTRUCTION,
    );
  });

  it("allows authorized maintenance roles to switch to construction tickets", () => {
    for (const role of [
      APP_ROLE.OWNER,
      APP_ROLE.ADMIN,
      APP_ROLE.MAINTENANCE_MANAGER,
      APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
    ]) {
      expect(canSeeAllTicketsTab(role)).toBe(true);
      expect(canSeeConstructionTicketsTab(role)).toBe(true);
      expect(resolveTicketListTab(role, "construction")).toBe(TICKET_LIST_TAB.CONSTRUCTION);
    }
  });

  it("keeps other roles on the normal tickets tab", () => {
    for (const role of [APP_ROLE.TECHNICIAN, APP_ROLE.SUPERVISOR, APP_ROLE.USER]) {
      expect(canSeeConstructionTicketsTab(role)).toBe(false);
      expect(resolveTicketListTab(role, "construction")).toBe(TICKET_LIST_TAB.ALL);
    }
  });

  it("builds stable URLs for both tabs", () => {
    expect(ticketListUrl(TICKET_LIST_TAB.ALL)).toBe("/tickets");
    expect(ticketListUrl(TICKET_LIST_TAB.CONSTRUCTION)).toBe("/tickets?tab=construction");
    expect(ticketInboxUrl(TICKET_LIST_TAB.ALL)).toBe("/tickets/inbox");
    expect(ticketInboxUrl(TICKET_LIST_TAB.CONSTRUCTION)).toBe("/tickets/inbox?tab=construction");
  });
});
