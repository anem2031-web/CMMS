# CMMS — MAIN PHASE 6 / 6.3 INVENTORY VALUATION & ACCOUNTING REPORTS — APPROVED SCOPE

**Date:** 2026-08-23  
**Status:** **CURRENT ADDENDUM APPLIES — owner-approved two-part structure; current 6.3.1 CLOSED; current 6.3.2 IMPLEMENTED / VERIFICATION PENDING**  
**Official stop:** current 6.3.2 is implemented in code; final 6.3 Runtime UAT/closure is pending. See §15 for the current numbering.

## 1. Purpose

6.3 builds the financial/value-oriented inventory reports on top of the shared Reports Foundation closed in 6.1 and the operational report set closed in 6.2.

It must answer four practical questions without changing inventory/accounting behavior:

> **What is the current stored value of inventory?**  
> **How is that value distributed by warehouse?**  
> **How is that value distributed by item/category?**  
> **Which value/variance conditions need review?**

6.3 is **reporting/read-only scope**. It must not post, revalue, repair, backfill, clean, or redesign inventory/accounting data.

## 2. UX / organization principle

Do **not** create scattered accounting-report pages with different controls or export behavior.

Within **مركز التقارير المخزنية**, 6.3 activates the existing **القيمة والمحاسبة** group and reuses the closed 6.1 report foundation:

- common report toolbar;
- common filters behavior;
- generated-at display;
- Print;
- Excel `.xlsx`;
- PDF;
- Arabic/RTL and mixed Arabic/English handling.

Where multiple views can live coherently in one financial reporting area, prefer tabs/sections over unrelated navigation entries.

## 3. Original approved 6.3 execution breakdown — HISTORICAL / superseded by §15

```text
6.3.1 — Inventory Valuation Report
6.3.2 — Value by Warehouse / Category
6.3.3 — Inventory Variance & Accounting Review
6.3.4 — Runtime UAT & Closure
```

These are execution checkpoints inside 6.3. They do not change the remaining Main Phase 6 roadmap.

## 4. 6.3.1 — Inventory Valuation Report

### 4.1 Purpose

Provide the primary current inventory valuation report using the **current accepted stored inventory value/cost state**.

The report should answer:

- what item currently carries inventory value;
- in which warehouse;
- current quantity;
- current average cost;
- current stored inventory value;
- total value of the active filtered report scope.

### 4.2 Approved fields / presentation

Where supported by the actual current project/Live DB model, useful columns include:

- Item name
- Internal/item code
- Warehouse
- Category where reliably available
- Quantity
- Unit of measure
- Average Cost
- Total Cost Value / current inventory value
- Current status/context where useful without duplicating 6.2

The financial report must use **the current accepted values stored/derived by existing system behavior**. 6.3 must not introduce a new valuation policy or recalculate production data merely to make the report match a theoretical formula.

### 4.3 Totals

The report may provide current-scope totals such as:

- total inventory value for the active filters;
- count of returned inventory rows/items/warehouses where useful;
- value subtotals when logically grouped.

Totals must be based on the same filtered result presented/exported to the user.

## 5. 6.3.2 — Value by Warehouse / Category

### 5.1 Purpose

Allow the owner/management/accounting user to understand **where inventory value is concentrated** without opening many separate reports.

### 5.2 Value by Warehouse

Provide grouped current inventory value by warehouse, using the same current valuation basis as 6.3.1.

Useful outputs may include:

- Warehouse code/name
- Total current quantity context where meaningful
- Total current inventory value
- Share/percentage of total value where safely computed from the active result

No warehouse balance or value is modified by this view.

### 5.3 Value by Category

Provide grouped current inventory value by item/category **only where the current project/Live DB relationship is reliably available**.

Do not guess a category relationship from project Schema alone if Live DB differs. If category mapping is incomplete, the report should handle `Uncategorized / غير مصنف` visibly rather than mutate or backfill data.

Useful outputs may include:

- Category
- Item count
- Current quantity context where useful
- Current inventory value
- Share/percentage of total value where appropriate

### 5.4 Organization

Warehouse and Category value views should remain inside the **القيمة والمحاسبة** reporting area rather than becoming disconnected top-level report pages.

## 6. 6.3.3 — Inventory Variance & Accounting Review

