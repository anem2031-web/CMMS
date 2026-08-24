# CMMS — MAIN PHASE 6 / 6.2 STOCK BALANCE & MOVEMENT REPORTS — APPROVED SCOPE

**Date:** 2026-08-23  
**Status:** **SCOPE APPROVED / DOCUMENTED — IMPLEMENTATION NOT STARTED**  
**Official stop:** after **6.1 Reports Foundation & Unified Reports Center official closure** and before starting **6.2.1**.

## 1. Purpose

6.2 is the first Main Phase 6 step that builds real operational inventory reports on top of the shared Reports Foundation closed in 6.1.

It must answer two simple operational questions from one coherent reporting area:

> **What stock exists now?**  
> **What happened to that stock?**

6.2 is reporting/read-only scope. It does not post, repair, recalculate, backfill, clean, or redesign inventory data/workflows.

## 2. UX / organization principle

Do **not** scatter operational inventory reporting into many unrelated pages or navigation entries.

Within **مركز التقارير المخزنية**, 6.2 activates two clear groups:

1. **الرصيد والحالة**
2. **الحركات والتتبع**

The shared toolbar/export/filter conventions already closed in 6.1 must be reused rather than rebuilt per report.

## 3. Approved 6.2 execution breakdown

```text
6.2.1 — Stock Balance & Status
6.2.2 — Stock Card & Unified Movement Report
6.2.3 — Unified Export & Review
6.2.4 — Runtime UAT & Closure
```

The substeps are execution checkpoints inside 6.2. They do not change the Main Phase 6 roadmap outside this approved scope.

## 4. 6.2.1 — Stock Balance & Status

### 4.1 Purpose

Provide the primary current-state operational report answering:

- what item is in stock;
- in which warehouse;
- current quantity;
- unit of measure;
- current status requiring attention.

### 4.2 Approved report content

The primary **رصيد المخزون — Stock Balance** view may show, where supported by the actual current project/Live DB data model:

- Item name
- Internal/item code
- Warehouse
- Quantity
- Unit of measure
- Current average cost
- Current inventory value
- Minimum stock threshold
- Status

Showing current cost/value columns in Stock Balance is allowed as useful current-state context. **Financial valuation analysis, grouping and accounting-focused reporting remain 6.3 scope** and must not be duplicated or redesigned here.

### 4.3 Status views

The same coherent **الرصيد والحالة** reporting area should support views/filters for:

- All stock
- Minimum Stock / below minimum
- Zero Stock
- Negative Stock

Negative Stock is a review indicator only. The report must not fix or update quantity.

### 4.4 Lots

For Lot-tracked inventory, Lot detail should be available where useful without overcrowding the primary Stock Balance table.

Preferred behavior:

- primary report stays inventory/warehouse oriented;
- user may drill into Lot detail when needed;
- Lot detail may include Lot Code, warehouse allocation and quantity where supported;
- do not duplicate the Main Phase 5.4 reconciliation engine.

## 5. 6.2.2 — Stock Card & Unified Movement Report

### 5.1 Stock Card — بطاقة الصنف

Stock Card is a focused timeline for one selected item and should show its accepted inventory movements in chronological order with enough traceability to understand how the stock changed.

Where supported by the actual current data model, useful fields include:

- date/time;
- movement type;
- quantity in/out;
- warehouse;
- document/reference number;
- Lot reference where applicable;
- relevant running/current movement context where safely derivable without inventing historical truth.

Do not perform historical reconstruction/backfill merely to populate a report column.

### 5.2 Unified Movement Report — تقرير الحركات الموحد

Prefer one strong movement report instead of separate disconnected top-level pages for each movement family.

Approved movement filter/view options include:

- All movements
- Receipt
- Issue / Delivery
- Return
- Warehouse Transfer
- Disposal
- Inventory adjustment / settlement-related movement where represented by the accepted current data model

### 5.3 Common movement filters

Reuse common filter conventions from 6.1. Where applicable, support:

- From date
- To date
- Warehouse
- Item
- Movement type
- Document/reference number

Additional filters require a real report need; do not add unrelated controls for visual complexity.

## 6. 6.2.3 — Unified Export & Review

6.2.3 does **not** rebuild the export foundation. It applies and verifies the **already closed 6.1 shared foundation** across the new 6.2 reports.

Every applicable 6.2 report must use the organized shared actions:

```text
تحديث | إعادة تعيين الفلاتر | طباعة | تصدير ▼
                                           ├─ تصدير Excel
                                           └─ تصدير PDF
```

Requirements already approved in 6.1 remain mandatory:

- export/print respects the current report filters;
- `.xlsx` is a real organized workbook, not CSV substitution;
- numeric/date cells stay analysis-friendly where feasible;
- Arabic/RTL is preserved;
- mixed Arabic/English source values and codes remain readable and unforced-translated;
- PDF/Print are clear and consistent;
- **تاريخ ووقت إنشاء التقرير** is shown consistently;
- Reset Filters changes report filter state only and never business data.

