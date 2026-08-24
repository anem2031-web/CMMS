# CMMS — Main Phase 6.4 Inventory Analytics & Planning Reports — Implementation

**Date:** 2026-08-24  
**Status:** COMPLETE / TARGETED TESTS PASSED / RUNTIME UAT ACCEPTED / OFFICIALLY CLOSED  
**Official closure:** `docs/CMMS_MAIN_PHASE6_STEP6_4_INVENTORY_ANALYTICS_PLANNING_RUNTIME_UAT_CLOSURE_2026-08-24.md`

## Scope implemented

One unified read-only page:

`/inventory/reports/analytics`

with five approved tabs:

1. Slow Moving Inventory
2. Dead Moving Inventory
3. ABC Analysis
4. Inventory Aging
5. Inventory Turnover (planning indicator)

The page reuses Main Phase 6.1 shared report toolbar/export foundation and supports Refresh, Reset Filters, Print, Excel and PDF.

## Safety / accounting boundaries

6.4 is strictly read-only:

- no DB mutation
- no Auto-fix
- no Historical Backfill
- no Legacy Cleanup
- no Revaluation
- no change to `averageCost`
- no change to `totalCostValue`
- no accounting posting/workflow change
- no Centralized Numbering work
- no Batch Transfer semantic change

## Data semantics

### Slow / Dead Moving

Uses only actually recorded outbound inventory transactions. Thresholds are report filters, defaulting to:

- Slow Moving: 90 days
- Dead Moving: 180 days

The Dead threshold is normalized to remain greater than the Slow threshold. A positive-balance inventory row with no recorded outbound history is explicitly reported as **no outbound history** and is not silently classified as Slow or Dead.

### ABC

ABC is a planning classification based on positive current stored inventory value. It uses stored current value without revaluation and groups the same logical item across warehouses. Boundaries are cumulative current-value shares:

- A: first ~80%
- B: next to ~95%
- C: remainder

The row that crosses a boundary remains in the higher-priority class.

### Inventory Aging

Aging is based only on current positive `inventory_lot_balances` joined to `inventory_lots`, using the accepted operational relation `inventory_lot_balances.inventoryId`. The age basis is the recorded Lot `createdAt`.

Buckets:

- 0–30
- 31–90
- 91–180
- 181–365
- 365+
- Unknown

Positive inventory not covered by a current positive Lot balance is counted as aging coverage unavailable; no historical age is invented.

### Turnover

The displayed turnover value is intentionally a **planning indicator**, not a formal accounting turnover ratio:

`recorded outbound transaction value during selected period / current stored inventory value`

Default period: 365 days.

The report separately shows valued and unvalued outbound movements and explicitly exposes `accountingTurnoverClaimed = false`. It does not claim COGS / Average Inventory accounting semantics because that would require a historical valuation basis not approved in the current project.

## Filters

Shared filters:

- item/internal-code search
- warehouse
- category

Conditional planning parameters:

- Slow threshold (days)
- Dead threshold (days)
- Turnover indicator period (days)

Exports and Print use the same active filters and active analytics tab.

## Category basis

Uses the already accepted catalog taxonomy resolver (`getInventoryCatalogTaxonomy`). Missing links remain visibly Uncategorized; no backfill or cleanup is performed.

## Files

Core implementation:

- `server/services/reports/inventoryAnalyticsReportCore.ts`
- `server/services/reports/inventoryAnalyticsReport.ts`
- `server/routers/reports/inventory-reports.router.ts`
- `server/_core/index.ts`
- `client/src/pages/inventory/InventoryAnalyticsReport.tsx`
- `client/src/pages/inventory/InventoryReportsCenter.tsx`
- `client/src/App.tsx`
- `client/src/i18n/ar.ts`
- `client/src/i18n/en.ts`
- `client/src/i18n/ur.ts`
- `server/services/reports/reportsCenterFoundationPreview.ts`

Targeted test:

- `server/tests/inventoryAnalyticsReportPhase6Step4.test.ts`

## Targeted verification prepared

Run after extracting the implementation patch:

```bash
pnpm exec vitest run server/tests/inventoryAnalyticsReportPhase6Step4.test.ts
```

The targeted test covers threshold normalization, movement classification, ABC boundaries, aging buckets, turnover indicator semantics, read-only enforcement, Lot aging relation, and the unified five-tab page/export wiring.

## Runtime UAT required before official closure

Verify on the running application:

- analytics page opens from Reports Center
- all five tabs load
- search / warehouse / category filters work
- Slow and Dead threshold changes affect results correctly
- ABC page renders classification and current stored values
- Aging shows current Lot aging and uncovered count without invented history
- Turnover shows planning-indicator warning and valued/unvalued outbound counts
- Excel / PDF / Print work for each tab and respect filters
- Reset Filters and Refresh work
- no mutation/fix/revaluation action is present

Only after targeted test PASS + owner Runtime UAT acceptance may 6.4 be marked OFFICIALLY CLOSED.

## Current stopping point

Main Phase 6.3 remains OFFICIALLY CLOSED. **Main Phase 6.4 is COMPLETE / TARGETED TESTS PASSED / RUNTIME UAT ACCEPTED / OFFICIALLY CLOSED.** Main Phase 6.5 remains NOT STARTED and must not start automatically. Closure evidence is recorded in `docs/CMMS_MAIN_PHASE6_STEP6_4_INVENTORY_ANALYTICS_PLANNING_RUNTIME_UAT_CLOSURE_2026-08-24.md`.
