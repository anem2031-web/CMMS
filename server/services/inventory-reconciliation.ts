import {
  inventory,
  inventoryLotBalances,
  inventoryLots,
  warehouses,
} from "../../drizzle/schema";
import { getDb } from "../_core/db/client";
import {
  INVENTORY_AVERAGE_COST_SCALE,
  INVENTORY_QUANTITY_SCALE,
  INVENTORY_VALUE_SCALE,
} from "../_core/inventory-costing";
import { isInventoryLotsEnabled } from "../_core/inventory-lots";
import {
  evaluateInventoryReconciliation,
  type InventoryReconciliationInventoryRow,
  type InventoryReconciliationLotBalanceRow,
  type InventoryReconciliationLotRow,
  type InventoryReconciliationResult,
  type InventoryReconciliationWarehouseRow,
} from "./inventory-reconciliation-core";

/**
 * Main Phase 5.4.2 — read-only Live DB reconciliation.
 *
 * Deliberately SELECT-only: no mutation, repair, backfill, revaluation,
 * historical transaction reconstruction, or workflow/accounting change.
 */
export async function runInventoryReconciliation(): Promise<InventoryReconciliationResult> {
  const database = await getDb();
  if (!database) throw new Error("تعذر الاتصال بقاعدة البيانات");

  const [inventoryRows, lotRows, lotBalanceRows, warehouseRows] = await Promise.all([
    database.select({
      id: inventory.id,
      itemName: inventory.itemName,
      warehouseId: inventory.warehouseId,
      quantity: inventory.quantity,
      averageCost: inventory.averageCost,
      totalCostValue: inventory.totalCostValue,
    }).from(inventory),
    database.select({
      id: inventoryLots.id,
      lotCode: inventoryLots.lotCode,
      remainingQuantity: inventoryLots.remainingQuantity,
    }).from(inventoryLots),
    database.select({
      id: inventoryLotBalances.id,
      lotId: inventoryLotBalances.lotId,
      inventoryId: inventoryLotBalances.inventoryId,
      quantity: inventoryLotBalances.quantity,
    }).from(inventoryLotBalances),
    database.select({ id: warehouses.id }).from(warehouses),
  ]);

  return evaluateInventoryReconciliation(
    {
      inventoryRows: inventoryRows as InventoryReconciliationInventoryRow[],
      lotRows: lotRows as InventoryReconciliationLotRow[],
      lotBalanceRows: lotBalanceRows as InventoryReconciliationLotBalanceRow[],
      warehouseRows: warehouseRows as InventoryReconciliationWarehouseRow[],
      lotsEnabled: isInventoryLotsEnabled(),
    },
    {
      quantityScale: INVENTORY_QUANTITY_SCALE,
      averageCostScale: INVENTORY_AVERAGE_COST_SCALE,
      valueScale: INVENTORY_VALUE_SCALE,
    },
  );
}
