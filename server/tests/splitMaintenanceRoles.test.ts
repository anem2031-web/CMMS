import { describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  hasPurchaseOrderForTicket: vi.fn(),
}));
vi.mock("../_core/db", () => dbMocks);
import { canRoleAccessCatalogModule, canRoleAccessPath, isCatalogAdminRole } from "../../shared/roles";
import {
  canPerformAction,
  canPerformItemAction,
  canResolvePOItemDelegateChange,
  isPOVisible,
} from "../_core/authz/engine";
import { PO_STATUS } from "../_core/authz/policy";
import { assertTicketReadable, isRoleDeniedFromTickets, isTicketReadOnlyForUser, isTicketVisible } from "../routers/tickets/tickets.access";

const po = (status: string = PO_STATUS.PENDING_REVIEW) => ({
  id: 100,
  status,
  requestedById: 999,
});

const managerVariants = [
  "general_maintenance_manager",
  "construction_procurement_manager",
] as const;

describe("split maintenance roles — purchase permissions copied from maintenance_manager", () => {
  for (const role of managerVariants) {
    it(`${role} sees all purchase requests and reviews pending_review`, () => {
      expect(isPOVisible({ role, userId: 1 }, po(PO_STATUS.DRAFT))).toBe(true);
      expect(isPOVisible({ role, userId: 1 }, po(PO_STATUS.CLOSED))).toBe(true);
      expect(canPerformAction("reviewItems", { role, userId: 1 }, po())).toBe(true);
      expect(canPerformAction("cancelItem", { role, userId: 1 }, po())).toBe(true);
    });

    it(`${role} keeps the same item-edit stage restrictions`, () => {
      expect(canPerformItemAction(
        "editItem",
        { role, userId: 1, isCreator: false },
        { poStatus: PO_STATUS.PENDING_REVIEW, itemStatus: "pending" },
      )).toBe(true);
      expect(canPerformItemAction(
        "editItem",
        { role, userId: 1, isCreator: false },
        { poStatus: PO_STATUS.PENDING_ESTIMATE, itemStatus: "pending" },
      )).toBe(false);
    });

    it(`${role} can resolve a delegate-change request only for the PO they reviewed`, () => {
      expect(canResolvePOItemDelegateChange({ role, userId: 1 }, {
        delegateId: 55,
        itemStatus: "pending",
        batchId: null,
        delegateChangeRequestedAt: new Date(),
        reviewedById: 1,
      })).toBe(true);
      // 2026-08-13: نفس الدور لا يحسم طلبًا راجعه مستخدم آخر
      expect(canResolvePOItemDelegateChange({ role, userId: 1 }, {
        delegateId: 55,
        itemStatus: "pending",
        batchId: null,
        delegateChangeRequestedAt: new Date(),
        reviewedById: 2,
      })).toBe(false);
    });
  }
});

describe("Catalog module roles — manager access with admin-only overview", () => {
  it("allows owner/admin and the three maintenance-manager roles into the Catalog module", () => {
    for (const role of [
      "owner",
      "admin",
      "maintenance_manager",
      "general_maintenance_manager",
      "construction_procurement_manager",
    ]) {
      expect(canRoleAccessCatalogModule(role)).toBe(true);
      expect(canRoleAccessPath(role, "/catalog")).toBe(true);
    }

    for (const role of [
      "purchase_manager",
      "purchase_requester",
      "warehouse",
      "food_warehouse_manager",
      "food_warehouse_assistant",
    ]) {
      expect(canRoleAccessCatalogModule(role)).toBe(false);
      expect(canRoleAccessPath(role, "/catalog")).toBe(false);
    }
  });

  it("keeps delete/import/export/settings as owner/admin-only capabilities", () => {
    expect(isCatalogAdminRole("owner")).toBe(true);
    expect(isCatalogAdminRole("admin")).toBe(true);
    expect(isCatalogAdminRole("construction_procurement_manager")).toBe(false);
  });
});

