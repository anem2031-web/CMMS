import { sql, type SQL } from "drizzle-orm";

export type IssueUnitRequestInput = {
  inventoryId: number;
  catalogItemId: number | null;
  warehouseId: number | null;
  fromUnit: string;
  toUnit: string;
  factor: number;
};

export type IssueUnitRequestEffect = {
  kind: "ticket" | "pmv2" | "operational" | "purchase";
  id: number;
  reference: string;
  beforeQuantity: number;
  afterQuantity: number;
  fromUnit: string;
  toUnit: string;
};

type PurchaseLink = { kind: "ticket" | "pmv2" | "operational"; id: number; quantity: number; purchaseItemId: number };
type RequestWrite = { effect: IssueUnitRequestEffect; queries: SQL[]; oldValues: unknown };
export type IssueUnitRequestPlan = { affected: IssueUnitRequestEffect[]; changes: RequestWrite[]; blockers: string[] };
type Database = { execute(query: SQL): Promise<unknown> };

async function readRows<Row>(db: Database, query: SQL): Promise<Row[]> {
  const result = await db.execute(query);
  if (!Array.isArray(result) || !Array.isArray(result[0])) throw new Error("تعذر قراءة الطلبات المرتبطة");
  return result[0] as Row[];
}

const numberIds = (ids: number[]) => sql.join(ids.map(id => sql`${id}`), sql`,`);
const maxInt = 2147483647;
const maxDecimal = 999999999.999;
const zero = BigInt(0);
const factorScale = BigInt(10_000);

function decimalInteger(value: unknown, scale: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) throw new Error("قيمة الكمية أو المعامل غير صالحة");
  const fixed = numeric.toFixed(scale);
  if (Number(fixed) !== numeric) throw new Error("قيمة الكمية أو المعامل خارج الدقة المدعومة");
  return BigInt(fixed.replace(".", ""));
}

function convertQuantity(value: unknown, factor: number, scale: number, maximum: number) {
  const product = decimalInteger(value, 3) * decimalInteger(factor, 4);
  const divisor = factorScale * BigInt(10 ** (3 - scale));
  if (product % divisor !== zero || product / divisor > decimalInteger(maximum, scale))
    throw new Error("الكمية الناتجة لا تتوافق مع دقة الكمية في مسار الطلب");
  return Number(product / divisor) / 10 ** scale;
}

export function convertOpenIssueQuantity(total: unknown, fulfilled: unknown, factor: number, wholeUnits: boolean) {
  const remaining = decimalInteger(total, 3) - decimalInteger(fulfilled, 3);
  if (remaining < zero) throw new Error("كمية الطلب المتبقية غير متسقة");
  const before = Number(remaining) / 1000;
  const scale = wholeUnits ? 0 : 3;
  const maximum = wholeUnits ? maxInt : maxDecimal;
  const convertedFulfilled = convertQuantity(fulfilled, factor, scale, maximum);
  const after = convertQuantity(before, factor, scale, maximum);
  const convertedTotal = convertQuantity(total, factor, scale, maximum);
  return { before, after, convertedTotal, convertedFulfilled };
}

function convertPrice(cost: string | null, factor: number) {
  if (cost == null) return null;
  const product = decimalInteger(cost, 2) * factorScale;
  const divisor = decimalInteger(factor, 4);
  if (divisor === zero || product % divisor !== zero || product / divisor > BigInt(999_999_999_999))
    throw new Error("سعر وحدة الشراء الناتج يحتاج دقة أعلى من المتاحة في البند");
  return (Number(product / divisor) / 100).toFixed(2);
}

function noteObject(note: string): Record<string, unknown> {
  const value: unknown = JSON.parse(note);
  if (typeof value !== "object" || value == null || Array.isArray(value))
    throw new Error("تعذر التحقق من بيانات مسار الاحتياج");
  return value as Record<string, unknown>;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "تعذر التحقق من تحويل الاحتياج";
}

type Stock = { id: number; warehouseId: number | null; warehouseType: string | null; unit: string; quantity: string };
type TicketNeed = { id: number; assignmentId: number; warehouseId: number; materialRound: number; originalItemName: string;
  reference: string; requestedQuantity: number; usedQuantity: number | null };
