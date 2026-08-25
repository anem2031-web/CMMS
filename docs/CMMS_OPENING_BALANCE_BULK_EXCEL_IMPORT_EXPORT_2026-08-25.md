# CMMS — Bulk Opening Balance Excel Import / Export

**Date:** 2026-08-25  
**Status:** IMPLEMENTED — CODE / DOCUMENTATION PACKAGE  
**Scope:** Opening Balance workflow only

## Approved business decision

Bulk opening stock is implemented as an extension of the existing `opening_balance` inventory-count workflow. It does **not** introduce a second posting path and does not bypass settlement.

The warehouse is selected in CMMS when the opening-balance operation is created. Therefore warehouse code/name are deliberately absent from the Excel business sheet.

## Excel business template

The editable `Opening Stock` sheet contains only:

1. `كود الصنف` — required; exact active Master Catalog item code.
2. `الكمية الافتتاحية` — required; > 0; maximum 3 decimal places.
3. `تكلفة الوحدة` — required; may explicitly be `0`; maximum 4 decimal places.
4. `تاريخ الانتهاء` — optional; `YYYY-MM-DD`.

No warehouse columns, notes, LOT code, QR/tracking token, Inventory ID, or manually entered total value are accepted as business inputs.

A second read-only/reference-style worksheet named `دليل الأصناف` is generated in the downloaded template and lists active Catalog item code/name/unit to help users choose the correct item code. Matching is still performed by item code only.

## Workflow

1. Create/open an `opening_balance` operation and select its warehouse in CMMS.
2. Download the Excel template.
3. Fill the `Opening Stock` sheet.
4. Upload `.xlsx`.
5. Server parses and validates every non-empty row against the **current DB state**.
6. Preview shows valid/error rows, total quantity, and total opening value.
7. If any row has an error, the whole import is blocked.
8. If all rows are valid, `اعتماد الاستيراد` stages all rows inside one DB transaction.
9. Staging keeps Inventory quantity at zero and does not create LOTs or Inventory Transactions.
10. Existing workflow remains authoritative: finalize the opening-balance operation, then apply settlement.
11. Settlement creates Opening Balance LOT + QR, updates inventory quantity/value, and records the inventory transaction.

## Validation rules

The server rejects the whole batch when any row violates a rule, including:

- missing/unknown Catalog item code;
- duplicate item code in the uploaded file;
- duplicate active Catalog records with the same code;
- item already added to the same opening-balance operation;
- more than one Inventory record for the same Catalog item + selected warehouse;
- existing non-zero stock in the selected warehouse;
- missing/invalid/non-positive quantity;
- quantity precision greater than 3 decimals;
- missing/invalid/negative unit cost;
- unit-cost precision greater than 4 decimals;
- invalid expiry date.

The commit re-runs validation inside the transaction; preview is not trusted as a write authorization snapshot.

## Import atomicity

Bulk Opening Balance import is **all-or-nothing for this import batch only**. If any staged row fails during commit, the transaction rolls back the entire import.

This decision does **not** change Warehouse Batch Transfer semantics. Batch Transfer remains per-item / partial success as separately approved.

## Export

`تصدير الرصيد` exports the current opening-balance operation to an import-compatible `Opening Stock` worksheet using the same four columns.

For an already-posted opening balance, the export prefers the stored Opening Balance LOT `issueUnitCost` so a later change in the aggregate Inventory average cost does not rewrite the historical opening cost in the export.

## Explicit non-scope

- No historical inventory cleanup or backfill.
- No revaluation of old inventory.
- No historical renumbering.
- No production Cutover is executed by this feature.
- No new DB table or schema migration is required.
- No change to Centralized Document Numbering.
- LOT numbering/QR creation continues through the existing approved settlement/Lot workflow.

## Files

- `client/src/components/inventory/OpeningBalanceBulkExcel.tsx`
- `client/src/pages/inventory/InventoryOperations.tsx`
- `server/services/inventory/openingBalanceBulkExcel.service.ts`
- `server/routers/inventory/inventoryCount.router.ts`
- `server/tests/openingBalanceBulkExcelImport.test.ts`

