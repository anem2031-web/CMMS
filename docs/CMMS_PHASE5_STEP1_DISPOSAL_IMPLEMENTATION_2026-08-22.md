# CMMS — Main Phase 5 / 5.1 — Disposal / Write-off Implementation

**Date:** 2026-08-22  
**Status:** **IMPLEMENTED / TARGETED SOURCE & SYNTAX CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED**

## 1) Position in roadmap

Main Phase 4 remains officially closed. Main Phase 5 has now started by explicit owner approval. The first part is:

- **5.1 — Disposal / Write-off**
- 5.2 — Returns — not started
- 5.3 — Receipt / Issue / Transfer review — not started
- 5.4 — Inventory Reconciliation — not started

Main Phase 5 is not closed until all four parts are evaluated and closed under their approved scope.

## 2) Approved 5.1 scope

The current roadmap requires Disposal to:

1. deduct quantity correctly;
2. reduce inventory value using the correct cost;
3. persist the disposal value;
4. create a clear Disposal movement;
5. preserve full history;
6. execute atomically and safely.

No approval workflow, performer-role change, posting-timing change, historical backfill, legacy cleanup, or accounting redesign is included.

## 3) Existing baseline found before coding

The latest project already had a mature Disposal flow:

- `disposal_operations` / `disposal_items` document model;
- `DO-YYYY-NNNNNN` numbering;
- `transactionType = "disposal"` inventory movement;
- server-side valuation using current `inventory.averageCost`;
- persisted `unitCost` and `totalCost`;
- list/detail/print exposure of disposal value;
- when Lots are enabled: warehouse-scoped Lot QR resolution, Lot balance consumption, `inventory_lots.remainingQuantity`, Aggregate Inventory posting, `disposal_items.lotId`, and `inventory_transactions.lotId` inside a DB transaction.

Therefore 5.1 does **not** rebuild Disposal from scratch.

## 4) Gap found

The legacy non-Lot path created the Disposal header/items before calling `issueDisposal()` as a separate posting step outside the creating transaction.

If stock posting failed after the document was created, this could theoretically leave a partial document state. This conflicts with the 5.1 requirement that the supported operation be atomic and safe.

A second hardening opportunity was that legacy posting read current Inventory without holding the row lock across the whole posting transaction.

## 5) Implementation

### 5.1 Same transaction writer for numbering

Disposal number allocation now uses `generateDisposalNumberWith(writer)` and is invoked from the active transaction writer during `createDisposal()`.

The counter still uses MySQL `AUTO_INCREMENT`. A rolled-back transaction may consume an ID and therefore leave a numbering gap. No gapless-numbering redesign was introduced.

### 5.2 Legacy non-Lot path made atomic

The existing legacy workflow is preserved, but the following effects now execute in one `db.transaction(...)`:

- Disposal number allocation;
- `disposal_operations` header;
- `disposal_items` rows;
- re-read/lock current Inventory state;
- server-side valuation;
- Inventory quantity/value decrement;
- `inventory_transactions` Disposal movement.

### 5.3 Server remains valuation source of truth

For legacy and Lot-aware Disposal:

```text
unitCost = current inventory.averageCost
movementValue = quantity × current averageCost
newInventoryValue = newInventoryQuantity × current averageCost
```

Client-provided `unitCost` / `totalCost` are not trusted as posting truth. The persisted Disposal item is synchronized to the server-calculated values.

### 5.4 Concurrency / negative-stock protection

Legacy posting now:

- locks the current Inventory row with `FOR UPDATE` inside the transaction;
- re-reads current quantity and average cost;
- rejects insufficient stock;
- performs a conditional decrement with `quantity >= requested quantity`;
- aborts the transaction if the conditional update does not affect exactly one row.

### 5.5 Lot-aware path preserved

The approved 2B-8 Lot-aware Disposal behavior remains in place:

- Warehouse + Lot QR are the operational source of truth;
- no client-supplied `lotId` is trusted;
- Lot balance and remaining quantity are consumed through the existing Lot service;
- Aggregate Inventory is locked and decremented;
- document item and inventory transaction keep the resolved `lotId`;
- all effects remain inside one transaction.

## 6) Files changed for 5.1 implementation

- `server/_core/db/warehouse-receipts.ts`
- `server/tests/inventoryDisposalPhase5Step1.test.ts` (new)
- `docs/CMMS_PHASE5_STEP1_DISPOSAL_IMPLEMENTATION_2026-08-22.md` (new)
- `docs/inventory/INVENTORY_DEVELOPMENT_PLAN_AND_CHANGE_CONTROL.md`
- `docs/PENDING_TASKS.md`
- `docs/INDEX.md`
- `docs/CHANGELOG_TECHNICAL.md`

## 7) Explicitly not changed

- No SQL or migration.
- No Live DB modification.
- No historical Disposal recalculation/backfill.
- No legacy data cleanup.
- No Approval / Maker-Checker workflow.
- No new statuses or reason codes.
- No change to who performs Disposal.
- No change to the point at which Disposal deducts stock.
- No Phase 3 or Phase 4 reopening.

## 8) Verification state

Source-regression coverage was added for:

- same-writer Disposal numbering;
- transaction boundary on legacy non-Lot path;
- Inventory row locking and conditional decrement;
- current-average-cost valuation and persisted movement value;
- preservation of the Lot-aware transactional path;
- absence of a newly introduced approval workflow in the Disposal router.

**Runtime UAT completed and passed on 2026-08-22.** Closure evidence is recorded in:

- `docs/CMMS_PHASE5_STEP1_DISPOSAL_RUNTIME_UAT_CLOSURE_2026-08-22.md`

Runtime UAT covered two successful Lots-enabled Disposal postings (`DO-2026-000003`, `DO-2026-000004`), Live DB quantity/value/Lot/transaction invariants, over-quantity UI protection, detail history, and print output. The legacy non-Lot runtime path was not separately exercised because Lots are enabled in the deployed workflow; its hardening remains covered by the targeted source/regression checks and this limit was accepted as non-blocking for 5.1 closure.

No temporary rollback failpoint has been introduced.

## 9) Current official stop

```text
Main Phase 4 = CLOSED
Main Phase 5 = IN PROGRESS
  5.1 Disposal / Write-off = COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED
  5.2 Returns = NOT STARTED
  5.3 Receipt / Issue / Transfer Review = NOT STARTED
  5.4 Inventory Reconciliation = NOT STARTED
```

5.1 is officially closed. Do not start 5.2 automatically; discuss 5.2 scope/gaps with the owner before coding.
