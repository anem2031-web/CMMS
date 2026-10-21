/** Pure improvement cost rules. No database, financial posting or application imports. */
/** A purchased improvement may still need a maintenance execution document. */
export function canAddImprovementExecutionTicket(idea: { status?: string; executionTrackingVersion?: number; linkedPurchaseOrderId?: number | null; linkedTicketId?: number | null }) {
  return idea.status === "in_progress" && Number(idea.executionTrackingVersion) === 1 &&
    Number(idea.linkedPurchaseOrderId) > 0 && !idea.linkedTicketId;
}
export type CostSource = { key: string; documentKind: "purchase" | "ticket" | "inventory"; documentId: number; number: string; description: string; amount: number; status: string };
export type FinancialIssue = { code: "missing_value" | "invalid_value" | "unreconciled_total"; documentKind: CostSource["documentKind"]; documentId: number; number: string };
export interface ExecutionTicket { id: number; ticketNumber: string; status: string; actualCost: string | number | null }
export interface ExecutionPurchase { id: number; poNumber: string; ticketId: number | null; status: string }
export interface PurchaseCostItem { id: number; purchaseOrderId: number; itemName: string; status: string; actualTotalCost: string | number | null; purchasedAt: unknown; receivedAt?: unknown; quantity?: number | string; ticketLinkedQuantity?: number | string | null }
export interface StockCostMovement { id: number; ticketId: number; purchaseOrderItemId: number | null; type: string; transactionType: string; totalCost: string | number | null; documentNumber?: string }
export interface ImprovementProgressIdea { id: number; executionTrackingVersion?: number; linkedTicketId?: number | null; linkedPurchaseOrderId?: number | null }
export interface ImprovementProgressTicket { id: number; status: string; parentTicketId?: number | null }
export interface ImprovementProgressOrder { id: number; ticketId?: number | null; status: string }
export interface ImprovementProgressItem { id: number; purchaseOrderId: number; status: string }
export interface ImprovementProgressTask { id: number; ticketId: number; status: string; convertedTicketId?: number | null }
export interface ImprovementExecutionProgress { percent: number; completed: number; total: number; ready: boolean; missingDocument: boolean }

