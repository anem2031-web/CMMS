import { beforeEach, describe, expect, it, vi } from "vitest";
import { APP_ROLE, MAINTENANCE_RESPONSIBLE_DEPARTMENT as DEPT } from "../../shared/roles";
import { SqlTicketTeamAssignmentRepository, type TicketPromotionPort } from "../routers/maintenance-teams/assignment.repository";
import type { AssignmentContext, AssignmentTeam } from "../../shared/maintenance-team-tickets/assignment";
import type { TeamDatabase } from "../routers/maintenance-teams/repository";

// The live environment/database modules remain blocked by the isolated config.
// All ticket writes and transactions below are in-memory substitutes.
const state = vi.hoisted(() => ({ parent: {} as any, task: {} as any, department: {} as any, created: [] as any[] }));
vi.mock("../_core/db", () => ({
  getTicketById: vi.fn(async (id: number) => id === 1 ? state.parent : { id, ticketNumber: "MT-TEST-01", categoryId: null }),
  getTicketTaskById: vi.fn(async () => state.task),
  getTicketDepartmentById: vi.fn(async () => state.department),
  getTaskAssignees: vi.fn(async () => [{ userId: 101 }]),
  getUserById: vi.fn(async () => ({ id: 101, role: "it_manager", isActive: 1 })),
  lockTicketForSubTicketSequence: vi.fn(),
  lockTicketDepartmentForTaskSequence: vi.fn(),
  lockTicketTaskForPromotion: vi.fn(),
  allocateNextSubTicketSequence: vi.fn(async () => 1),
  withTransaction: vi.fn(async (work: any) => work({})),
  createTicket: vi.fn(async (data: any) => { state.created.push(data); return 2; }),
  createTicketItem: vi.fn(async () => 3),
  updateTicketTask: vi.fn(),
  addTicketStatusHistory: vi.fn(),
  createAuditLog: vi.fn(),
  createNotification: vi.fn(),
}));
vi.mock("../services/translation/translation", () => ({ detectLanguage: vi.fn() }));
vi.mock("../services/translation/translationEngine", () => ({ queueTranslation: vi.fn() }));

import { ticketsWorkflowRouter } from "../routers/tickets/tickets.workflow";
import * as db from "../_core/db";

beforeEach(() => {
  vi.clearAllMocks();
  state.parent = {
    id: 1, ticketNumber: "MT-TEST", title: "بلاغ المكيف", workflowModel: "department_tasks", status: "department_planning",
    categoryId: 7, category: "general", siteId: 10, sectionId: 11, assetId: 12,
    priority: "medium", reportedById: 20,
  };
  state.task = { id: 30, ticketId: 1, ticketDepartmentId: 40, taskNumber: 1, title: "مهمة", description: "فحص المكيف", status: "assigned", convertedTicketId: null };
  state.department = { id: 40, ticketId: 1, department: DEPT.GENERAL, responsibleManagerId: 101 };
  state.created = [];
});
const context = (role: string = APP_ROLE.ADMIN) => ({ user: { id: 101, role, name: "Offline test", isActive: 1 }, req: {}, res: {} } as any);

describe("Named and IT task promotion preserve the actual parent category", () => {
  it("inherits the Center Category ID even when the compatibility category is general", async () => {
    const result = await ticketsWorkflowRouter.createCaller(context()).promoteDepartmentTask({ ticketId: 1, taskId: 30 });
    expect(result.ticketId).toBe(2);
    expect(state.created).toHaveLength(1);
    expect(state.created[0]).toMatchObject({ categoryId: 7, category: "general", parentTicketId: 1, sourceTaskId: 30, workflowModel: "sub_ticket" });
  });
  it("preserves both fields for IT without changing its routing", async () => {
    state.parent.categoryId = 17; state.parent.category = "it"; state.department.department = DEPT.IT;
    await ticketsWorkflowRouter.createCaller(context(APP_ROLE.IT_MANAGER)).promoteDepartmentTask({ ticketId: 1, taskId: 30 });
    expect(state.created[0]).toMatchObject({ categoryId: 17, category: "it", maintenanceResponsibleDepartment: DEPT.IT, assignedToId: 101 });
  });
  it.each([null, undefined])("retains legacy parent category when categoryId is %s", async categoryId => {
    state.parent.categoryId = categoryId; state.parent.category = "hvac";
    await ticketsWorkflowRouter.createCaller(context()).promoteDepartmentTask({ ticketId: 1, taskId: 30 });
    expect(state.created[0].category).toBe("hvac");
    expect(state.created[0].categoryId ?? null).toBeNull();
  });
  it("does not rewrite an existing child on a retry", async () => {
    state.task.convertedTicketId = 2;
    await ticketsWorkflowRouter.createCaller(context()).promoteDepartmentTask({ ticketId: 1, taskId: 30 });
    expect(db.createTicket).not.toHaveBeenCalled();
    expect(db.updateTicketTask).not.toHaveBeenCalled();
  });
  it("retains the closed-parent guard", async () => {
    state.parent.status = "closed";
    await expect(ticketsWorkflowRouter.createCaller(context()).promoteDepartmentTask({ ticketId: 1, taskId: 30 })).rejects.toThrow("مغلق");
    expect(db.createTicket).not.toHaveBeenCalled();
  });
});

describe("Team assignment uses the same parent category without a live database", () => {
  async function createTeamChild() {
    const tx = { execute: vi.fn(async () => [{ insertId: 50 }]) };
    const createTicket = vi.fn(async (data: any) => { state.created.push(data); return 2; });
    const port: TicketPromotionPort = {
      getTicketById: async () => state.parent,
      getTicketTaskById: async () => state.task,
      getTicketDepartmentById: async () => state.department,
      lockTicketForSubTicketSequence: vi.fn(), lockTicketDepartmentForTaskSequence: vi.fn(), lockTicketTaskForPromotion: vi.fn(),
      allocateNextSubTicketSequence: async () => 1,
      createTicket, createTicketItem: async () => 3, updateTicketTask: vi.fn(), updateTicketDepartment: vi.fn(),
    };
    const store = { transaction: async (work: any) => work(tx) } as unknown as TeamDatabase;
    const repository = new SqlTicketTeamAssignmentRepository(async () => ({ db: store, tickets: port }));
    const assignment: AssignmentContext = { parent: state.parent, department: state.department, task: state.task };
    const team: AssignmentTeam = { id: 60, name: "فريق التكييف", active: true, warehouseId: 70, warehouseActive: true, warehouseType: "branch", memberCount: 2 };
    const result = await repository.transaction(work => work.create(assignment, team, { id: 101, role: APP_ROLE.ADMIN }));
    expect(createTicket).toHaveBeenCalledWith(expect.anything(), tx);
    expect(result).toMatchObject({ ticketId: 2, ticketNumber: "MT-TEST-01", alreadyExisting: false });
    return state.created[0];
  }
  it("persists the modern category ID with the original compatibility category", async () => {
    expect(await createTeamChild()).toMatchObject({ categoryId: 7, category: "general", workflowModel: "sub_ticket", assignedToId: null, parentTicketId: 1 });
  });
  it.each([null, undefined])("keeps legacy team parents working when categoryId is %s", async categoryId => {
    state.parent.categoryId = categoryId; state.parent.category = "hvac";
    const child = await createTeamChild();
    expect(child.category).toBe("hvac");
    expect(child.categoryId ?? null).toBeNull();
  });
  it("uses the current parent category read inside the assignment transaction", async () => {
    state.parent.categoryId = 21;
    expect(await createTeamChild()).toMatchObject({ categoryId: 21 });
  });
});
