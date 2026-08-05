import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../_core/db", () => ({
  hasPurchaseOrderForTicket: vi.fn(),
}));

import {
  APP_ROLE,
  MAINTENANCE_INSPECTION_RESULT_STATUS,
  MAINTENANCE_INSPECTION_WORKFLOW_STATUS,
  MAINTENANCE_RESPONSIBLE_DEPARTMENT,
} from "../../shared/roles";
import {
  canRecordTicketInspection,
  canReviewTicketInspection,
  canSelectTicketMaintenancePath,
  isAssignedInspectionTechnician,
  shouldAutoApproveRecordedInspection,
} from "../routers/tickets/tickets.access";

const baseTicket = {
  id: 501,
  status: "under_inspection",
  reportedById: 90,
  assignedToId: 11,
  assignedTechnicianId: null,
  maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.GENERAL,
  maintenanceResponsibleManagerId: 21,
  inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.PENDING_SUBMISSION,
};

describe("distinct inspection workflow values", () => {
  it("uses maintenance-specific values that cannot collide with generic statuses", () => {
    expect(MAINTENANCE_INSPECTION_WORKFLOW_STATUS.PENDING_SUBMISSION).toBe("maintenance_inspection_pending_submission");
    expect(MAINTENANCE_INSPECTION_WORKFLOW_STATUS.SUBMITTED_FOR_REVIEW).toBe("maintenance_inspection_submitted_for_review");
    expect(MAINTENANCE_INSPECTION_RESULT_STATUS.APPROVED).toBe("maintenance_inspection_result_approved");
  });
});

describe("direct technician assignment without acceptance step", () => {
  const assignedTechnician = { id: 11, role: APP_ROLE.TECHNICIAN };
  const otherTechnician = { id: 12, role: APP_ROLE.TECHNICIAN };

  it("treats the assigned technician as immediately responsible and able to record", () => {
    expect(isAssignedInspectionTechnician(assignedTechnician, baseTicket)).toBe(true);
    expect(canRecordTicketInspection(assignedTechnician, baseTicket)).toBe(true);
  });

  it("denies a different technician", () => {
    expect(isAssignedInspectionTechnician(otherTechnician, baseTicket)).toBe(false);
    expect(canRecordTicketInspection(otherTechnician, baseTicket)).toBe(false);
  });
});

describe("manager recording and review boundaries", () => {
  const generalManager = { id: 21, role: APP_ROLE.GENERAL_MAINTENANCE_MANAGER };
  const constructionManager = { id: 31, role: APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER };
  const constructionTicket = {
    ...baseTicket,
    assignedToId: 15,
    maintenanceResponsibleDepartment: MAINTENANCE_RESPONSIBLE_DEPARTMENT.CONSTRUCTION,
    maintenanceResponsibleManagerId: 31,
  };

  it("allows each department manager to record only within their workflow scope", () => {
    expect(canRecordTicketInspection(generalManager, baseTicket)).toBe(true);
    expect(canRecordTicketInspection(constructionManager, constructionTicket)).toBe(true);
    expect(canRecordTicketInspection(constructionManager, baseTicket)).toBe(false);
  });


  it("does not let a general manager record a construction ticket after routing", () => {
    expect(canRecordTicketInspection(generalManager, constructionTicket)).toBe(false);
  });

  it("allows a supervisor to record but does not auto-approve the supervisor entry", () => {
    const supervisor = { id: 41, role: APP_ROLE.SUPERVISOR };
    expect(canRecordTicketInspection(supervisor, baseTicket)).toBe(true);
    expect(shouldAutoApproveRecordedInspection(supervisor)).toBe(false);
  });

  it("auto-approves manager-recorded results but not technician-recorded results", () => {
    expect(shouldAutoApproveRecordedInspection(generalManager)).toBe(true);
    expect(shouldAutoApproveRecordedInspection(constructionManager)).toBe(true);
    expect(shouldAutoApproveRecordedInspection({ id: 11, role: APP_ROLE.TECHNICIAN })).toBe(false);
  });

  it("allows review only while a technician result is submitted", () => {
    const submitted = {
      ...baseTicket,
      inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.SUBMITTED_FOR_REVIEW,
    };
    expect(canReviewTicketInspection(generalManager, submitted)).toBe(true);
    expect(canReviewTicketInspection(generalManager, baseTicket)).toBe(false);
  });


  it("does not allow a technician to review or select the maintenance path", () => {
    const assignedTechnician = { id: 11, role: APP_ROLE.TECHNICIAN };
    const submitted = {
      ...baseTicket,
      inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.SUBMITTED_FOR_REVIEW,
    };
    const approved = {
      ...baseTicket,
      inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED,
    };
    expect(canReviewTicketInspection(assignedTechnician, submitted)).toBe(false);
    expect(canSelectTicketMaintenancePath(assignedTechnician, approved)).toBe(false);
  });

  it("blocks path selection until the inspection is approved", () => {
    expect(canSelectTicketMaintenancePath(generalManager, baseTicket)).toBe(false);
    expect(canSelectTicketMaintenancePath(generalManager, {
      ...baseTicket,
      inspectionWorkflowStatus: MAINTENANCE_INSPECTION_WORKFLOW_STATUS.APPROVED,
    })).toBe(true);
  });
});

describe("inspection workflow migration contract", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "drizzle/migrations/2026_08_03_ticket_inspection_workflow.sql"),
    "utf8",
  );

  it("adds distinct ticket attribution and review columns", () => {
    for (const column of [
      "inspectionWorkflowStatus",
      "inspectionPerformedById",
      "inspectionRecordedById",
      "inspectionSubmittedAt",
      "inspectionApprovedAt",
      "inspectionReturnReason",
    ]) {
      expect(sql).toContain(`\`${column}\``);
    }
  });

  it("keeps TiDB column additions in separate ALTER TABLE statements", () => {
    const ticketAlterCount = (sql.match(/ALTER TABLE `tickets`/g) || []).length;
    const resultAlterCount = (sql.match(/ALTER TABLE `inspection_results`/g) || []).length;
    expect(ticketAlterCount).toBeGreaterThanOrEqual(10);
    expect(resultAlterCount).toBeGreaterThanOrEqual(12);
  });
});