type TicketDelivery = { id: number; needId: number; inventoryId: number; issuedQuantity: number; returnedQuantity: number; unit: string | null };
type TicketSupply = { id: number; needId: number; sourceKind: string; sourceId: number; linkedQuantity: number; status: string };
type TicketAction = { id: number; assignmentId: number; note: string };
type Pmv2Route = { id: number; note: string; taskItemId: number; reference: string; warehouseId: number };
type Pmv2Request = { id: number; status: string; requestedQuantity: string; receivedWarehouseQuantity: string; issuedToTeamQuantity: string };
type Pmv2Link = { id: number; materialRequestItemId: number; purchaseOrderItemId: number; linkedQuantity: string };
type Pmv2Movement = { id: number; taskItemId: number; action: string; note: string };
type OperationalNeed = { id: number; orderId: number; reference: string; quantity: string; issued: string; dispatchContext?: string | Record<string, unknown> | null };
type OperationalLink = { orderItemId: number; purchaseOrderItemId: number; quantity: number; unit: string };
type PurchaseLine = {
  id: number; reference: string; quantity: number; unit: string | null; status: string; batchId: number | null;
  orderStatus: string; receivedAt: string | null; accountingApprovedAt: string | null; managementApprovedAt: string | null;
  receivedQuantity: number | null; deliveredQuantity: number | null; returnedQuantity: number | null;
  estimatedUnitCost: string | null; actualUnitCost: string | null; catalogItemId: number | null;
  hasOtherInventoryReceipt: number; hasSupplierReturn: number; hasPricingBundle: number;
};