describe("split maintenance roles — module exclusions", () => {
  it("general maintenance manager keeps ticket/scan and Catalog access but loses warehouse and construction", () => {
    const role = "general_maintenance_manager";
    expect(canRoleAccessPath(role, "/tickets")).toBe(true);
    expect(canRoleAccessPath(role, "/triage")).toBe(true);
    expect(canRoleAccessPath(role, "/scan-asset")).toBe(true);
    for (const path of ["/inventory", "/inventory-operations", "/warehouse/return", "/documents", "/item-tracker", "/construction"]) {
      expect(canRoleAccessPath(role, path)).toBe(false);
    }
    expect(canRoleAccessPath(role, "/catalog")).toBe(true);
    expect(isRoleDeniedFromTickets(role)).toBe(false);
    expect(isTicketVisible({ id: 1, role }, { reportedById: 2, assignedToId: null })).toBe(true);
  });

  it("construction/procurement manager uses the shared ticket and inbox construction tabs but loses creation, triage and asset scan", () => {
    const role = "construction_procurement_manager";
    expect(canRoleAccessPath(role, "/tickets")).toBe(true);
    expect(canRoleAccessPath(role, "/tickets?tab=construction")).toBe(true);
    expect(canRoleAccessPath(role, "/tickets/inbox?tab=construction")).toBe(true);
    for (const path of ["/tickets/new", "/triage", "/scan-asset", "/tag/ABC", "/inventory", "/inventory-operations", "/documents", "/item-tracker"]) {
      expect(canRoleAccessPath(role, path)).toBe(false);
    }
    expect(canRoleAccessPath(role, "/purchase-orders")).toBe(true);
    expect(canRoleAccessPath(role, "/construction/tickets")).toBe(true); // legacy redirect remains valid
    expect(canRoleAccessPath(role, "/tickets/123")).toBe(true); // detail route; server enforces routed/read-only scope
    expect(canRoleAccessPath(role, "/tickets/not-a-ticket-id")).toBe(false);
    expect(canRoleAccessPath(role, "/tickets/new")).toBe(false);
    expect(canRoleAccessPath(role, "/catalog")).toBe(true);
    expect(canRoleAccessPath(role, "/construction/projects")).toBe(true);
    expect(isRoleDeniedFromTickets(role)).toBe(false);
    expect(isTicketVisible({ id: 1, role }, {
      reportedById: 9,
      assignedToId: null,
      maintenanceResponsibleDepartment: "maintenance_report_department_construction",
      maintenanceResponsibleManagerId: 1,
    })).toBe(true);
    expect(isTicketVisible({ id: 1, role }, {
      reportedById: 1,
      assignedToId: 1,
      maintenanceResponsibleDepartment: "maintenance_report_department_general",
      maintenanceResponsibleManagerId: 2,
    })).toBe(false);
  });
});


describe("construction/procurement manager — linked ticket read-only exception", () => {
  const user = { id: 2, role: "construction_procurement_manager" };
  const ticket = { id: 77, reportedById: 5, assignedToId: 9, maintenanceResponsibleDepartment: "maintenance_report_department_general", maintenanceResponsibleManagerId: 8 };

  it("allows ticket detail only when a purchase order is linked", async () => {
    dbMocks.hasPurchaseOrderForTicket.mockResolvedValueOnce(true);
    await expect(assertTicketReadable(user, ticket)).resolves.toBeUndefined();
    expect(dbMocks.hasPurchaseOrderForTicket).toHaveBeenCalledWith(77);
  });

  it("marks the linked general ticket as read-only", () => {
    expect(isTicketReadOnlyForUser(user, ticket)).toBe(true);
  });

  it("does not mark its routed construction ticket as read-only", () => {
    expect(isTicketReadOnlyForUser(user, {
      ...ticket,
      maintenanceResponsibleDepartment: "maintenance_report_department_construction",
      maintenanceResponsibleManagerId: user.id,
    })).toBe(false);
  });

  it("rejects an unlinked ticket", async () => {
    dbMocks.hasPurchaseOrderForTicket.mockResolvedValueOnce(false);
    await expect(assertTicketReadable(user, ticket)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
