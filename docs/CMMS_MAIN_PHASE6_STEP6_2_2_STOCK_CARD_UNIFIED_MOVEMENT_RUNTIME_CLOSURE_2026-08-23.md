# CMMS — Main Phase 6 / 6.2.2 Stock Card & Unified Movement Report — Runtime UAT Closure

**Date:** 2026-08-23  
**Main Phase:** 6 — Inventory / Accounting Reports  
**Step:** 6.2.2 — Stock Card & Unified Movement Report  
**Status:** **COMPLETE / TARGETED TESTS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED**

## 1. Closure purpose

This document records the deployed Runtime acceptance and official closure of **6.2.2 — Stock Card & Unified Movement Report**.

6.2.2 remains a **read-only reporting step**. It does not change Inventory, Lots, Transactions, accounting behavior, workflows, numbering, or historical data.

## 2. Runtime pages verified

The deployed report page was opened successfully at:

```text
/inventory/reports/movements
```

The two approved views were verified in Runtime:

1. **جميع الحركات** — unified inventory movement report.
2. **بطاقة الصنف** — selected-item Stock Card showing current stored balance/value plus recorded transaction history.

The Runtime screenshots supplied by the owner showed real movement rows, document references, item/warehouse information, quantities, costs/values where present, and the Stock Card view for a selected item.

## 3. Targeted test evidence

The owner executed:

```bash
pnpm exec vitest run server/tests/inventoryMovementReportPhase6Step2_2.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       4 passed (4)
```

Passing coverage included:

- filter normalization and stable Stock Card item identity;
- in/out movement summary without inventing a historical opening balance;
- RTL export rows using the same filtered movement result while preserving mixed document/Lot codes;
- DB-facing report service remains read-only.

## 4. Runtime filter / export acceptance

The owner confirmed in deployed Runtime that:

- movement/report filters work correctly;
- Stock Card item selection works;
- filtered report results display correctly;
- Excel/PDF export works correctly and respects the active filtered result.

The shared 6.1 report foundation remains the single source for the common report actions/export behavior; 6.2.2 did not introduce a separate export architecture.

## 5. Historical-data boundary preserved

Stock Card intentionally shows:

- current stored Inventory quantity/value; and
- movements actually recorded in `inventory_transactions`.

It does **not**:

- fabricate an opening-balance row;
- claim old experimental history fully reconstructs the current balance;
- backfill or repair historical transactions;
- clean or rewrite legacy data.

This remains aligned with the approved future-focused project policy.

## 6. Read-only / change-control verification

No part of this closure approves or performs:

- `INSERT`, `UPDATE`, `DELETE`, Auto-fix, or repair posting;
- Schema/Migration/Live DB data change;
- Historical Backfill/Cleanup/Revaluation;
- Workflow or Accounting redesign;
- Inventory Posting Engine work;
- Centralized Document Numbering;
- Batch Transfer semantic change;
- Production Cutover.

## 7. Accepted verification boundary

No artificial mismatch or destructive Live DB change was created for this reporting UAT.

The acceptance evidence is the deployed report/Stock Card behavior, working filters and filtered exports, plus the targeted 4/4 passing tests. This closure does not reopen already accepted inventory workflows or legacy-history questions.

## 8. Official status after closure

```text
Main Phase 6 = IN PROGRESS

6.1 — Reports Foundation & Unified Reports Center
= OFFICIALLY CLOSED

6.2 — Stock Balance & Movement Reports
= IN PROGRESS

6.2.1 — Stock Balance & Status
= OFFICIALLY CLOSED

6.2.2 — Stock Card & Unified Movement Report
= COMPLETE / TARGETED TESTS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED

6.2.3 — Unified Export & Review
= NOT STARTED

6.2.4 — Runtime UAT & Closure
= NOT STARTED
```

## 9. Exact stop

> **STOP AFTER 6.2.2 OFFICIAL CLOSURE / BEFORE STARTING 6.2.3.**

Do not start 6.2.3 automatically.
