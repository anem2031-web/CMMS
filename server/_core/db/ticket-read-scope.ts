import { and, eq, inArray, or } from "drizzle-orm";
import { tickets, ticketItems, ticketDepartments, ticketTasks, ticketTaskAssignees, purchaseOrders } from "../../../drizzle/schema";
import { getDb } from "./client";
import { groupReadRows, readScopeChunks } from "../authz/read-batch";
import { isTicketVisible, type TicketAccessUser, type TicketReadPort } from "../../routers/tickets/tickets.access";

/** All data is local to this invocation. The original guard decides each ticket;
 * never use this preloaded scope as authority for a subsequent mutation. */
export async function loadTicketReadScope(user: TicketAccessUser, ids: number[], database?: any) {
  const db = database ?? await getDb();
  if (!db) throw new Error("تعذر تحميل نطاق البلاغات");
  const rows: any[] = await readScopeChunks(ids, selected => db.select({
    id: tickets.id, reportedById: tickets.reportedById, assignedToId: tickets.assignedToId,
    assignedTechnicianId: tickets.assignedTechnicianId, sourceTaskId: tickets.sourceTaskId,
    maintenanceResponsibleDepartment: tickets.maintenanceResponsibleDepartment,
    maintenanceResponsibleManagerId: tickets.maintenanceResponsibleManagerId,
  }).from(tickets).where(inArray(tickets.id, selected)));
  const slow = rows.filter(ticket => !isTicketVisible(user, ticket));
  const slowIds = slow.map(ticket => Number(ticket.id));
  const taskRole = ["technician", "it_manager", "it_member"].includes(user.role);
  const departmentRole = ["construction_procurement_manager", "it_manager", "it_member"].includes(user.role);
  const [items, departments, assignments, linked]: any[][] = await Promise.all([
    readScopeChunks(slowIds, selected => db.select({ ticketId: ticketItems.ticketId,
      assignedToId: ticketItems.assignedToId, assignedTechnicianId: ticketItems.assignedTechnicianId,
      responsibleDepartment: ticketItems.responsibleDepartment, responsibleManagerId: ticketItems.responsibleManagerId,
    }).from(ticketItems).where(inArray(ticketItems.ticketId, selected))),
    departmentRole ? readScopeChunks(slowIds, selected => db.select({ ticketId: ticketDepartments.ticketId,
      department: ticketDepartments.department, responsibleManagerId: ticketDepartments.responsibleManagerId,
    }).from(ticketDepartments).where(inArray(ticketDepartments.ticketId, selected))) : [],
    taskRole ? readScopeChunks(slowIds, selected => {
      const sources = slow.filter(ticket => selected.includes(Number(ticket.id)) && ticket.sourceTaskId).map(ticket => Number(ticket.sourceTaskId));
      return db.select({ taskId: ticketTasks.id, ticketId: ticketTasks.ticketId, userId: ticketTaskAssignees.userId })
        .from(ticketTaskAssignees).innerJoin(ticketTasks, eq(ticketTaskAssignees.taskId, ticketTasks.id))
        .where(and(eq(ticketTaskAssignees.userId, user.id), or(inArray(ticketTasks.ticketId, selected), sources.length ? inArray(ticketTasks.id, sources) : undefined)));
    }) : [],
    user.role === "construction_procurement_manager" ? readScopeChunks(slowIds, selected => db.select({ ticketId: purchaseOrders.ticketId }).from(purchaseOrders).where(inArray(purchaseOrders.ticketId, selected))) : [],
  ]);
  const itemsByTicket = groupReadRows(items, row => Number(row.ticketId));
  const departmentsByTicket = groupReadRows(departments, row => Number(row.ticketId));
  const assignedTickets = new Set(assignments.map(row => Number(row.ticketId)));
  const assignedTasks = new Set(assignments.map(row => Number(row.taskId)));
  const linkedTickets = new Set(linked.map(row => Number(row.ticketId)));
  const source: TicketReadPort = {
    getTicketItems: async id => itemsByTicket.get(id) ?? [],
    hasTicketDepartmentAssignment: async (id, department, managerId) => (departmentsByTicket.get(id) ?? []).some(row => row.department === department && (managerId === undefined || Number(row.responsibleManagerId) === managerId)),
    hasPurchaseOrderForTicket: async id => linkedTickets.has(id),
    isUserAssignedToTicketTasks: async (id, sourceTaskId, userId) => userId === user.id && (assignedTickets.has(id) || !!sourceTaskId && assignedTasks.has(Number(sourceTaskId))),
  };
  return { tickets: new Map<number, any>(rows.map(row => [Number(row.id), row])), source };
}
