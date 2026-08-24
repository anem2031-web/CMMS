# CMMS — MAIN PHASE 6 INVENTORY / ACCOUNTING REPORTS — APPROVED SCOPE

**Date:** 2026-08-23  
**Status:** **SCOPE APPROVED / DOCUMENTED — IMPLEMENTATION NOT STARTED**  
**Official stop before implementation:** after Main Phase 5 official closure and before starting Main Phase 6 / 6.1.

## 1. Purpose

Main Phase 6 converts the inventory data already produced by the accepted operational workflows into a coherent reporting area for warehouse, management, and accounting review.

This phase is a **reporting/read-oriented addition** to the current system. It does not redesign Receipt, Issue/Delivery, Return, Disposal, Warehouse Transfer, Inventory Count, Settlement, or Reconciliation workflows.

The approved UX principle is:

> **One Inventory Reports Center → a small number of clear report groups → shared filters and consistent terminology.**

Do not scatter the approved reports across many unrelated navigation entries or duplicate the same reporting logic in multiple pages.

## 2. Approved Reports Center structure

Create one main entry:

**مركز التقارير المخزنية**

The Center groups reports into four logical areas.

### 2.1 الرصيد والحالة

Purpose: answer **what stock exists now, where it exists, and what current stock conditions need attention**.

Approved contents:

- **رصيد المخزون — Stock Balance**
- **الحد الأدنى للمخزون — Minimum Stock**
- **المخزون الصفري / السالب — Zero / Negative Stock**

`Stock Balance` is the primary report of this group and should provide drill-through/navigation to more detailed item movement information where appropriate instead of creating unnecessary duplicate navigation.

### 2.2 الحركات والتتبع

Purpose: answer **what happened to inventory**.

Approved contents:

- **بطاقة الصنف — Stock Card**
- **الحركات — Transactions** with common filtering by date, warehouse, item, movement type, and document/reference where supported
- views/filters for:
  - Receipts
  - Issues / Deliveries
  - Returns
  - Transfers
  - Disposal
  - Inventory adjustments / settlement-related movements where represented by the accepted data model

Design rule: do not create a separate disconnected page for every movement family when the same movement report can expose the result through a movement-type filter. `Stock Card` remains a focused item timeline view.

### 2.3 القيمة والمحاسبة

Purpose: answer **what the current inventory is worth and where that value is concentrated**.

Approved contents:

- **تقييم المخزون — Inventory Valuation**
- **قيمة المخزون حسب المخزن — Value by Warehouse**
- **قيمة المخزون حسب التصنيف — Value by Category**
- **فروقات المخزون — Inventory Variance** as a reporting/read view where supported by accepted inventory/count/reconciliation data

Important boundary: Main Phase 6 consumes the currently accepted quantity/cost/value behavior. It must not silently redesign accounting valuation or create the future Inventory Posting Engine. Posting-engine architecture remains Main Phase 7.

### 2.4 التحليل والتخطيط — DOCUMENTED FOR LATER / EXECUTE LAST

Purpose: answer **what requires a management decision based on inventory behavior over time**.

Approved future analytical views:

- **Slow Moving Inventory — الحركة البطيئة**
- **Dead Moving Inventory — المخزون الراكد**
- **ABC Analysis — ABC**
- **Inventory Aging — الأعمار**
- **Inventory Turnover — معدل الدوران**

These analytical reports are intentionally **low priority for the current Main Phase 6 execution order**.

Owner decision:

> **Document them now, but do not build them at the beginning of Main Phase 6. They are to be implemented last, after the core balance/movement and valuation/accounting reports are completed and accepted.**

When implementation eventually reaches this group, prefer one page named **تحليل المخزون** with small tabs:

- الحركة البطيئة
- المخزون الراكد
- ABC
- الأعمار
- معدل الدوران

Do not create five scattered top-level pages unless the owner later approves a different UX.

## 3. Shared report behavior and unified report toolbar — APPROVED REQUIRED FOUNDATION

The owner explicitly approved a **single, consistent reporting interaction model** across Main Phase 6. This is part of **6.1 — Reports Foundation & Unified Reports Center** and is not an optional polish item to be added differently by each report.

### 3.1 Shared filters

Common filters should be reused where applicable:

- date range
- warehouse
- item
- category

Additional filters may be added only where the report needs them, for example movement type or document/reference for movement reports.

### 3.2 Unified toolbar — no scattered actions

