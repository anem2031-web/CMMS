# CMMS — Main Phase 6 / 6.2.1 Stock Balance & Status — Implementation Checkpoint

**Date:** 2026-08-23  
**Main Phase:** 6 — Inventory / Accounting Reports  
**Step:** 6.2.1 — Stock Balance & Status  
**Status:** **IMPLEMENTED / TARGETED SOURCE CHECKS PASSED / DEPLOYED RUNTIME VERIFICATION PENDING**

## 1. Purpose

Implement the first real operational inventory report on top of the Reports Foundation officially closed in 6.1.

The report answers, without changing inventory data:

- what item is currently recorded in stock;
- in which warehouse;
- current quantity and unit;
- current average cost and stored inventory value;
- minimum-stock threshold and current status;
- Lot detail when the Inventory row is Lot-tracked (current positive warehouse balances only, matching the existing Inventory Lot-list behavior).

## 2. Runtime route

```text
/inventory/reports/stock-balance
```

The **الرصيد والحالة** card in `/inventory/reports` opens this report. The report stays inside the unified Inventory Reports Center architecture; no new scattered top-level reporting menu was added.

## 3. Read-only data contract

6.2.1 reads current-state fields only. It does not rebuild historical inventory truth and it does not alter values.

Primary current fields:

- `inventory.id`
- `inventory.itemName`
- `inventory.internalCode`
- `inventory.warehouseId`
- `inventory.quantity`
- `inventory.unit`
- `inventory.minQuantity`
- `inventory.averageCost`
- `inventory.totalCostValue`
- warehouse code/name

Optional Lot drill-down, when Lots are operationally enabled, reads:

- `inventory_lot_balances.inventoryId`
- `inventory_lot_balances.lotId`
- `inventory_lot_balances.quantity`
- `inventory_lots.lotCode`
- `inventory_lots.trackingToken`
- `inventory_lots.remainingQuantity`
- `inventory_lots.expiryDate`

Live DB remains authoritative. This implementation does not claim that project Schema alone proves Live DB structure. The fields used here are aligned to current supported runtime paths and previously inspected current-state DB structure; final acceptance still requires deployed Runtime verification.

## 4. Stock status rules

The report uses mutually exclusive operational status labels so the screen is unambiguous:

```text
negative = quantity < 0
zero     = quantity = 0
low      = quantity > 0 AND minQuantity > 0 AND quantity <= minQuantity
normal   = otherwise
```

Storage precision is 0.001 quantity; the classifier uses the existing half-unit tolerance `0.0005` around zero/minimum comparisons.

A negative or low/zero result is a **review/report status only**. 6.2.1 never repairs or changes stock.

## 5. UI / filters

The report reuses the officially closed 6.1 foundation:

- Refresh
- Reset Filters
- Print
- grouped Export → Excel / PDF
- generated-at date/time

Current 6.2.1 filters:

- Item name / internal code search
- Warehouse
- Status: All / Normal / Low / Zero / Negative

The primary table shows:

- Item
- Code
- Warehouse
- Quantity
- Unit
- Average Cost
- Stored Inventory Value
- Minimum Stock
- Status
- Lot count / drill-down

Lot detail is collapsed by default to avoid overcrowding the main report.

## 6. Export behavior

Print, Excel and PDF call the same server-side report service used by the UI data rules and receive the same active filters.

Export columns include current stock context plus compact Lot summaries where applicable. The shared 6.1 export foundation continues to provide:

- organized `.xlsx` output;
- numeric quantity/cost/value cells;
- RTL/LTR and mixed-language handling;
- report title / generated time / filter summary;
- PDF/Print common layout;
- Unicode-safe filenames.

6.2.1 does not introduce a second export architecture.

## 7. Explicit non-scope / safety

No:

- `INSERT`, `UPDATE` or `DELETE` for report execution;
- Auto-fix;
- Historical Backfill / Cleanup / Reconstruction;
- revaluation;
- Schema/Migration/SQL change;
- Receipt/Issue/Return/Transfer/Settlement workflow change;
- Accounting/Posting Engine change;
- Centralized Document Numbering;
- Production Cutover;
- 6.2.2 Stock Card / Unified Movement implementation.

The displayed `totalCostValue` is the value currently stored by the accepted inventory workflow. 6.2.1 does not recalculate old/experimental data merely to make the report look consistent.

## 8. Files added / changed

### New

- `server/services/reports/inventoryStockBalanceReport.ts`
- `client/src/pages/inventory/InventoryStockBalanceReport.tsx`
- `server/tests/stockBalanceReportPhase6Step2_1.test.ts`
- this implementation document

### Updated

- `server/routers/reports/inventory-reports.router.ts`
- `server/_core/index.ts`
- `client/src/App.tsx`
- `client/src/pages/inventory/InventoryReportsCenter.tsx`
- `client/src/i18n/ar.ts`
- `client/src/i18n/en.ts`
- `client/src/i18n/ur.ts`
- Main Phase 6 roadmap/status documentation

## 9. Verification performed in packaging environment

- Targeted TypeScript/TSX syntax transpile for all modified source/test/translation files: **PASS**.
- Source review confirms the DB-facing Stock Balance service contains no `.insert(` / `.update(` / `.delete(` / `withTransaction(` calls.
- Route/linkage review confirms `/inventory/reports/stock-balance` is registered and the Reports Center Balance/Status card opens it.
- No full-project `tsc --noEmit` or full Vitest run is claimed in the uploaded dependency-less project snapshot.

Targeted deployed test to run after extraction/restart:

```bash
pnpm exec vitest run server/tests/stockBalanceReportPhase6Step2_1.test.ts
```

## 10. Acceptance gate / exact stop

Do **not** close 6.2.1 from packaging checks alone.

After extraction and server restart, verify:

1. Stock Balance page opens from Reports Center.
2. Current Live DB rows load successfully.
3. Warehouse/search/status filters work.
4. Minimum/Zero/Negative status behavior is understandable and correct.
5. Lot drill-down works for a Lot-tracked row.
6. Refresh and Reset Filters work.
7. Print, Excel and PDF work using active filters.
8. Targeted test passes.

Until these are verified:

```text
6.2.1 = IMPLEMENTED / TARGETED SOURCE CHECKS PASSED / RUNTIME VERIFICATION PENDING
6.2.2 = NOT STARTED
```
