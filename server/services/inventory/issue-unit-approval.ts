import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { eq, sql, type SQL } from "drizzle-orm";
import { auditLogs, catalogAuditLogs, inventory, inventoryLotBalances, inventoryLots } from "../../../drizzle/schema";
import { getActiveCatalogUnitCanonicalName } from "../../_core/catalog-unit-governance";
import { catalogAuditJson } from "../../_core/catalog-audit";
import { isInventoryLotsEnabled } from "../../_core/inventory-lots";
import { applyIssueUnitRequests, planIssueUnitRequests } from "./issue-unit-request-conversion";

type UnitApprovalInput = { inventoryId: number; issueUnit: string; factor: number };
type InventoryRow = Pick<typeof inventory.$inferSelect,
  "id" | "unit" | "issueUnit" | "issueUnitApprovedAt" | "quantity" | "averageCost" |
  "totalCostValue" | "minQuantity" | "conversionFactor" | "isFrozen" | "linkedItemId" | "warehouseId">;
type LotRow = {
  balanceId: number; lotId: number; lotCode: string | null; quantity: string;
  originalQuantity: string; remainingQuantity: string; issueUnit: string | null;
  issueUnitCost: string; conversionFactor: string;
};
const zero = BigInt(0);
const fourDecimalScale = BigInt(10_000);
const quantityCostToCents = BigInt(100_000);

async function read<Row>(db: { execute: (query: SQL) => Promise<unknown> }, query: SQL): Promise<Row[]> {
  const result = await db.execute(query);
  if (!Array.isArray(result) || !Array.isArray(result[0])) throw Error("تعذر قراءة بيانات تحويل الوحدة");
  return result[0];
}

function scaled(value: string | number, digits: number) {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole + fraction.padEnd(digits, "0"));
}

function roundedDivision(value: bigint, divisor: bigint) {
  return (value + divisor / BigInt(2)) / divisor;
}

function convertIssueQuantity(quantity: number | string, factor: number): number {
  const quantityMillis = scaled(quantity, 3);
  const product = quantityMillis * scaled(factor, 4);
  if (product < zero || product % fourDecimalScale !== zero || product / fourDecimalScale > BigInt(999_999_999_999)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "الكمية بعد التحويل خارج الدقة المدعومة (ثلاث منازل عشرية)" });
  }
  return Number(product / fourDecimalScale) / 1000;
}

function convertCost(cost: string, factor: number, before: string | number, after: number): string {
  const oldCost = scaled(cost, 4);
  const newCost = roundedDivision(oldCost * fourDecimalScale, scaled(factor, 4));
  const beforeCents = roundedDivision(oldCost * scaled(before, 3), quantityCostToCents);
  const afterCents = roundedDivision(newCost * scaled(after, 3), quantityCostToCents);
  if (oldCost < zero || newCost > BigInt(999_999_999_999) || beforeCents !== afterCents) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "دقة تكلفة الوحدة الحالية لا تسمح بهذا المعامل مع الحفاظ على قيمة الرصيد" });
  }
  return (Number(newCost) / 10_000).toFixed(4);
}

function combinedFactor(existing: string, factor: number) {
  const result = scaled(existing, 4) * scaled(factor, 4);
  if (result <= zero || result % fourDecimalScale !== zero || result / fourDecimalScale > BigInt(9_999_999_999)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "معامل الاستلام بعد التحويل خارج الدقة المدعومة" });
  }
  return (Number(result / fourDecimalScale) / 10_000).toFixed(4);
}

async function readInventory(tx: any, id: number, lock: boolean) {
  const lockSql = lock ? sql`FOR UPDATE` : sql``;
  const statement = sql`SELECT id,unit,issueUnit,issueUnitApprovedAt,quantity,averageCost,totalCostValue,minQuantity,
    conversionFactor,isFrozen,linkedItemId,warehouseId FROM inventory WHERE id=${id}`;
  if (lock) {
    const [identity] = await read<InventoryRow>(tx, statement);
    if (identity?.linkedItemId) await read(tx, sql`SELECT id FROM catalog_items WHERE id=${identity.linkedItemId} FOR UPDATE`);
    const [row] = await read<InventoryRow>(tx, sql`${statement} ${lockSql}`);
    if (row?.linkedItemId !== identity?.linkedItemId) throw new TRPCError({ code: "CONFLICT", message: "تغير ربط الصنف، أعد تحميل المخزون" });
    return row;
  }
  const [row] = await read<InventoryRow>(tx, statement);
  return row;
}

