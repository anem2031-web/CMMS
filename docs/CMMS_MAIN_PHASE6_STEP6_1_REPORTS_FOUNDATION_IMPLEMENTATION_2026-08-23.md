# CMMS — MAIN PHASE 6 / 6.1 — REPORTS FOUNDATION & UNIFIED REPORTS CENTER — IMPLEMENTATION

**Date:** 2026-08-23  
**Status:** **IMPLEMENTED / TARGETED TESTS PASSED / DEPLOYED RUNTIME VERIFICATION PASSED / OFFICIALLY CLOSED**  
**Main Phase 6:** **IN PROGRESS**  
**Next step after official 6.1 closure:** **6.2 — Stock Balance & Movement Reports — NOT STARTED**

## 1. Purpose

6.1 implements the shared reporting foundation approved before Main Phase 6 started. It does **not** build the actual Stock Balance, Stock Card, Transactions, Valuation, or Analytics reports yet.

The goal is to prevent each later report from creating a different toolbar/export/print implementation and to avoid scattering inventory reports across unrelated top-level pages.

## 2. Existing project capabilities inspected before implementation

The implementation reuses the current project rather than replacing working infrastructure:

- `exceljs` already exists in `package.json` and is already used by existing export services.
- the project already has an authenticated download pattern and `file-saver`/browser download patterns;
- `server/services/pdf/htmlToPdfService.ts` already provides the shared Puppeteer/Chromium HTML-to-PDF renderer and the Docker image already installs Chromium + Arabic Noto fonts;
- existing legacy/general report pages under `/reports` remain untouched;
- Main Phase 5.4 `Inventory Reconciliation` remains a separate read-only control and is linked from the new Inventory Reports Center rather than duplicated.

No new reporting dependency was added.

## 3. Unified Inventory Reports Center

New page:

```text
/inventory/reports
```

Navigation label:

```text
مركز التقارير المخزنية
```

The center presents the approved Main Phase 6 organization in one place:

1. **الرصيد والحالة** — planned for 6.2.
2. **الحركات والتتبع** — planned for 6.2.
3. **القيمة والمحاسبة** — planned for 6.3.
4. **التحليل والتخطيط** — explicitly deferred / execute last in 6.4.

A direct link to the already-closed **تقرير مطابقة المخزون** is provided without rebuilding the reconciliation engine.

No 6.2/6.3/6.4 report data query is introduced by the center itself.

## 4. Shared report UI foundation

Reusable components were added:

- `ReportToolbar`
  - `تحديث`
  - `إعادة تعيين الفلاتر`
  - visual separator
  - `طباعة`
  - grouped `تصدير` menu
    - `تصدير Excel`
    - `تصدير PDF`
  - missing actions remain disabled rather than causing each report to invent a different toolbar layout.

- `ReportFiltersBar`
  - shared visual shell for report-specific filters;
  - does not prescribe business filters that belong to 6.2/6.3.

- `ReportGeneratedAt`
  - common generated-at date/time presentation;
  - supports Arabic / English / Urdu locale formatting.

## 5. Shared client download foundation

`client/src/lib/reportExport.ts` provides reusable authenticated report download/open helpers.

Important behavior:

- current report-specific endpoints remain responsible for authorization;
- report filters are passed as query parameters only when defined;
- filenames from `Content-Disposition`, including RFC 5987 UTF-8 filenames, are supported;
- no report data is mutated by these helpers.

## 6. Shared server export foundation

`server/services/reports/reportExportFoundation.ts` establishes the reusable export layer for later report-specific endpoints.

### 6.1 Excel `.xlsx`

Uses the project's existing `exceljs` dependency and supports:

- real `.xlsx` output;
- report title;
- generated date/time;
- active-filter summary;
- typed numeric/quantity/currency/date/date-time cells;
- logical column definitions and bounded widths;
- styled headers and alternating readable rows;
- Auto Filter;
- frozen report header/data heading area;
- A4 print setup with automatic portrait/landscape default based on report width;
- RTL worksheet direction when requested;
- original Arabic/English/Latin source values preserved as values rather than force-translated strings.

### 6.2 PDF / Print HTML

A single HTML report template is shared by PDF/print-oriented report endpoints:

- uses the existing `htmlToPdfService` for PDF generation;
- no second PDF rendering stack is introduced;
- A4 portrait/landscape handling;
- repeated table header behavior for paged output;
- report title + generation time + active filters;
- RTL/LTR support;
- `dir="auto"` / `bdi` isolation for mixed Arabic/English source data and document/Lot codes;
- HTML escaping of source values before rendering;
- no force-translation of stored data.

### 6.3 Unicode filenames

The foundation provides RFC 5987-compatible `Content-Disposition` construction so Arabic/Urdu report filenames can be delivered without relying on ASCII-only filenames.

## 7. Languages

The Reports Center and shared toolbar copy were added consistently for:

- Arabic (`ar`)
- English (`en`)
- Urdu (`ur`)

