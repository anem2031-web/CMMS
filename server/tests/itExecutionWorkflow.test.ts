import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canExecuteItSubTicket,
  canRecordItExecutionOutcome,
  canStartItSubTicket,
  itExecutionOutcomeRequiresNote,
  itExecutionOutcomeTransition,
} from "../../shared/it-execution-workflow";
import { APP_ROLE, MAINTENANCE_RESPONSIBLE_DEPARTMENT as DEPT } from "../../shared/roles";

const fixture = vi.hoisted(() => ({
  ticket: {} as any,
  histories: [] as any[],
  audits: [] as any[],
  notifications: [] as any[],
  pathB: vi.fn(async () => undefined),
}));

vi.mock("../_core/db", () => ({
  withTransaction: vi.fn(async (work: any) => work({
    insert: (table: any) => ({ values: async (row: any) => {
      if (String(table).includes("ticket_status_history")) fixture.histories.push(row);
      else fixture.audits.push(row);
    } }),
  })),
  lockTicketForSubTicketSequence: vi.fn(async () => undefined),
  getTicketById: vi.fn(async (id: number) => id === fixture.ticket.id ? { ...fixture.ticket } : null),
  updateTicket: vi.fn(async (_id: number, changes: any) => Object.assign(fixture.ticket, changes)),
  syncSingleTicketItem: vi.fn(async () => true),
  getUserById: vi.fn(async (id: number) => ({ id, role: fixture.ticket.actorRole ?? APP_ROLE.IT_MEMBER, isActive: 1 })),
  getExternalMaintenanceJobByTicketId: vi.fn(async () => ({ id: 90, status: "reinstall_in_progress" })),
  updateExternalMaintenanceJobByTicketId: vi.fn(async () => undefined),
  createNotification: vi.fn(async (row: any) => fixture.notifications.push(row)),
  getUsersByRole: vi.fn(async () => []),
}));

vi.mock("../routers/purchase/ticket-purchase-workflow", () => ({
  assertPathBMaterialsDeliveredToTechnician: fixture.pathB,
}));

import { itTeamRouter } from "../routers/tickets/it-team.router";

const actor = (id = 7, role = APP_ROLE.IT_MEMBER) => ({ id, role, isActive: 1, name: "IT" });
const caller = (user = actor()) => itTeamRouter.createCaller({ user, authenticatedUser: user, req: {}, res: {} } as any);

function ticket(overrides: Record<string, any> = {}) {
  return {
    id: 44,
    ticketNumber: "MT-IT-44",
    reportedById: 3,
    assignedToId: 7,
    maintenanceResponsibleDepartment: DEPT.IT,
    maintenanceResponsibleManagerId: 8,
    workflowModel: "sub_ticket",
    sourceTaskId: 12,
    status: "under_inspection",
    maintenancePath: null,
    ...overrides,
  };
}

beforeEach(() => {
  fixture.ticket = ticket();
  fixture.histories.length = 0;
  fixture.audits.length = 0;
  fixture.notifications.length = 0;
  fixture.pathB.mockClear();
});

describe("IT execution policy", () => {
  it("limits execution to the active named IT executor of a sub-ticket", () => {
    expect(canExecuteItSubTicket(actor(), ticket())).toBe(true);
    expect(canExecuteItSubTicket(actor(9), ticket())).toBe(false);
    expect(canExecuteItSubTicket(actor(7, APP_ROLE.TECHNICIAN), ticket())).toBe(false);
    expect(canExecuteItSubTicket({ ...actor(), isActive: 0 }, ticket())).toBe(false);
    expect(canExecuteItSubTicket(actor(), ticket({ workflowModel: "department_tasks" }))).toBe(false);
  });

  it("keeps start and outcome stages independent", () => {
    expect(canStartItSubTicket(actor(), ticket())).toBe(true);
    expect(canStartItSubTicket(actor(), ticket({ status: "in_progress" }))).toBe(false);
    expect(canRecordItExecutionOutcome(actor(), ticket({ status: "in_progress" }))).toBe(true);
    expect(canRecordItExecutionOutcome(actor(), ticket())).toBe(false);
  });

  it("maps the five outcomes without changing an existing B/C path", () => {
    expect(itExecutionOutcomeTransition("ok", null)).toEqual({ status: "closed", maintenancePath: "A" });
    expect(itExecutionOutcomeTransition("fixed", "B")).toEqual({ status: "closed", maintenancePath: "B" });
    expect(itExecutionOutcomeTransition("needs_material", null)).toEqual({ status: "work_approved", maintenancePath: "B" });
    expect(itExecutionOutcomeTransition("external", null)).toEqual({ status: "work_approved", maintenancePath: "C" });
    expect(itExecutionOutcomeTransition("blocked", null)).toEqual({ status: "in_progress", maintenancePath: null });
    expect(itExecutionOutcomeRequiresNote("fixed")).toBe(true);
    expect(itExecutionOutcomeRequiresNote("blocked")).toBe(true);
    expect(itExecutionOutcomeRequiresNote("external")).toBe(true);
    expect(itExecutionOutcomeRequiresNote("ok")).toBe(false);
  });
});

describe("IT execution RPC boundary", () => {
  it("starts an existing assigned IT sub-ticket and writes its single-item shadow", async () => {
    await expect(caller().startItExecution({ ticketId: 44 })).resolves.toEqual({ success: true });
    expect(fixture.ticket.status).toBe("in_progress");
  });

  it("denies a direct API start by another IT member", async () => {
    await expect(caller(actor(9)).startItExecution({ ticketId: 44 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.ticket.status).toBe("under_inspection");
  });

  it("closes a repaired IT ticket and notifies only its requester", async () => {
    fixture.ticket = ticket({ status: "in_progress" });
    await expect(caller().recordItExecutionOutcome({ ticketId: 44, outcome: "fixed", note: "تم استبدال الكابل", materialsUsed: "كابل شبكة" })).resolves.toMatchObject({ status: "closed", maintenancePath: "A" });
    expect(fixture.ticket).toMatchObject({ status: "closed", maintenancePath: "A", repairNotes: "تم استبدال الكابل", materialsUsed: "كابل شبكة" });
    expect(fixture.notifications).toHaveLength(1);
    expect(fixture.notifications[0].userId).toBe(3);
  });

  it("retains the material-delivery guard before closing path B", async () => {
    fixture.ticket = ticket({ status: "in_progress", maintenancePath: "B" });
    await caller().recordItExecutionOutcome({ ticketId: 44, outcome: "fixed", note: "تم الإصلاح" });
    expect(fixture.pathB).toHaveBeenCalledWith(44);
  });

  it("rejects missing evidence and a foreign direct API outcome", async () => {
    fixture.ticket = ticket({ status: "in_progress" });
    await expect(caller().recordItExecutionOutcome({ ticketId: 44, outcome: "fixed", note: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller(actor(9)).recordItExecutionOutcome({ ticketId: 44, outcome: "ok", note: "" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(fixture.ticket.status).toBe("in_progress");
  });
});