/** Display progress only. Financial settlement and outcome evaluation keep their own rules. */
export function deriveImprovementExecutionProgress(
  idea: ImprovementProgressIdea,
  tickets: ImprovementProgressTicket[],
  orders: ImprovementProgressOrder[],
  items: ImprovementProgressItem[],
  tasks: ImprovementProgressTask[],
): ImprovementExecutionProgress {
  const ticketMap = new Map(tickets.map(ticket => [Number(ticket.id), ticket]));
  const included = new Set<number>();
  const children = new Map<number, number[]>();
  for (const ticket of Array.from(ticketMap.values())) {
    if (ticket.parentTicketId) children.set(Number(ticket.parentTicketId), [...(children.get(Number(ticket.parentTicketId)) ?? []), Number(ticket.id)]);
  }
  let missingDocument = !!idea.linkedTicketId && !ticketMap.has(Number(idea.linkedTicketId));
  const pending = idea.linkedTicketId ? [Number(idea.linkedTicketId)] : [];
  while (pending.length) {
    const id = pending.pop()!;
    if (included.has(id)) { missingDocument = true; continue; }
    if (!ticketMap.has(id)) continue;
    if (included.size >= 2000) throw new Error("عدد مستندات التنفيذ يتجاوز حد التحقق");
    included.add(id);
    pending.push(...(children.get(id) ?? []));
  }
  const linkedOrders = Array.from(new Map(orders.filter(order => Number(order.id) === Number(idea.linkedPurchaseOrderId) || included.has(Number(order.ticketId))).map(order => [Number(order.id), order])).values());
  const missingPurchase = !!idea.linkedPurchaseOrderId && !linkedOrders.some(order => Number(order.id) === Number(idea.linkedPurchaseOrderId));
  const unresolvedTasks = Array.from(new Map(tasks.filter(task => included.has(Number(task.ticketId)) && task.status !== "cancelled").map(task => [Number(task.id), task])).values())
    .filter(task => !task.convertedTicketId || !included.has(Number(task.convertedTicketId)));
  if (unresolvedTasks.some(task => !!task.convertedTicketId)) missingDocument = true;
  missingDocument ||= missingPurchase;
  const completedTickets = Array.from(included).filter(id => ["closed", "requester_confirmed"].includes(ticketMap.get(id)!.status)).length;
  const uniqueItems = Array.from(new Map(items.map(item => [Number(item.id), item])).values());
  const completedOrders = linkedOrders.filter(order => {
    const orderItems = uniqueItems.filter(item => Number(item.purchaseOrderId) === Number(order.id));
    return ["received", "closed"].includes(order.status) && orderItems.length > 0 &&
      orderItems.every(item => ["purchased", "delivered_to_warehouse", "delivered_to_requester"].includes(item.status));
  }).length;
  const total = included.size + linkedOrders.length + unresolvedTasks.length +
    (idea.linkedTicketId && !ticketMap.has(Number(idea.linkedTicketId)) ? 1 : 0) + (missingPurchase ? 1 : 0);
  const completed = completedTickets + completedOrders;
  const ready = total > 0 && completed === total && !missingDocument && unresolvedTasks.length === 0;
  const percent = ready ? 100 : total > 0 ? Math.min(99, Math.round(completed * 100 / total)) : 0;
  return { percent, completed, total, ready, missingDocument };
}
export function moneyCents(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0")));
  return Number.isSafeInteger(cents) ? cents : null;
}
export function hasCompleteCostStudy(idea: any): boolean {
  return !!idea.costStudiedAt && !!idea.costStudyById && !!idea.costStudyNotes?.trim() &&
    [idea.estimatedMaterialsCost, idea.estimatedLaborCost, idea.estimatedServicesCost].every(value => moneyCents(value) !== null);
}
export function aggregateImprovementCosts(tickets: ExecutionTicket[], orders: ExecutionPurchase[], items: PurchaseCostItem[], movements: StockCostMovement[]) {
  const lines: CostSource[] = [], issues: FinancialIssue[] = [];
  const seen = new Set<string>(), purchasedItems = new Set<number>(), costByTicket = new Map<number, number>();
  const orderMap = new Map(orders.map(o => [o.id, o]));
  const ticketMap = new Map(tickets.map(t => [t.id, t]));
  const sharedPurchases = new Map<number, { cents: number; ticketId: number }>();
  const sharedConsumption = new Map<string, { cents: number; purchaseShare: number; movement: StockCostMovement; ticket: ExecutionTicket }>();
  const consumedMovementIds = new Set<number>();
  const add = (line: CostSource, cents: number, ticketId?: number | null) => {
    if (seen.has(line.key)) return;
    seen.add(line.key); lines.push({ ...line, amount: cents / 100 });
    if (ticketId) costByTicket.set(ticketId, (costByTicket.get(ticketId) ?? 0) + cents);
  };
  const issue = (code: FinancialIssue["code"], kind: CostSource["documentKind"], id: number, number: string) => issues.push({ code, documentKind: kind, documentId: id, number });
  for (const item of items) {
    const order = orderMap.get(item.purchaseOrderId);
    if (!order || !["purchased", "delivered_to_warehouse", "delivered_to_requester"].includes(item.status)) continue;
    if (!item.purchasedAt && !item.receivedAt) { issue("missing_value", "purchase", order.id, order.poNumber); continue; }
    // Only actual purchases recorded by the existing authorized purchasing workflow. Never estimates/custody.
    let cents = moneyCents(item.actualTotalCost);
    if (cents === null) { issue(item.actualTotalCost == null ? "missing_value" : "invalid_value", "purchase", order.id, order.poNumber); continue; }
    // A team-ticket PO may buy extra stock. Attribute only its canonical linked
    // quantity; general purchasing totals keep the full original actual cost.
    if (order.ticketId && item.ticketLinkedQuantity != null) {
      const totalQuantity = Number(item.quantity), linkedQuantity = Number(item.ticketLinkedQuantity);
      if (!Number.isSafeInteger(totalQuantity) || !Number.isSafeInteger(linkedQuantity) || totalQuantity <= 0 || linkedQuantity <= 0 || linkedQuantity > totalQuantity) {
        issue("invalid_value", "purchase", order.id, order.poNumber); continue;
      }
      const denominator = BigInt(totalQuantity);
      cents = Number((BigInt(cents) * BigInt(linkedQuantity) + denominator / BigInt(2)) / denominator);
      if (linkedQuantity < totalQuantity) sharedPurchases.set(item.id, { cents, ticketId: order.ticketId });
    }
    purchasedItems.add(item.id);
    add({ key: `purchase-item:${item.id}`, documentKind: "purchase", documentId: order.id, number: order.poNumber, description: item.itemName, amount: 0, status: item.status }, cents, order.ticketId);
  }
  for (const movement of movements) {
    const ticket = ticketMap.get(movement.ticketId);
    if (!ticket || !(movement.type === "out" && movement.transactionType === "delivery" || movement.type === "in" && movement.transactionType === "return")) continue;
    // The project's own purchase was already counted, including material later issued to the same project.
    const shared = movement.purchaseOrderItemId ? sharedPurchases.get(movement.purchaseOrderItemId) : undefined;
    if (movement.purchaseOrderItemId && purchasedItems.has(movement.purchaseOrderItemId) && !shared) continue;
    const cents = moneyCents(movement.totalCost);
    if (cents === null) { issue(movement.totalCost == null ? "missing_value" : "invalid_value", "inventory", movement.id, movement.documentNumber || ticket.ticketNumber); continue; }
    if (shared) {
      if (consumedMovementIds.has(movement.id)) continue;
      consumedMovementIds.add(movement.id);
      const key = `${movement.purchaseOrderItemId}:${ticket.id}`;
      const previous = sharedConsumption.get(key);
      sharedConsumption.set(key, { cents: (previous?.cents ?? 0) + (movement.type === "in" ? -cents : cents), purchaseShare: shared.ticketId === ticket.id ? shared.cents : 0, movement, ticket });
      continue;
    }
    add({ key: `inventory-transaction:${movement.id}`, documentKind: "inventory", documentId: movement.id, number: movement.documentNumber || ticket.ticketNumber, description: movement.type === "in" ? "stock_return" : "stock_issue", amount: 0, status: movement.transactionType }, movement.type === "in" ? -cents : cents, ticket.id);
  }
  // Extra stock remains uncharged until actually issued to this project's tickets.
  // Count only net consumption above the already counted purchase share.
  for (const [key, entry] of Array.from(sharedConsumption.entries())) {
    if (!Number.isSafeInteger(entry.cents) || entry.cents < 0) { issue("invalid_value", "inventory", entry.movement.id, entry.movement.documentNumber || entry.ticket.ticketNumber); continue; }
    const extraCost = Math.max(0, entry.cents - entry.purchaseShare);
    if (extraCost > 0) add({ key: `inventory-shared-purchase:${key}`, documentKind: "inventory", documentId: entry.movement.id, number: entry.movement.documentNumber || entry.ticket.ticketNumber, description: "stock_issue_above_ticket_purchase_share", amount: 0, status: "delivery" }, extraCost, entry.ticket.id);
  }
  for (const ticket of tickets) {
    if (!["closed", "requester_confirmed"].includes(ticket.status) || ticket.actualCost === null) continue;
    const total = moneyCents(ticket.actualCost), components = costByTicket.get(ticket.id) ?? 0;
    if (total === null) { issue("invalid_value", "ticket", ticket.id, ticket.ticketNumber); continue; }
    // actualCost is a recorded maintenance TOTAL, never an additional material charge.
    if (components > total) { issue("unreconciled_total", "ticket", ticket.id, ticket.ticketNumber); continue; }
    const remainder = total - components;
    if (remainder > 0) add({ key: `ticket-residual:${ticket.id}`, documentKind: "ticket", documentId: ticket.id, number: ticket.ticketNumber, description: "maintenance_remainder", amount: 0, status: ticket.status }, remainder, ticket.id);
  }
  const totalCents = lines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0);
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new Error("قيمة التكاليف المجمعة غير صالحة؛ راجع المصروف والمرتجع");
  return { lines, issues, total: totalCents / 100, complete: issues.length === 0 };
}
