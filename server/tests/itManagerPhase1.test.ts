import { describe, expect, it } from "vitest";
import {
  APP_ROLE,
  MAINTENANCE_RESPONSIBLE_DEPARTMENT,
  canRoleAccessPath,
  canRoleExecutePmv2Technician,
  canRoleManagePmv2,
} from "../../shared/roles";
import {
  canManageTicketItemWorkflow,
  canManageTicketWorkflow,
  isTicketReadOnlyForUser,
  isTicketVisible,
} from "../routers/tickets/tickets.access";

const itManager = { id: 70, role: APP_ROLE.IT_MANAGER };
const itMember = { id: 71, role: APP_ROLE.IT_MEMBER };
const maintenanceManager = { id: 10, role: APP_ROLE.MAINTENANCE_MANAGER };
const generalManager = { id: 11, role: APP_ROLE.GENERAL_MAINTENANCE_MANAGER };
const constructionManager = { id: 12, role: APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER };
const owner = { id: 1, role: APP_ROLE.OWNER };

const itTicket = {
  id: 500,
  status: "under_inspection",
  reportedById: 99,
  assignedToId: 70,
  assignedTechnicianId: null,
  maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
  maintenanceResponsibleManagerId: 70,
};

describe("IT manager phase 2 access contract", () => {
  it("defines an independent IT role and department", () => {
    expect(APP_ROLE.IT_MANAGER).toBe("it_manager");
    expect(APP_ROLE.IT_MEMBER).toBe("it_member");
    expect(MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT).toBe("maintenance_report_department_it");
  });

  it("shows the shared IT queue to the team while keeping unrelated tickets scoped", () => {
    expect(isTicketVisible(itManager, itTicket)).toBe(true);
    expect(isTicketVisible(itMember, { ...itTicket, id: 501, reportedById: 99, assignedToId: null })).toBe(true);
    expect(isTicketVisible(itManager, { ...itTicket, id: 502, reportedById: 70, assignedToId: null, maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL, maintenanceResponsibleManagerId: 11 })).toBe(true);
    expect(isTicketVisible(itMember, { ...itTicket, id: 503, reportedById: 99, assignedToId: null, maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL, maintenanceResponsibleManagerId: 11 })).toBe(false);
  });

  it("opens A/B/C only for the exact assigned IT executor", () => {
    expect(canManageTicketWorkflow(itManager, itTicket)).toBe(true);
    expect(canManageTicketWorkflow(itMember, itTicket)).toBe(false);
    expect(canManageTicketWorkflow(itMember, { ...itTicket, assignedToId: 71 })).toBe(true);
    expect(canManageTicketItemWorkflow(itManager, {
      responsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
      responsibleManagerId: 70,
      assignedToId: 70,
    })).toBe(true);
    expect(canManageTicketItemWorkflow(itMember, {
      responsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.IT,
      responsibleManagerId: 70,
      assignedToId: 70,
    })).toBe(false);
  });

  it("makes IT tickets read-only for maintenance and construction managers", () => {
    for (const manager of [maintenanceManager, generalManager, constructionManager]) {
      expect(isTicketVisible(manager, itTicket)).toBe(true);
      expect(canManageTicketWorkflow(manager, itTicket)).toBe(false);
      expect(isTicketReadOnlyForUser(manager, itTicket)).toBe(true);
    }
    expect(canManageTicketWorkflow(owner, itTicket)).toBe(true);
    expect(isTicketReadOnlyForUser(owner, itTicket)).toBe(false);
  });

  it("opens only ticket and own purchase-order routes in phase 2", () => {
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/tickets")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/tickets/inbox")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/tickets/new")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/tickets/123")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/notifications")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/purchase-orders")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/purchase-orders/new?ticketId=500")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/scheduled-maintenance/my-tasks")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/scheduled-maintenance")).toBe(false);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/scheduled-maintenance/reports")).toBe(false);
    expect(canRoleAccessPath(APP_ROLE.IT_MANAGER, "/triage")).toBe(false);
    expect(canRoleAccessPath(APP_ROLE.IT_MEMBER, "/tickets")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MEMBER, "/notifications")).toBe(true);
    expect(canRoleAccessPath(APP_ROLE.IT_MEMBER, "/purchase-orders")).toBe(false);
    expect(canRoleAccessPath(APP_ROLE.IT_MEMBER, "/scheduled-maintenance/my-tasks")).toBe(true);
  });

  it("allows PM V2 execution for the IT team without PM V2 management", () => {
    expect(canRoleExecutePmv2Technician(APP_ROLE.IT_MANAGER)).toBe(true);
    expect(canRoleExecutePmv2Technician(APP_ROLE.IT_MEMBER)).toBe(true);
    expect(canRoleManagePmv2(APP_ROLE.IT_MANAGER)).toBe(false);
    expect(canRoleManagePmv2(APP_ROLE.IT_MEMBER)).toBe(false);
  });
});