### 6.1 Purpose

Provide a **review report** for financial/value conditions that deserve attention. This is visibility only, not a repair engine.

6.3.3 may surface safely detectable current-state exceptions such as:

- current stored value inconsistent with accepted current quantity/cost state beyond the approved tolerance/rule;
- missing/invalid value/cost fields where the current supported flow expects them;
- inventory rows requiring accounting review based on the implemented report rules;
- links to/reuse of already accepted reconciliation evidence where useful, without rebuilding Main Phase 5.4.

### 6.2 Relationship with Main Phase 5.4

Main Phase 5.4 already owns **Inventory Reconciliation** and remains the authoritative read-only integrity/reconciliation engine for its approved invariants.

6.3.3 must **not duplicate, fork, or silently change** that engine. If useful, it may:

- reference/reuse existing read-only reconciliation results;
- present a financial/accounting-oriented view of relevant exceptions;
- link the user to **تقرير مطابقة المخزون** for integrity details.

### 6.3 No repair behavior

The variance/accounting review must never provide implicit or automatic:

- Revalue / Recalculate
- Fix quantity
- Fix average cost
- Fix total value
- Create missing transaction
- Backfill
- Historical repair

Any future corrective action requires a separate explicit approved change.

## 7. Shared filters / review behavior

Reuse the 6.1 shared conventions. Where applicable, 6.3 reports may filter by:

- Warehouse
- Item / internal code
- Category
- Current status / review condition

Date filters should be used only where the specific report meaning actually depends on a period. **Current valuation is primarily a current-state report**, not a historical ledger reconstruction.

Do not add filters only for visual complexity.

## 8. Print / Excel / PDF requirements

6.3 must reuse the **closed 6.1 shared export foundation** and the export/review behavior already verified in 6.2.

Every applicable 6.3 report must preserve:

```text
تحديث | إعادة تعيين الفلاتر | طباعة | تصدير ▼
                                           ├─ تصدير Excel
                                           └─ تصدير PDF
```

Requirements:

- Print/Excel/PDF respects active report filters;
- Excel output is a real organized `.xlsx` workbook, not CSV substitution;
- monetary values remain numeric/analysis-friendly where feasible;
- columns, headings and totals are organized and readable;
- Arabic/RTL is preserved;
- mixed Arabic/English item names, warehouse codes and source values remain readable without forced translation;
- PDF/Print use the shared readable template;
- report generated-at information follows the existing shared foundation;
- the previously documented Riyadh-time enforcement concern remains **deferred/non-blocking** unless separately reprioritized; this scope does not claim universal `Asia/Riyadh` enforcement.

## 9. 6.3.4 — Runtime UAT & Closure

Before 6.3 closes, deployed Runtime UAT should verify the actual financial reports against current Live DB values.

Minimum acceptance areas:

- Inventory Valuation report loads current supported quantity/cost/value data correctly;
- at least one selected current item/warehouse row is verified against Live DB with **one read-only SQL command at a time** when SQL is needed;
- report totals equal the sum of the active report result;
- Value by Warehouse grouping is correct for verified sample/current result;
- Value by Category grouping handles mapped and unmapped category data without modifying data;
- Variance/Accounting Review does not mutate data and does not duplicate/rewrite 5.4 rules;
- filters work correctly;
- Reset/Refresh work correctly;
- Excel/PDF/Print work and respect active filters;
- no report action writes to Live DB.

## 10. Data / change-control boundaries

6.3 must not introduce:

- update of `averageCost`;
- update of `totalCostValue`;
- inventory quantity mutation;
- Revaluation posting;
- historical valuation recalculation;
- Historical Backfill;
- Legacy Cleanup/repair;
- transaction regeneration;
- accounting posting/redesign;
- Main Phase 7 Posting Engine work;
- Centralized Document Numbering / `receipt_number_counter`;
- historical renumbering;
- Workflow redesign;
- Batch Transfer all-or-nothing redesign;
- Production Cutover or reset/deletion of experimental inventory data.

Old/experimental data remains untouched. 6.3 is future-facing reporting over current accepted system state.

## 11. Source-of-truth rule

- Latest project code/docs = truth for what is implemented.
- Live DB = truth for actual DB structure/state/data.
- Project Schema remains a code model only.