async function makePlan(tx: any, input: UnitApprovalInput, lock: boolean) {
  const row = await readInventory(tx, input.inventoryId, lock);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود في المخزون" });
  if (Number(row.isFrozen)) throw new TRPCError({ code: "BAD_REQUEST", message: "السجل التاريخي المجمّد لا يقبل تحويل الوحدة" });
  if (row.issueUnitApprovedAt) throw new TRPCError({ code: "CONFLICT", message: "سبق اعتماد وحدة الصرف لهذا الصنف" });

  const fromUnit = (row.issueUnit || "").trim() || (row.unit || "").trim();
  const toUnit = await getActiveCatalogUnitCanonicalName(input.issueUnit, tx);
  if (!toUnit) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر وحدة صرف فعّالة" });
  const sourceCanonical = await getActiveCatalogUnitCanonicalName(fromUnit, tx) || fromUnit;
  if (sourceCanonical === toUnit && input.factor !== 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "معامل التحويل لنفس الوحدة يجب أن يكون 1" });
  }
  const changed = fromUnit !== toUnit || input.factor !== 1;
  const after = { quantity: convertIssueQuantity(row.quantity, input.factor), unit: toUnit };
  const before = { quantity: Number(row.quantity), unit: fromUnit };
  const blockers: string[] = [];
  const lockSql = lock ? sql`FOR UPDATE` : sql``;
  const balances = await read<LotRow>(tx, sql`SELECT b.id AS balanceId,b.lotId,b.quantity,l.lotCode,
    l.originalQuantity,l.remainingQuantity,l.issueUnit,l.issueUnitCost,l.conversionFactor
    FROM inventory_lot_balances b LEFT JOIN inventory_lots l ON l.id=b.lotId
    WHERE b.inventoryId=${row.id} ORDER BY b.lotId,b.id ${lockSql}`);
  const lots = balances.filter(lot => lot.lotCode != null);
  const lotIds = lots.map(lot => Number(lot.lotId));

  if (changed) {
    if (!fromUnit && before.quantity > 0) blockers.push("وحدة الرصيد الحالي غير معروفة. راجع سجل الصنف قبل تحويله.");
    const lotQuantity = lots.reduce((total, lot) => total + scaled(lot.quantity, 3), zero);
    if ((balances.length || isInventoryLotsEnabled()) && lotQuantity !== scaled(row.quantity, 3)) {
      blockers.push(`رصيد الصنف ${before.quantity}، ومجموع أرصدة اللوتات ${Number(lotQuantity) / 1000}. راجع الفرق قبل التحويل.`);
    }
    if (lots.length !== balances.length || new Set(lotIds).size !== lotIds.length) {
      blockers.push("توجد روابط لوتات مفقودة أو مكررة لهذا الصنف.");
    }
    const otherUnits = Array.from(new Set(lots.map(lot => lot.issueUnit?.trim()).filter((unit): unit is string => !!unit && unit !== fromUnit)));
    const compatibleUnits = await Promise.all(otherUnits.map(async unit =>
      [unit, await getActiveCatalogUnitCanonicalName(unit, tx) || unit] as const));
    const lotUnits = new Map(compatibleUnits);
    const mixed = lots.find(lot => {
      const unit = lot.issueUnit?.trim();
      return !!unit && unit !== fromUnit && lotUnits.get(unit) !== sourceCanonical;
    });
    if (mixed) blockers.push(`وحدة اللوت ${mixed.lotCode} هي «${mixed.issueUnit}». راجع معامل هذا اللوت قبل التحويل.`);
    if (lotIds.length) {
      const ids = sql.join(lotIds.map(id => sql`${id}`), sql`, `);
      const otherBalances = await read(tx, sql`SELECT id FROM inventory_lot_balances
        WHERE lotId IN (${ids}) AND inventoryId<>${row.id} LIMIT 1 ${lockSql}`);
      if (otherBalances.length) blockers.push("أحد اللوتات مرتبط بسجل مخزون آخر. يلزم تسوية وحدة اللوت في السجلين معًا.");
      if (!otherBalances.length && lots.some(lot => scaled(lot.remainingQuantity, 3) !== scaled(lot.quantity, 3))) {
        blockers.push("المتبقي المسجل لأحد اللوتات لا يطابق رصيده في المخزون.");
      }
      const [supplierReturn] = await read<{ returnNumber: string }>(tx, sql`SELECT returnNumber FROM warehouse_returns
        WHERE lotId IN (${ids}) AND sourceDeliveryDocumentId IS NULL AND returnedQuantity>0 LIMIT 1 ${lockSql}`);
      if (supplierReturn) {
        blockers.push(`يوجد مرتجع مورد سابق (${supplierReturn.returnNumber}) بوحدة اللوت الحالية. لا يمكن تحويله دون التأثير على حسابات المرتجع.`);
      }
    }
    const [count] = await read<{ operationNumber: string }>(tx, sql`SELECT o.operationNumber
      FROM inventory_count_operations o
      WHERE (o.status='in_progress' AND (
        EXISTS (SELECT 1 FROM inventory_count_snapshots s WHERE s.operationId=o.id AND s.inventoryId=${row.id})
        OR EXISTS (SELECT 1 FROM inventory_count_items c WHERE c.operationId=o.id AND c.inventoryId=${row.id})
      )) OR (o.status='completed' AND EXISTS (
        SELECT 1 FROM inventory_count_items c
        WHERE c.operationId=o.id AND c.inventoryId=${row.id} AND c.diffQuantity<>0
        AND NOT EXISTS (SELECT 1 FROM inventory_settlement_items si JOIN inventory_settlements a ON a.id=si.settlementId
          WHERE a.sourceCountOperationId=o.id AND a.status='applied' AND si.inventoryId=c.inventoryId AND si.lotId<=>c.lotId)
        AND NOT EXISTS (SELECT 1 FROM inventory_settlement_drafts sd WHERE sd.sourceCountOperationId=o.id AND sd.status='no_adjustment')
      )) LIMIT 1 ${lockSql}`);
    if (count) blockers.push(`أكمل الجرد أو تسويته (${count.operationNumber}) قبل تغيير وحدة الصنف.`);
  }

  const requestPlan = changed ? await planIssueUnitRequests(tx, {
    inventoryId: row.id, catalogItemId: row.linkedItemId, warehouseId: row.warehouseId,
    fromUnit, toUnit, factor: input.factor,
  }, { lock }) : null;
  if (requestPlan) blockers.push(...requestPlan.blockers);

  const stock = changed && blockers.length === 0 ? {
    averageCost: convertCost(row.averageCost, input.factor, row.quantity, after.quantity),
    minQuantity: row.minQuantity == null ? null : convertIssueQuantity(row.minQuantity, input.factor),
    conversionFactor: combinedFactor(row.conversionFactor, input.factor),
    lots: lots.map(lot => {
      const remainingQuantity = convertIssueQuantity(lot.remainingQuantity, input.factor);
      const issueUnitCost = convertCost(lot.issueUnitCost, input.factor, lot.remainingQuantity, remainingQuantity);
      return { ...lot, remainingQuantity, issueUnitCost,
        quantity: convertIssueQuantity(lot.quantity, input.factor),
        originalQuantity: convertIssueQuantity(lot.originalQuantity, input.factor),
        conversionFactor: combinedFactor(lot.conversionFactor, input.factor) };
    }),
  } : null;
  const requestState = requestPlan?.changes.map(({ effect, oldValues }) => ({ effect, oldValues }));
  const confirmationToken = createHash("sha256").update(JSON.stringify({ row, toUnit, factor: input.factor, balances, requestState, blockers })).digest("hex");
  return { row, before, after, stock, lotIds, requestPlan, blockers, confirmationToken };
}

