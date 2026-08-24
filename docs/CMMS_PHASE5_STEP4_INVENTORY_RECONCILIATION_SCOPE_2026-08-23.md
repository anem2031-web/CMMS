# CMMS — Main Phase 5 / Step 5.4 — Inventory Reconciliation Scope

**Date:** 2026-08-23  
**Status:** ✅ **SCOPE DOCUMENTED / APPROVED — IMPLEMENTATION NOT STARTED**  
**Current project stop:** **AFTER 5.3 OFFICIAL CLOSURE / BEFORE 5.4.1 IMPLEMENTATION**

## 1. Purpose

Main Phase 5.4 is a **future-facing, read-only Inventory Reconciliation** phase.

Its purpose is to verify that the current inventory state is internally consistent and that future supported inventory movements preserve that consistency.

This phase is **not** a historical cleanup or historical ledger reconstruction project.

## 2. Historical / legacy data policy

Existing historical and experimental inventory data remains **untouched**.

5.4 must not automatically:

- delete or reset old inventory data;
- backfill historical transactions;
- repair legacy rows;
- revalue historical inventory;
- rebuild historical document links;
- renumber historical documents;
- rewrite accounting history;
- run old migrations merely because they exist in the project.

Historical/experimental data is not required to be made perfect for this phase. The project owner is interested in protecting **future production behavior**.

The future production cutover/opening-balance process is a separate scope and is **not part of 5.4**.

## 3. Approved 5.4 structure

Main Phase 5.4 will be completed through four steps:

```text
5.4.1 — Inventory Integrity Rules
5.4.2 — Read-only Reconciliation Engine
5.4.3 — Reconciliation Exception Report
5.4.4 — Runtime UAT & Closure
```

## 4. 5.4.1 — Inventory Integrity Rules

Define and approve the invariants that must remain true for future inventory operations.

Core rules include, where applicable to the current Lots-enabled model:

1. **Aggregate Inventory vs Warehouse Lot Balances**

```text
inventory.quantity
≈ SUM(inventory_lot_balances.quantity) for the same inventory record
```

2. **Global Lot Remaining vs Lot Distribution Across Warehouses**

```text
inventory_lots.remainingQuantity
≈ SUM(inventory_lot_balances.quantity) for the same lot across warehouses
```

3. **Inventory Value Internal Consistency**

```text
inventory.totalCostValue
≈ inventory.quantity × inventory.averageCost
```

The comparison must use the project's accepted quantity/cost/value precision and rounding rules.

4. **Impossible / unsafe current-state checks**

Examples:

- negative aggregate inventory quantity;
- negative lot balance;
- aggregate quantity inconsistent with lot balances;
- global lot remaining inconsistent with its warehouse distribution;
- material current-value inconsistency.

The exact rule set must be implemented from the then-current code and verified against Live DB structure. Project Schema remains a **code model**, not proof of Live DB structure.

## 5. 5.4.2 — Read-only Reconciliation Engine

Build a reusable backend reconciliation layer that:

- reads current inventory state;
- evaluates the approved integrity rules;
- classifies results;
- returns evidence required for review.

The engine is **read-only**.

It must not automatically perform:

- `UPDATE`;
- `DELETE`;
- repair `INSERT` operations;
- stock recalculation writes;
- lot-balance correction;
- transaction creation to repair missing history;
- historical backfill;
- legacy cleanup;
- historical revaluation.

Recommended result classes:

```text
PASS
EXCEPTION
```

Exception types may include:

```text
INVENTORY_LOT_QUANTITY_MISMATCH
LOT_GLOBAL_BALANCE_MISMATCH
INVENTORY_VALUE_MISMATCH
NEGATIVE_INVENTORY
NEGATIVE_LOT_BALANCE
```

Additional future-facing checks may be added only when they are supported safely by the actual code and Live DB structure.

## 6. Transaction and document checks

5.4 must **not** attempt to reconstruct or validate the full experimental transaction history as a condition of success.

`SUM(IN) - SUM(OUT)` over all legacy history must not be treated automatically as the source of truth for current quantity unless future inspection proves a complete and valid baseline.

Transaction/document checks inside 5.4 should therefore be limited to **safe, future-facing traceability checks** that can be proven from the current architecture, for example when applicable:

```text
Receipt  → Inventory Transaction → Inventory / Lot
Delivery → out/delivery Transaction → Inventory / Lot
Transfer → paired OUT / IN transfer traces
Return   → Return transaction + supported source reference
Disposal → out/disposal transaction
Settlement → adjustment transaction / settlement reference
```

5.4 is not a historical forensic-audit engine.

Full transaction-ledger reconstruction / centralized posting architecture remains aligned with the later **Main Phase 7 — Inventory Posting Engine** unless separately approved otherwise.

## 7. 5.4.3 — Reconciliation Exception Report

Provide a simple review/reporting surface for reconciliation results.

The report should focus on exceptions and reviewability, not become the full reporting suite reserved for Main Phase 6.

Typical fields may include:

- Item / Inventory identifier;
- Warehouse;
- Lot when applicable;
- Check / exception type;
- Current value;
- Expected/computed value;
- Difference;
- review status/result.

Useful filters may include Warehouse, Item, Lot, exception type and PASS/EXCEPTION state.

**No automatic Fix / Recalculate / Apply action is part of 5.4.**

## 8. 5.4.4 — Runtime UAT & Closure

Runtime UAT should use **newly created movements** and verify that supported current workflows preserve the approved invariants.

Relevant paths may include:

- Receipt;
- Delivery / Issue;
- Supplier Return;
- Recipient → Warehouse Return;
- Disposal / Write-off;
- Warehouse Transfer;
- Inventory Count Settlement.

UAT must not intentionally corrupt or rewrite Live DB without separate explicit approval.

5.4 may close only after the approved rules, read-only engine and exception report are verified with appropriate Runtime UAT.

After 5.4 official closure, Main Phase 5 can be evaluated for official completion because 5.1, 5.2 and 5.3 are already officially closed.

## 9. Explicitly out of scope

The following remain outside 5.4 unless separately approved:

- historical data cleanup;
- historical backfill;
- historical transaction reconstruction;
- historical inventory revaluation;
- legacy repair;
- production cutover / opening-balance loading;
- deletion/reset of experimental inventory data;
- Centralized Document Numbering;
- `receipt_number_counter`;
- historical renumbering;
- Batch Transfer all-or-nothing redesign;
- new approval workflows;
- broad accounting redesign;
- broad FK/UNIQUE rollout;
- automatic reconciliation repair.

## 10. Change-control / Live DB rule

- Latest Full Project is the source of truth for code/documentation actually present.
- Live DB is the source of truth for actual structure/state/data.
- Do not change Live DB merely to match project Schema.
- If Live DB inspection is required, provide **one SQL command at a time** for manual execution by the project owner.
- No coding for 5.4 begins merely because this scope document exists.

## 11. Current status after this documentation

```text
Main Phase 3 = CLOSED
Main Phase 4 = CLOSED
Main Phase 5 = IN PROGRESS
5.1 = OFFICIALLY CLOSED
5.2 = OFFICIALLY CLOSED
5.3 = OFFICIALLY CLOSED
5.4 = SCOPE DOCUMENTED / APPROVED — IMPLEMENTATION NOT STARTED
```

**Exact stop:** before implementation of `5.4.1 — Inventory Integrity Rules`.
