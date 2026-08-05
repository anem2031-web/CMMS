import { TRPCError } from "@trpc/server";
import {
  APP_ROLE,
  MAINTENANCE_INSPECTION_WORKFLOW_STATUS,
  MAINTENANCE_RESPONSIBLE_DEPARTMENT,
} from "@shared/roles";
import * as db from "../../_core/db";

const ROLES_DENIED_FROM_TICKETS = [
  APP_ROLE.ACCOUNTANT,
  APP_ROLE.PURCHASE_MANAGER,
  APP_ROLE.WAREHOUSE,
  APP_ROLE.PURCHASE_REQUESTER,
  APP_ROLE.FOOD_WAREHOUSE_MANAGER,
  APP_ROLE.FOOD_WAREHOUSE_ASSISTANT,
];

const REPORTER_SCOPED_ROLES = [APP_ROLE.OPERATOR];
const ASSIGNEE_SCOPED_ROLES = [APP_ROLE.TECHNICIAN];

export interface TicketAccessUser {
  id: number;
  role: string;
}

export interface TicketVisibilitySubject {
  id?: number;
  status?: string | null;
  reportedById: number | null;
  assignedToId: number | null;
  assignedTechnicianId?: number | null;
  maintenanceResponsibleDepartment?: string | null;
  maintenanceResponsibleManagerId?: number | null;
  inspectionWorkflowStatus?: string | null;
}

export function isRoleDeniedFromTickets(role: string): boolean {
  return ROLES_DENIED_FROM_TICKETS.includes(role as any);
}

export function isConstructionTicketAssignedToUser(
  user: TicketAccessUser,
  ticket: TicketVisibilitySubject,
): boolean {
  return (
    user.role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER &&
    ticket.maintenanceResponsibleDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION &&
    ticket.maintenanceResponsibleManagerId === user.id
  );
}

/**
 * Visibility used by ticket lists and normal ticket detail access.
 * Construction/procurement managers see only construction tickets explicitly routed to them.
 * Their separate linked-purchase exception is handled by assertTicketReadable().
 */
export function isTicketVisible(user: TicketAccessUser, ticket: TicketVisibilitySubject): boolean {
  if (isRoleDeniedFromTickets(user.role)) return false;

  if (user.role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER) {
    return isConstructionTicketAssignedToUser(user, ticket);
  }

  if (REPORTER_SCOPED_ROLES.includes(user.role as any)) {
    return ticket.reportedById === user.id;
  }
  if (ASSIGNEE_SCOPED_ROLES.includes(user.role as any)) {
    return ticket.assignedToId === user.id || ticket.assignedTechnicianId === user.id;
  }
  return true;
}

export function assertTicketVisible(
  user: TicketAccessUser,
  ticket: TicketVisibilitySubject,
  message = "ليس لديك صلاحية للاطلاع على هذا البلاغ",
): void {
  if (!isTicketVisible(user, ticket)) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}

/**
 * Detail/history/attachment read guard.
 * A construction manager may additionally read a non-routed ticket when it is linked
 * to a purchase order, but that exception remains read-only.
 */
export async function assertTicketReadable(
  user: TicketAccessUser,
  ticket: TicketVisibilitySubject & { id: number },
  message = "ليس لديك صلاحية للاطلاع على هذا البلاغ",
): Promise<void> {
  if (isTicketVisible(user, ticket)) return;

  if (user.role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER) {
    const linked = await db.hasPurchaseOrderForTicket(ticket.id);
    if (linked) return;
  }

  throw new TRPCError({ code: "FORBIDDEN", message });
}

/**
 * Manager/supervisor workflow scope after routing.
 * - legacy maintenance manager + owner/admin: unrestricted
 * - general manager: pending triage and general/unclassified tickets only
 * - construction manager: only construction tickets routed to that exact user
 * - supervisor: keeps existing inspection/closure scope, but cannot perform routing
 */
