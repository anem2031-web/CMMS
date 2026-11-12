import { describe, expect, it, vi } from "vitest";
import { businessPageAllowed, businessRpcAllowed } from "../../shared/business-role-policy";
import { canRoleAccessPath } from "../../shared/roles";
import { router } from "../_core/trpc";
import { pmv2WarehouseReadProcedure, pmv2WarehouseProcedure } from "../pmv2/security/procedures";
import { TicketTeamAssignmentService } from "../maintenance-team-tickets/assignment/service";
import { SqlTicketTeamAssignmentRepository } from "../routers/maintenance-teams/assignment.repository";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { canonicalInventoryDocument, resolveDocumentPdfInput } from "../services/pdf/canonicalDocumentExport";

const senior = { id: 37, role: "senior_management", isActive: 1 };
const warehouse = { id: 38, role: "warehouse", isActive: 1 };

describe("senior warehouse oversight remains read only", () => {
  it("grants only the explicit page and three PMV2 reads, never warehouse mutations", async () => {
    expect(canRoleAccessPath(senior.role, "/scheduled-maintenance/warehouse-requests")).toBe(true);
    expect(businessPageAllowed(senior.role, "/scheduled-maintenance/warehouse-requests")).toBe(true);
    for (const path of ["pmv2.warehouse.waitingMaterialQueue", "pmv2.warehouse.readyToIssueQueue", "pmv2.warehouse.pendingReturns", "ticketTeamAssignments.warehouseRequests", "operationalIssues.list", "operationalIssues.detail", "warehouseRequestDocuments.list", "warehouseRequestDocuments.detail"])
      expect(businessRpcAllowed(senior, "query", path)).toBe(true);
    for (const path of ["pmv2.warehouse.issueReadyRequirement", "pmv2.warehouse.confirmPendingReturn", "pmv2.warehouse.prepareTransferHandoff", "operationalIssues.approve", "operationalIssues.issue", "operationalIssues.returnMaterial", "warehouseRequestDocuments.recordPrint"])
      expect(businessRpcAllowed(senior, "mutation", path)).toBe(false);
    expect(businessRpcAllowed({ ...senior, isActive: 0 }, "query", "pmv2.warehouse.pendingReturns")).toBe(false);
  });
  it("uses a separate PMV2 read procedure without widening the writer procedure", async () => {
    const api = router({ pmv2: router({ warehouse: router({ waitingMaterialQueue: pmv2WarehouseReadProcedure.query(() => "read"), issueReadyRequirement: pmv2WarehouseProcedure.mutation(() => "write") }) }) });
    const call = (user: any) => api.createCaller({ user, authenticatedUser: user, req: {}, res: {} } as any);
    await expect(call(senior).pmv2.warehouse.waitingMaterialQueue()).resolves.toBe("read");
    await expect(call(senior).pmv2.warehouse.issueReadyRequirement()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(call(warehouse).pmv2.warehouse.waitingMaterialQueue()).resolves.toBe("read");
    await expect(call(warehouse).pmv2.warehouse.issueReadyRequirement()).resolves.toBe("write");
    await expect(call({ ...senior, isActive: 0 }).pmv2.warehouse.waitingMaterialQueue()).rejects.toMatchObject({ code: "FORBIDDEN" });
    const admin = { id: 1, role: "admin", isActive: 1 };
    await expect(call(admin).pmv2.warehouse.waitingMaterialQueue()).resolves.toBe("read");
    await expect(call(admin).pmv2.warehouse.issueReadyRequirement()).resolves.toBe("write");
  });
  it.each(["delivery", "warehouse_issue", "return"] as const)("builds the senior %s PDF from a freshly read existing document", async type => {
    const caller: any = {
      deliveryDocuments: { getForPrint: vi.fn(async () => ({ deliveryNumber: "DLV-1", itemName: "مادة", quantity: 1 })) },
      warehouseIssueBatches: { getById: vi.fn(async () => ({ issueNumber: "WIS-1" })) },
      returnDocuments: { list: vi.fn(async () => [{ id: 1, returnNumber: "RTN-1" }]) },
    };
    const renderers: any = { delivery: vi.fn(() => "delivery-html"), warehouseIssue: vi.fn(() => "issue-html"), return: vi.fn(async () => "return-html") };
    const result = await resolveDocumentPdfInput(senior, { html: "untrusted", filename: "wrong", source: { type, id: 1 } },
      source => canonicalInventoryDocument(source, caller, senior, renderers));
    expect(result.html).toBe(type === "delivery" ? "delivery-html" : type === "warehouse_issue" ? "issue-html" : "return-html");
    expect(result.html).not.toBe("untrusted");
    expect(type === "delivery" ? caller.deliveryDocuments.getForPrint : type === "warehouse_issue" ? caller.warehouseIssueBatches.getById : caller.returnDocuments.list).toHaveBeenCalledTimes(1);
  });
  it("passes the real senior identity to the material-only ticket queue and rejects inactive identities", async () => {
    const repository = { queue: vi.fn(async () => [{ ticketId: 7 }]) } as any;
    const service = new TicketTeamAssignmentService(repository);
    await expect(service.warehouseRequests({ id: senior.id, role: senior.role, active: true })).resolves.toEqual([{ ticketId: 7 }]);
    expect(repository.queue).toHaveBeenCalledWith({ id: senior.id, role: senior.role, active: true }, { materialsOnly: true });
    await expect(service.warehouseRequests({ id: senior.id, role: senior.role, active: false })).rejects.toHaveProperty("code", "FORBIDDEN");
    await expect(service.warehouseRequests({ id: 12, role: "technician", active: true })).rejects.toHaveProperty("code", "FORBIDDEN");
  });
  it("uses the actual ticket material reader with bounded queries for a large repeated-parent queue", async () => {
    const queries: string[] = [];
    const parents = Array.from({ length: 200 }, (_, index) => ({ assignmentId: index + 1, ticketId: 7, teamId: 2, ticketNumber: "MT-7", title: "بلاغ", stage: "waiting_material" }));
    const needs = parents.map((parent, index) => ({ id: index + 1, assignmentId: parent.assignmentId, itemNameSnapshot: "مادة", unitSnapshot: "قطعة", requestedQuantity: 5, usedQuantity: 3, issued: 5, returned: 1, available: 4, currentRound: 1, materialRound: 1 }));
    const db = { execute: async (statement: any) => {
      const query = new MySqlDialect().sqlToQuery(statement).sql; queries.push(query);
      if (query.includes("SELECT a.id AS assignmentId")) return [parents];
      if (query.includes("SELECT n.id,n.assignmentId")) return [needs];
      if (query.includes("FROM ticket_team_actions") || query.includes("FROM ticket_team_supply_links")) return [[]];
      throw Error(`Unexpected query: ${query}`);
    } } as any;
    const repository = new SqlTicketTeamAssignmentRepository(async () => ({ db, tickets: {} as any }));
    const rows = await repository.queue({ id: senior.id, role: senior.role, active: true }, { materialsOnly: true });
    expect(rows).toHaveLength(200); expect(queries).toHaveLength(4);
    expect(queries[0]).toContain("INNER JOIN tickets k"); expect(queries[0]).toContain("i.ticketId=a.ticketId");
    expect(rows[0].materialNeeds?.[0]).toMatchObject({ name: "مادة", section: "returns", requestedQuantity: 5, issuedQuantity: 5, returnedQuantity: 1, availableQuantity: 4 });
  });
});
