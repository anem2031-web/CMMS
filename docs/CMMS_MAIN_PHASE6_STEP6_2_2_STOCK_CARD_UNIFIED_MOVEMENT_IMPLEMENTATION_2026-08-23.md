# CMMS — Main Phase 6 / 6.2.2 Stock Card & Unified Movement Report — Implementation Checkpoint

**Date:** 2026-08-23  
**Main Phase:** 6 — Inventory / Accounting Reports  
**Step:** 6.2.2 — Stock Card & Unified Movement Report  
**Status:** **IMPLEMENTED / TARGETED SOURCE CHECKS PASSED / DEPLOYED RUNTIME VERIFICATION PENDING**

## 1. Purpose

Provide one organized read-only movement/reporting page for two closely related needs instead of scattering inventory movement reports:

1. **جميع الحركات** — unified Inventory Movement report.
2. **بطاقة الصنف** — one selected item with its current balance/value plus its recorded movement history.

The step intentionally does **not** reconstruct experimental legacy history or invent an opening balance. Stock Card shows the current stored truth plus movements actually recorded in `inventory_transactions`.

## 2. Runtime route

```text
/inventory/reports/movements
```

The **الحركات والتتبع** card in the Inventory Reports Center opens this page.

## 3. Unified filters

- Search: item name, internal code, Lot Code, document/reference, invoice or reason where supported.
- Warehouse.
- Movement type: Receipt / Issue-Delivery / Return / Transfer / Disposal / Adjustment-Settlement.
- Direction: In / Out.
- From date / To date.
- Stock Card item selector when the **بطاقة الصنف** tab is active.

Invalid reversed date ranges are normalized by the report service.

## 4. Data / traceability shown

The movement table shows, when present:

- date/time;
- item and internal code;
- warehouse;
- movement type and direction;
- Lot Code;
- quantity / unit;
- unit cost / movement value;
- document/reference (`RCV`, `DLV`, `RTN`, `TRF`, etc. when recorded by the accepted workflow);
- reason / notes.

The service resolves references only from existing transaction/document links. It does not create or repair missing historical links.

## 5. Stock Card behavior

A Stock Card requires selecting exactly one logical item identity. Current quantity and value are aggregated from the current Inventory rows for that item, including multiple warehouses where applicable.

The movement history below it is the recorded transaction history only. Therefore:

- no fabricated historical opening row;
- no historical reconstruction/backfill;
- no claim that old experimental transactions fully explain current balance;
- no mutation of Inventory or Transactions.

## 6. Shared 6.1 report actions

6.2.2 reuses the officially closed Reports Foundation:

- Refresh;
- Reset Filters;
- Print;
- Export → Excel / PDF;
- generated-at date/time.

UI and exports use the same movement filters/service contract. Arabic/RTL and mixed Arabic/Latin values are preserved through the shared export foundation.

## 7. Read-only safety

No:

- `INSERT`, `UPDATE`, `DELETE` or repair transaction;
- Schema/Migration/SQL data change;
- Historical Backfill/Cleanup/Revaluation;
- workflow/accounting/posting redesign;
- Centralized Numbering;
- Batch Transfer semantic change;
- Production Cutover;
- 6.2.3 start.

## 8. Main files

### New

- `server/services/reports/inventoryMovementReport.ts`
- `client/src/pages/inventory/InventoryMovementReport.tsx`
- `server/tests/inventoryMovementReportPhase6Step2_2.test.ts`
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

## 9. Acceptance gate

After extraction and server restart verify in Runtime:

1. Reports Center **الحركات والتتبع** opens `/inventory/reports/movements`.
2. **جميع الحركات** loads real Live DB movement rows.
3. Search / warehouse / movement type / direction / date filters work.
4. Receipt / Delivery / Return / Transfer / Disposal / Adjustment labels map correctly to actual rows where data exists.
5. Selecting **بطاقة الصنف** requires one item and shows current quantity/value + recorded history.
6. Lot Code and document/reference appear correctly for recent Phase 5 UAT data where available.
7. Refresh / Reset work.
8. Print / Excel / PDF work and honor active filters; Stock Card export honors the selected item.
9. Targeted test passes:

```bash
pnpm exec vitest run server/tests/inventoryMovementReportPhase6Step2_2.test.ts
```

Until Runtime acceptance:

```text
6.2.2 = IMPLEMENTED / TARGETED SOURCE CHECKS PASSED / RUNTIME VERIFICATION PENDING
6.2.3 = NOT STARTED
```