function previewResult(plan: Awaited<ReturnType<typeof makePlan>>) {
  return { before: plan.before, after: plan.after, requests: plan.requestPlan?.affected || [],
    blockers: plan.blockers, confirmationToken: plan.confirmationToken };
}

export async function previewIssueUnitConversion(db: any, input: UnitApprovalInput) {
  return previewResult(await makePlan(db, input, false));
}

export async function approveIssueUnitConversion(tx: any, input: UnitApprovalInput & { confirmationToken: string }, actorId: number) {
  const plan = await makePlan(tx, input, true);
  if (plan.confirmationToken !== input.confirmationToken) {
    throw new TRPCError({ code: "CONFLICT", message: "تغير الرصيد أو الطلبات منذ المعاينة. أعد المعاينة قبل الاعتماد." });
  }
  if (plan.blockers.length) throw new TRPCError({ code: "CONFLICT", message: plan.blockers[0] });

  const { row, before, after, stock, lotIds } = plan;
  const [lastMovement] = await read<{ id: number }>(tx, sql`SELECT id FROM inventory_transactions
    WHERE inventoryId=${row.id} ORDER BY id DESC LIMIT 1 FOR UPDATE`);
  if (stock || row.unit !== after.unit || row.issueUnit !== after.unit) {
    const priorUnit = sql`COALESCE(NULLIF(TRIM(l.issueUnit),''),NULLIF(TRIM(i.issueUnit),''),i.unit,'')`;
    const historicalLots = stock && lotIds.length
      ? sql`OR t.lotId IN (${sql.join(lotIds.map(id => sql`${id}`), sql`, `)})` : sql``;
    await tx.execute(sql`UPDATE inventory_transactions t JOIN inventory i ON i.id=t.inventoryId
      LEFT JOIN inventory_lots l ON l.id=t.lotId SET t.unitSnapshot=${priorUnit}
      WHERE t.unitSnapshot IS NULL AND (t.inventoryId=${row.id} ${historicalLots})`);
    for (const table of ["inventory_count_snapshots", "inventory_count_items", "inventory_settlement_items"]) {
      await tx.execute(sql`UPDATE ${sql.identifier(table)} t JOIN inventory i ON i.id=t.inventoryId
        LEFT JOIN inventory_lots l ON l.id=t.lotId SET t.unitSnapshot=${priorUnit}
        WHERE t.unitSnapshot IS NULL AND t.inventoryId=${row.id}`);
    }
    for (const lot of stock?.lots ?? []) {
      await tx.update(inventoryLots).set({ issueUnit: after.unit, issueUnitCost: lot.issueUnitCost,
        originalQuantity: lot.originalQuantity.toFixed(3), remainingQuantity: lot.remainingQuantity.toFixed(3),
        conversionFactor: lot.conversionFactor }).where(eq(inventoryLots.id, lot.lotId));
      await tx.update(inventoryLotBalances).set({ quantity: lot.quantity.toFixed(3) })
        .where(eq(inventoryLotBalances.id, lot.balanceId));
    }
  }
  if (plan.requestPlan) await applyIssueUnitRequests(tx, plan.requestPlan);
  await tx.update(inventory).set({ unit: after.unit, issueUnit: after.unit, issueUnitApprovedAt: sql`CURRENT_TIMESTAMP(3)`,
    ...(stock && { quantity: after.quantity, averageCost: stock.averageCost, minQuantity: stock.minQuantity,
      conversionFactor: stock.conversionFactor }) }).where(eq(inventory.id, row.id));
  await tx.insert(auditLogs).values({ userId: actorId, action: "approve_inventory_issue_unit", entityType: "inventory", entityId: row.id,
    oldValues: { ...before, averageCost: row.averageCost, totalCostValue: row.totalCostValue },
    newValues: { ...after, factor: input.factor, averageCost: stock?.averageCost ?? row.averageCost,
      totalCostValue: row.totalCostValue, lastMovementId: lastMovement?.id ?? 0,
      lotIds, requests: plan.requestPlan?.affected || [] } });
  return previewResult(plan);
}

