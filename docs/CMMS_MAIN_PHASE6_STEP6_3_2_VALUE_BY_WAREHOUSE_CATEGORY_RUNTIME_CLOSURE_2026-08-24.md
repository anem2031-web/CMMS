# CMMS — Main Phase 6 / Step 6.3.2 — Value by Warehouse / Category — Runtime UAT Closure

**Date:** 2026-08-24  
**Final status:** **COMPLETE / TARGETED TESTS PASSED / RUNTIME UAT ACCEPTED / OFFICIALLY CLOSED**

## 1. Closure decision

Main Phase **6.3.2 — Value by Warehouse / Category** is officially closed after implementation, targeted automated verification, deployed Runtime review, and explicit owner acceptance.

The exact project stop after this closure is:

```text
Main Phase 6 = IN PROGRESS
6.1 = OFFICIALLY CLOSED
6.2 = OFFICIALLY CLOSED
6.3 = IN PROGRESS
6.3.1 = OFFICIALLY CLOSED
6.3.2 = OFFICIALLY CLOSED
6.3.3 = NOT STARTED
6.3.4 = NOT STARTED
6.4 = DOCUMENTED FOR LATER / EXECUTE LAST / NOT STARTED
6.5 = NOT STARTED

STOP AFTER 6.3.2 CLOSURE / BEFORE 6.3.3.
DO NOT START 6.3.3 AUTOMATICALLY.
```

## 2. Implemented scope accepted

6.3.2 remains inside the existing **القيمة والمحاسبة** area on:

```text
/inventory/reports/valuation
```

The page contains the accepted three views:

1. **تقييم المخزون / Inventory Valuation** — the already closed 6.3.1 detailed report.
2. **حسب المخزن / Value by Warehouse**.
3. **حسب التصنيف / Value by Category**.

No separate top-level report pages were introduced for the two grouped views.

## 3. Valuation/accounting basis preserved

6.3.2 uses the same accepted valuation basis as 6.3.1:

- current stored `inventory.totalCostValue`;
- no Revaluation;
- no replacement calculation using `quantity × averageCost` as a new stored valuation;
- no modification to `averageCost`;
- no modification to `totalCostValue`;
- no Posting Engine or Accounting behavior redesign.

The grouping layer is read-only.

## 4. Value by Warehouse — accepted Runtime behavior

Runtime evidence supplied by the owner showed the warehouse view loading successfully and presenting grouped current inventory value.

Observed Runtime summary included:

- source inventory rows: **717**;
- grouped rows: **3**;
- defined warehouses represented: **2**, plus the visible no-specific-warehouse grouping where applicable;
- current-value share by group is displayed from the active result total;
- mixed quantity units remain separated as quantity context instead of being summed into one cross-unit quantity.

## 5. Value by Category — accepted Runtime behavior

Runtime evidence supplied by the owner showed the category view loading successfully and presenting current value grouped through the accepted Catalog taxonomy read layer.

Observed Runtime summary included:

- source inventory rows: **717**;
- category groups: **16**;
- inventory rows without an accepted category mapping: **688** shown visibly as uncategorized/unmapped context rather than repaired.

This behavior is intentional:

- no category Backfill;
- no Legacy Cleanup;
- no mutation to Catalog or Inventory links;
- incomplete mapping remains visible as `غير مصنف / Uncategorized`.

## 6. 6.3.1 regression check

The existing **Inventory Valuation** tab continued to render successfully during Runtime review after 6.3.2 deployment.

6.3.2 did not reopen or replace the closed 6.3.1 valuation behavior.

## 7. Export / Print Runtime acceptance

The owner explicitly confirmed that the report works correctly and that the export/print actions work in Runtime.

Accepted output actions:

- Excel;
- PDF;
- Print.

The implementation reuses the shared Main Phase 6 report/export foundation and exports the active grouped stored-value result.

## 8. Targeted automated verification

Executed by the owner on the deployed/local project:

```text
pnpm exec vitest run server/tests/inventoryValueDistributionReportPhase6Step3_2.test.ts
```

Result:

```text
Test Files  1 passed (1)
Tests       5 passed (5)
```

Passed cases:

1. groups stored values by warehouse and keeps mixed quantities separated by unit;
2. groups by accepted catalog taxonomy and leaves unmapped inventory visibly uncategorized;
3. does not invent percentages when the active total is zero or negative;
4. exports the grouped stored value with active-result filters;
5. keeps 6.3.2 DB-facing code read-only and reuses 6.3.1 + 2B-9 foundations.

## 9. Change-control confirmation

No part of this closure authorizes or performs:

- SQL / Schema / Migration changes;
- Live DB mutation;
- Historical Backfill;
- Legacy Cleanup;
- historical Revaluation;
- Auto-fix;
- historical renumbering;
- Centralized Document Numbering;
- `receipt_number_counter` creation;
- Workflow or Accounting behavior change;
- Batch Transfer all-or-nothing redesign;
- Main Phase 6.4 Analytics implementation;
- inventory cutover / experimental-data reset.

All such items remain under their previously approved change-control rules.

## 10. Final status

```text
6.3.2 — Value by Warehouse / Category
= COMPLETE
= TARGETED TESTS 5/5 PASS
= RUNTIME UI ACCEPTED
= EXCEL / PDF / PRINT ACCEPTED
= READ-ONLY
= OFFICIALLY CLOSED
```

**Next possible step:** `6.3.3 — Inventory Variance & Accounting Review`.

**Execution gate:** do not begin 6.3.3 until the owner separately approves starting it.
