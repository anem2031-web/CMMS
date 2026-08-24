# CMMS — MAIN PHASE 6 — UNIFIED REPORT TOOLBAR & EXPORT STANDARD — APPROVED

**Date:** 2026-08-23  
**Status:** **APPROVED / DOCUMENTED — IMPLEMENTATION NOT STARTED**  
**Applies to:** Main Phase 6, primarily **6.1 — Reports Foundation & Unified Reports Center**

## 1. Decision

The owner approved a single shared report-toolbar and export standard for Main Phase 6. The purpose is to prevent scattered, inconsistent buttons and to ensure every report produces organized, readable output.

This documentation does **not** start 6.1 and does not add code, SQL, migrations, or data changes.

## 2. Approved toolbar organization

Use one consistent toolbar pattern across reports:

```text
[ تحديث ]  [ إعادة تعيين الفلاتر ]   |   [ طباعة ]  [ تصدير ▼ ]
```

The **تصدير** menu groups:

- **تصدير Excel**
- **تصدير PDF**

Do not scatter Excel/PDF/Print/Reset actions around the page or use a different arrangement for every report without an approved reason.

## 3. Common report metadata

Every report should clearly expose **تاريخ ووقت إنشاء التقرير**. The same information should be carried into print/PDF/Excel output where practical.

## 4. Filter behavior

- Shared filters are reused where applicable.
- **إعادة تعيين الفلاتر** returns only the filters to the defined default state.
- Print and export must use the same active report/filter scope the user is reviewing; they must not silently export unrelated/all data.

## 5. Excel standard

Excel export is approved as a real `.xlsx` output where technically feasible. Expected quality:

- report title;
- generation date/time;
- active filter summary;
- logical column order;
- formatted headers;
- sensible widths;
- freeze header row and Auto Filter where useful;
- quantities/costs/values exported as numeric cells, not strings;
- dates exported as proper date/date-time cells where feasible;
- meaningful totals only where appropriate;
- RTL worksheet/report orientation for Arabic output where appropriate;
- preserve English document/lot/reference codes exactly as stored.

The exported workbook should be clean enough for immediate business use without manual reformatting.

## 6. PDF / printing standard

PDF should be clear and professionally structured:

- report title;
- generation date/time;
- active filters;
- readable tables;
- repeated table headers across pages when needed;
- page numbering where useful;
- portrait/landscape chosen sensibly by report width;
- correct RTL Arabic and mixed Arabic/English rendering.

Printing should reuse the same visual/reporting principles as PDF instead of becoming a separate unrelated design.

## 7. Mixed-language rule

Reports can legitimately contain Arabic and English together.

- Labels/headings follow the report/interface language.
- Source data remains unchanged.
- Do not force-translate item names, internal codes, document numbers, Lot codes, manufacturer names, or other stored values.
- Do not reverse or corrupt Latin codes inside Arabic layouts.

## 8. Architectural rule

Build the shared reporting/export foundation in 6.1 so later reports reuse it. Do not independently recreate Excel/PDF/Print logic inside each report. Exact component/function names are left to implementation after inspection of the latest project architecture.

## 9. Boundaries

This decision does not approve:

- changing inventory workflow or accounting behavior;
- Auto-fix;
- Historical Backfill/Cleanup/Revaluation;
- Centralized Numbering;
- Production Cutover;
- starting 6.1 automatically.

## 10. Current stop

```text
Main Phase 6
= SCOPE APPROVED / DOCUMENTED
= IMPLEMENTATION NOT STARTED

6.1 — Reports Foundation & Unified Reports Center
= NOT STARTED
```

The next implementation step remains **6.1**, and it begins only after a new explicit owner instruction.

## 11. Subsequent implementation status update

This file remains the approval record for the toolbar/export standard. Later on 2026-08-23, the owner explicitly started **6.1**, and the shared toolbar/export foundation was implemented against the then-current project source.

Current status/evidence is tracked in:

`docs/CMMS_MAIN_PHASE6_STEP6_1_REPORTS_FOUNDATION_IMPLEMENTATION_2026-08-23.md`

The standard defined above remains the controlling design requirement.