Every Main Phase 6 report should use the same clear toolbar pattern. Avoid placing unrelated export/print/reset buttons in random locations or using a different control arrangement per report.

Approved conceptual layout:

```text
[ تحديث ]  [ إعادة تعيين الفلاتر ]   |   [ طباعة ]  [ تصدير ▼ ]
```

The **تصدير** menu should group export actions instead of scattering separate buttons:

- **تصدير Excel**
- **تصدير PDF**

The exact visual implementation may follow the project's existing component system, but the hierarchy and terminology should remain consistent.

### 3.3 Generated-at date/time

Each generated report must show the report generation date/time clearly using the same terminology across reports, for example:

**تاريخ ووقت إنشاء التقرير**

This timestamp should also be included in exported/printed output where practical.

### 3.4 Reset Filters

**إعادة تعيين الفلاتر** resets the report filters to their defined default state only. It must not alter inventory/business data.

### 3.5 Export must respect the current report scope

Excel/PDF/print output must represent the same report result/filter scope the user is reviewing. Do not silently export all records when the on-screen report is filtered to a warehouse, period, item, category, movement type, or other supported filter.

### 3.6 Excel export — organized, formatted and analysis-friendly

Excel export is explicitly approved where technically feasible in the current architecture and should be a true `.xlsx` workbook rather than an unformatted CSV substitute.

Approved expectations:

- clear report title;
- report generation date/time;
- concise summary of the active filters;
- organized column order matching the report meaning;
- clear formatted header row;
- sensible column widths;
- freeze header row where useful;
- Auto Filter where useful;
- correct numeric types for quantities, unit costs, averages, and values rather than exporting them as text;
- correct date/date-time cell types where feasible;
- totals/subtotals only where they are meaningful for that report;
- Arabic worksheets/reports should use RTL layout when appropriate while preserving codes/references such as `RCV`, `DLV`, `RTN`, `TRF`, `LOT`, item codes, and source data exactly as stored.

The objective is a workbook that is immediately usable, readable, sortable and printable without manual cleanup.

### 3.7 PDF export — clear professional report output

PDF export is explicitly approved as a common report capability. The shared PDF template should provide:

- clear report title;
- report generation date/time;
- active filter summary;
- readable table layout;
- repeated table headers across pages where the report spans multiple pages;
- page numbering where appropriate;
- appropriate portrait/landscape choice based on report width;
- correct Arabic RTL rendering and robust mixed Arabic/English text handling.

### 3.8 Mixed-language / hybrid data rule

Exports must not corrupt or force-translate source data.

- UI/report labels and column headings follow the active interface/report language.
- Item names, document numbers, lot codes, internal codes, manufacturer names, and other source data remain as stored.
- Arabic and English may legitimately appear together in the same report. The export renderer must preserve readable direction/alignment without reversing codes or damaging mixed text.

### 3.9 Printing

**طباعة** should reuse the same report presentation principles as PDF as much as practical so printed output and PDF do not become two unrelated designs.

### 3.10 Reuse, not per-report duplication

6.1 should establish reusable reporting/export foundations where appropriate, for example shared concepts/components/utilities equivalent to:

- report toolbar;
- shared filter controls/model;
- generated-at header;
- Excel export utility/template;
- PDF/print template.

Exact filenames/component names are implementation details and are not prescribed by this scope document. The requirement is architectural reuse and visual consistency rather than duplicated export logic inside every report.

The normal reporting flow is therefore approved as:

**filters → display/review report → reset/refresh as needed → print or export the same scoped result**.

## 4. Relationship with Main Phase 5.4 Reconciliation

Do not rebuild Inventory Reconciliation inside Main Phase 6.

- **Main Phase 5.4 / تقرير مطابقة المخزون** answers: *Are the current supported inventory structures internally consistent?*
- **Main Phase 6** answers: *What do the accepted inventory data tell warehouse, management, and accounting users?*

The Reports Center may later provide a navigation link to **تقرير مطابقة المخزون**, but must not duplicate its reconciliation engine or add repair actions.

## 5. Approved implementation sequence

Main Phase 6 is approved to be organized as:

### 6.1 — Reports Foundation & Unified Reports Center

