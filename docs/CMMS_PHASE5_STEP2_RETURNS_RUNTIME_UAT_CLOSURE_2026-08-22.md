# CMMS — Main Phase 5 / 5.2 — Returns Runtime UAT & Official Closure

**Date:** 2026-08-22  
**Status:** **COMPLETE / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED**

## 1) Closure scope

Main Phase 5 / 5.2 covers the two approved Returns paths:

1. **Supplier Return** — return stock from warehouse to the supplier.
2. **Recipient → Warehouse Return** — return previously issued stock from a recipient/technician/entity back to the warehouse.

This closure does **not** introduce Approval, Inspection, Quarantine, historical repair, backfill, broad FK/UNIQUE rollout, or any unrelated Workflow/Accounting redesign.

## 2) Approved Recipient Return policy

The project owner explicitly approved the following future behavior:

> **Same Original Lot + Original Issue Cost + Original Issue Link + Partial/Over-return Guards + Atomic Posting**

A valid Recipient Return therefore:

- starts from the original `DLV-...` Delivery document;
- returns quantity to the same original Inventory + Lot;
- uses the original issue movement `unitCost` as the return valuation basis;
- accumulates prior returns against the same Delivery;
- rejects quantities above the remaining returnable quantity;
- posts Lot, Inventory, financial value, Return header/document and `in/return` movement atomically.

## 3) Live DB future-only linkage applied manually

Live DB inspection showed that modern `delivery_documents` rows carry the required source linkage (`inventoryId`, `lotId`, `inventoryTransactionId`), while `warehouse_returns` lacked an explicit Delivery source reference.

The project owner manually applied and verified, one SQL statement at a time:

```text
warehouse_returns.sourceDeliveryDocumentId INT NULL
idx_warehouse_returns_source_delivery(sourceDeliveryDocumentId)
```

The first attempt to add the column and index together failed. A follow-up `INFORMATION_SCHEMA.COLUMNS` check confirmed the column had **not** been partially created. The column was then added alone and verified, followed by the index as a separate statement.

No FK, UNIQUE, historical backfill, legacy cleanup, or migration replay was performed. Existing Supplier Returns and historical rows remain allowed to have `sourceDeliveryDocumentId = NULL`.

## 4) Fresh Runtime UAT — Supplier Return

### Case A — Supplier Return from receipt `RCV-2026-420140`

Source Lot:

```text
Lot                 LOT-2026-AD6712E9
Inventory           210253
Pre-return balance  6.000
Return quantity     1.000
Reason              معطوب
```

Runtime result:

```text
Return              RTN-2026-60003
returnId            60003
Inventory           210253
Lot                  21 / LOT-2026-AD6712E9
returnedQuantity     1
Lot remaining        5.000
Lot balance          5.000
Inventory quantity   5.000
SUM(lot balances)    5.000
Average Cost         1.0000
Total Cost Value     5.00
Movement             out / return
Movement quantity    1.000
Movement unit cost   1.0000
Movement value       1.00
transactionReturnId  60003
```

**PASS:** Supplier Return preserved the Lot/Inventory invariant, decremented quantity/value consistently, used the server-side current Average Cost for the supplier-return movement, and linked the movement to the Return record.

## 5) Fresh Runtime UAT — Recipient → Warehouse Return

### Case B — Full return of original Delivery

Original Delivery:

```text
Delivery             DLV-2026-300204
sourceDeliveryId     210204
Inventory            210253
Lot                  21 / LOT-2026-AD6712E9
Originally issued    1
Original movement    450501 / out / delivery
Original issue cost  1.0000
Original issue value 1.00
```

Recipient Return result:

```text
Return                RTN-2026-60004
returnId              60004
returnedQuantity      1
totalReturned         1
Return movement       450502 / in / return
Return unit cost      1.0000
Return value          1.00
Lot remaining         5.000
Lot balance           5.000
Inventory quantity    5.000
SUM(lot balances)     5.000
Total Cost Value      5.00
documentUrl           RTN-2026-60004
```

**PASS:** same original Inventory/Lot, explicit original Delivery linkage, original issue cost valuation, quantity/value restoration and `in/return` movement all matched the approved policy.

A second attempt to resolve the same fully-returned Delivery was rejected at runtime with:

```text
تم إرجاع كامل الكمية المصروفة في هذا السند مسبقًا
```

**PASS:** full-return / over-return protection.

### Case C — Partial return and cumulative guard

Original Delivery:

```text
Delivery             DLV-2026-300205
Inventory            210253
Lot                  21 / LOT-2026-AD6712E9
Originally issued    2
Original movement    450503
Original issue cost  1.0000
Original issue value 2.00
```

Before the successful partial return, a runtime attempt to return quantity `3` while only `2` remained was rejected with:

```text
الكمية (3) أكبر من المتبقي القابل للإرجاع (2)
```

**PASS:** over-return validation.

Successful partial return:

```text
Return                   RTN-2026-60005
returnId                 60005
returnedQuantity         1
totalReturnedAgainstDLV  1
remainingReturnableQty   1
Return movement          in / return
Return unit cost         1.0000
Return value             1.00
Lot remaining            4.000
Lot balance              4.000
Inventory quantity       4.000
SUM(lot balances)        4.000
Average Cost             1.0000
Total Cost Value         4.00
```

The UI was then reopened for `DLV-2026-300205` and displayed:

```text
Originally issued        2
Previously returned      1
Remaining returnable     1
Original issue cost      1.0000
Current return value     1.00
```

**PASS:** partial returns are cumulative and the next return sees the remaining quantity correctly.

## 6) Targeted implementation verification

Before Runtime UAT:

- TypeScript syntax/transpile for modified TS/TSX files: **PASS**.
- targeted source-regression checks for atomicity, source linkage, valuation boundaries, partial/over-return protection, UI and print traceability: **PASS**.

Full-project Vitest / full `tsc --noEmit` is **not claimed** from the implementation workspace because local `node_modules` was not present there.

## 7) Accepted verification limits

- Fresh Runtime UAT covered the deployed **Lots Enabled** Supplier Return and Recipient Return paths.
- Hardened legacy non-Lot Supplier Return was not separately Runtime-exercised in this closure; targeted source/regression checks remain its evidence.
- Recipient Return list/print source-reference behavior is covered by targeted source checks; the closure Runtime session focused on source resolution, posting, financial valuation, partial/full return guards and Live DB invariants.
- No historical Delivery linkage was fabricated; old/unlinked Delivery documents remain rejected rather than backfilled or guessed.

These limits are accepted as **non-blocking** for 5.2 closure under the approved scope.

## 8) Official closure

```text
Main Phase 5 = IN PROGRESS

5.1 Disposal / Write-off
= COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED

5.2 Returns
= COMPLETE / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED

5.3 Receipt / Issue / Transfer Review
= NOT STARTED

5.4 Inventory Reconciliation
= NOT STARTED
```

**Exact stop:** after official closure of **5.2**, before starting **5.3**.

Do **not** start 5.3 automatically. Discuss its scope/gap analysis with the project owner before implementation.
