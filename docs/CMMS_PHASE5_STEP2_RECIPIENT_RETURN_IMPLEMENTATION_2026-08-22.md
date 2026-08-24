# CMMS — Main Phase 5 / 5.2 — Recipient → Warehouse Return Implementation

**Date:** 2026-08-22  
**Status:** **IMPLEMENTED / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / 5.2 OFFICIALLY CLOSED**

## 1) Approved policy

The project owner explicitly approved the following future behavior for returns from a consuming recipient/entity back to warehouse stock:

> **Same Original Lot + Original Issue Cost + Original Issue Link + Partial/Over-return Guards + Atomic Posting**

No Approval / Inspection / Quarantine workflow was introduced in this step.

## 2) Live DB decision and manual change

Live DB was treated as the source of truth before coding. The inspected structure showed:

- `delivery_documents` already has `inventoryId`, `lotId`, `inventoryTransactionId`, recipient data and `deliveryNumber`.
- `inventory_transactions` already has `unitCost`, `totalCost`, `lotId`, `transactionType` and `documentUrl`.
- `warehouse_returns` had no explicit link to the original Delivery document.

A future-only link was therefore approved and added manually to Live DB, one SQL statement at a time:

```text
warehouse_returns.sourceDeliveryDocumentId INT NULL
index: idx_warehouse_returns_source_delivery(sourceDeliveryDocumentId)
```

Execution record:

1. The first combined `ALTER ... ADD COLUMN ... ADD INDEX ...` attempt failed and was verified to have left **no partial column**.
2. `sourceDeliveryDocumentId INT NULL` was then added successfully by itself.
3. `INFORMATION_SCHEMA.COLUMNS` confirmed the column exists as nullable `INT` with `NULL` default.
4. The index was then added successfully in a separate SQL statement.

No FK, UNIQUE constraint, historical backfill or legacy repair was performed.

The project `drizzle/schema.ts` is now synchronized to this confirmed Live DB addition. No migration file is included in this patch because the Live DB change was executed manually and must not be blindly re-run.

## 3) Source eligibility

A Recipient → Warehouse Return is allowed only when the original Delivery document has explicit future-safe linkage:

- `delivery_documents.inventoryId`
- `delivery_documents.lotId`
- `delivery_documents.inventoryTransactionId`

The linked movement must be:

```text
type = out
transactionType = delivery
movement.inventoryId = delivery.inventoryId
movement.lotId = delivery.lotId
movement.quantity = delivery.quantity
```

The original movement must also contain a valid `unitCost`.

Old Delivery documents missing these links are rejected safely. They are **not** backfilled or guessed from names/POs/history.

## 4) Partial / over-return protection

`warehouse_returns.sourceDeliveryDocumentId` is the durable link to the original Delivery document.

Before posting, the backend calculates:

```text
previouslyReturned = SUM(warehouse_returns.returnedQuantity)
                    WHERE sourceDeliveryDocumentId = original delivery id

returnableQuantity = originalDelivery.quantity - previouslyReturned
```

The original `delivery_documents` row is locked with `FOR UPDATE` before re-reading this amount. This serializes concurrent partial-return attempts against the same Delivery and prevents two requests from both passing the same remaining-quantity check.

A return greater than `returnableQuantity` is rejected.

## 5) Same original Lot

The return does **not** create a new Lot.

Inside the posting transaction the backend locks and updates the exact original:

- `inventory_lot_balances` row for `(lotId, inventoryId)`
- `inventory_lots` row
- `inventory` row

Then it adds the returned quantity to:

```text
original Lot balance
inventory_lots.remainingQuantity
inventory.quantity
```

If the original Lot balance row is missing or ambiguous, the return stops instead of creating/repairing a balance silently.

## 6) Original issue cost / financial posting

The valuation source is **the original Delivery movement cost**, not Current Average Cost:

```text
originalIssueUnitCost = original inventory_transactions.unitCost
returnValue           = returnedQuantity × originalIssueUnitCost

newInventoryQuantity = currentInventoryQuantity + returnedQuantity
newInventoryValue    = currentTotalCostValue + returnValue
newAverageCost        = newInventoryValue / newInventoryQuantity
```

Numeric conventions remain:

```text
Quantity      DECIMAL(12,3) model convention
Average Cost  DECIMAL(12,4)
Value         DECIMAL(14,2)
```

The current Live DB return header/document quantity columns are `INT`, therefore this new Recipient Return path intentionally accepts whole-unit quantities only. No quantity-column widening was approved in 5.2.

## 7) Atomic posting

The following effects are inside one DB transaction:

- lock/revalidate original Delivery source;
- cumulative over-return check;
- original Lot balance increase;
- Lot remaining increase;
- Inventory quantity/value/average-cost update;
- `warehouse_returns` row with `sourceDeliveryDocumentId`;
- `inventory_transactions` row (`type=in`, `transactionType=return`);
- automatic Return document.

If any required step fails, the core posting rolls back.

The Return movement stores the generated `RTN-...` in `documentUrl` for direct ledger traceability.

## 8) UI / document behavior

`/warehouse/return` now exposes two explicit modes:

1. **مرتجع إلى المورد** — existing Supplier Return workflow.
2. **مرتجع من الجهة إلى المخزن** — new approved Recipient Return workflow.

Recipient Return begins from the **original Delivery number**. After resolution the UI shows:

- original Delivery number;
- original recipient;
- original warehouse;
- original Lot;
- originally delivered quantity;
- previously returned quantity;
- remaining returnable quantity;
- original issue unit cost;
- estimated return value.

Return list / printing now identifies Recipient Returns through the original Delivery link and displays the original Delivery number. Supplier Return display remains separate.

## 9) Files changed in this patch

- `drizzle/schema.ts`
- `server/_core/db/warehouse-returns.ts`
- `server/routers/inventory/returns.router.ts`
- `server/tests/inventoryReturnsPhase5Step2.test.ts`
- `client/src/pages/inventory/WarehouseReturn.tsx`
- `client/src/pages/inventory/WarehouseReturnsList.tsx`
- `client/src/lib/printReturnDocument.ts`
- `docs/CMMS_PHASE5_STEP2_RETURNS_IMPLEMENTATION_2026-08-22.md`
- `docs/CMMS_PHASE5_STEP2_RECIPIENT_RETURN_IMPLEMENTATION_2026-08-22.md`
- `docs/inventory/INVENTORY_DEVELOPMENT_PLAN_AND_CHANGE_CONTROL.md`
- `docs/PENDING_TASKS.md`
- `docs/INDEX.md`
- `docs/CHANGELOG_TECHNICAL.md`

## 10) Verification performed

- TypeScript syntax/transpile for all modified TS/TSX files: **PASS**.
- Targeted source-regression assertions for source linkage, atomicity, original-cost valuation, over-return guards, UI and print traceability: **PASS**.
- Full-project Vitest / full `tsc --noEmit`: not claimed from this workspace because local project `node_modules` is absent.
- Fresh Runtime UAT: **PASS** for full return, partial return, cumulative remaining quantity, same-Lot/original-cost posting and over-return protection. See `docs/CMMS_PHASE5_STEP2_RETURNS_RUNTIME_UAT_CLOSURE_2026-08-22.md`.

## 11) Current stop

```text
Main Phase 5 = IN PROGRESS
5.1 Disposal / Write-off = OFFICIALLY CLOSED
5.2 Returns = COMPLETE / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED
5.3 = NOT STARTED
5.4 = NOT STARTED
```

5.2 is officially closed. Do not start 5.3 automatically; discuss 5.3 scope with the project owner first.
