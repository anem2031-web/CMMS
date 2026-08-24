# Main Phase 6 / 6.2.3 — Unified Export & Review — Implementation Checkpoint

**Date:** 2026-08-23  
**Status:** IMPLEMENTED / TARGETED SOURCE CHECKS PASSED / DEPLOYED RUNTIME VERIFICATION PENDING  
**Current stop after this package:** deploy and verify 6.2.3; **do not start 6.2.4 automatically**.

## Purpose

6.2.3 does not build another report screen or another export architecture. It reviews and hardens the already closed 6.1 shared reporting foundation as used by the two real 6.2 reports:

- `6.2.1 — Stock Balance & Status`
- `6.2.2 — Stock Card & Unified Movement Report`

The approved common behavior remains:

```text
تحديث | إعادة تعيين الفلاتر | طباعة | تصدير ▼
                                           ├─ Excel
                                           └─ PDF
```

## Implementation / review completed

1. Confirmed both 6.2 pages use the same shared `ReportToolbar`, `ReportGeneratedAt`, authenticated download helper and print-view helper.
2. Confirmed report-specific Excel/PDF/Print endpoints reuse the same read-only report service and the same filter contract as the on-screen report.
3. Added cross-report targeted coverage for:
   - common RTL/Arabic export behavior;
   - same generated-at semantics;
   - structured XLSX generation;
   - printable RTL HTML generation;
   - mixed Arabic/Latin document and Lot codes;
   - active-filter metadata;
   - shared toolbar / reset / export plumbing on both pages.
4. Hardened the Unified Movement / Stock Card export filter summary so a selected warehouse is exported as a readable warehouse label (`code + name`) rather than a raw numeric `warehouseId` when warehouse metadata is available.
5. The movement report result now carries the read-only warehouse metadata already loaded by its meta query so export formatting can use the same user-facing warehouse identity.

## Change-control boundaries preserved

- No Live DB write.
- No SQL or Migration.
- No Inventory quantity/cost/value mutation.
- No Historical Backfill, Legacy Cleanup or Revaluation.
- No new report business scope beyond 6.2.1/6.2.2.
- No Accounting/Posting Engine/Workflow/Numbering change.
- No new export architecture; 6.1 remains the single shared foundation.

## Targeted checks in packaging environment

- TypeScript/TSX syntax/transpile for modified files: PASS.
- Static read-only/source review: PASS.
- Cross-report test added: `server/tests/unifiedReportExportReviewPhase6Step2_3.test.ts`.
- Full deployed Vitest/runtime export verification is **not claimed** until run in the owner's project.

## Required deployed verification before closure

Run:

```bash
pnpm exec vitest run server/tests/unifiedReportExportReviewPhase6Step2_3.test.ts
```

Then verify with **actual 6.2 report data**:

1. Stock Balance: apply a visible filter and export Excel + PDF; confirm exported rows/filter summary match the active report.
2. Unified Movement Report: apply a warehouse + movement-type filter and export Excel + PDF; confirm the warehouse appears by readable code/name and the exported rows match the active filter.
3. Stock Card: select one item and export Excel/PDF; confirm the title identifies the Stock Card/item and only that selected item history is included.
4. Print preview on at least one 6.2 report remains readable RTL/mixed-language and shows report generated date/time.

Only after those Runtime checks pass may `6.2.3` be officially closed. `6.2.4` remains NOT STARTED until then.
