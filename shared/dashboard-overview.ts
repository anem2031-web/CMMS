/** Read-only dashboard rules. No application, database or browser imports. */
export type DashboardDepartment = "all" | "general" | "construction" | "it" | "unclassified";
export type DashboardFilters = {
  period: "month" | "year" | "all" | "custom";
  dateFrom?: string;
  dateTo?: string;
  siteId?: number;
  department: DashboardDepartment;
};
export const DASHBOARD_METRICS = [
  "new_reports", "open_execution", "completed_execution", "aged_execution",
  "waiting_material", "purchase_pending", "purchase_in_transit", "purchase_received",
  "received_value", "critical_execution", "pending_triage", "under_inspection",
  "awaiting_confirmation",
  "organizing_reports",
] as const;
export type DashboardMetric = (typeof DASHBOARD_METRICS)[number];
export type WaitOwner = "maintenance" | "warehouse" | "purchase" | "accounting" | "management" | "external" | "gate" | "mixed" | "finished" | "unknown";
export type DashboardTicket = {
  id: number; ticketNumber: string; title: string;
  titleAr?: string | null; titleEn?: string | null; titleUr?: string | null;
  status: string; priority: string; workflowModel: string;
  parentTicketId: number | null; siteId: number | null;
  locationDetail?: string | null;
  department: string | null; managerId: number | null; assignedToId: number | null;
  supervisorId?: number | null; maintenancePath?: string | null;
  createdAt: number | null; closedAt: number | null; assignedAt: number | null;
};
export type DashboardItemScope = { ticketId: number; department: string | null; managerId: number | null };
export type DashboardOrder = { id: number; poNumber: string; status: string; ticketId: number | null; siteId: number | null; requestedById: number };
export type DashboardPurchase = {
  id: number; orderId: number; itemName: string; status: string;
  quantity: number; receivedQuantity: number | null; unit: string | null;
  actualTotalCost: string | number | null; receivedAt: number | null;
  purchasedAt: number | null; delegateId: number | null;
};
export type DashboardTeam = {
  id: number; ticketId: number; managerId: number; stage: string; teamName: string;
  createdAt: number | null; enteredAt: number | null; note: string | null;
};
export type DashboardData = {
  tickets: DashboardTicket[]; itemScopes: DashboardItemScope[]; departmentScopes: DashboardItemScope[];
  orders: DashboardOrder[]; purchases: DashboardPurchase[]; teams: DashboardTeam[];
  teamPurchaseLinks: { ticketId: number; purchaseItemId: number }[];
  statusEntries: { ticketId: number; enteredAt: number | null; note?: string | null }[];
  users: { id: number; name: string; role: string }[];
  sites: { id: number; name: string }[];
  externalJobs: { ticketId: number; status: string; delegateId: number | null; purchaseOrderId?: number | null; actualRecipientId?: number | null; createdAt: number | null; warehousePreparedAt: number | null; gateExitApprovedAt: number | null; delegateReadyForReturnAt: number | null; gateEntryApprovedAt: number | null; warehouseReceivedAt: number | null; handoverAt: number | null }[];
};
export type DashboardRow = {
  key: string; kind: "ticket" | "purchase"; id: number; number: string;
  title: string; titleAr?: string | null; titleEn?: string | null; titleUr?: string | null;
  status: string; priority?: string; siteId: number | null; siteName: string | null;
  departments: Exclude<DashboardDepartment, "all">[];
  managerNames: string[]; managerIds: number[]; managerKeys: string[];
  waitOwner: WaitOwner; actorNames: string[]; currentSince: number | null;
  waitHours: number | null; ageHours: number | null; note: string | null;
  actionStage: string | null;
  parentTicketId: number | null; date: number | null;
  amount: number | null; orderId?: number; orderNumber?: string;
  quantity?: number; unit?: string | null;
  childTotal?: number; childCompleted?: number;
};
export type DashboardManager = {
  key: string; managerId: number | null; name: string | null;
  department: Exclude<DashboardDepartment, "all">;
  open: number; completed: number; waitingElsewhere: number; agedInside: number; unknownWait: number;
};
export const DASHBOARD_AGE_HOURS = 48;
const FINISHED = new Set(["closed", "requester_confirmed"]);
const RECEIVED = new Set(["delivered_to_warehouse", "delivered_to_requester"]);
const PURCHASE_PENDING = new Set(["approved", "funded"]);
const mapDepartment = (value: string | null | undefined): Exclude<DashboardDepartment, "all"> => {
  if (value === "maintenance_report_department_general" || value === "general") return "general";
  if (value === "maintenance_report_department_construction" || value === "construction") return "construction";
  if (value === "maintenance_report_department_it" || value === "it") return "it";
  return "unclassified";
};
export function dashboardPeriod(filters: DashboardFilters, now: number) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
  const part = (key: string) => parts.find(p => p.type === key)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  let from: string | null = null, to: string | null = null;
  if (filters.period === "month") { from = `${part("year")}-${part("month")}-01`; to = today; }
  if (filters.period === "year") { from = `${part("year")}-01-01`; to = today; }
  if (filters.period === "custom") {
    from = filters.dateFrom ?? null; to = filters.dateTo ?? null;
    const valid = (s: string | null) => {
      if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
      const parsed = new Date(`${s}T00:00:00Z`);
      return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === s;
    };
    if (!valid(from) || !valid(to) || from! > to!) throw new Error("INVALID_DASHBOARD_PERIOD");
  }
  return {
    from, to,
    fromMs: from ? Date.parse(`${from}T00:00:00+03:00`) : null,
    toMs: to ? Date.parse(`${to}T00:00:00+03:00`) + 86400000 : null,
  };
}
function moneyCents(value: string | number | null): number | null {
  if (value == null || String(value).trim() === "") return null;
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  return cents <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(cents) : null;
}
export function buildDashboard(data: DashboardData, filters: DashboardFilters, now: number) {
  const range = dashboardPeriod(filters, now);
  const within = (at: number | null) => at != null && at <= now && (range.fromMs == null || at >= range.fromMs) && (range.toMs == null || at < range.toMs);
  const users = new Map(data.users.map(u => [u.id, u]));
  const sites = new Map(data.sites.map(s => [s.id, s.name]));
  const tickets = new Map(data.tickets.map(t => [t.id, t]));
  const orders = new Map(data.orders.map(o => [o.id, o]));
  const statusEntries = new Map(data.statusEntries.map(s => [s.ticketId, s]));
  const scopesByTicket = new Map<number, DashboardItemScope[]>();
  for (const scope of [...data.itemScopes, ...data.departmentScopes]) {
    const list = scopesByTicket.get(scope.ticketId) ?? [];
    list.push(scope); scopesByTicket.set(scope.ticketId, list);
  }
  const teamsByTicket = new Map<number, DashboardTeam[]>();
  for (const team of data.teams) {
    const list = teamsByTicket.get(team.ticketId) ?? [];
    list.push(team); teamsByTicket.set(team.ticketId, list);
  }
  const childProgress = new Map<number, { total: number; completed: number }>();
  for (const ticket of data.tickets) {
    if (!ticket.parentTicketId) continue;
    const entry = childProgress.get(ticket.parentTicketId) ?? { total: 0, completed: 0 };
    entry.total++; if (FINISHED.has(ticket.status)) entry.completed++;
    childProgress.set(ticket.parentTicketId, entry);
  }
  const externalByTicket = new Map<number, DashboardData["externalJobs"]>();
  for (const job of data.externalJobs) {
    if (job.status === "closed") continue;
    const list = externalByTicket.get(job.ticketId) ?? [];
    list.push(job); externalByTicket.set(job.ticketId, list);
  }
  const purchasesByTicket = new Map<number, DashboardPurchase[]>();
  const teamTicketIds = new Set(data.teams.map(t => t.ticketId));
  const link = (ticketId: number, item: DashboardPurchase) => {
    const list = purchasesByTicket.get(ticketId) ?? [];
    if (!list.some(x => x.id === item.id)) list.push(item);
    purchasesByTicket.set(ticketId, list);
  };
  for (const item of data.purchases) {
    const order = orders.get(item.orderId);
    if (order?.ticketId && !teamTicketIds.has(order.ticketId)) link(order.ticketId, item);
  }
  const purchaseMap = new Map(data.purchases.map(i => [i.id, i]));
  for (const entry of data.teamPurchaseLinks) {
    const item = purchaseMap.get(entry.purchaseItemId);
    if (item) link(entry.ticketId, item);
  }
  const unique = <T,>(values: T[]) => Array.from(new Set(values));
  function ticketScopes(ticket: DashboardTicket) {
    const parts = scopesByTicket.get(ticket.id) ?? [];
    const teamScopes = (teamsByTicket.get(ticket.id) ?? []).map(t => ({ ticketId: ticket.id, department: ticket.department, managerId: t.managerId }));
    const specific = [...parts, ...teamScopes].filter(s => s.department || s.managerId);
    const source = specific.length ? specific : [{ ticketId: ticket.id, department: ticket.department, managerId: ticket.managerId }];
    return unique(source.map(s => `${mapDepartment(s.department ?? ticket.department)}:${s.managerId ?? (s.department == null || s.department === ticket.department ? ticket.managerId : null) ?? ""}`)).map(key => {
      const [department, manager] = key.split(":");
      return { department: department as Exclude<DashboardDepartment, "all">, managerId: manager ? Number(manager) : null };
    });
  }
  function scopeMatches(siteId: number | null, departments: Exclude<DashboardDepartment, "all">[]) {
    return (!filters.siteId || siteId === filters.siteId) && (filters.department === "all" || departments.includes(filters.department));
  }
  const ticketSiteId = (ticket: DashboardTicket) => ticket.siteId ?? (ticket.parentTicketId ? tickets.get(ticket.parentTicketId)?.siteId ?? null : null);
  const ticketLocation = (ticket: DashboardTicket) => ticket.locationDetail?.trim() || (ticket.parentTicketId ? tickets.get(ticket.parentTicketId)?.locationDetail?.trim() : null) || null;
  function purchaseOwner(item: DashboardPurchase): WaitOwner {
    const order = orders.get(item.orderId);
    if (item.status === "purchased" || RECEIVED.has(item.status)) return "warehouse";
    if (PURCHASE_PENDING.has(item.status)) return "purchase";
    if (item.status === "pending_review" || item.status === "needs_item_revision") return "maintenance";
    if (item.status === "estimated" && order?.status === "pending_accounting") return "accounting";
    if (item.status === "estimated" && order?.status === "pending_management") return "management";
    if (["pending", "estimated"].includes(item.status)) return "purchase";
    return "unknown";
  }
  function ticketWait(ticket: DashboardTicket) {
    let owner: WaitOwner = "maintenance";
    let since = statusEntries.get(ticket.id)?.enteredAt ?? null;
    let note: string | null = statusEntries.get(ticket.id)?.note ?? null;
    let actionStage: string | null = null;
    let actors = ticket.assignedToId ? [users.get(ticket.assignedToId)?.name].filter((x): x is string => !!x) : [];
    const teamParts = (teamsByTicket.get(ticket.id) ?? []).filter(t => t.stage !== "closed");
    let material = ["needs_purchase", "purchase_pending_estimate", "purchase_pending_accounting", "purchase_pending_management", "purchase_approved", "partial_purchase", "purchased", "received_warehouse"].includes(ticket.status);
    if (FINISHED.has(ticket.status)) return { owner: "finished" as WaitOwner, since: ticket.closedAt, actors: [], note, material: false, actionStage };
    if (teamParts.length) {
      actionStage = unique(teamParts.map(team => `team:${team.stage}`)).join("|");
      const owners = teamParts.map(team => {
        if (team.stage === "waiting_material") { material = true; return "warehouse" as WaitOwner; }
        if (team.stage === "external_in_progress") return "external" as WaitOwner;
        return "maintenance" as WaitOwner;
      });
      const kinds = unique(owners);
      owner = kinds.length === 1 ? kinds[0] : "mixed";
      // Only a recorded stage transition or the initial assignment supplies a wait start.
      const starts = teamParts.map(t => t.enteredAt);
      since = starts.every(x => x != null) ? Math.min(...starts as number[]) : null;
      note = teamParts.map(t => t.note).filter(Boolean).join(" | ") || null;
      actors = unique(teamParts.flatMap(t => ["awaiting_review", "blocked", "external_requested"].includes(t.stage)
        ? users.get(t.managerId) ? [users.get(t.managerId)!.name] : []
        : t.teamName ? [t.teamName] : []));
    } else if (ticket.status === "purchase_pending_estimate" || ticket.status === "purchase_approved" || ticket.status === "partial_purchase") owner = "purchase";
    else if (ticket.status === "purchase_pending_accounting") owner = "accounting";
    else if (ticket.status === "purchase_pending_management") owner = "management";
    else if (ticket.status === "purchased" || ticket.status === "received_warehouse") owner = "warehouse";
    else if (ticket.status === "out_for_repair") owner = "external";
    if (material) {
      const active = (purchasesByTicket.get(ticket.id) ?? []).filter(i => !["rejected", "cancelled", "purchase_cancelled"].includes(i.status));
      const kinds = unique(active.map(purchaseOwner));
      if (kinds.length) owner = kinds.length === 1 ? kinds[0] : "mixed";
      if (owner === "purchase") actors = unique(active.flatMap(i => i.delegateId && users.get(i.delegateId) ? [users.get(i.delegateId)!.name] : []));
      else if (owner === "maintenance" && active.some(i => ["pending_review", "needs_item_revision"].includes(i.status))) actors = unique(ticketScopes(ticket).flatMap(s => s.managerId && users.get(s.managerId) ? [users.get(s.managerId)!.name] : []));
      else if (owner !== "maintenance") actors = [];
      // A purchase can move between organizations while the ticket remains in one status.
      // Do not label the entire ticket-stage age as the current organization's delay.
      if (active.length) since = null;
    }
    const external = externalByTicket.get(ticket.id) ?? [];
    if (external.length) {
      actionStage = unique(external.map(job => `external:${job.status}`)).join("|");
      const kinds = unique(external.map(job => {
        if (["waiting_gate_exit", "waiting_gate_entry"].includes(job.status)) return "gate";
        if (["waiting_warehouse_preparation", "waiting_warehouse_receipt", "waiting_technician_handover"].includes(job.status)) return "warehouse";
        if (job.status === "purchase_cycle") {
          const order = job.purchaseOrderId ? orders.get(job.purchaseOrderId) : null;
          if (order?.status === "pending_accounting") return "accounting";
          if (order?.status === "pending_management") return "management";
          if (["draft", "pending_review", "revision_needed"].includes(order?.status ?? "")) return "maintenance";
          if (order?.status === "pending_estimate") return "purchase";
          return "external";
        }
        return "maintenance";
      })) as WaitOwner[];
      owner = kinds.length === 1 ? kinds[0] : "mixed";
      const starts = external.map(job => ({
        waiting_warehouse_preparation: job.createdAt,
        waiting_gate_exit: job.warehousePreparedAt,
        purchase_cycle: job.gateExitApprovedAt,
        waiting_gate_entry: job.delegateReadyForReturnAt,
        waiting_warehouse_receipt: job.gateEntryApprovedAt,
        waiting_technician_handover: job.warehouseReceivedAt,
        delivered_for_reinstall: job.handoverAt,
      } as Record<string, number | null>)[job.status] ?? null);
      since = starts.every(x => x != null) ? Math.min(...starts as number[]) : null;
      if (external.some(job => job.status === "purchase_cycle" && job.purchaseOrderId)) since = null;
      actors = owner === "external" || owner === "purchase" ? unique(external.flatMap(job => job.delegateId && users.get(job.delegateId) ? [users.get(job.delegateId)!.name] : [])) : owner === "maintenance" ? unique(external.flatMap(job => ["delivered_for_reinstall", "reinstall_in_progress"].includes(job.status) && job.actualRecipientId && users.get(job.actualRecipientId) ? [users.get(job.actualRecipientId)!.name] : [])) : [];
      material = false;
    }
    if (owner === "maintenance" && !external.some(job => ["delivered_for_reinstall", "reinstall_in_progress"].includes(job.status)) && (["repaired", "verified", "ready_for_closure", "work_approved", "needs_purchase"].includes(ticket.status) || !actors.length)) {
      const ids = ticket.status === "ready_for_closure" && ticket.maintenancePath === "A" && ticket.supervisorId
        ? [ticket.supervisorId] : ticketScopes(ticket).flatMap(s => s.managerId ? [s.managerId] : []);
      actors = unique(ids.flatMap(id => users.get(id) ? [users.get(id)!.name] : []));
    }
    if (since == null && ["new", "pending_triage"].includes(ticket.status)) since = ticket.createdAt;
    return { owner, since, actors, note, material, actionStage };
  }
  const metrics = Object.fromEntries(DASHBOARD_METRICS.map(m => [m, [] as DashboardRow[]])) as Record<DashboardMetric, DashboardRow[]>;
  const managerMap = new Map<string, DashboardManager>();
  let missingClosedDates = 0, missingReceiptDates = 0;
  for (const ticket of data.tickets) {
    const scopes = ticketScopes(ticket);
    const departments = unique(scopes.map(s => s.department));
    const siteId = ticketSiteId(ticket);
    if (!scopeMatches(siteId, departments)) continue;
    const managerIds = unique(scopes.flatMap(s => s.managerId ? [s.managerId] : []));
    const wait = ticketWait(ticket);
    const endAt = FINISHED.has(ticket.status) ? ticket.closedAt : now;
    const ageHours = ticket.createdAt == null || endAt == null ? null : Math.max(0, (endAt - ticket.createdAt) / 3600000);
    const waitHours = wait.owner === "finished" || wait.since == null ? null : Math.max(0, (now - wait.since) / 3600000);
    const row: DashboardRow = {
      key: `ticket:${ticket.id}`, kind: "ticket", id: ticket.id, number: ticket.ticketNumber,
      title: ticket.title, titleAr: ticket.titleAr, titleEn: ticket.titleEn, titleUr: ticket.titleUr,
      status: ticket.status, priority: ticket.priority, siteId, siteName: (siteId ? sites.get(siteId) : null) || ticketLocation(ticket),
      departments, managerIds, managerKeys: scopes.map(s => `${s.department}:${s.managerId ?? "unassigned"}`), managerNames: managerIds.flatMap(id => users.get(id) ? [users.get(id)!.name] : []),
      waitOwner: wait.owner, actorNames: wait.actors, currentSince: wait.since, waitHours, ageHours,
      note: wait.note, actionStage: wait.actionStage, parentTicketId: ticket.parentTicketId,
      date: FINISHED.has(ticket.status) ? ticket.closedAt : ticket.createdAt, amount: null,
    };
    if (ticket.workflowModel !== "sub_ticket" && !ticket.parentTicketId && within(ticket.createdAt)) metrics.new_reports.push(row);
    if (["new", "pending_triage"].includes(ticket.status) && !FINISHED.has(ticket.status)) metrics.pending_triage.push(row);
    if (ticket.workflowModel === "department_tasks") {
      const children = childProgress.get(ticket.id);
      row.childTotal = children?.total ?? 0;
      row.childCompleted = children?.completed ?? 0;
      if (!FINISHED.has(ticket.status)) metrics.organizing_reports.push(row);
      continue;
    }
    const finished = FINISHED.has(ticket.status);
    if (finished) {
      if (ticket.closedAt == null) missingClosedDates++;
      if (within(ticket.closedAt)) metrics.completed_execution.push(row);
      if (ticket.status === "closed") metrics.awaiting_confirmation.push(row);
    } else {
      metrics.open_execution.push(row);
      if (ageHours != null && ageHours > DASHBOARD_AGE_HOURS) metrics.aged_execution.push(row);
      if (wait.material) metrics.waiting_material.push(row);
      if (ticket.priority === "critical") metrics.critical_execution.push(row);
      if (ticket.status === "under_inspection") metrics.under_inspection.push(row);
    }
    for (const scope of scopes) {
      if (filters.department !== "all" && scope.department !== filters.department) continue;
      const key = `${scope.department}:${scope.managerId ?? "unassigned"}`;
      const group = managerMap.get(key) ?? { key, managerId: scope.managerId, name: scope.managerId ? users.get(scope.managerId)?.name ?? null : null, department: scope.department, open: 0, completed: 0, waitingElsewhere: 0, agedInside: 0, unknownWait: 0 };
      if (finished) { if (within(ticket.closedAt)) group.completed++; }
      else {
        group.open++;
        if (wait.owner === "unknown" || wait.owner === "mixed") group.unknownWait++;
        else if (wait.owner !== "maintenance") group.waitingElsewhere++;
        else if (waitHours == null || scopes.length > 1) group.unknownWait++;
        else if (waitHours > DASHBOARD_AGE_HOURS) group.agedInside++;
      }
      managerMap.set(key, group);
    }
  }
  let cents = 0, missingCosts = 0;
  const seenItems = new Set<number>();
  for (const item of data.purchases) {
    if (seenItems.has(item.id)) continue;
    seenItems.add(item.id);
    const order = orders.get(item.orderId);
    if (!order) continue;
    const linkedTicket = order.ticketId ? tickets.get(order.ticketId) : null;
    const siteId = order.siteId ?? (linkedTicket ? ticketSiteId(linkedTicket) : null);
    const departments = linkedTicket ? unique(ticketScopes(linkedTicket).map(s => s.department)) : [mapDepartment(users.get(order.requestedById)?.role === "construction_procurement_manager" ? "construction" : ["maintenance_manager", "general_maintenance_manager"].includes(users.get(order.requestedById)?.role ?? "") ? "general" : null)];
    if (!scopeMatches(siteId, departments)) continue;
    const amount = moneyCents(item.actualTotalCost);
    const row: DashboardRow = {
      key: `purchase:${item.id}`, kind: "purchase", id: item.id, number: order.poNumber,
      title: item.itemName, status: item.status, siteId, siteName: (siteId ? sites.get(siteId) : null) || (linkedTicket ? ticketLocation(linkedTicket) : null),
      departments, managerIds: [], managerKeys: [], managerNames: [], waitOwner: purchaseOwner(item),
      actorNames: item.delegateId && users.get(item.delegateId) ? [users.get(item.delegateId)!.name] : [],
      currentSince: null, waitHours: null, ageHours: null, note: null, actionStage: null,
      parentTicketId: order.ticketId, date: item.receivedAt, amount: amount == null ? null : amount / 100,
      orderId: order.id, orderNumber: order.poNumber,
      quantity: RECEIVED.has(item.status) ? item.receivedQuantity ?? item.quantity : item.quantity, unit: item.unit,
    };
    if (PURCHASE_PENDING.has(item.status)) metrics.purchase_pending.push(row);
    if (item.status === "purchased") metrics.purchase_in_transit.push(row);
    if (RECEIVED.has(item.status)) {
      if (item.receivedAt == null) missingReceiptDates++;
      if (within(item.receivedAt) || filters.period === "all" && item.receivedAt == null) {
        metrics.purchase_received.push(row);
        metrics.received_value.push(row);
        if (amount == null) missingCosts++;
        else cents += amount;
      }
    }
  }
  if (!Number.isSafeInteger(cents)) throw new Error("INVALID_DASHBOARD_MONEY_TOTAL");
  for (const metric of DASHBOARD_METRICS) metrics[metric].sort((a, b) => (b.ageHours ?? b.date ?? 0) - (a.ageHours ?? a.date ?? 0) || b.id - a.id);
  return {
    filters, range, generatedAt: now, ageThresholdHours: DASHBOARD_AGE_HOURS,
    counts: Object.fromEntries(DASHBOARD_METRICS.map(m => [m, metrics[m].length])) as Record<DashboardMetric, number>,
    receivedValue: cents / 100, missingCosts, missingClosedDates, missingReceiptDates,
    managers: Array.from(managerMap.values()).filter(g => g.open || g.completed).sort((a, b) => b.agedInside - a.agedInside || b.open - a.open),
    sites: data.sites, metrics,
  };
}
export function dashboardSummary(report: ReturnType<typeof buildDashboard>) {
  const { metrics, ...summary } = report;
  return { ...summary, followupRows: metrics.aged_execution.slice(0, 10) };
}
export type DashboardManagerBucket = "all" | "waiting_elsewhere" | "aged_inside" | "unknown_wait";
export function dashboardDetails(report: ReturnType<typeof buildDashboard>, metric: DashboardMetric, page = 1, managerKey?: string, managerBucket: DashboardManagerBucket = "all") {
  const matching = report.metrics[metric].filter(row => {
    if (managerKey && !row.managerKeys.includes(managerKey)) return false;
    if (managerBucket === "waiting_elsewhere") return !["maintenance", "unknown", "mixed"].includes(row.waitOwner);
    if (managerBucket === "aged_inside") return row.waitOwner === "maintenance" && row.waitHours != null && row.waitHours > DASHBOARD_AGE_HOURS && row.managerKeys.length === 1;
    if (managerBucket === "unknown_wait") return ["unknown", "mixed"].includes(row.waitOwner) || row.waitOwner === "maintenance" && (row.waitHours == null || row.managerKeys.length > 1);
    return true;
  });
  return { generatedAt: report.generatedAt, total: matching.length, page, pageSize: 20, rows: matching.slice((page - 1) * 20, page * 20), receivedValue: report.receivedValue, missingCosts: report.missingCosts };
}
