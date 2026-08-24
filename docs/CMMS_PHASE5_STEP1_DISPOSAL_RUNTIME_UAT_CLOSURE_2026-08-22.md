# CMMS — Main Phase 5 / 5.1 — Disposal / Write-off Runtime UAT & Official Closure

**Date:** 2026-08-22  
**Status:** **COMPLETE / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED**

## 1) Roadmap position

Main Phase 4 remains officially closed. Main Phase 5 is in progress and is composed of:

- **5.1 — Disposal / Write-off — CLOSED by this document**
- 5.2 — Returns — NOT STARTED
- 5.3 — Receipt / Issue / Transfer Review — NOT STARTED
- 5.4 — Inventory Reconciliation — NOT STARTED

Closing 5.1 does **not** close Main Phase 5 and does **not** start 5.2 automatically.

## 2) Approved scope verified

The approved 5.1 scope was to verify/harden the existing Disposal flow so that it:

1. deducts quantity correctly;
2. reduces inventory value using the correct cost;
3. persists the disposal value;
4. creates a clear Disposal movement;
5. preserves operation history and document traceability;
6. executes atomically and safely under the supported implementation.

No Approval Workflow, performer-role change, posting-timing change, historical backfill, legacy cleanup, or accounting redesign was approved or introduced.

## 3) Implementation baseline before Runtime UAT

The existing Lot-aware path was already warehouse-scoped, QR/Lot-aware and transactional. The 5.1 implementation hardened the legacy non-Lot path so that Disposal number allocation, header, items, server-side valuation, Inventory quantity/value decrement, and Disposal inventory movement execute through one DB transaction.

Legacy posting also re-reads/locks current Inventory state with `FOR UPDATE`, uses current `inventory.averageCost` on the server, rejects insufficient stock, and performs a conditional decrement. No SQL/Migration or Live DB schema change was required.

Implementation reference:

- `docs/CMMS_PHASE5_STEP1_DISPOSAL_IMPLEMENTATION_2026-08-22.md`

## 4) Runtime UAT environment and test stock

Runtime UAT was performed on the deployed Lots-enabled workflow using stock originating from receipt:

```text
RCV-2026-420140
```

The receipt had, among others, these available Lots at the start of testing:

```text
Lot 22
LOT-2026-0D2DAF0B
Item: نصل قطع طبي
QR: CMMS-LOT-0d2daf0b-edf2-426f-9a0f-f46bf1a02178
Original / available before first disposal: 10.000

Lot 21
LOT-2026-AD6712E9
Item: دهان فينوماستيك برايمر داخلي جوتن – 18 Liters
QR: CMMS-LOT-ad6712e9-f8c7-4d49-b400-d7234bc98acb
Original / available before tested disposal: 10.000
```

## 5) Runtime UAT Case A — successful Disposal, quantity/value/movement

A Disposal was created for Lot 22 with quantity `1.000` and reason `منتهي الصلاحية`.

Created document:

```text
DO-2026-000003
```

Live DB verification after posting:

```text
status                    COMPLETED
inventoryId               210186
lotId                     22
disposalQty                1.000
disposalUnitCost           1.0000
disposalValue              1.00
lotCode                    LOT-2026-0D2DAF0B
lotRemainingQty            9.000
lotBalanceQty              9.000
inventoryQty               9.000
averageCost                1.0000
totalCostValue             9.00
SUM(lot balances)          9.000
transactionId              450498
transactionDirection       out
transactionType            disposal
transactionQty             1.000
transactionUnitCost        1.0000
transactionValue           1.00
documentUrl                DO-2026-000003
```

**PASS:** quantity, Lot balance, Aggregate Inventory, inventory value, and Disposal movement were consistent after posting.

Financial proof:

```text
Before value: 10.00
Disposal:      1.00
After value:   9.00
```

## 6) Runtime UAT Case B — over-quantity UI protection

After Case A, Lot 22 had `9.000` available. A new Disposal attempt was prepared with requested quantity `10`.