If 6.3 implementation needs uncertain category/value relationships or SQL verification, inspect Live DB first. Do not change Live DB merely to match project Schema.

## 12. Relationship with adjacent steps

- **6.1** = Reports Foundation & Unified Reports Center — **OFFICIALLY CLOSED**.
- **6.2** = Stock Balance & Movement Reports — **OFFICIALLY CLOSED**.
- **6.3** = Inventory Valuation & Accounting Reports — this approved scope.
- **6.4** = Inventory Analytics & Planning Reports — **DOCUMENTED FOR LATER / EXECUTE LAST / LOW PRIORITY**.
- **6.5** = final Runtime UAT & Main Phase 6 closure after all then-approved Main Phase 6 scope is complete.
- **Main Phase 7** remains the place for Inventory Posting Engine work; do not pull it into 6.3.

## 13. Historical official status at original scope approval

```text
Main Phase 6 — Inventory / Accounting Reports
= IN PROGRESS

6.1 — Reports Foundation & Unified Reports Center
= OFFICIALLY CLOSED

6.2 — Stock Balance & Movement Reports
= COMPLETE / OFFICIALLY CLOSED

6.3 — Inventory Valuation & Accounting Reports
= SCOPE APPROVED / DOCUMENTED
= IMPLEMENTATION NOT STARTED

  6.3.1 — Inventory Valuation Report
  = NOT STARTED

  6.3.2 — Value by Warehouse / Category
  = NOT STARTED

  6.3.3 — Inventory Variance & Accounting Review
  = NOT STARTED

  6.3.4 — Runtime UAT & Closure
  = NOT STARTED

6.4 — Inventory Analytics & Planning Reports
= DOCUMENTED FOR LATER / EXECUTE LAST / NOT STARTED

6.5 — Runtime UAT & Main Phase 6 Closure
= NOT STARTED
```

**Official stop:** after documenting this approved 6.3 scope and before starting **6.3.1 — Inventory Valuation Report**.


---

## 14. 2026-08-24 execution status addendum

6.3.1 has now been implemented and accepted in Runtime. This addendum supersedes the earlier pre-implementation stop statement for **6.3.1 only**.

```text
6.3 — Inventory Valuation & Accounting Reports
= IN PROGRESS

6.3.1 — Inventory Valuation Report
= COMPLETE / TARGETED TESTS PASSED / RUNTIME UAT PASSED / OFFICIALLY CLOSED

6.3.2 — Value by Warehouse / Category
= NOT STARTED

6.3.3 — Inventory Variance & Accounting Review
= NOT STARTED

6.3.4 — Runtime UAT & Closure
= NOT STARTED
```

Acceptance evidence for 6.3.1:

- deployed UI verified;
- search / warehouse / value-status filters verified;
- Excel / PDF / Print verified;
- targeted Vitest = **4/4 PASS**;
- stored `totalCostValue` remains the displayed/exported valuation source;
- no Revaluation or DB write behavior introduced.

**New official stop:** after 6.3.1 official closure and before starting **6.3.2 — Value by Warehouse / Category**.

---

## 15. 2026-08-24 owner-approved two-part execution structure — CURRENT

The owner explicitly approved simplifying the remaining 6.3 execution structure to **two current checkpoints only**. This changes current roadmap numbering/organization, not historical evidence filenames.

```text
CURRENT 6.3.1 — Inventory Valuation & Value Distribution
= former 6.3.1 + former 6.3.2
= COMPLETE / OFFICIALLY CLOSED

CURRENT 6.3.2 — Inventory Variance, Accounting Review & Runtime Closure
= former 6.3.3 + former 6.3.4
= IN PROGRESS
```

Historical documents/tests for former 6.3.1 and former 6.3.2 remain valid and retain their original names. Do not rename/rewrite them.

For the current 6.3.2 review implementation, do not invent new accounting rules. Reuse Main Phase 5.4 as the authoritative reconciliation/tolerance source and use stored `totalCostValue` as the current value basis. The review may surface accepted 5.4 Inventory-linked exceptions and existing negative stored-value status, but must remain read-only with no Revaluation, Auto-fix, Backfill or Legacy Cleanup.

**Current stop after code delivery:** current 6.3.2 implemented; targeted test + Runtime UAT + final Main Phase 6.3 closure remain pending.
