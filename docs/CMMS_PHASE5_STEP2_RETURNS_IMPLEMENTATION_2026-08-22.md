# CMMS — Main Phase 5 / 5.2 — Returns Implementation

**Date:** 2026-08-22  
**Status:** **COMPLETE / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED**

## 1) Scope

5.2 covers:

- Supplier Return.
- Return from recipient/consuming entity back to warehouse.
- Link return to the original document/source.
- Partial returns.
- Correct quantity and inventory-value impact.
- Atomic posting where the operation changes inventory state.

No workflow, approval, historical-data, or accounting-policy redesign is permitted without separate explicit approval.

## 2) Supplier Return

The current Lots-enabled path already starts from explicit Warehouse + scanned Receipt Lot QR and resolves Inventory + Receipt + PO/PO Item + Vendor/Invoice from the Lot source. Opening-balance Lots are rejected because they do not prove a supplier source. Lot Balance + Lot remaining quantity + Aggregate Inventory + `warehouse_returns` + `inventory_transactions` + return document are posted in a DB transaction.

5.2 hardened this existing workflow without redesign:

1. Aggregate Inventory is locked/re-read before financial posting.
2. Supplier Return movement valuation uses server-side **Current `inventory.averageCost`** at posting time.
3. Inventory quantity/value decrement is conditional and remains in the same transaction as Lot consumption, Return header, movement, PO updates and Return document.
4. `RTN-...` generation uses the active transaction writer.
5. Legacy non-Lot Supplier Return keeps its UI/behavior but its core posting is consolidated into one DB transaction.
6. No quantity-column policy was widened from code assumptions alone.

Existing prior UAT evidence from 2B-8 remains historical evidence. Fresh Main Phase 5.2 Runtime UAT was subsequently executed and passed; see `docs/CMMS_PHASE5_STEP2_RETURNS_RUNTIME_UAT_CLOSURE_2026-08-22.md`.

## 3) Recipient → Warehouse Return — approved decision

The project owner explicitly approved:

> **Same Original Lot + Original Issue Cost + Original Issue Link + Partial/Over-return Guards + Atomic Posting**

No Inspection / Quarantine / Approval workflow is introduced here. A damaged/unfit return should not be silently treated as available stock through a newly invented workflow.

## 4) Live DB source link

Live DB inspection showed that `delivery_documents` already contains the exact future linkage required to reverse a Delivery safely (`inventoryId`, `lotId`, `inventoryTransactionId`), while `warehouse_returns` lacked a Delivery-source reference.

The owner manually applied, one statement at a time:

```text
warehouse_returns.sourceDeliveryDocumentId INT NULL
idx_warehouse_returns_source_delivery(sourceDeliveryDocumentId)
```

The first combined column+index statement failed and was verified to leave no partial column. The column was then added and verified independently, followed by the index independently.

No FK, UNIQUE constraint, historical backfill, legacy cleanup or repair was performed. `drizzle/schema.ts` now models the confirmed Live DB addition. No migration file is included because this exact Live DB change has already been manually applied and must not be blindly rerun.

## 5) Recipient Return implementation

The new backend path:

- resolves the original Delivery by exact `deliveryNumber`;
- rejects duplicate Delivery numbers rather than choosing one silently;
- requires explicit `inventoryId + lotId + inventoryTransactionId` linkage;
- verifies the linked movement is the same `out/delivery` movement and its quantity matches the Delivery document;
- reads **original `inventory_transactions.unitCost`** as valuation basis;
- calculates cumulative prior Recipient Returns through `sourceDeliveryDocumentId`;
- locks the original Delivery row before rechecking partial/over-return quantity;
- restores quantity to the exact original `inventory_lot_balances` row and `inventory_lots.remainingQuantity`;
- increases Inventory quantity/value and recalculates Average Cost from the new value/current quantity;
- writes a new `warehouse_returns` row with `sourceDeliveryDocumentId`;
- writes `inventory_transactions` as `type=in / transactionType=return` with the original issue cost and RTN reference;
- creates the Return document in the same DB transaction.

Old/unlinked Delivery documents are rejected safely. No historical linkage is guessed or backfilled.

The UI now provides an explicit **مرتجع من الجهة إلى المخزن** mode starting from the original Delivery number and shows the original recipient/Lot/warehouse, issued quantity, prior returns, returnable quantity, original issue cost and estimated return value before posting.

Return list/print paths expose the original Delivery reference for recipient returns while preserving Supplier Return display.

Detailed reference: `docs/CMMS_PHASE5_STEP2_RECIPIENT_RETURN_IMPLEMENTATION_2026-08-22.md`.

## 6) Verification performed

- TypeScript syntax/transpile for modified TS/TSX files: **PASS**.
- Targeted source-regression assertions: **PASS**.
- Full-project Vitest / full `tsc --noEmit`: not claimed because local project `node_modules` is absent in the implementation workspace.
- Fresh Runtime UAT for Supplier Return and Recipient Return: **PASS**. Closure evidence: `docs/CMMS_PHASE5_STEP2_RETURNS_RUNTIME_UAT_CLOSURE_2026-08-22.md`.

## 7) Current stop

```text
Main Phase 5 = IN PROGRESS
5.1 Disposal / Write-off = OFFICIALLY CLOSED
5.2 Returns = COMPLETE / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED
5.3 = NOT STARTED
5.4 = NOT STARTED
```

5.2 is officially closed. Do not start 5.3 automatically; discuss 5.3 scope with the project owner first.