- reports-center shell/navigation
- common report UX conventions
- shared filter model/components where useful
- **unified report toolbar**: تحديث + إعادة تعيين الفلاتر + طباعة + grouped تصدير menu
- **Excel `.xlsx` export foundation** with organized formatting, numeric/date typing, filter context, and Arabic/RTL handling
- **PDF/print foundation** with consistent report header, generated-at timestamp, filter context, pagination/table-header handling, and mixed Arabic/English support
- reusable generated-at date/time presentation
- exports/print must respect the current report filters/scope
- confirm existing reporting/backend capabilities before duplicating them
- no change to operational inventory workflows

### 6.2 — Stock Balance & Movement Reports

Core operational reporting, including:

- Stock Balance
- Stock Card
- Transactions
- Receipt / Issue / Return / Transfer / Disposal / adjustment views through the unified movement reporting approach
- Minimum Stock
- Zero / Negative Stock

### 6.3 — Inventory Valuation & Accounting Reports

Core financial/read reporting, including:

- Inventory Valuation
- Value by Warehouse
- Value by Category
- Inventory Variance

### 6.4 — Inventory Analytics & Planning Reports — EXECUTE LAST / LOW PRIORITY

Documented and approved for later execution only after 6.1–6.3 are completed/accepted:

- Slow Moving
- Dead Moving
- ABC Analysis
- Aging
- Inventory Turnover

Preferred UX when reached: one **تحليل المخزون** page with tabs rather than five scattered report pages.

### 6.5 — Runtime UAT & Main Phase 6 Closure

Final deployed Runtime verification and documentation/closure after all then-approved Main Phase 6 scope is complete.

## 6. Change-control boundaries

Main Phase 6 does **not** approve:

- Historical Backfill or Legacy Cleanup
- historical data repair/revaluation
- Auto-fix from reports
- inventory quantity/cost/value posting redesign
- Main Phase 7 Inventory Posting Engine work
- Centralized Document Numbering / `receipt_number_counter`
- historical renumbering
- Batch Transfer all-or-nothing redesign
- changing Receipt / Issue / Return / Disposal / Transfer / Count / Settlement workflows
- Production Cutover or deleting/resetting experimental inventory data

Old/experimental data remains untouched under the owner's existing future-facing policy.

## 7. Current official status

```text
Main Phase 5
= COMPLETE / OFFICIALLY CLOSED

Main Phase 6 — Inventory / Accounting Reports
= SCOPE APPROVED / DOCUMENTED
= IMPLEMENTATION NOT STARTED

6.1 — Reports Foundation & Unified Reports Center
= NOT STARTED

6.2 — Stock Balance & Movement Reports
= NOT STARTED

6.3 — Inventory Valuation & Accounting Reports
= NOT STARTED

6.4 — Inventory Analytics & Planning Reports
= DOCUMENTED FOR LATER / EXECUTE LAST / NOT STARTED

6.5 — Runtime UAT & Main Phase 6 Closure
= NOT STARTED
```

**Official stop:** before 6.1. Do not begin Main Phase 6 implementation without a new explicit owner instruction.

## 8. Subsequent implementation status update

This file remains the approved pre-implementation scope record. Later on 2026-08-23, the owner explicitly instructed the project to begin **6.1 — Reports Foundation & Unified Reports Center**.

Current implementation status is tracked in:

`docs/CMMS_MAIN_PHASE6_STEP6_1_REPORTS_FOUNDATION_IMPLEMENTATION_2026-08-23.md`

The approved scope itself is unchanged; only the historical `IMPLEMENTATION NOT STARTED` checkpoint in this document has been superseded by the explicit 6.1 start.

## 9. Subsequent status update — 6.1 closed / 6.2 scope approved

Later on 2026-08-23, **6.1 — Reports Foundation & Unified Reports Center** passed targeted tests and deployed Runtime verification and was **OFFICIALLY CLOSED**.

The owner then approved the detailed execution scope for **6.2 — Stock Balance & Movement Reports** as four checkpoints:

```text
6.2.1 — Stock Balance & Status
6.2.2 — Stock Card & Unified Movement Report
6.2.3 — Unified Export & Review
6.2.4 — Runtime UAT & Closure
```

Reference: `docs/CMMS_MAIN_PHASE6_STEP6_2_STOCK_BALANCE_MOVEMENT_REPORTS_APPROVED_SCOPE_2026-08-23.md`.

**Current status at this checkpoint:** Main Phase 6 = IN PROGRESS; 6.1 = OFFICIALLY CLOSED; 6.2 = SCOPE APPROVED / DOCUMENTED — IMPLEMENTATION NOT STARTED; official stop before 6.2.1.

