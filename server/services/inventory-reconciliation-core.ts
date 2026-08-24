export type InventoryReconciliationCode =
  | "INVENTORY_LOT_QUANTITY_MISMATCH"
  | "LOT_GLOBAL_BALANCE_MISMATCH"
  | "NEGATIVE_INVENTORY_QUANTITY"
  | "NEGATIVE_LOT_BALANCE"
  | "NEGATIVE_LOT_REMAINING"
  | "INVENTORY_VALUE_MISMATCH"
  | "ORPHAN_INVENTORY_REFERENCE"
  | "ORPHAN_LOT_REFERENCE"
  | "INVENTORY_WITHOUT_WAREHOUSE"
  | "ORPHAN_WAREHOUSE_REFERENCE"
  | "DUPLICATE_LOT_WITHIN_WAREHOUSE";

export type InventoryReconciliationEntityType = "inventory" | "lot" | "lot_balance" | "warehouse_lot";

export interface InventoryReconciliationException {
  code: InventoryReconciliationCode;
  entityType: InventoryReconciliationEntityType;
  inventoryId: number | null;
  lotId: number | null;
  warehouseId: number | null;
  itemName: string | null;
  lotCode: string | null;
  currentValue: number | null;
  expectedValue: number | null;
  difference: number | null;
  tolerance: number | null;
  message: string;
}

export interface InventoryReconciliationInventoryRow {
  id: number;
  itemName: string;
  warehouseId: number | null;
  quantity: string | number;
  averageCost: string | number;
  totalCostValue: string | number;
}

export interface InventoryReconciliationLotRow {
  id: number;
  lotCode: string;
  remainingQuantity: string | number;
}

export interface InventoryReconciliationLotBalanceRow {
  id: number;
  lotId: number;
  inventoryId: number;
  quantity: string | number;
}

export interface InventoryReconciliationWarehouseRow {
  id: number;
}

export interface InventoryReconciliationInputRows {
  inventoryRows: InventoryReconciliationInventoryRow[];
  lotRows: InventoryReconciliationLotRow[];
  lotBalanceRows: InventoryReconciliationLotBalanceRow[];
  warehouseRows: InventoryReconciliationWarehouseRow[];
  lotsEnabled: boolean;
}

export interface InventoryReconciliationConfig {
  quantityScale: number;
  averageCostScale: number;
  valueScale: number;
}

export interface InventoryReconciliationResult {
  generatedAt: string;
  readOnly: true;
  scope: {
    lotsEnabled: boolean;
    historicalReconstructionIncluded: false;
    autoFixIncluded: false;
    inventoryRows: number;
    trackedInventoryRows: number;
    inventoryRowsOutsideLotTrackedScope: number;
    lotRows: number;
    lotBalanceRows: number;
  };
  rules: {
    quantityScale: number;
    averageCostScale: number;
    valueScale: number;
    quantityTolerance: number;
    valueTolerancePolicy: string;
  };
  summary: {
    checksPerformed: number;
    passedChecks: number;
    exceptionChecks: number;
    exceptionsByCode: Partial<Record<InventoryReconciliationCode, number>>;
  };
  exceptions: InventoryReconciliationException[];
}

const EPSILON = 0.000001;

