# CMMS — Main Phase 6 / Step 6.3.2 — Value by Warehouse / Category Implementation

**Date:** 2026-08-24  
**Status:** IMPLEMENTED IN CODE / STATIC + ISOLATED LOGIC CHECKS PASSED / DEPLOYED RUNTIME UAT PENDING  
**Previous step:** 6.3.1 Inventory Valuation Report = OFFICIALLY CLOSED

## 1. Scope implemented

6.3.2 was implemented in one delivery inside the existing **القيمة والمحاسبة** reporting area.

The existing `/inventory/reports/valuation` page now keeps the closed 6.3.1 valuation detail and adds two grouped read-only views:

1. **Value by Warehouse — القيمة حسب المخزن**
2. **Value by Category — القيمة حسب التصنيف**

No new disconnected top-level report page was introduced.

## 2. Valuation basis — unchanged

6.3.2 does **not** introduce a new valuation engine.

It reuses `loadInventoryValuationReport()` from 6.3.1, therefore all grouped values are based on the current stored:

- `inventory.totalCostValue`

The implementation does not recalculate inventory value from `quantity × averageCost`, does not perform Revaluation, and does not update `averageCost` or `totalCostValue`.

## 3. Value by Warehouse

The warehouse view groups the currently filtered 6.3.1 rows by warehouse and exposes:

- warehouse code/name;
- inventory-row count;
- current stored inventory value;
- share of the active filtered total when the denominator is safely positive;
- quantity context separated by unit.

Quantities with different units are **not** merged into one misleading total. For example, pieces and liters remain separate quantity-context entries.

## 4. Value by Category

The category view reuses the already accepted read-only 2B-9 taxonomy resolver:

`Inventory → linked Catalog Item → Catalog node/path`

It exposes:

- Catalog category/path;
- distinct item count within the group;
- inventory-row count;
- current stored inventory value;
- share of the active filtered total when safely computable;
- quantity context separated by unit.

If an Inventory row has no reliable category mapping, it is shown visibly under:

- `غير مصنف`
- `Uncategorized`

No category backfill, cleanup, repair, or schema mutation is performed.

## 5. Shared filters and exports

6.3.2 reuses the existing valuation filters:

- item/internal-code search;
- warehouse;
- stored-value status (`all / positive / zero / negative`).

The active grouped result supports the shared 6.1 report actions:

- Refresh
- Reset Filters
- Print
- Excel `.xlsx`
- PDF

Separate read-only export endpoints were added for warehouse/category grouped views, and they use the same active filters as the UI.

## 6. Files added/changed

### New

- `server/services/reports/inventoryValueDistributionReport.ts`
- `server/tests/inventoryValueDistributionReportPhase6Step3_2.test.ts`
- `docs/CMMS_MAIN_PHASE6_STEP6_3_2_VALUE_BY_WAREHOUSE_CATEGORY_IMPLEMENTATION_2026-08-24.md`

### Changed

- `server/routers/reports/inventory-reports.router.ts`
- `server/_core/index.ts`
- `client/src/pages/inventory/InventoryValuationReport.tsx`
- `client/src/pages/inventory/InventoryReportsCenter.tsx`
- `client/src/i18n/ar.ts`
- `client/src/i18n/en.ts`
- `client/src/i18n/ur.ts`
- `docs/PENDING_TASKS.md`
- `docs/INDEX.md`
- `docs/CHANGELOG_TECHNICAL.md`
- `docs/inventory/INVENTORY_DEVELOPMENT_PLAN_AND_CHANGE_CONTROL.md`

## 7. Safety / change-control confirmation

This implementation introduces:

- no SQL;
- no migration;
- no DB write;
- no Revaluation;
- no Historical Backfill;
- no Legacy Cleanup;
- no Auto-fix;
- no Accounting/Posting behavior change;
- no Centralized Numbering work;
- no `receipt_number_counter`;
- no Batch Transfer semantic change;
- no 6.4 Analytics implementation;
- no Cutover activity.

## 8. Verification performed in packaging environment

Because the uploaded Full Project does not include installed project dependencies (`node_modules`) and network installation is unavailable in the packaging environment, the project Vitest suite was **not claimed as executed here**.

Performed successfully:

- TypeScript syntax transpilation check for every modified TS/TSX file: **PASS**.
- Isolated runtime harness against the exact 6.3.2 grouping/export-core implementation: **PASS**.
- Verified warehouse grouping uses stored row values and separates mixed units.
- Verified category grouping merges the same Catalog Item across warehouses and retains unmapped inventory as Uncategorized.
- Verified share is suppressed for zero/negative active totals.
- Verified the DB-facing 6.3.2 service source contains no `.insert()`, `.update()`, `.delete()`, or `withTransaction()` calls.

## 9. Targeted test prepared for deployed/local project

Run after extracting the patch into the current project:

```bash
pnpm exec vitest run server/tests/inventoryValueDistributionReportPhase6Step3_2.test.ts
```

Expected test count from the prepared file: **5 tests**.

Do not mark the test as passed until it is actually executed in the deployed/local project.

## 10. Runtime UAT required before official closure

Verify on `/inventory/reports/valuation`:

- existing 6.3.1 detail tab remains correct;
- **حسب المخزن** loads grouped current values;
- **حسب التصنيف** loads Catalog grouping and visibly handles `غير مصنف`;
- search / warehouse / value-status filters affect grouped values and totals;
- percentages use the active filtered result and show `—` when the active total is not safely positive;
- mixed units remain separated in quantity context;
- Excel/PDF/Print work for both grouped tabs and respect filters;
- no UI action writes or repairs inventory/category data.

## 11. Current official stop after this delivery

```text
Main Phase 6 = IN PROGRESS
6.1 = OFFICIALLY CLOSED
6.2 = OFFICIALLY CLOSED
6.3 = IN PROGRESS
6.3.1 = OFFICIALLY CLOSED
6.3.2 = IMPLEMENTED IN CODE / RUNTIME VERIFICATION PENDING
6.3.3 = NOT STARTED
6.3.4 = NOT STARTED
6.4 = DEFERRED / EXECUTE LAST
6.5 = NOT STARTED
```

**Do not start 6.3.3 automatically. Verify and close 6.3.2 first.**