export function canManageTicketWorkflow(
  user: TicketAccessUser,
  ticket: TicketVisibilitySubject,
): boolean {
  if ([APP_ROLE.OWNER, APP_ROLE.ADMIN, APP_ROLE.MAINTENANCE_MANAGER].includes(user.role as any)) {
    return true;
  }

  if (user.role === APP_ROLE.GENERAL_MAINTENANCE_MANAGER) {
    return (
      ticket.status === "pending_triage" ||
      !ticket.maintenanceResponsibleDepartment ||
      ticket.maintenanceResponsibleDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL
    );
  }

  if (user.role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER) {
    return isConstructionTicketAssignedToUser(user, ticket);
  }

  if (user.role === APP_ROLE.SUPERVISOR) return true;

  return false;
}

export function assertTicketWorkflowManageable(
  user: TicketAccessUser,
  ticket: TicketVisibilitySubject,
  message = "ليس لديك صلاحية لتنفيذ إجراء على هذا البلاغ",
): void {
  if (!canManageTicketWorkflow(user, ticket)) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}

export function isTicketReadOnlyForUser(
  user: TicketAccessUser,
  ticket: TicketVisibilitySubject,
): boolean {
  if (
    user.role === APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER &&
    !isConstructionTicketAssignedToUser(user, ticket)
  ) {
    return true;
  }

  // After a ticket is routed to construction, the general maintenance manager
  // keeps follow-up visibility but may not mutate the construction workflow.
  return (
    user.role === APP_ROLE.GENERAL_MAINTENANCE_MANAGER &&
    ticket.maintenanceResponsibleDepartment === MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION
  );
}


const INSPECTION_MANAGER_ROLES = [
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.ADMIN,
  APP_ROLE.OWNER,
] as const;

/** Direct assignment is authoritative; no accept/start step is required. */
export function isAssignedInspectionTechnician(
  user: TicketAccessUser,
  ticket: TicketVisibilitySubject,
): boolean {
  return user.role === APP_ROLE.TECHNICIAN && ticket.assignedToId === user.id;
}

/**
 * Inspection recording is allowed to the directly assigned technician and to
 * the manager/supervisor who owns the ticket workflow scope.
 */
export function canRecordTicketInspection(
  user: TicketAccessUser,
  ticket: TicketVisibilitySubject,
): boolean {
  if (ticket.status !== "under_inspection") return false;
  if (isAssignedInspectionTechnician(user, ticket)) return true;
  if (user.role === APP_ROLE.SUPERVISOR) return canManageTicketWorkflow(user, ticket);
  if ((INSPECTION_MANAGER_ROLES as readonly string[]).includes(user.role)) {
    return canManageTicketWorkflow(user, ticket);
  }
  return false;
}

/** Manager-entered inspections are approved immediately; technician/supervisor entries require review. */
export function shouldAutoApproveRecordedInspection(user: TicketAccessUser): boolean {
  return (INSPECTION_MANAGER_ROLES as readonly string[]).includes(user.role);
}

export function canReviewTicketInspection(
  user: TicketAccessUser,
  ticket: TicketVisibilitySubject,
): boolean {
  return (
    ticket.status === "under_inspection" &&
    ticket.inspectionWorkflowStatus === MAINTENANCE_INSPECTION_WORKFLOW_STATUS.SUBMITTED_FOR_REVIEW &&
    (INSPECTION_MANAGER_ROLES as readonly string[]).includes(user.role) &&
    canManageTicketWorkflow(user, ticket)
  );
}

export function canSelectTicketMaintenancePath(
  user: TicketAccessUser,
  ticket: TicketVisibilitySubject,
): boolean {
  return (
    ticket.status === "under_inspection" &&
    ticket.inspectionWorkflowStatus === MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED &&
    (INSPECTION_MANAGER_ROLES as readonly string[]).includes(user.role) &&
    canManageTicketWorkflow(user, ticket)
  );
}
