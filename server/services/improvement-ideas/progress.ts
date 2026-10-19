import { sql, type SQL } from "drizzle-orm";
import { deriveImprovementExecutionProgress, type ImprovementExecutionProgress, type ImprovementProgressIdea, type ImprovementProgressTicket } from "../../../shared/improvement-execution";
import type { ExecutionSql } from "./execution";

const ids = (values: number[]) => sql.join(values.map(id => sql`${id}`), sql`, `);
const positiveIds = (values: unknown[]) => Array.from(new Set(values.map(Number).filter(id => Number.isSafeInteger(id) && id > 0)));
async function rows(tx: ExecutionSql, query: SQL): Promise<any[]> { return (await tx.execute(query))[0]; }
async function readChunks(tx: ExecutionSql, values: number[], query: (chunk: number[]) => SQL) {
  const found: any[] = [];
  for (let offset = 0; offset < values.length; offset += 500) found.push(...await rows(tx, query(values.slice(offset, offset + 500))));
  return found;
}

/** Batch all tracked ideas; no cost queries or per-card database round trips. */
export async function loadImprovementExecutionProgress(tx: ExecutionSql, ideas: ImprovementProgressIdea[]) {
  const tracked = ideas.filter(idea => Number(idea.executionTrackingVersion) === 1);
  const result = new Map<number, ImprovementExecutionProgress>();
  if (!tracked.length) return result;
  const tickets = new Map<number, ImprovementProgressTicket>();
  const visited = new Set<number>();
  let frontier = positiveIds(tracked.map(idea => idea.linkedTicketId));
  for (let depth = 0; frontier.length && depth < 50; depth++) {
    frontier.forEach(id => visited.add(id));
    const found = await readChunks(tx, frontier, chunk => sql`SELECT id,status,parentTicketId FROM tickets WHERE id IN (${ids(chunk)})`);
    found.forEach(ticket => tickets.set(Number(ticket.id), ticket));
    const children = await readChunks(tx, frontier, chunk => sql`SELECT id FROM tickets WHERE parentTicketId IN (${ids(chunk)})`);
    frontier = positiveIds(children.map(child => child.id)).filter(id => !visited.has(id));
  }
  if (frontier.length) throw new Error("عمق روابط التنفيذ يتجاوز حد التحقق");
  const ticketIds = Array.from(tickets.keys());
  const directOrders = positiveIds(tracked.map(idea => idea.linkedPurchaseOrderId));
  const relatedOrders = await readChunks(tx, ticketIds, chunk => sql`SELECT id,ticketId,status FROM purchase_orders WHERE ticketId IN (${ids(chunk)})`);
  const linkedOrders = await readChunks(tx, directOrders, chunk => sql`SELECT id,ticketId,status FROM purchase_orders WHERE id IN (${ids(chunk)})`);
  const orders = Array.from(new Map([...relatedOrders, ...linkedOrders].map(order => [Number(order.id), order])).values());
  const orderIds = positiveIds(orders.map(order => order.id));
  const items = await readChunks(tx, orderIds, chunk => sql`SELECT id,purchaseOrderId,status FROM purchase_order_items WHERE purchaseOrderId IN (${ids(chunk)})`);
  const tasks = await readChunks(tx, ticketIds, chunk => sql`SELECT id,ticketId,status,convertedTicketId FROM ticket_tasks WHERE ticketId IN (${ids(chunk)})`);
  for (const idea of tracked) result.set(Number(idea.id), deriveImprovementExecutionProgress(idea, Array.from(tickets.values()), orders, items, tasks));
  return result;
}
