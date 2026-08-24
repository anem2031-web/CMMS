# CMMS — Main Phase 6 / 6.2.1 Stock Balance & Status — Runtime UAT Closure

**Date:** 2026-08-23  
**Status:** **OFFICIALLY CLOSED**  
**Next:** `6.2.2 — Stock Card & Unified Movement Report = NOT STARTED`

## 1) Scope closed

`6.2.1 — Stock Balance & Status` is now complete and officially closed.

The delivered report is read-only and provides:

- current stock balance by item and warehouse;
- item/internal code, quantity, unit, average cost, stored inventory value, minimum stock and status;
- status views for Normal / Low Stock / Zero Stock / Negative Stock;
- search by item name/internal code and filters by warehouse/status;
- Lot drill-down when Lot data exists;
- shared Phase 6.1 actions for refresh, reset filters, print, Excel and PDF export.

No inventory data repair or write operation is part of this step.

## 2) Targeted automated evidence

Command executed by the owner:

```text
pnpm exec vitest run server/tests/stockBalanceReportPhase6Step2_1.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
```

The tests confirmed:

1. negative / zero / low / normal classification with zero taking precedence over minimum;
2. summary counts are based on the active filtered result;
3. RTL export definition is built from the same filtered rows and preserves Lot codes;
4. the DB-facing report service remains read-only.

## 3) Runtime UI evidence

The deployed Stock Balance & Status page rendered successfully.

Runtime snapshot observed during verification:

```text
Report rows              = 709
Normal                    = 141
Low stock                 = 0
Zero stock                = 568
Negative stock            = 0
Inventory within Lot Tracking = 8
```

These numbers are a runtime snapshot only and are not treated as historical truth or a cleanup target.

## 4) Required Runtime acceptance checks — PASSED

The owner explicitly confirmed all remaining Runtime acceptance checks:

### 4.1 Stock status filter

**PASS** — the stock-status filter works in Runtime.

### 4.2 Filter-aware Excel / PDF export

**PASS** — Excel and PDF export work with an active filter and export the filtered report result rather than silently exporting the full unfiltered dataset.

### 4.3 Lot drill-down

**PASS** — a Lot-enabled row was expanded successfully in Runtime.

The expanded section displayed the expected Lot details, including:

- `Lot Code`;
- Lot balance in the current warehouse;
- total remaining quantity for the Lot;
- expiry date when present;
- `QR / Tracking Token`.

The observed Runtime example included a `1 دفعة` drill-down and an actual Lot code such as `LOT-2026-EC1B7E38`.

## 5) Change-control / safety confirmation

6.2.1 remains reporting-only:

- no `INSERT` / `UPDATE` / `DELETE` behavior was added for report operation;
- no Live DB correction or historical cleanup was performed;
- no backfill or revaluation was performed;
- no workflow or accounting behavior was changed;
- no Posting Engine or Centralized Numbering work was introduced;
- legacy / experimental data remains untouched.

## 6) Official closure

```text
Main Phase 6
= IN PROGRESS

6.1 — Reports Foundation & Unified Reports Center
= OFFICIALLY CLOSED

6.2 — Stock Balance & Movement Reports
= IN PROGRESS

6.2.1 — Stock Balance & Status
= COMPLETE / TARGETED TESTS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED

6.2.2 — Stock Card & Unified Movement Report
= NOT STARTED
```

## 7) Exact stop

> **STOP AFTER 6.2.1 OFFICIAL CLOSURE. DO NOT START 6.2.2 AUTOMATICALLY.**
