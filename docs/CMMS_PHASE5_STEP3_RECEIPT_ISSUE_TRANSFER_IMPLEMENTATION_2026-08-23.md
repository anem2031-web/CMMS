# CMMS — Main Phase 5 / Step 5.3 — Receipt / Issue / Warehouse Transfer Review

**Date:** 2026-08-23  
**Status:** **COMPLETE / IMPLEMENTED HARDENING / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED**

## 1. Scope

5.3 reviews the already-existing Receipt, Issue/Delivery, and Warehouse Transfer paths. It does **not** rebuild those workflows. The approved target is consistency of quantity, cost/value, warehouse identity, atomic posting, Lot traceability, and document linkage without historical cleanup or silent workflow redesign.

## 2. Receipt hardening

### Warehouse identity

The active receipt UIs previously sent a fixed `warehouseId: 1`, and backend processing also had a `... || 1` fallback. These fixed numeric assumptions were removed. The backend now resolves the receipt warehouse in this order:

1. explicit active Warehouse id when supplied;
2. Warehouse already attached to an explicitly selected Inventory row;
3. otherwise the **single active Main warehouse** resolved dynamically from `warehouses`.

If there is no active Main warehouse, or more than one active Main warehouse while no explicit warehouse can be resolved, the receipt is rejected safely instead of silently choosing a numeric id.

The legacy invoice-draft receipt path is hardened with the same dynamic Main warehouse rule for new/unresolved Inventory rows. No historical Inventory rows are rewritten.

### Quantity/value concurrency

For an existing Inventory row, receipt processing now obtains an Aggregate Inventory `FOR UPDATE` lock before reading current quantity and `averageCost` and before calculating the moving weighted average. Existing Lot creation and purchase transaction behavior remain inside the same receipt transaction.

## 3. Issue / Delivery hardening

`issueDelivery()` now locks the Aggregate Inventory row before reading quantity and `averageCost`. This keeps the availability check, issue valuation, Lot consumption, Inventory decrement, `inventory_transactions` movement, and Delivery document on one current state inside the existing DB transaction.

No delivery approval/status workflow was added or changed.

## 4. Warehouse Transfer hardening

- Source Aggregate Inventory is locked before quantity/cost read for both Lots-enabled and legacy paths.
- Existing destination Aggregate Inventory is locked before weighted-average valuation and increment for both paths.
- `TRF-...` is allocated inside the same transaction before movement records are inserted.
- Both transfer movements (`out` source and `in` destination) now carry `documentUrl = transferNumber`, giving a direct shared trace reference to the Transfer header.
- Existing Lots-enabled behavior still moves the **same Lot/QR identity** between warehouse balances; it does not create a new Lot merely because inventory moves warehouses.

The existing batch-transfer behavior remains unchanged: each item is still posted as its own atomic transfer and the batch can report mixed item success/failure. Changing the entire batch to all-or-nothing is a workflow decision and was not approved here.

## 5. Document numbering decision

No new Receipt counter table is introduced in 5.3. Live DB inspection before this decision showed:

- max current-year RCV sequence observed: `420148`;
- duplicate Receipt Number groups: `0`;
- `receipt_number_counter` table: absent.

The project already has `getNextReceiptNumber(tx?)`, while other document families use different existing mechanisms. The owner approved deferring unification to a future **Centralized Document Numbering Service / Engine** rather than introducing a one-off RCV counter now. See `docs/CMMS_CENTRALIZED_DOCUMENT_NUMBERING_DEFERRED_2026-08-23.md`.

This deferral explicitly means:

- keep existing number formats/mechanisms for now;
- no historical renumbering or backfill;
- no gapless-number promise;
- no new RCV counter or migration in this package.

## 6. Verification performed

Targeted source/regression checks cover:

- no fixed `warehouseId: 1` in current receipt submit paths;
- dynamic Main warehouse resolution with safe ambiguity rejection;
- Receipt Inventory `FOR UPDATE` before weighted-average calculation;
- Delivery Inventory `FOR UPDATE` before availability/cost read;
- Transfer source and existing destination locks on both Lot and legacy paths;
- both Transfer movements reference the same `TRF-...`;
- existing RCV numbering retained and no partial new counter introduced.

TypeScript syntax/transpile checks passed for all modified TS/TSX files. Full-project typecheck/test-suite is not claimed because the supplied Full Project workspace does not include its local dependency installation.

## 7. Runtime UAT completed

Fresh Runtime UAT completed successfully on 2026-08-23:

1. Receipt `RCV-2026-420150` = PASS for two fresh items in `WH-MAIN`, with Lot/QR, quantity/value and `in/purchase` movements verified in Live DB.
2. Delivery `DLV-2026-300213` = PASS for Lot `LOT-2026-224A39C8`, with Lot/Inventory/value decrement and `out/delivery` trace verified.
3. Transfer `TRB-2026-030005` / `TRF-2026-030005` = PASS from `WH-MAIN` to `SUB-1`: same Lot identity, source `3`, destination `1`, company-wide Lot quantity `4`, and paired transfer movements verified.
4. Over-quantity transfer attempt `4 > 3` was rejected by the UI with `الكمية أكبر من الرصيد المتاح (3 قطعة)` = PASS.

5.3 is therefore **officially closed**. Full evidence and accepted verification limits are recorded in `docs/CMMS_PHASE5_STEP3_RECEIPT_ISSUE_TRANSFER_RUNTIME_UAT_CLOSURE_2026-08-23.md`.

## 8. Explicit non-scope

No historical backfill, legacy cleanup, broad FK/UNIQUE rollout, centralized numbering implementation, In-Transit state, destination approval, or transfer-batch workflow redesign is part of this implementation checkpoint.