6.2.3 must review the output using actual 6.2 report data, not only the generic 6.1 foundation preview.

## 7. 6.2.4 — Runtime UAT & Closure

Before 6.2 closes, deployed Runtime UAT should verify the actual reports against the current Live DB.

Minimum acceptance areas:

- Stock Balance loads and reflects current supported stock data;
- warehouse/item filters behave correctly;
- Minimum / Zero / Negative status views are logically correct for the returned rows;
- Stock Card shows the selected item's supported movement history correctly;
- Unified Movement Report filters movement types/date/warehouse/item/reference correctly where implemented;
- Lot detail, when shown, maps to the supported current Lot model without assuming uncertain Live DB columns;
- Refresh / Reset Filters operate correctly;
- Print works;
- Excel exports a readable organized `.xlsx` using the current filtered report data;
- PDF exports a readable Arabic/RTL/mixed-language report using the current filtered report data;
- no report action mutates Live DB.

Where a factual report total or row mapping needs Live DB verification, follow the established rule: **one read-only SQL command at a time**, executed manually by the owner.

## 8. Data / change-control boundaries

6.2 must not introduce:

- inventory quantity/cost/value mutation;
- Auto-fix;
- Historical Backfill;
- Legacy Cleanup;
- historical transaction reconstruction merely to make old experimental data look complete;
- accounting valuation redesign;
- Main Phase 7 Posting Engine work;
- Centralized Document Numbering / `receipt_number_counter`;
- historical renumbering;
- Workflow redesign;
- Batch Transfer all-or-nothing redesign;
- Production Cutover or deletion/reset of experimental inventory data.

Old/experimental data remains untouched. The owner is future-focused; 6.2 reports current accepted data without attempting to repair the past.

## 9. Source-of-truth rule

- Latest project code/docs = truth for what is implemented.
- Live DB = truth for actual DB structure/state/data.
- Project Schema remains a code model only.

Do not make report SQL/query assumptions from Schema alone when Live DB structure is uncertain.

## 10. Relationship with adjacent phases

- **6.1** = shared Reports Center / toolbar / filters / Excel / PDF / Print foundation — **OFFICIALLY CLOSED**.
- **6.2** = operational stock balance, status and movement reporting — this approved scope.
- **6.3** = financial valuation/accounting-oriented reports — do not pull its analytics into 6.2.
- **6.4** = Slow/Dead Moving, ABC, Aging, Turnover — **execute last / low priority**.
- **6.5** = final Main Phase 6 Runtime UAT & closure after all then-approved Main Phase 6 scope is complete.

## 11. Current official status after this approval

```text
Main Phase 6 — Inventory / Accounting Reports
= IN PROGRESS

6.1 — Reports Foundation & Unified Reports Center
= COMPLETE / TARGETED TESTS PASSED / RUNTIME VERIFIED / OFFICIALLY CLOSED

6.2 — Stock Balance & Movement Reports
= IN PROGRESS

  6.2.1 — Stock Balance & Status
  = IMPLEMENTED / TARGETED SOURCE CHECKS PASSED / RUNTIME VERIFICATION PENDING

  6.2.2 — Stock Card & Unified Movement Report
  = NOT STARTED

  6.2.3 — Unified Export & Review
  = NOT STARTED

  6.2.4 — Runtime UAT & Closure
  = NOT STARTED

6.3 — Inventory Valuation & Accounting Reports
= NOT STARTED

6.4 — Inventory Analytics & Planning Reports
= DOCUMENTED FOR LATER / EXECUTE LAST / NOT STARTED

6.5 — Runtime UAT & Main Phase 6 Closure
= NOT STARTED
```

**Historical approved-scope stop:** before 6.2.1. **Current stop:** after 6.2.1 implementation and before deployed Runtime verification/closure; 6.2.2 remains NOT STARTED.

## 12. 6.2.1 implementation checkpoint — 2026-08-23

The owner explicitly started 6.2.1 after approving this scope. The implementation is now present and awaits deployed Runtime verification.

Implemented:

- `/inventory/reports/stock-balance`;
- current Stock Balance table and summary;
- warehouse / item-code-name / stock-status filters;
- Minimum / Zero / Negative operational status views;
- optional Lot drill-down;
- reuse of the 6.1 toolbar and filtered Print/Excel/PDF export foundation.

No DB write, migration, schema change, Auto-fix, historical cleanup/backfill/revaluation, Posting Engine or workflow redesign was introduced.

**6.2.1 = IMPLEMENTED / TARGETED SOURCE CHECKS PASSED / DEPLOYED RUNTIME VERIFICATION PENDING.**

Reference: `docs/CMMS_MAIN_PHASE6_STEP6_2_1_STOCK_BALANCE_STATUS_IMPLEMENTATION_2026-08-23.md`.
