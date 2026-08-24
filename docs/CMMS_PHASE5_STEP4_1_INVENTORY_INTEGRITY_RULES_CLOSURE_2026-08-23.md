# CMMS — Main Phase 5 / 5.4.1 Inventory Integrity Rules — Official Closure

**Date:** 2026-08-23  
**Status:** **COMPLETE / LIVE DB READ-ONLY DISCOVERY PASSED / RULES APPROVED / OFFICIALLY CLOSED**

## 1) Objective

Define the integrity rules that the future-facing Inventory Reconciliation Engine will evaluate. This step does **not** implement the engine, does not change application code, and does not modify Live DB data.

Live DB is authoritative for actual structure/state. Project Schema remains a code model only. All DB checks in this step were read-only and were executed manually by the owner one SQL statement at a time.

## 2) Live DB structure confirmed

The following relevant Live DB types were confirmed:

- `inventory.quantity` = `decimal(12,3)`
- `inventory.averageCost` = `decimal(12,4)`
- `inventory.totalCostValue` = `decimal(14,2)`
- `inventory.warehouseId` = `int NULL`
- `inventory_lots.remainingQuantity` = `decimal(12,3)`
- `inventory_lot_balances.lotId` = `int`
- `inventory_lot_balances.inventoryId` = `int`
- `inventory_lot_balances.quantity` = `decimal(12,3)`
- `inventory_transactions.quantity` = `decimal(12,3)`
- `inventory_transactions.unitCost` = `decimal(12,4) NULL`
- `inventory_transactions.totalCost` = `decimal(14,2) NULL`

The actual Inventory/Lot relation used for live reconciliation is through `inventory_lot_balances(lotId, inventoryId)`. No assumption is made that `inventory_lots.inventoryId` exists in Live DB.

## 3) Approved integrity rules

### Rule 1 — Inventory Quantity ↔ Lot Balances

For an Inventory row that participates in the Lot-enabled state:

```text
inventory.quantity = SUM(inventory_lot_balances.quantity)
                     WHERE inventoryId = inventory.id
```

Quantity comparison precision is based on the Live DB `decimal(12,3)` scale. The reconciliation check may use a half-unit-of-last-place threshold (`0.0005`) to avoid representation noise.

### Rule 2 — Global Lot Remaining ↔ Warehouse Distribution

For each Lot:

```text
inventory_lots.remainingQuantity
= SUM(inventory_lot_balances.quantity) WHERE lotId = inventory_lots.id
```

Warehouse Transfer changes distribution between Inventory rows; it must not change the company-wide remaining quantity of the same Lot.

### Rule 3 — No Negative Stock

The supported future state must not produce negative values in:

```text
inventory.quantity
inventory_lot_balances.quantity
inventory_lots.remainingQuantity
```

The reconciliation engine must report a negative value as an exception. It must not automatically fix it.

### Rule 4 — Current Inventory Value Consistency

Expected display/current value is derived as:

```text
expectedValue = ROUND(quantity * averageCost, 2)
```

Because `averageCost` is stored to 4 decimals while `totalCostValue` is stored to 2 decimals, the rule is **not** strict raw equality. The approved rounding tolerance is:

```text
tolerance = MAX(
  0.01,
  CEILING(ABS(quantity) * 0.00005 * 100) / 100
)
```

If `quantity = 0`, future supported state should have `totalCostValue = 0.00`; keeping an informational `averageCost` does not by itself create stock value.

A difference beyond the approved tolerance is a reconciliation exception only; it does not authorize Revaluation or historical repair.

### Rule 5 — Lot Balance Reference / Warehouse Integrity

Every `inventory_lot_balances` row must:

- reference an existing `inventory` row;
- reference an existing `inventory_lots` row;
- resolve through its Inventory row to a Warehouse;
- not create more than one Inventory identity for the same `lotId + warehouseId` pair.

Any violation is reported as an integrity exception. No auto-repair is allowed.

## 4) Live DB read-only evidence

### 4.1 Inventory ↔ Lot Balance quantity

```text
totalInventoryRows                   = 695
inventoriesWithLotBalances           = 5
quantityLotMismatches                = 0
nonZeroInventoryWithoutLotBalance    = 121
```

All Inventory rows currently participating in Lot balances matched their Lot totals. The `121` non-zero Inventory rows without Lot balances are treated as existing experimental/legacy data and are **not** a cleanup target for this phase.

### 4.2 Lot remaining ↔ distributed balances

```text
totalLots                    = 4
lotsWithBalances             = 4
lotBalanceMismatches         = 0
nonZeroLotsWithoutBalances   = 0
```

PASS.

### 4.3 Negative balance checks

```text
negativeInventoryRows        = 0
minimumInventoryQuantity     = 0.000

negativeLotBalanceRows       = 0
minimumLotBalanceQuantity    = 1.000

negativeLotRemainingRows     = 0
minimumLotRemainingQuantity  = 4.000
```

PASS.

### 4.4 Current value observation

Across `695` Inventory rows, the diagnostic comparison found `2` existing value differences, with maximum absolute difference `60.00`:

```text
inventory 180001: qty 1.000, avg 120.0000, stored 60.00, calculated 120.00
inventory 167:    qty 5.000, avg 12.0000,  stored 108.00, calculated 60.00
```

Both are existing experimental rows whose last updates were on `2026-08-15`, before the current Phase 5 work. By explicit owner decision they remain untouched. They do not authorize Backfill/Revaluation and do not block the future-facing rule definition.

### 4.5 Lot Balance reference / warehouse integrity

```text
totalLotBalanceRows               = 5
orphanInventoryReferences         = 0
orphanLotReferences               = 0
balancesWithoutWarehouse          = 0
duplicateLotWithinSameWarehouse   = 0
```

PASS.

## 5) Explicit non-goals reaffirmed

5.4.1 performed no:

- `INSERT`, `UPDATE`, `DELETE`, migration, or schema change;
- historical cleanup/backfill/revaluation;
- historical transaction reconstruction;
- automatic data repair;
- workflow/accounting redesign;
- numbering changes;
- Batch Transfer semantic change.

## 6) Closure decision

```text
5.4.1 — Inventory Integrity Rules
= COMPLETE / LIVE DB READ-ONLY DISCOVERY PASSED / RULES APPROVED / OFFICIALLY CLOSED
```

Current stop after this closure:

```text
Main Phase 5 = IN PROGRESS
5.1 = CLOSED
5.2 = CLOSED
5.3 = CLOSED
5.4 = IN PROGRESS
  5.4.1 = CLOSED
  5.4.2 = NOT STARTED
  5.4.3 = NOT STARTED
  5.4.4 = NOT STARTED
```

**Do not start 5.4.2 automatically.**
