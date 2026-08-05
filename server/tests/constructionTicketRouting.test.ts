import { describe, expect, it } from "vitest";
import {
  APP_ROLE,
  MAINTENANCE_RESPONSIBLE_DEPARTMENT,
  canRoleAccessPath,
} from "../../shared/roles";
import {
  canManageTicketWorkflow,
  isConstructionTicketAssignedToUser,
  isTicketReadOnlyForUser,
  isTicketVisible,
} from "../routers/tickets/tickets.access";

const constructionTicket = (managerId = 44) => ({
  id: 901,
  status: "under_inspection",
  reportedById: 3,
  assignedToId: null,
  assignedTechnicianId: null,
  maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
  maintenanceResponsibleManagerId: managerId,
});

const generalTicket = {
  ...constructionTicket(22),
  maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL,
};

describe("distinct maintenance routing values", () => {
  it("uses long, context-specific stored values", () => {
    expect(MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL).toBe("maintenance_report_department_general");
    expect(MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION).toBe("maintenance_report_department_construction");
    expect(MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL).not.toBe(MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION);
  });
});

describe("construction ticket workflow scope", () => {
  const constructionManager = { id: 44, role: APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER };

  it("gives the routed manager visibility and workflow control", () => {
    const ticket = constructionTicket(44);
    expect(isConstructionTicketAssignedToUser(constructionManager, ticket)).toBe(true);
    expect(isTicketVisible(constructionManager, ticket)).toBe(true);
    expect(canManageTicketWorkflow(constructionManager, ticket)).toBe(true);
    expect(isTicketReadOnlyForUser(constructionManager, ticket)).toBe(false);
  });

  it("denies a different construction manager", () => {
    const ticket = constructionTicket(45);
    expect(isTicketVisible(constructionManager, ticket)).toBe(false);
    expect(canManageTicketWorkflow(constructionManager, ticket)).toBe(false);
  });

  it("keeps a linked general ticket read-only", () => {
    expect(isTicketVisible(constructionManager, generalTicket)).toBe(false);
    expect(canManageTicketWorkflow(constructionManager, generalTicket)).toBe(false);
    expect(isTicketReadOnlyForUser(constructionManager, generalTicket)).toBe(true);
  });

  it("uses the shared ticket and inbox construction tabs while keeping the legacy redirect and denying triage", () => {
    expect(canRoleAccessPath(APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER, "/tickets?tab=construction")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER, "/construction/tickets")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER, "/tickets/inbox")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER, "/tickets/new")).toBe(false);
    expect(canRoleAccessPath(APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER, "/triage")).toBe(false);
  });
});

describe("general manager routing boundary", () => {
  const generalManager = { id: 22, role: APP_ROLE.GENERAL_MAINTENANCE_MANAGER };

  it("can manage pending triage and general tickets", () => {
    expect(canManageTicketWorkflow(generalManager, { ...generalTicket, status: "pending_triage" })).toBe(true);
    expect(canManageTicketWorkflow(generalManager, generalTicket)).toBe(true);
  });

  it("cannot manage a routed construction ticket and sees it read-only", () => {
    expect(canManageTicketWorkflow(generalManager, constructionTicket(44))).toBe(false);
    expect(isTicketReadOnlyForUser(generalManager, constructionTicket(44))).toBe(true);
  });
});