export async function planIssueUnitRequests(
  db: Database,
  input: IssueUnitRequestInput,
  { lock = false }: { lock?: boolean } = {}
): Promise<IssueUnitRequestPlan> {
  const { inventoryId, catalogItemId, warehouseId, fromUnit, toUnit, factor } = input;
  const plan: IssueUnitRequestPlan = { affected: [], changes: [], blockers: [] };
  if (!fromUnit || (fromUnit === toUnit && factor === 1)) return plan;
  const locking = lock ? sql` FOR UPDATE` : sql``;
  const record = (kind: IssueUnitRequestEffect["kind"], id: number, reference: string, beforeQuantity: number, afterQuantity: number, queries: SQL[], oldValues: unknown) => {
    const effect = { kind, id, reference, beforeQuantity, afterQuantity, fromUnit, toUnit };
    plan.affected.push(effect);
    plan.changes.push({ effect, queries, oldValues });
  };
  const links: PurchaseLink[] = [];
  const poIds = new Set<number>();
  if (catalogItemId != null) {
    const stock = await readRows<Stock>(db, sql`SELECT i.id,w.id AS warehouseId,w.type AS warehouseType,i.quantity,
      COALESCE(NULLIF(TRIM(i.issueUnit),''),TRIM(i.unit)) AS unit
      FROM inventory i LEFT JOIN warehouses w ON (w.id=i.warehouseId OR (i.warehouseId IS NULL AND w.id=(SELECT MIN(m.id) FROM warehouses m WHERE m.type='main' AND m.isActive=1)))
      WHERE i.linkedItemId=${catalogItemId} AND COALESCE(i.isFrozen,0)=0 ORDER BY i.id${locking}`);
    const source = stock.find(row => Number(row.id) === inventoryId);
    const effectiveWarehouseId = source?.warehouseId ?? warehouseId;
    const isMain = source?.warehouseType === "main";
    const scopedTo = (target: number, demand: number) => target === effectiveWarehouseId || (isMain &&
      stock.filter(row => Number(row.warehouseId) === target && row.unit === fromUnit)
        .reduce((sum, row) => sum + Number(row.quantity), 0) < demand);
    const scopeConflict = (target: number, includeMain = isMain) => stock.some(row => Number(row.id) !== inventoryId &&
      (row.unit === toUnit || (Number(row.quantity) > 0 && row.unit === fromUnit)) &&
      (Number(row.warehouseId) === target || (includeMain && row.warehouseType === "main")));
    const tickets = (await readRows<TicketNeed>(db, sql`SELECT n.id,n.assignmentId,n.warehouseId,n.materialRound,n.originalItemName,
      a.ticketNumber AS reference,n.requestedQuantity,n.usedQuantity
      FROM ticket_team_material_needs n JOIN ticket_team_assignments a ON a.id=n.assignmentId
      JOIN tickets t ON t.id=a.ticketId
      WHERE n.catalogItemId=${catalogItemId} AND TRIM(n.unitSnapshot)=${fromUnit} AND n.materialRound=a.materialRound
        AND a.stage='waiting_material' AND t.status NOT IN ('closed','requester_confirmed')
      ORDER BY n.id${locking}`)).filter(row => scopedTo(Number(row.warehouseId), Number(row.requestedQuantity)));
    if (tickets.length) {
      const supplies = await readRows<TicketSupply>(db, sql`SELECT id,needId,sourceKind,sourceId,linkedQuantity,status
        FROM ticket_team_supply_links WHERE needId IN (${numberIds(tickets.map(row => row.id))}) AND status<>'cancelled' ORDER BY id${locking}`);
      const actions = await readRows<TicketAction>(db, sql`SELECT id,assignmentId,note FROM ticket_team_actions
        WHERE assignmentId IN (${numberIds(Array.from(new Set(tickets.map(row => row.assignmentId))))})
          AND kind IN ('needs_material','material_resolved') ORDER BY revision DESC${locking}`);
      const deliveries = await readRows<TicketDelivery>(db, sql`SELECT d.id,d.needId,m.inventoryId,d.issuedQuantity,d.returnedQuantity,doc.unit
        FROM ticket_team_delivery_links d JOIN inventory_transactions m ON m.id=d.inventoryTransactionId
        JOIN delivery_documents doc ON doc.id=d.deliveryDocumentId
        WHERE d.needId IN (${numberIds(tickets.map(row => row.id))}) ORDER BY d.id${locking}`);
      const changedAssignments = new Set<number>();
      for (const row of tickets) {
        try {
          if (scopeConflict(Number(row.warehouseId))) throw new Error("يوجد سجل مخزون آخر للوحدة الحالية أو المختارة في نطاق الطلب");
          if (row.usedQuantity != null) throw new Error("يوجد إقرار استخدام مرتبط بالاحتياج يحتاج تسوية بوحدته الأصلية");
          const sources = supplies.filter(link => link.needId === row.id);
          if (sources.some(link => link.sourceKind === "transfer")) throw new Error("يوجد تحويل مخزني موثق لهذا الاحتياج");
          if (!isMain && sources.some(link => link.sourceKind === "purchase")) throw new Error("الشراء المرتبط يغذي المستودع الرئيسي");
          const previous = deliveries.filter(delivery => delivery.needId === row.id);
          if (previous.some(delivery => delivery.inventoryId !== inventoryId || delivery.unit?.trim() !== fromUnit))
            throw new Error("الصرف السابق لا يتبع هذا الرصيد بوحدته الأصلية");
          const priorIssued = previous.reduce((sum, delivery) => sum + Number(delivery.issuedQuantity), 0);
          const priorReturned = previous.reduce((sum, delivery) => sum + Number(delivery.returnedQuantity), 0);
          const next = convertOpenIssueQuantity(row.requestedQuantity, priorIssued, factor, true);
          if (next.before === 0) continue;
          convertQuantity(priorReturned, factor, 0, maxInt);
          for (const delivery of previous) {
            convertQuantity(delivery.issuedQuantity, factor, 0, maxInt);
            convertQuantity(delivery.returnedQuantity, factor, 0, maxInt);
          }
          const route = actions.flatMap(action => {
            if (action.assignmentId !== row.assignmentId) return [];
            let note: Record<string, unknown>;
            try { note = noteObject(action.note); } catch { return []; }
            if (note.type !== "ticket_material_need" || Number(note.round) !== row.materialRound ||
              note.originalName !== row.originalItemName || (note.catalogItemId != null && Number(note.catalogItemId) !== catalogItemId)) return [];
            return [{ ...action, parsed: note }];
          })[0];
          if (!route) throw new Error("مسار توفير الاحتياج غير موثق");
          const nextShortage = convertQuantity(route.parsed.shortage, factor, 0, maxInt);
          const requestLinks = sources.map(link => ({ kind: "ticket" as const, id: link.id,
            quantity: convertQuantity(link.linkedQuantity, factor, 0, maxInt), purchaseItemId: link.sourceId }));
          const queries = [
            sql`UPDATE ticket_team_material_needs SET requestedQuantity=${next.convertedTotal},unitSnapshot=${toUnit} WHERE id=${row.id}`,
            sql`UPDATE ticket_team_actions SET note=${JSON.stringify({ ...route.parsed, shortage: nextShortage,
              approvedStockUnit: { needId: row.id, unit: toUnit, fromUnit, factor, priorIssued, priorReturned,
                deliveryIds: previous.map(delivery => delivery.id) } })} WHERE id=${route.id}`,
          ];
          if (!changedAssignments.has(row.assignmentId)) {
            queries.push(sql`UPDATE ticket_team_assignments SET revision=revision+1 WHERE id=${row.assignmentId}`);
            changedAssignments.add(row.assignmentId);
          }
          record("ticket", row.id, row.reference, next.before, next.after, queries, { row, route: route.note, sources, previous });
          links.push(...requestLinks);
        } catch (error) { plan.blockers.push(`${row.reference}: ${message(error)}`); }
      }
    }

    const routeRows = await readRows<Pmv2Route>(db, sql`SELECT a.id,a.note,a.taskItemId,t.taskNumber AS reference,team.warehouseId
      FROM pmv2_item_actions a JOIN pmv2_task_items i ON i.id=a.taskItemId JOIN pmv2_tasks t ON t.id=i.taskId
      JOIN pmv2_teams team ON team.id=t.teamId
      WHERE a.action='material_route_decision' AND i.status='waiting_material' AND i.result='needs_material' AND t.status<>'cancelled'
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(a.note),a.note,'{}'),'$.catalogItemId')) AS UNSIGNED)=${catalogItemId}
      ORDER BY a.id DESC${locking}`);
    const sameTeamRoutes = routeRows.map(row => ({ ...row, parsed: noteObject(row.note) }))
      .filter(row => Number(row.parsed.teamWarehouseId) === Number(row.warehouseId));
    const pmv2Routes = Array.from(new Map(sameTeamRoutes.slice().reverse().map(row => [row.taskItemId, row])).values())
      .filter(row => String(row.parsed.unit).trim() === fromUnit &&
        (Number(row.parsed.inventoryId) === inventoryId ||
          (row.parsed.route === "material_request" && scopedTo(Number(row.warehouseId), Number(row.parsed.requestedQuantity)))));
    if (pmv2Routes.length) {
      const requestIds = Array.from(new Set(pmv2Routes.map(row => Number(row.parsed.materialRequestItemId || 0)).filter(Boolean)));
      const requests = requestIds.length ? await readRows<Pmv2Request>(db, sql`SELECT id,status,requestedQuantity,receivedWarehouseQuantity,issuedToTeamQuantity
        FROM pmv2_material_request_items WHERE id IN (${numberIds(requestIds)}) ORDER BY id${locking}`) : [];
      const purchaseLinks = requestIds.length ? await readRows<Pmv2Link>(db, sql`SELECT id,materialRequestItemId,purchaseOrderItemId,linkedQuantity
        FROM pmv2_material_purchase_links WHERE materialRequestItemId IN (${numberIds(requestIds)}) ORDER BY id${locking}`) : [];
      const movements = await readRows<Pmv2Movement>(db, sql`SELECT id,taskItemId,action,note FROM pmv2_item_actions
        WHERE taskItemId IN (${numberIds(pmv2Routes.map(row => row.taskItemId))}) AND action IN
        ('material_transfer_linked','material_issue_linked','material_issue_link_pending','material_consumption_declared','material_consumption_finalized','material_return_part_linked','material_return_completed')
        ORDER BY id${locking}`);
      for (const row of pmv2Routes) {
        try {
          const requestId = Number(row.parsed.materialRequestItemId || 0);
          const request = requests.find(item => item.id === requestId);
          if (request && ["cancelled", "consumed"].includes(request.status)) continue;
          if (requestId && !request) throw new Error("بند طلب المواد المرتبط غير موجود");
          if (request && (!isMain || warehouseId == null))
            throw new Error("الاحتياج بانتظار توفير من المستودع الرئيسي؛ يعتمد تحويل وحدته على سجل المصدر المرتبط بالمستودع");
          if (scopeConflict(Number(row.warehouseId))) throw new Error("يوجد سجل مخزون آخر للوحدة الحالية أو المختارة في نطاق الطلب");
          const previous = movements.filter(item => item.taskItemId === row.taskItemId).flatMap(item => {
            const note = noteObject(item.note);
            const matches = Number(note.routeDecisionActionId) === row.id ||
              (requestId > 0 && Number(note.materialRequestItemId) === requestId) ||
              (note.routeDecisionActionId == null && note.materialRequestItemId == null);
            return matches ? [{ ...item, parsed: note }] : [];
          });
          if (previous.some(item => item.action !== "material_issue_linked" ||
            Number(item.parsed.inventoryId) !== inventoryId || String(item.parsed.unit).trim() !== fromUnit ||
            item.parsed.originalQuantity != null || item.parsed.replacementPlanId != null))
            throw new Error("يوجد تحويل أو تسوية استخدام أو صرف من رصيد آخر لهذا الاحتياج");
          if (Number(request?.issuedToTeamQuantity || 0) > 0)
            throw new Error("يوجد توريد سابق من مستودع آخر لهذا الاحتياج");
          const priorIssued = previous.reduce((sum, item) => sum + Number(item.parsed.quantity), 0);
          const next = convertOpenIssueQuantity(row.parsed.requestedQuantity, priorIssued, factor, false);
          if (next.before === 0) continue;
          const nextNote = { ...row.parsed, requestedQuantity: next.convertedTotal, unit: toUnit,
            shortageQuantity: convertQuantity(row.parsed.shortageQuantity, factor, 3, maxDecimal),
            availableQuantity: row.parsed.availableQuantity == null ? null : convertQuantity(row.parsed.availableQuantity, factor, 3, maxDecimal),
            ...(request ? { approvedStockUnit: { inventoryId, warehouseId: effectiveWarehouseId, unit: toUnit } } : {}),
          };
          const sources = purchaseLinks.filter(link => link.materialRequestItemId === requestId);
          const requestLinks = sources.map(link => ({ kind: "pmv2" as const, id: link.id,
            quantity: convertQuantity(link.linkedQuantity, factor, 3, maxDecimal), purchaseItemId: link.purchaseOrderItemId }));
          const queries = [sql`UPDATE pmv2_item_actions SET note=${JSON.stringify(nextNote)} WHERE id=${row.id}`];
          for (const item of previous) {
            const approvedCoverage = {
              ...item.parsed,
              originalQuantity: convertQuantity(item.parsed.quantity, factor, 3, maxDecimal),
              generalStockQuantity: convertQuantity(item.parsed.generalStockQuantity, factor, 3, maxDecimal),
              materialRequestQuantity: convertQuantity(item.parsed.materialRequestQuantity, factor, 3, maxDecimal),
            };
            queries.push(sql`UPDATE pmv2_item_actions SET note=${JSON.stringify(approvedCoverage)} WHERE id=${item.id}`);
          }
          if (request) {
            const pending = convertOpenIssueQuantity(request.requestedQuantity, request.receivedWarehouseQuantity, factor, false);
            queries.push(sql`UPDATE pmv2_material_request_items SET requestedQuantity=${pending.convertedTotal},
              receivedWarehouseQuantity=${pending.convertedFulfilled},unitSnapshot=${toUnit} WHERE id=${request.id}`);
          }
          record("pmv2", requestId || row.id, row.reference, next.before, next.after, queries,
            { request, route: row.note, sources, previous: previous.map(item => ({ id: item.id, note: item.note })) });
          links.push(...requestLinks);
        } catch (error) { plan.blockers.push(`${row.reference}: ${message(error)}`); }
      }
    }

    const operationalSchema = await readRows<{ TABLE_NAME: string; COLUMN_NAME: string }>(db, sql`SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='operational_issue_items' AND COLUMN_NAME IN ('id','dispatchContext'))
        OR (TABLE_NAME='operational_issue_purchase_links' AND COLUMN_NAME='orderItemId'))`);
    if (operationalSchema.some(row => row.TABLE_NAME === "operational_issue_items")) {
      const contextColumn = operationalSchema.some(row => row.COLUMN_NAME === "dispatchContext") ? sql`,i.dispatchContext` : sql``;
      const operational = await readRows<OperationalNeed>(db, sql`SELECT i.id,i.orderId,o.orderNumber AS reference,i.quantity${contextColumn},
        COALESCE((SELECT SUM(d.quantity) FROM operational_issue_deliveries d WHERE d.orderItemId=i.id),0) AS issued
        FROM operational_issue_items i JOIN operational_issue_orders o ON o.id=i.orderId
        WHERE i.catalogItemId=${catalogItemId} AND TRIM(i.unit)=${fromUnit} AND o.status IN ('pending','approved')
        ORDER BY i.id${locking}`);
      const purchaseLinks = operational.length && operationalSchema.some(row => row.TABLE_NAME === "operational_issue_purchase_links")
        ? await readRows<OperationalLink>(db, sql`SELECT orderItemId,purchaseOrderItemId,quantity,unit FROM operational_issue_purchase_links
            WHERE orderItemId IN (${numberIds(operational.map(row => row.id))}) ORDER BY orderItemId${locking}`) : [];
      const changedOrders = new Set<number>();
      for (const row of operational) {
        try {
          if (Number(row.issued) >= Number(row.quantity)) continue;
          const context = typeof row.dispatchContext === "string" ? noteObject(row.dispatchContext) : row.dispatchContext;
          if (context && Number(context.warehouseId) !== effectiveWarehouseId) continue;
          if (!context) {
            if (Number(source?.quantity ?? 0) > 0) throw new Error("طلب صرف قديم بلا مخزن محدد يعتمد على الوحدة الحالية");
            continue;
          }
          if (scopeConflict(Number(context.warehouseId), false)) throw new Error("يوجد سجل مخزون آخر للوحدة الحالية أو المختارة في نطاق الطلب");
          if (Number(row.issued)) throw new Error("يوجد صرف سابق موثق لهذا الاحتياج");
          const next = convertOpenIssueQuantity(row.quantity, 0, factor, true);
          const link = purchaseLinks.find(item => item.orderItemId === row.id);
          if (link && link.unit.trim() !== fromUnit) throw new Error("وحدة رابط الشراء تختلف عن وحدة الطلب");
          const requestLink = link ? { kind: "operational" as const, id: link.orderItemId,
            quantity: convertQuantity(link.quantity, factor, 0, maxInt), purchaseItemId: link.purchaseOrderItemId } : null;
          const queries = [sql`UPDATE operational_issue_items SET quantity=${next.convertedTotal},unit=${toUnit} WHERE id=${row.id}`];
          if (!changedOrders.has(row.orderId)) {
            queries.push(sql`UPDATE operational_issue_orders SET revision=revision+1 WHERE id=${row.orderId}`);
            changedOrders.add(row.orderId);
          }
          record("operational", row.id, row.reference || `#${row.orderId}`, next.before, next.after, queries, { row, link });
          if (requestLink) links.push(requestLink);
        } catch (error) { plan.blockers.push(`${row.reference || `#${row.orderId}`}: ${message(error)}`); }
      }
    }
  }

  const receiptSources = await readRows<{ purchaseOrderItemId: number }>(db, sql`SELECT DISTINCT purchaseOrderItemId
    FROM warehouse_receipt_items WHERE inventoryId=${inventoryId} AND purchaseOrderItemId IS NOT NULL
    UNION SELECT purchaseOrderItemId FROM inventory_transactions WHERE inventoryId=${inventoryId}
      AND purchaseOrderItemId IS NOT NULL AND type='in' AND transactionType='purchase' ORDER BY purchaseOrderItemId`);
  const receivedHere = new Set(receiptSources.map(source => Number(source.purchaseOrderItemId)));
  for (const source of receiptSources) poIds.add(source.purchaseOrderItemId);
  for (const link of links) poIds.add(link.purchaseItemId);
  if (poIds.size) {
    const purchases = await readRows<PurchaseLine>(db, sql`SELECT i.id,p.poNumber AS reference,i.quantity,i.unit,i.status,i.batchId,
      p.status AS orderStatus,p.accountingApprovedAt,p.managementApprovedAt,i.receivedAt,
      i.receivedQuantity,i.deliveredQuantity,i.returnedQuantity,i.estimatedUnitCost,i.actualUnitCost,i.catalogItemId,
      (EXISTS(SELECT 1 FROM warehouse_receipt_items r WHERE r.purchaseOrderItemId=i.id AND r.inventoryId<>${inventoryId}) OR
        EXISTS(SELECT 1 FROM inventory_transactions x WHERE x.purchaseOrderItemId=i.id AND x.inventoryId<>${inventoryId}
          AND x.type='in' AND x.transactionType='purchase')) AS hasOtherInventoryReceipt,
      EXISTS(SELECT 1 FROM supplier_return_cases c WHERE c.purchaseOrderItemId=i.id) AS hasSupplierReturn,
      EXISTS(SELECT 1 FROM delegate_pricing_bundle_items b WHERE b.purchaseOrderItemId=i.id AND b.removedAt IS NULL) AS hasPricingBundle
      FROM purchase_order_items i JOIN purchase_orders p ON p.id=i.purchaseOrderId
      WHERE i.id IN (${numberIds(Array.from(poIds))}) ORDER BY i.id${locking}`);
    for (const id of Array.from(poIds).sort((a, b) => a - b)) {
      const row = purchases.find(line => line.id === id);
      const sources = links.filter(link => link.purchaseItemId === id);
      if (!row) {
        if (sources.length) plan.blockers.push(`بند الشراء #${id}: لم يعد الرابط يشير إلى بند موجود`);
        continue;
      }
      if (["rejected", "cancelled", "purchase_cancelled"].includes(row.status) || row.orderStatus === "rejected") continue;
      try {
        const sameCatalog = catalogItemId === row.catalogItemId || (row.catalogItemId == null && sources.length === 0 && receivedHere.has(id));
        if (String(row.unit ?? "").trim() !== fromUnit || !sameCatalog) {
          if (sources.length) throw new Error("وحدة بند الشراء المرتبط أو هوية صنفه لا تطابق الاحتياج");
          continue;
        }
        const received = row.receivedQuantity ?? 0;
        const next = convertOpenIssueQuantity(row.quantity, received, factor, true);
        const archived = next.before === 0 || ["closed", "received"].includes(row.orderStatus) || row.status === "delivered_to_requester";
        if (archived && !sources.length) continue;
        if (Number(row.hasOtherInventoryReceipt)) throw new Error("بند الشراء له استلامات مرتبطة برصيد مخزون آخر");
        if (Number(row.hasSupplierReturn) || Number(row.deliveredQuantity || 0) > 0 || Number(row.returnedQuantity || 0) > 0)
          throw new Error("الشراء مرتبط بتسليم أو مرتجع سابق يحتاج تسوية بوحدته الأصلية");
        const queries: SQL[] = [];
        if (archived) {
          // Preserve already-issued purchase and finance documents. Only the
          // ticket's operational coverage uses the converted stock quantity.
          if (next.before !== 0 || !row.receivedAt || !receivedHere.has(id) || sources.some(link => link.kind !== "ticket"))
            throw new Error("الشراء المستلم مرتبط بمسار تغطية يتطلب وحدة البند الأصلية");
        } else {
          if (row.batchId != null || Number(row.hasPricingBundle) || row.accountingApprovedAt != null || row.managementApprovedAt != null)
            throw new Error("الطلب مرتبط بمستند تسعير أو اعتماد يعتمد على وحدة البند الأصلية");
          const estimatedUnitCost = convertPrice(row.estimatedUnitCost, factor);
          const actualUnitCost = convertPrice(row.actualUnitCost, factor);
          queries.push(sql`UPDATE purchase_order_items SET quantity=${next.convertedTotal},unit=${toUnit},
            receivedQuantity=${row.receivedQuantity == null ? null : next.convertedFulfilled},
            estimatedUnitCost=${estimatedUnitCost},actualUnitCost=${actualUnitCost} WHERE id=${row.id}`);
        }
        for (const source of sources) {
          if (source.kind === "ticket") queries.push(sql`UPDATE ticket_team_supply_links SET linkedQuantity=${source.quantity} WHERE id=${source.id}`);
          if (source.kind === "pmv2") queries.push(sql`UPDATE pmv2_material_purchase_links SET linkedQuantity=${source.quantity} WHERE id=${source.id}`);
          if (source.kind === "operational") queries.push(sql`UPDATE operational_issue_purchase_links SET quantity=${source.quantity},unit=${toUnit} WHERE orderItemId=${source.id}`);
        }
        record("purchase", row.id, row.reference, next.before, next.after, queries, row);
      } catch (error) { plan.blockers.push(`${row.reference}: ${message(error)}`); }
    }
  }
  return plan;
}

export async function applyIssueUnitRequests(db: Database, plan: IssueUnitRequestPlan) {
  if (plan.blockers.length) throw new Error(plan.blockers[0]);
  for (const change of plan.changes)
    for (const query of change.queries)
      await db.execute(query);
}
