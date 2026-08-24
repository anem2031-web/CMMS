# CMMS — Main Phase 6 / 6.2.1 Stock Balance & Status — Runtime Verification Checkpoint

**Date:** 2026-08-23  
**Status:** IMPLEMENTED / TARGETED TESTS PASSED / BASE RUNTIME UI VERIFIED — **FINAL RUNTIME CHECKS PENDING**  
**This document is NOT an official closure.**

## 1. Scope

This checkpoint records only evidence actually confirmed for `6.2.1 — Stock Balance & Status`. It does not start 6.2.2 and does not change inventory data.

## 2. Runtime UI evidence

The deployed report page opened successfully at:

`/inventory/reports/stock-balance`

Visible report summary at the captured Runtime checkpoint:

| Metric | Value |
|---|---:|
| Report rows | 709 |
| Normal | 141 |
| Low stock | 0 |
| Zero stock | 568 |
| Negative stock | 0 |
| Inventory within Lot Tracking | 8 |

The page visibly included the shared report toolbar, report filters, summary cards, and the Stock Balance table.

## 3. Targeted automated verification

Owner executed:

```text
pnpm exec vitest run server/tests/stockBalanceReportPhase6Step2_1.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
```

The targeted tests verify:

- negative / zero / low / normal classification with zero taking precedence over minimum stock;
- summary values are calculated from the active filtered result;
- RTL export definition is built from the same filtered rows and preserves Lot codes;
- DB-facing Stock Balance report service remains read-only.

## 4. Remaining Runtime acceptance before closure

The following checks were requested but have not yet been explicitly confirmed by the owner:

1. Select **Zero Stock** (or another status) and confirm the visible rows are restricted to that status.
2. Reset filters, search for a Lot-tracked inventory item, open **Lots** detail and confirm Lot information displays correctly.
3. With a filter active, export **Excel** and **PDF** and confirm both contain the filtered result rather than the full unfiltered report.

These are blocking acceptance checks for the official 6.2.1 closure record.

## 5. Change-control / data policy

- Read-only reporting only.
- No SQL or Live DB mutation performed for this checkpoint.
- No historical cleanup or backfill.
- No revaluation.
- No workflow, accounting, posting, numbering, or permissions change.
- Old/experimental data remains untouched.

## 6. Exact stop

```text
Main Phase 6 = IN PROGRESS
6.1 = OFFICIALLY CLOSED
6.2 = IN PROGRESS
6.2.1 = IMPLEMENTED / TARGETED TESTS PASSED / BASE RUNTIME UI VERIFIED / FINAL RUNTIME CHECKS PENDING
6.2.2 = NOT STARTED
```

**STOP inside 6.2.1 Runtime verification. Do not start 6.2.2 and do not mark 6.2.1 OFFICIALLY CLOSED until the remaining Runtime checks are explicitly confirmed.**