function asNumber(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundTo(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function quantityTolerance(scale: number): number {
  return 0.5 * 10 ** -scale;
}

/**
 * Max expected value drift caused only by storing averageCost at its configured scale.
 * For zero quantity, stored inventory value must be 0.00 exactly at value scale.
 */
export function calculateInventoryValueTolerance(
  quantity: number,
  config: InventoryReconciliationConfig,
): number {
  const normalizedQuantity = roundTo(Math.abs(quantity), config.quantityScale);
  if (normalizedQuantity === 0) return 0;
  const halfAverageCostUnit = 0.5 * 10 ** -config.averageCostScale;
  const rawTolerance = normalizedQuantity * halfAverageCostUnit;
  const valueFactor = 10 ** config.valueScale;
  const minimumStoredUnit = 1 / valueFactor;
  return Math.max(minimumStoredUnit, Math.ceil(rawTolerance * valueFactor) / valueFactor);
}

function incrementCounter(
  counter: Partial<Record<InventoryReconciliationCode, number>>,
  code: InventoryReconciliationCode,
) {
  counter[code] = (counter[code] || 0) + 1;
}

/**
 * Main 5.4.2 pure evaluator.
 *
 * This function is intentionally persistence-free. Historical transaction
 * reconstruction is out of scope. Inventory quantity/value checks are limited
 * to Inventory rows that actually participate in inventory_lot_balances so
 * legacy/non-Lot experimental rows do not become future-facing failures.
 */
export function evaluateInventoryReconciliation(
  input: InventoryReconciliationInputRows,
  config: InventoryReconciliationConfig,
): InventoryReconciliationResult {
  const qtyTolerance = quantityTolerance(config.quantityScale);
  const inventoryById = new Map(input.inventoryRows.map((row) => [Number(row.id), row]));
  const lotById = new Map(input.lotRows.map((row) => [Number(row.id), row]));
  const warehouseIds = new Set(input.warehouseRows.map((row) => Number(row.id)));

  const balancesByInventory = new Map<number, InventoryReconciliationLotBalanceRow[]>();
  const balancesByLot = new Map<number, InventoryReconciliationLotBalanceRow[]>();
  for (const balance of input.lotBalanceRows) {
    const inventoryId = Number(balance.inventoryId);
    const lotId = Number(balance.lotId);
    const inventoryGroup = balancesByInventory.get(inventoryId) || [];
    inventoryGroup.push(balance);
    balancesByInventory.set(inventoryId, inventoryGroup);
    const lotGroup = balancesByLot.get(lotId) || [];
    lotGroup.push(balance);
    balancesByLot.set(lotId, lotGroup);
  }

  const trackedInventoryIds = new Set<number>(
    input.lotBalanceRows
      .map((row) => Number(row.inventoryId))
      .filter((inventoryId) => inventoryById.has(inventoryId)),
  );

  const exceptions: InventoryReconciliationException[] = [];
  const exceptionsByCode: Partial<Record<InventoryReconciliationCode, number>> = {};
  let checksPerformed = 0;

  const pushException = (exception: InventoryReconciliationException) => {
    exceptions.push(exception);
    incrementCounter(exceptionsByCode, exception.code);
  };
  const hasQuantityMismatch = (actual: number, expected: number) => Math.abs(actual - expected) > qtyTolerance;
  const hasValueMismatch = (actual: number, expected: number, tolerance: number) =>
    Math.abs(actual - expected) > tolerance + EPSILON;

  // Rule 5 — every Lot Balance must resolve to Inventory + Lot + Warehouse.
  for (const balance of input.lotBalanceRows) {
    const inventoryId = Number(balance.inventoryId);
    const lotId = Number(balance.lotId);
    const inv = inventoryById.get(inventoryId);
    const lot = lotById.get(lotId);

    checksPerformed += 2;
    if (!inv) {
      pushException({
        code: "ORPHAN_INVENTORY_REFERENCE", entityType: "lot_balance", inventoryId, lotId,
        warehouseId: null, itemName: null, lotCode: lot?.lotCode || null,
        currentValue: null, expectedValue: null, difference: null, tolerance: null,
        message: `رصيد الدفعة ${balance.id} يشير إلى Inventory غير موجود (${inventoryId})`,
      });
    }
    if (!lot) {
      pushException({
        code: "ORPHAN_LOT_REFERENCE", entityType: "lot_balance", inventoryId, lotId,
        warehouseId: inv?.warehouseId == null ? null : Number(inv.warehouseId),
        itemName: inv?.itemName || null, lotCode: null,
        currentValue: null, expectedValue: null, difference: null, tolerance: null,
        message: `رصيد الدفعة ${balance.id} يشير إلى Lot غير موجود (${lotId})`,
      });
    }

    if (inv) {
      checksPerformed += 1;
      if (inv.warehouseId == null) {
        pushException({
          code: "INVENTORY_WITHOUT_WAREHOUSE", entityType: "lot_balance", inventoryId, lotId,
          warehouseId: null, itemName: inv.itemName, lotCode: lot?.lotCode || null,
          currentValue: null, expectedValue: null, difference: null, tolerance: null,
          message: `Inventory ${inventoryId} المرتبط بالدفعة لا يحمل warehouseId`,
        });
      } else {
        checksPerformed += 1;
        if (!warehouseIds.has(Number(inv.warehouseId))) {
          pushException({
            code: "ORPHAN_WAREHOUSE_REFERENCE", entityType: "lot_balance", inventoryId, lotId,
            warehouseId: Number(inv.warehouseId), itemName: inv.itemName, lotCode: lot?.lotCode || null,
            currentValue: null, expectedValue: null, difference: null, tolerance: null,
            message: `Inventory ${inventoryId} يشير إلى مخزن غير موجود (${inv.warehouseId})`,
          });
        }
      }
    }
  }

  // Rules 1, 3 and 4 — current/future Lot-tracked Inventory only.
  for (const inventoryId of trackedInventoryIds) {
    const inv = inventoryById.get(inventoryId)!;
    const balances = balancesByInventory.get(inventoryId) || [];
    const actualQuantity = asNumber(inv.quantity);
    const lotQuantity = roundTo(
      balances.reduce((sum, row) => sum + asNumber(row.quantity), 0),
      config.quantityScale,
    );

    checksPerformed += 1;
    if (hasQuantityMismatch(actualQuantity, lotQuantity)) {
      pushException({
        code: "INVENTORY_LOT_QUANTITY_MISMATCH", entityType: "inventory", inventoryId, lotId: null,
        warehouseId: inv.warehouseId == null ? null : Number(inv.warehouseId), itemName: inv.itemName, lotCode: null,
        currentValue: actualQuantity, expectedValue: lotQuantity,
        difference: roundTo(actualQuantity - lotQuantity, config.quantityScale), tolerance: qtyTolerance,
        message: `كمية Inventory ${inventoryId} لا تساوي مجموع أرصدة الدفعات المرتبطة به`,
      });
    }

    checksPerformed += 1;
    if (actualQuantity < -qtyTolerance) {
      pushException({
        code: "NEGATIVE_INVENTORY_QUANTITY", entityType: "inventory", inventoryId, lotId: null,
        warehouseId: inv.warehouseId == null ? null : Number(inv.warehouseId), itemName: inv.itemName, lotCode: null,
        currentValue: actualQuantity, expectedValue: 0, difference: actualQuantity, tolerance: qtyTolerance,
        message: `كمية Inventory ${inventoryId} سالبة`,
      });
    }

    const averageCost = asNumber(inv.averageCost);
    const actualValue = roundTo(asNumber(inv.totalCostValue), config.valueScale);
    const expectedValue = roundTo(roundTo(actualQuantity, config.quantityScale) * averageCost, config.valueScale);
    const tolerance = calculateInventoryValueTolerance(actualQuantity, config);
    checksPerformed += 1;
    if (hasValueMismatch(actualValue, expectedValue, tolerance)) {
      pushException({
        code: "INVENTORY_VALUE_MISMATCH", entityType: "inventory", inventoryId, lotId: null,
        warehouseId: inv.warehouseId == null ? null : Number(inv.warehouseId), itemName: inv.itemName, lotCode: null,
        currentValue: actualValue, expectedValue,
        difference: roundTo(actualValue - expectedValue, config.valueScale), tolerance,
        message: `قيمة Inventory ${inventoryId} غير متسقة مع الكمية ومتوسط التكلفة ضمن حد التقريب المعتمد`,
      });
    }
  }

  // Rules 2 and 3 — each Lot against its distribution across warehouses.
  for (const lot of input.lotRows) {
    const lotId = Number(lot.id);
    const balances = balancesByLot.get(lotId) || [];
    const actualRemaining = asNumber(lot.remainingQuantity);
    const distributedQuantity = roundTo(
      balances.reduce((sum, row) => sum + asNumber(row.quantity), 0),
      config.quantityScale,
    );

    checksPerformed += 1;
    if (hasQuantityMismatch(actualRemaining, distributedQuantity)) {
      pushException({
        code: "LOT_GLOBAL_BALANCE_MISMATCH", entityType: "lot", inventoryId: null, lotId,
        warehouseId: null, itemName: null, lotCode: lot.lotCode,
        currentValue: actualRemaining, expectedValue: distributedQuantity,
        difference: roundTo(actualRemaining - distributedQuantity, config.quantityScale), tolerance: qtyTolerance,
        message: `الرصيد المتبقي للدفعة ${lot.lotCode} لا يساوي مجموع توزيعها على المخازن`,
      });
    }

    checksPerformed += 1;
    if (actualRemaining < -qtyTolerance) {
      pushException({
        code: "NEGATIVE_LOT_REMAINING", entityType: "lot", inventoryId: null, lotId,
        warehouseId: null, itemName: null, lotCode: lot.lotCode,
        currentValue: actualRemaining, expectedValue: 0, difference: actualRemaining, tolerance: qtyTolerance,
        message: `الرصيد المتبقي للدفعة ${lot.lotCode} سالب`,
      });
    }
  }

  // Rule 3 — an individual Lot Balance may never be negative.
  for (const balance of input.lotBalanceRows) {
    const quantity = asNumber(balance.quantity);
    checksPerformed += 1;
    if (quantity < -qtyTolerance) {
      const inv = inventoryById.get(Number(balance.inventoryId));
      const lot = lotById.get(Number(balance.lotId));
      pushException({
        code: "NEGATIVE_LOT_BALANCE", entityType: "lot_balance",
        inventoryId: Number(balance.inventoryId), lotId: Number(balance.lotId),
        warehouseId: inv?.warehouseId == null ? null : Number(inv.warehouseId),
        itemName: inv?.itemName || null, lotCode: lot?.lotCode || null,
        currentValue: quantity, expectedValue: 0, difference: quantity, tolerance: qtyTolerance,
        message: `رصيد الدفعة ${balance.id} سالب`,
      });
    }
  }

  // Rule 5 — one physical Lot cannot map to multiple Inventory rows in one warehouse.
  const warehouseLotInventories = new Map<string, Set<number>>();
  for (const balance of input.lotBalanceRows) {
    const inv = inventoryById.get(Number(balance.inventoryId));
    if (!inv || inv.warehouseId == null) continue;
    const key = `${Number(balance.lotId)}:${Number(inv.warehouseId)}`;
    const inventoryIds = warehouseLotInventories.get(key) || new Set<number>();
    inventoryIds.add(Number(balance.inventoryId));
    warehouseLotInventories.set(key, inventoryIds);
  }

  for (const [key, inventoryIds] of warehouseLotInventories) {
    checksPerformed += 1;
    if (inventoryIds.size <= 1) continue;
    const [lotIdRaw, warehouseIdRaw] = key.split(":");
    const lotId = Number(lotIdRaw);
    const warehouseId = Number(warehouseIdRaw);
    const lot = lotById.get(lotId);
    pushException({
      code: "DUPLICATE_LOT_WITHIN_WAREHOUSE", entityType: "warehouse_lot",
      inventoryId: null, lotId, warehouseId, itemName: null, lotCode: lot?.lotCode || null,
      currentValue: inventoryIds.size, expectedValue: 1, difference: inventoryIds.size - 1, tolerance: 0,
      message: `الدفعة ${lot?.lotCode || lotId} مرتبطة بأكثر من Inventory داخل المخزن ${warehouseId}`,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    scope: {
      lotsEnabled: input.lotsEnabled,
      historicalReconstructionIncluded: false,
      autoFixIncluded: false,
      inventoryRows: input.inventoryRows.length,
      trackedInventoryRows: trackedInventoryIds.size,
      inventoryRowsOutsideLotTrackedScope: input.inventoryRows.length - trackedInventoryIds.size,
      lotRows: input.lotRows.length,
      lotBalanceRows: input.lotBalanceRows.length,
    },
    rules: {
      quantityScale: config.quantityScale,
      averageCostScale: config.averageCostScale,
      valueScale: config.valueScale,
      quantityTolerance: qtyTolerance,
      valueTolerancePolicy: "half stored average-cost unit × quantity; minimum one stored value unit; zero quantity => zero value",
    },
    summary: {
      checksPerformed,
      passedChecks: Math.max(0, checksPerformed - exceptions.length),
      exceptionChecks: exceptions.length,
      exceptionsByCode,
    },
    exceptions,
  };
}
