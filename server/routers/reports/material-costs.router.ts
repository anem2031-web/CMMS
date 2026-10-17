import { z } from "zod";
import { sql, eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, warehouseProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { pmv2Tasks } from "../../../drizzle/schema";
import { pmv2ExecutionActor, pmv2ExecutionActorCondition, pmv2ExecutionTeamCondition } from "../../pmv2/security/execution-access";
import { materialExecutionCostsEnabled } from "../../services/material-costs/feature";
import { readMaterialCostIssues } from "../../services/material-costs/reader";
import { materialCostEvents, summarizeMaterialCosts, groupMaterialCosts, type MaterialCostIssue } from "../../../shared/material-execution-costs";
import { assertTicketReadable } from "../tickets/tickets.access";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "التاريخ غير صالح");
const reportInput = z.object({
  source: z.enum(["all", "ticket", "pmv2", "independent"]).default("all"),
  groupBy: z.enum(["site", "section", "asset", "document"]).default("site"),
  siteId: z.number().int().positive().optional(), sectionId: z.number().int().positive().optional(), assetId: z.number().int().positive().optional(),
  from: date.optional(), to: date.optional(), page: z.number().int().min(1).default(1),
}).refine(value => !value.from || !value.to || value.from <= value.to, "بداية الفترة بعد نهايتها");
const fullReadRoles = new Set(["owner", "admin", "accountant", "warehouse", "senior_management", "executive_director"]);
const reportRoles = new Set([...Array.from(fullReadRoles), "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "supervisor", "it_manager"]);
async function database() { const value = await db.getDb(); if (!value) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر قراءة تكاليف المواد" }); return value; }

async function scopeIssues(issues: MaterialCostIssue[], user: { id: number; role: string }, connection: any) {
  if (fullReadRoles.has(user.role)) return issues;
  const ticketIds = new Set<number>();
  // Existing ticket-list guard includes secondary items/departments; construction keeps its exact manager scope.
  const tickets = await db.getTickets(user.role === "construction_procurement_manager" ? { constructionManagerScopeUserId: user.id }
    : user.role === "general_maintenance_manager" ? { maintenanceResponsibleDepartment: "maintenance_report_department_general" }
    : user.role === "it_manager" ? { itManagerScopeUserId: user.id } : {});
  for (const ticket of tickets) ticketIds.add(ticket.id);
  const tasks = await connection.select({ id: pmv2Tasks.id }).from(pmv2Tasks).innerJoin(pmv2ExecutionActor, pmv2ExecutionActorCondition(user.id)).where(pmv2ExecutionTeamCondition(user.id, pmv2Tasks.teamId));
  const taskIds = new Set<number>(tasks.map((task: any) => Number(task.id)));
  return issues.filter(issue => issue.source === "pmv2" ? taskIds.has(issue.sourceId!)
    : issue.source === "independent" ? false : ticketIds.has(issue.sourceId!));
}

export const materialCostsRouter = router({
  status: protectedProcedure.query(() => ({ enabled: materialExecutionCostsEnabled() })),
  issueTargets: warehouseProcedure.input(z.object({ search: z.string().trim().max(100).default("") })).query(async ({ input }) => {
    if (!materialExecutionCostsEnabled()) return [];
    const connection = await database();
    const found: any = await connection.execute(sql`SELECT i.id AS itemId,t.id AS ticketId,t.ticketNumber,i.title,t.siteId,t.sectionId,t.assetId
      FROM ticket_items i INNER JOIN tickets t ON t.id=i.ticketId
      WHERE t.workflowModel<>'department_tasks' AND t.status NOT IN ('closed','requester_confirmed','cancelled','rejected')
      AND i.status NOT IN ('closed','requester_confirmed','cancelled','rejected') AND t.siteId IS NOT NULL AND t.sectionId IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ticket_team_assignments a WHERE a.ticketItemId=i.id)
      AND (t.ticketNumber LIKE ${`%${input.search}%`} OR t.title LIKE ${`%${input.search}%`}) ORDER BY t.id DESC,i.id LIMIT 100`);
    return found[0] as Array<{ itemId: number; ticketId: number; ticketNumber: string; title: string; siteId: number; sectionId: number; assetId: number | null }>;
  }),
  report: protectedProcedure.input(reportInput).query(async ({ input, ctx }) => {
    if (!reportRoles.has(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية تقرير تكلفة المواد" });
    if (!materialExecutionCostsEnabled()) return { enabled: false, summary: summarizeMaterialCosts([]), groups: [], rows: [], total: 0, page: input.page };
    const connection = await database();
    const source = input.source === "all" ? undefined : input.source;
    const issues = (await scopeIssues(await readMaterialCostIssues(connection, { ...input, source }), ctx.user, connection)).filter(issue =>
      (!input.siteId || issue.siteId === input.siteId) && (!input.sectionId || issue.sectionId === input.sectionId) && (!input.assetId || issue.assetId === input.assetId));
    const events = materialCostEvents(issues, input);
    return { enabled: true, summary: summarizeMaterialCosts(events), groups: groupMaterialCosts(events, input.groupBy),
      rows: events.slice((input.page - 1) * 50, input.page * 50), total: events.length, page: input.page };
  }),
  document: protectedProcedure.input(z.object({ source: z.enum(["ticket", "pmv2"]), id: z.number().int().positive() })).query(async ({ input, ctx }) => {
    if (!materialExecutionCostsEnabled()) return { enabled: false, summary: summarizeMaterialCosts([]), rows: [] };
    const connection = await database();
    let ids = [input.id];
    if (input.source === "ticket") {
      const ticket = await db.getTicketById(input.id);
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
      try { await assertTicketReadable(ctx.user, ticket); } catch (error) {
        if (!(error instanceof TRPCError) || error.code !== "FORBIDDEN" || ctx.user.role !== "technician") throw error;
        const [members]: any = await connection.execute(sql`SELECT a.id FROM ticket_team_assignments a INNER JOIN maintenance_teams t ON t.id=a.teamId AND t.isActive=1 INNER JOIN maintenance_team_members m ON m.teamId=t.id AND m.isActive=1 INNER JOIN users u ON u.id=m.userId AND u.isActive=1 AND u.role='technician' WHERE a.ticketId=${input.id} AND m.userId=${ctx.user.id} LIMIT 1`);
        if (!members.length) throw error;
      }
      // Organizational parent is a view over authorized children, never another cost line.
      if (ticket.workflowModel === "department_tasks") {
        const children = await db.getSubTicketsByParent(input.id);
        ids = [];
        for (const child of children) { try { await assertTicketReadable(ctx.user, child); ids.push(child.id); } catch (error) { if (!(error instanceof TRPCError) || error.code !== "FORBIDDEN") throw error; } }
      }
    } else {
      const visible = await connection.select({ id: pmv2Tasks.id }).from(pmv2Tasks).innerJoin(pmv2ExecutionActor, pmv2ExecutionActorCondition(ctx.user.id)).where(and(eq(pmv2Tasks.id, input.id), pmv2ExecutionTeamCondition(ctx.user.id, pmv2Tasks.teamId))).limit(1);
      if (!visible.length) throw new TRPCError({ code: "FORBIDDEN", message: "المهمة غير متاحة لهذا الحساب" });
    }
    const issues: MaterialCostIssue[] = [];
    for (const id of ids) issues.push(...await readMaterialCostIssues(connection, { source: input.source, sourceId: id }));
    const events = materialCostEvents(issues);
    return { enabled: true, summary: summarizeMaterialCosts(events), rows: events };
  }),
});