export async function matchCatalogIssueUnit(tx: any, input: { inventoryId: number; expectedCatalogUnit: string | null }, actorId: number) {
  const row = await readInventory(tx, input.inventoryId, true);
  if (!row?.linkedItemId || Number(row.isFrozen)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "اختر سجل مخزون تشغيليًا مرتبطًا بالكتالوج" });
  }
  const [catalog] = await read<{ unit: string | null }>(tx, sql`SELECT unit FROM catalog_items WHERE id=${row.linkedItemId} FOR UPDATE`);
  if (!catalog) throw new TRPCError({ code: "NOT_FOUND", message: "صنف الكتالوج غير موجود" });
  const unit = await getActiveCatalogUnitCanonicalName(row.issueUnit?.trim() || row.unit, tx);
  if (!unit) throw new TRPCError({ code: "BAD_REQUEST", message: "وحدة الصرف المخزنية غير فعّالة" });
  if (catalog.unit === unit) return { catalogItemId: row.linkedItemId, unit };
  if (catalog.unit !== input.expectedCatalogUnit) {
    throw new TRPCError({ code: "CONFLICT", message: "تغيرت وحدة الكتالوج، أعد تحميل الصنف قبل التأكيد" });
  }
  await tx.execute(sql`UPDATE catalog_items SET unit=${unit} WHERE id=${row.linkedItemId}`);
  await tx.insert(catalogAuditLogs).values({ userId: actorId, action: "update", entityType: "item", entityId: row.linkedItemId,
    oldValues: catalogAuditJson({ unit: catalog.unit }), newValues: catalogAuditJson({ unit }) });
  return { catalogItemId: row.linkedItemId, unit };
}