Translation-key structural parity was checked across all three translation files.

## 8. Permissions / change-control

6.1 does **not** change the central role-access policy in `shared/roles.ts` and does not broaden an existing inventory role family.

The new navigation entry is limited to existing relevant warehouse/accounting/management roles that are not currently denied by the `/inventory` path policy. Later report data endpoints must enforce their own server-side authorization when 6.2/6.3 are implemented.

## 9. Explicit boundaries preserved

No change in 6.1 to:

- Live DB / Schema / migrations;
- Receipt / Issue / Return / Disposal / Transfer / Count / Settlement workflows;
- Accounting posting or valuation behavior;
- Historical data;
- Centralized Document Numbering / `receipt_number_counter`;
- Batch Transfer all-or-nothing semantics;
- Main Phase 7 Inventory Posting Engine;
- Production Cutover;
- 6.2 / 6.3 / 6.4 report business logic.

## 10. Targeted verification performed before delivery

Passed locally against the supplied source snapshot:

- TypeScript syntax/transpile check for every changed/new TS/TSX file;
- Arabic/English/Urdu translation-key structural parity check;
- route/navigation source linkage check;
- source inspection confirms the new report foundation contains no inventory DB mutation or repair path;
- mixed-language HTML template generation was exercised directly from the implemented source and preserved values such as `LOT-2026-...` beside Arabic text;
- Unicode filename / RFC 5987 header generation was exercised directly from the implemented source.

### Environment limitation

The uploaded project snapshot does not contain `node_modules`, so full project `tsc --noEmit` and the ExcelJS/Vitest runtime test were **not claimed** in this environment. A targeted test file was added for execution after extraction on the owner's installed project.

A local PDF visual-render attempt could not be completed in this tool environment because the available Playwright browser bundle was absent and direct system Chromium did not complete under the container DBus environment. This is **not** reported as a PDF Runtime PASS. The deployed project already has its own Chromium/Noto-Arabic Docker runtime; PDF Runtime acceptance remains for later report-specific UAT.

## 11. Historical deployed verification gate before official 6.1 closure

After extraction and application restart:

1. open **مركز التقارير المخزنية**;
2. verify the four grouped sections appear as documented and 6.4 is visibly deferred;
3. verify the link to **تقرير مطابقة المخزون** works;
4. run the targeted Phase 6.1 test if the installed project environment supports it.

Before Runtime acceptance, the status was:

```text
Main Phase 6 = IN PROGRESS
6.1 = IMPLEMENTED / TARGETED SOURCE CHECKS PASSED / RUNTIME VERIFICATION PENDING
6.2 = NOT STARTED
6.3 = NOT STARTED
6.4 = DOCUMENTED FOR LATER / EXECUTE LAST / NOT STARTED
6.5 = NOT STARTED
```

This historical gate was later satisfied and is superseded by the official Runtime closure section at the end of this document.

---

## Runtime correction — report-center actions were initially visual only

During the first runtime UI verification, the Reports Center rendered labels for `تحديث / إعادة تعيين الفلاتر / طباعة / تصدير Excel / تصدير PDF`, but those labels were not connected to real handlers on the center page. This is a blocking 6.1 foundation defect and **6.1 remains open until the corrected actions are verified at runtime**.

The correction keeps the approved organized toolbar pattern:

`تحديث | إعادة تعيين الفلاتر | طباعة | تصدير ▼ (Excel / PDF)`

The center now uses the shared `ReportToolbar` component and real authenticated foundation-preview endpoints. The preview intentionally exports only the four approved report groups because report-specific data belongs to 6.2+.

Runtime expectations after applying the correction:

- `تحديث` refreshes the generated-at timestamp and gives visible confirmation.
- `إعادة تعيين الفلاتر` gives visible confirmation; the center currently has no report-specific filters, so it confirms the default state rather than changing business data.
- `طباعة` opens an authenticated RTL print view.
- `تصدير Excel` downloads a real formatted `.xlsx` foundation-preview file.
- `تصدير PDF` downloads a real RTL PDF foundation-preview file.
- No DB mutation, workflow change, accounting change, or Phase 6.2 report implementation is introduced by this correction.


---

## Official Runtime closure — 2026-08-23

After the initial visual-only action defect was corrected, the owner verified the deployed Reports Center actions at Runtime. The targeted export test passed `4/4`; the targeted functional-actions test passed `3/3`; Refresh, Reset Filters, Print, Excel export and PDF export were confirmed working; generated Excel/PDF files were supplied for review.

**6.1 = COMPLETE / TARGETED TESTS PASSED / RUNTIME VERIFICATION PASSED / OFFICIALLY CLOSED.**

Closure reference: `docs/CMMS_MAIN_PHASE6_STEP6_1_REPORTS_FOUNDATION_RUNTIME_UAT_CLOSURE_2026-08-23.md`.

**Current stop:** before 6.2. Do not start 6.2 automatically.
