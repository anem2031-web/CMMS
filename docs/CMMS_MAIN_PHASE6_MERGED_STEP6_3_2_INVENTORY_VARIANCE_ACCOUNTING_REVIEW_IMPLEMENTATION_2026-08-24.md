# CMMS — MAIN PHASE 6 / MERGED 6.3.2 — INVENTORY VARIANCE, ACCOUNTING REVIEW & RUNTIME CLOSURE

**Date:** 2026-08-24  
**Status:** **IMPLEMENTED IN CODE / TARGETED TESTS PENDING USER RUNTIME / FINAL 6.3 CLOSURE PENDING**

## 1. Approved two-part restructuring

By explicit owner approval on 2026-08-24, Main Phase 6.3 was simplified from four execution checkpoints to two current checkpoints without rewriting historical evidence:

```text
NEW 6.3.1 — Inventory Valuation & Value Distribution
= former 6.3.1 Inventory Valuation Report
+ former 6.3.2 Value by Warehouse / Category
= OFFICIALLY CLOSED

NEW 6.3.2 — Inventory Variance, Accounting Review & Runtime Closure
= former 6.3.3 Inventory Variance & Accounting Review
+ former 6.3.4 Runtime UAT & Closure
= IN PROGRESS
```

Historical implementation/test/closure documents keep their original numbering. They are not renamed or deleted.

## 2. Implemented review behavior

The existing `/inventory/reports/valuation` reporting area now contains a fourth tab for **Accounting Review** beside the closed valuation / warehouse / category views.

The new review is deliberately **read-only** and reuses accepted foundations rather than creating a second reconciliation engine:

- `loadInventoryValuationReport()` supplies current stored inventory values and the existing search / warehouse / value-status filters.
- `runInventoryReconciliation()` from Main Phase 5.4 supplies authoritative accepted reconciliation exceptions/tolerance evidence.
- `getInventoryCatalogTaxonomy()` supplies the accepted read-only Catalog taxonomy mapping already used by the closed value-by-category view.

## 3. Review conditions implemented

Only safely-supported current-state review conditions are surfaced:

1. `value_mismatch`
   - only when Main Phase 5.4 returns `INVENTORY_VALUE_MISMATCH` for that Inventory row;
   - shows current value, accepted reference value, difference and tolerance from the 5.4 evidence;
   - never replaces the stored value.

2. `negative_stored_value`
   - based on the already accepted 6.3.1 stored-value status (`totalCostValue < negative threshold`);
   - visibility only, not an automatic accounting error/fix policy.

3. `negative_quantity`
   - only from the accepted 5.4 `NEGATIVE_INVENTORY_QUANTITY` exception.

4. `reconciliation_exception`
   - accounting-oriented visibility for other Inventory-linked 5.4 reconciliation exceptions relevant to the row;
   - the user can open the authoritative **Inventory Reconciliation Report** for integrity detail.

A normal Inventory row with no supported condition above is **not invented as an exception**.

## 4. Filters and presentation

The review reuses the common 6.1/6.3 controls and adds review-only filters:

- Item/internal-code search
- Warehouse
- Current stored-value status
- Category / Uncategorized
- Review condition

The table shows:

- Item / internal code
- Warehouse
- Category
- Quantity / unit
- `averageCost`
- stored `totalCostValue`
- Review condition(s)
- 5.4 reference/expected value where available
- Difference where available
- Reconciliation evidence code where available

## 5. Export / print

Added read-only exports for the active review result:

```text
/api/reports/inventory/valuation/accounting-review.xlsx
/api/reports/inventory/valuation/accounting-review.pdf
/api/reports/inventory/valuation/accounting-review/print
```

They reuse the closed shared Main Phase 6 report foundation and respect active filters.

## 6. Explicit non-goals / preserved boundaries

This implementation does **not**:

- update inventory quantity;
- update `averageCost`;
- update `totalCostValue`;
- Revalue / Recalculate inventory in DB;
- Auto-fix a reconciliation exception;
- create missing transactions;
- perform Historical Backfill;
- perform Legacy Cleanup;
- rebuild historical transactions;
- change Accounting/Posting workflow;
- implement Main Phase 7 Posting Engine;
- implement Centralized Document Numbering or `receipt_number_counter`;
- change Batch Transfer semantics;
- start Main Phase 6.4 Analytics.

No SQL or Live DB migration is required for this code implementation.

## 7. Verification gate

Targeted test file delivered:

```text
server/tests/inventoryAccountingReviewReportPhase6Step3_2Merged.test.ts
```

Expected command after patch extraction:

```bash
pnpm exec vitest run server/tests/inventoryAccountingReviewReportPhase6Step3_2Merged.test.ts
```

Final merged 6.3.2 / Main Phase 6.3 closure must wait for:

- targeted test PASS;
- deployed Runtime review tab PASS;
- search / warehouse / value-status / category / review-condition filters PASS;
- Reset / Refresh PASS;
- Excel / PDF / Print PASS;
- confirmation that the closed valuation / warehouse / category tabs remain functional;
- confirmation no report action writes to Live DB.

If a Live DB spot-check is needed, provide **one read-only SQL command at a time** only.

## 8. Current stop after this implementation delivery

```text
6.3.1 — Inventory Valuation & Value Distribution
= OFFICIALLY CLOSED

6.3.2 — Inventory Variance, Accounting Review & Runtime Closure
= IMPLEMENTED IN CODE / VERIFICATION & FINAL CLOSURE PENDING

6.4 — Inventory Analytics & Planning Reports
= DEFERRED / EXECUTE LAST / NOT STARTED
```

Do not mark Main Phase 6.3 officially closed until the Runtime acceptance gate above is completed.