The UI blocked the request before posting and showed:

```text
الكمية أكبر من رصيد الدفعة المتاح (9)
```

**PASS:** the Lots-enabled UI prevents submitting a Disposal quantity greater than the available Lot balance.

Verification boundary: this case proves the UI Runtime validation. The additional backend concurrency/negative-stock protections were covered by the 5.1 targeted source/regression checks; this UAT did not deliberately bypass the UI to force a backend insufficient-stock request.

## 7) Runtime UAT Case C — second successful Disposal and invariants

A Disposal was created for Lot 21 with quantity `4.000` and reason `منتهي الصلاحية`.

Created document:

```text
DO-2026-000004
```

Live DB verification after posting:

```text
status                    COMPLETED
inventoryId               210253
lotId                     21
disposalQty                4.000
disposalUnitCost           1.0000
disposalValue              4.00
lotCode                    LOT-2026-AD6712E9
lotRemainingQty            6.000
lotBalanceQty              6.000
inventoryQty               6.000
averageCost                1.0000
totalCostValue             6.00
SUM(lot balances)          6.000
transactionId              450499
transactionDirection       out
transactionType            disposal
transactionQty             4.000
transactionUnitCost        1.0000
transactionValue           4.00
documentUrl                DO-2026-000004
```

**PASS:** all checked quantity/value invariants remained aligned:

```text
Lot remaining = Lot balance = Inventory quantity = SUM(lot balances) = 6.000
10.00 - 4.00 = 6.00 inventory value
```

## 8) Detail view / historical traceability UAT

The operation details screen for `DO-2026-000004` displayed:

- status: completed;
- one item;
- item name and Lot `LOT-2026-AD6712E9`;
- quantity `4`;
- reason `منتهي الصلاحية`;
- value `4 ر.س`.

**PASS:** operation history/details expose the tested Disposal record and its key financial/quantity fields.

## 9) Print document UAT

The printed Disposal document for `DO-2026-000004` displayed the operation number, completed status, executor, item count, item name, Lot, quantity `4`, reason `منتهي الصلاحية`, unit cost `1 ر.س`, and total value `4 ر.س`.

**PASS:** printed document is traceable to the posted Disposal and exposes quantity, reason, unit cost, and total value.

## 10) Accepted verification limits

The following limits are recorded and were explicitly accepted as non-blocking for 5.1 closure:

- Deployed workflow has Lots enabled, so Runtime UAT exercised the Lot-aware path.
- The hardened legacy non-Lot path was **not** exercised as a separate Runtime scenario because it is not the active deployed workflow; it was covered by targeted source/regression checks.
- Backend insufficient-stock/concurrency protection was not tested by deliberately bypassing the UI; the Runtime over-quantity test proved the UI guard, while the backend protections remain source/regression-verified.
- No full-project Vitest/full `tsc --noEmit` claim is added beyond the targeted checks already recorded by the implementation document.

These limits do not authorize any Workflow redesign or historical cleanup.

## 11) Explicitly not changed

- No SQL or migration.
- No Live DB schema modification.
- No historical Disposal recalculation/backfill.
- No legacy data cleanup.
- No Approval / Maker-Checker workflow.
- No new statuses or reason codes.
- No change to who performs Disposal.
- No change to the point at which Disposal deducts stock.
- No Phase 3 or Phase 4 reopening.

## 12) Official closure decision

Based on the implementation checks and the Runtime UAT evidence above:

```text
Main Phase 5 = IN PROGRESS

5.1 Disposal / Write-off
= COMPLETE / TARGETED CHECKS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED

5.2 Returns
= NOT STARTED

5.3 Receipt / Issue / Transfer Review
= NOT STARTED

5.4 Inventory Reconciliation
= NOT STARTED
```

**Official stop:** stop after closing 5.1. Do **not** start 5.2 automatically. Discuss 5.2 scope/gaps with the project owner before coding.
