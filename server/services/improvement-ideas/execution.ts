import { sql, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { aggregateImprovementCosts, canAddImprovementExecutionTicket, deriveImprovementExecutionProgress, hasCompleteCostStudy, moneyCents } from "../../../shared/improvement-execution";

export interface ExecutionSql { execute(query: SQL): Promise<any> }
async function rows(tx: ExecutionSql, query: SQL): Promise<any[]> { const result = await tx.execute(query); return result[0]; }
const ids = (values: number[]) => sql.join(values.map(id => sql`${id}`), sql`, `);
export async function validateIdeaLocation(tx: ExecutionSql, input: { siteId?: number | null; sectionId?: number | null; assetId?: number | null }) {
  if (!input.siteId || !input.sectionId) throw new TRPCError({ code: "BAD_REQUEST", message: "الموقع والقسم مطلوبان" });
  const [site] = await rows(tx, sql`SELECT id,isActive FROM sites WHERE id=${input.siteId}`);
  const [section] = await rows(tx, sql`SELECT id,siteId,isActive FROM sections WHERE id=${input.sectionId}`);
  if (!site || Number(site.isActive) !== 1 || !section || Number(section.isActive) !== 1 || Number(section.siteId) !== input.siteId)
    throw new TRPCError({ code: "BAD_REQUEST", message: "الموقع أو القسم غير متاح أو القسم لا يتبع الموقع" });
  if (input.assetId) {
    const [asset] = await rows(tx, sql`SELECT id,siteId,sectionId FROM assets WHERE id=${input.assetId}`);
    if (!asset || Number(asset.sectionId) !== input.sectionId || asset.siteId && Number(asset.siteId) !== input.siteId)
      throw new TRPCError({ code: "BAD_REQUEST", message: "الأصل لا يتبع الموقع والقسم المختارين" });
  }
}
export async function prepareIdeaExecution(tx: ExecutionSql, id: number, actor: { id: number; role: string }, input: { siteId?: number | null; sectionId?: number | null; assetId?: number | null }, kind?: "ticket") {
  if (!["owner", "admin", "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager"].includes(actor.role)) throw new TRPCError({ code: "FORBIDDEN", message: "تحويل الفكرة للمسؤول المخول فقط" });
  const [idea] = await rows(tx, sql`SELECT * FROM improvement_ideas WHERE id=${id} FOR UPDATE`);
  if (!idea) throw new TRPCError({ code: "NOT_FOUND", message: "الفكرة غير موجودة" });
  const addingExecution = kind === "ticket" && canAddImprovementExecutionTicket(idea);
  if (!addingExecution && (idea.status !== "approved" || idea.linkedTicketId || idea.linkedPurchaseOrderId)) throw new TRPCError({ code: "CONFLICT", message: "الفكرة ليست جاهزة للتحويل أو رُبطت بمستند سابقًا؛ افتح تفاصيلها" });
  if (addingExecution) {
    const [order] = await rows(tx, sql`SELECT id,siteId,sectionId,assetId,status FROM purchase_orders WHERE id=${idea.linkedPurchaseOrderId} FOR UPDATE`);
    if (!order || ["draft", "rejected", "cancelled"].includes(order.status) || Number(order.siteId) !== Number(idea.siteId) || Number(order.sectionId) !== Number(idea.sectionId) || Number(order.assetId || 0) !== Number(idea.assetId || 0))
      throw new TRPCError({ code: "CONFLICT", message: "طلب شراء الفكرة غير متاح للتنفيذ أو لا يطابق موقعها وقسمها وأصلها" });
  }
  if (idea.costStudyRequired && (!(Number(idea.executionTrackingVersion) === 1 ? hasCompleteCostStudy(idea) : idea.costStudiedAt) || !idea.implementationOwner?.trim() || !idea.implementationDueDate)) throw new TRPCError({ code: "BAD_REQUEST", message: "استكمل دراسة التكلفة وخطة التنفيذ أولًا" });
  if (Number(idea.executionTrackingVersion) === 1) {
    if (Number(idea.siteId) !== input.siteId || Number(idea.sectionId) !== input.sectionId || Number(idea.assetId || 0) !== Number(input.assetId || 0))
      throw new TRPCError({ code: "BAD_REQUEST", message: "موقع مستند التنفيذ وقسمه وأصله يجب أن تطابق الفكرة" });
    await validateIdeaLocation(tx, input);
  }
  return idea;
}
export async function linkCreatedExecution(tx: ExecutionSql, idea: any, kind: "ticket" | "purchase", documentId: number, actorId: number) {
  if (!documentId) throw new Error("تعذر إنشاء مستند التنفيذ");
  const field = kind === "ticket" ? sql`linkedTicketId` : sql`linkedPurchaseOrderId`;
  const addingExecution = kind === "ticket" && canAddImprovementExecutionTicket(idea);
  const stateGuard = addingExecution
    ? sql`status='in_progress' AND executionTrackingVersion=1 AND linkedTicketId IS NULL AND linkedPurchaseOrderId=${idea.linkedPurchaseOrderId}`
    : sql`status='approved' AND linkedTicketId IS NULL AND linkedPurchaseOrderId IS NULL`;
  const result = await tx.execute(sql`UPDATE improvement_ideas SET ${field}=${documentId},status='in_progress' WHERE id=${idea.id} AND ${stateGuard}`);
  if (Number(result[0]?.affectedRows) !== 1) throw new TRPCError({ code: "CONFLICT", message: "تغيرت حالة الفكرة؛ أعد فتحها" });
  await tx.execute(sql`INSERT INTO audit_logs (userId,action,entityType,entityId,newValues) VALUES (${actorId},'link_created_improvement_execution','improvement_idea',${idea.id},${JSON.stringify({ kind, documentId, requestNumber: idea.requestNumber })})`);
}
export async function validateDirectIdeaPurchaseContext(tx: ExecutionSql, documentId: number, input: { siteId?: number | null; sectionId?: number | null; assetId?: number | null }) {
  const linked = await rows(tx, sql`SELECT siteId,sectionId,assetId FROM improvement_ideas WHERE linkedPurchaseOrderId=${documentId} AND executionTrackingVersion=1`);
  for (const idea of linked) if (Number(idea.siteId) !== input.siteId || Number(idea.sectionId) !== input.sectionId || Number(idea.assetId || 0) !== Number(input.assetId || 0))
    throw new TRPCError({ code: "BAD_REQUEST", message: "موقع مستند التنفيذ وقسمه وأصله يجب أن تطابق الفكرة" });
}
export async function assertNotTrackedIdeaSource(tx: ExecutionSql, kind: "ticket" | "purchase", documentId: number) {
  const field = kind === "ticket" ? sql`linkedTicketId` : sql`linkedPurchaseOrderId`;
  const linked = await rows(tx, sql`SELECT id FROM improvement_ideas WHERE ${field}=${documentId} AND executionTrackingVersion=1 LIMIT 1`);
  if (linked.length) throw new TRPCError({ code: "BAD_REQUEST", message: "هذا مستند تنفيذ فكرة تحسين؛ لا يمكن حذفه وفقد مرجع التنفيذ" });
}
export async function executionReference(tx: ExecutionSql, kind: "ticket" | "purchase", documentId: number) {
  let current = documentId;
  if (kind === "purchase") {
    const direct = await rows(tx, sql`SELECT id,requestNumber FROM improvement_ideas WHERE linkedPurchaseOrderId=${documentId}`);
    if (direct.length > 1) throw new TRPCError({ code: "CONFLICT", message: "المستند مرتبط بأكثر من فكرة؛ يلزم مراجعة الروابط" });
    if (direct[0]) return direct[0];
    const [order] = await rows(tx, sql`SELECT ticketId FROM purchase_orders WHERE id=${documentId}`);
    current = Number(order?.ticketId || 0);
  }
  const ancestors: number[] = [];
  while (current && ancestors.length < 50) {
    if (ancestors.includes(current)) throw new Error("دورة غير صالحة في روابط البلاغات");
    ancestors.push(current);
    const [ticket] = await rows(tx, sql`SELECT parentTicketId FROM tickets WHERE id=${current}`);
    current = Number(ticket?.parentTicketId || 0);
  }
  if (current) throw new Error("عمق روابط البلاغات يتجاوز حد التحقق");
  if (!ancestors.length) return null;
  const matches = await rows(tx, sql`SELECT id,requestNumber FROM improvement_ideas WHERE linkedTicketId IN (${ids(ancestors)})`);
  if (matches.length > 1) throw new TRPCError({ code: "CONFLICT", message: "سلسلة التنفيذ مرتبطة بأكثر من فكرة؛ يلزم مراجعة الروابط" });
  return matches[0] ?? null;
}
export async function improvementExecutionSummary(tx: ExecutionSql, idea: any) {
  const tickets: any[] = [], visited = new Set<number>();
  let frontier = idea.linkedTicketId ? [Number(idea.linkedTicketId)] : [];
  const readTickets = async (values: number[], children = false) => {
    const found: any[] = [];
    for (let offset = 0; offset < values.length; offset += 500) {
      const chunk = values.slice(offset, offset + 500);
      found.push(...await rows(tx, sql`SELECT id,ticketNumber,title,status,actualCost,parentTicketId FROM tickets WHERE ${children ? sql`parentTicketId` : sql`id`} IN (${ids(chunk)})`));
    }
    return found;
  };
  let found = await readTickets(frontier);
  for (let depth = 0; frontier.length && depth < 50; depth++) {
    if (visited.size + frontier.length > 2000) throw new Error("عدد مستندات التنفيذ يتجاوز حد التحقق");
    for (const ticket of found) { if (visited.has(Number(ticket.id))) throw new Error("دورة غير صالحة في سلسلة التنفيذ"); visited.add(Number(ticket.id)); tickets.push(ticket); }
    found = await readTickets(frontier, true);
    frontier = found.map(child => Number(child.id));
  }
  if (frontier.length) throw new Error("عمق روابط التنفيذ يتجاوز حد التحقق");
  const ticketIds = tickets.map(ticket => Number(ticket.id));
  const orders = await rows(tx, sql`SELECT id,poNumber,ticketId,status,requestedById FROM purchase_orders WHERE ${idea.linkedPurchaseOrderId ? sql`id=${idea.linkedPurchaseOrderId}` : sql`FALSE`} OR ${ticketIds.length ? sql`ticketId IN (${ids(ticketIds)})` : sql`FALSE`}`);
  const orderIds = orders.map(order => Number(order.id));
  const items = orderIds.length ? await rows(tx, sql`SELECT i.id,i.purchaseOrderId,i.itemName,i.status,i.actualTotalCost,i.purchasedAt,i.receivedAt,i.quantity,q.ticketLinkedQuantity FROM purchase_order_items i INNER JOIN purchase_orders p ON p.id=i.purchaseOrderId LEFT JOIN (SELECT s.sourceId,a.ticketId,SUM(s.linkedQuantity) AS ticketLinkedQuantity FROM ticket_team_supply_links s INNER JOIN ticket_team_material_needs n ON n.id=s.needId INNER JOIN ticket_team_assignments a ON a.id=n.assignmentId WHERE s.sourceKind='purchase' GROUP BY s.sourceId,a.ticketId) q ON q.sourceId=i.id AND q.ticketId=p.ticketId WHERE i.purchaseOrderId IN (${ids(orderIds)})`) : [];
  const movements = ticketIds.length ? await rows(tx, sql`SELECT x.id,x.ticketId,COALESCE(x.purchaseOrderItemId,l.purchaseOrderItemId) AS purchaseOrderItemId,x.type,x.transactionType,x.totalCost,COALESCE(d.deliveryNumber,r.returnNumber) AS documentNumber FROM inventory_transactions x LEFT JOIN inventory_lots l ON l.id=x.lotId LEFT JOIN delivery_documents d ON d.inventoryTransactionId=x.id LEFT JOIN warehouse_returns r ON r.id=x.returnId WHERE x.ticketId IN (${ids(ticketIds)}) AND ((x.type='out' AND x.transactionType='delivery') OR (x.type='in' AND x.transactionType='return'))`) : [];
  // Organizational parent totals duplicate executable children and are excluded as control totals.
  const costTickets = tickets.map(ticket => tickets.some(child => Number(child.parentTicketId) === Number(ticket.id)) ? { ...ticket, actualCost: null } : ticket);
  const costs = aggregateImprovementCosts(costTickets, orders, items, movements);
  const estimate = [idea.estimatedMaterialsCost, idea.estimatedLaborCost, idea.estimatedServicesCost].reduce((sum, value) => sum + (moneyCents(value) ?? 0), 0) / 100;
  const ticketDone = tickets.length > 0 && tickets.every(ticket => ["closed", "requester_confirmed"].includes(ticket.status));
  const orderDone = orders.length > 0 && orders.every(order => {
    const orderItems = items.filter(item => Number(item.purchaseOrderId) === Number(order.id));
    return ["received", "closed", "rejected"].includes(order.status) && orderItems.length > 0 && orderItems.every(item => ["purchased", "delivered_to_warehouse", "delivered_to_requester", "rejected", "cancelled"].includes(item.status));
  });
  const missingDocument = (!!idea.linkedTicketId && !tickets.some(ticket => Number(ticket.id) === Number(idea.linkedTicketId))) || (!!idea.linkedPurchaseOrderId && !orders.some(order => Number(order.id) === Number(idea.linkedPurchaseOrderId)));
  const tasks = Number(idea.executionTrackingVersion) === 1 && ticketIds.length ? await rows(tx, sql`SELECT id,ticketId,status,convertedTicketId FROM ticket_tasks WHERE ticketId IN (${ids(ticketIds)})`) : [];
  const executionProgress = Number(idea.executionTrackingVersion) === 1 ? deriveImprovementExecutionProgress(idea, tickets, orders, items, tasks) : undefined;
  return { ...costs, estimatedTotal: estimate, budgetRemaining: Math.round((estimate - costs.total) * 100) / 100, tickets, orders,
    executionProgress,
    executionDone: !missingDocument && (tickets.length > 0 || orders.length > 0) && (!tickets.length || ticketDone) && (!orders.length || orderDone), missingDocument };
}
