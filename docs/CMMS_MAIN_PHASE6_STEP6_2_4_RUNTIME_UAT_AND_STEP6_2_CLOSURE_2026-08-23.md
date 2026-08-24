# CMMS — Main Phase 6 / 6.2.4 Runtime UAT & 6.2 Closure

**Date:** 2026-08-23  
**Status:** **6.2.4 OFFICIALLY CLOSED / 6.2 OFFICIALLY CLOSED**  
**Next stop:** **before 6.3 — Inventory Valuation & Accounting Reports**

## Purpose

توثيق Runtime UAT النهائي لـ`6.2 — Stock Balance & Movement Reports` بعد إغلاق 6.2.1 و6.2.2 و6.2.3، بدون إضافة Workflow جديد أو تعديل بيانات المخزون.

## Runtime UAT evidence

### 1) Stock Balance vs Live DB — PASS

تم استخدام الصنف **سيكا رابيد 2 مواد سرعة تصلب** والدفعة:

`LOT-2026-191EEB06`

عرض تقرير رصيد المخزون الصنف في مخزنين بعد حركة التحويل:

- `WH-MAIN / المخزن الرئيسي`: quantity = `3`
- `SUB-1 / مخزن الدهانات`: quantity = `1`
- مجموع الرصيد الحالي = `4`

فحص Live DB Read-only أثبت:

- `inventoryId 210274`: Inventory Qty `3.000`, Lot Balance `3.000`, Average Cost `10.0000`, Total Value `30.00`
- `inventoryId 210277`: Inventory Qty `1.000`, Lot Balance `1.000`, Average Cost `10.0000`, Total Value `10.00`
- `inventory_lots.remainingQuantity = 4.000`

النتيجة: **PASS**.

### 2) Unified Movement Report vs Live DB — PASS

التقرير عرض أربع حركات لنفس الـLot:

1. Receipt / Purchase IN = `5`
2. Delivery OUT = `1` — `DLV-2026-300215`
3. Transfer OUT = `1` — `TRF-2026-030006`
4. Transfer IN = `1` — `TRF-2026-030006`

Live DB Read-only أثبت نفس الحركات والقيم:

- Purchase IN: Qty `5.000`, Unit Cost `10.0000`, Total `50.00`
- Delivery OUT: Qty `1.000`, Unit Cost `10.0000`, Total `10.00`
- Transfer OUT: Qty `1.000`, Unit Cost `10.0000`, Total `10.00`
- Transfer IN: Qty `1.000`, Unit Cost `10.0000`, Total `10.00`

إجمالي الوارد في التقرير = `6`، إجمالي الصادر = `2`، صافي الحركة = `4`.

النتيجة: **PASS**.

### 3) Stock Card — PASS

ظهر Bug أثناء Runtime UAT: كتابة اسم الصنف في البحث لم تكن تختار الصنف لبطاقة الصنف تلقائيًا.

تم إصلاحه بحزمة `CMMS_MAIN_PHASE6_STEP6_2_4_STOCK_CARD_SEARCH_FIX_2026-08-23.zip`.

Targeted test بعد الإصلاح:

`server/tests/stockCardSearchPhase6Step2_4.test.ts` = **4/4 PASS**

Runtime بعد الإصلاح أثبت:

- البحث باسم الصنف يحدد الصنف عندما يكون التطابق واضحًا.
- الرصيد الحالي = `4`
- القيمة الحالية = `40.00`
- عدد المخازن = `2`
- عدد الحركات = `4`
- إجمالي الوارد = `6`
- إجمالي الصادر = `2`
- سجل الحركات يعرض Receipt / Delivery / Transfer OUT / Transfer IN بالمستندات والـLot نفسه.

النتيجة: **PASS**.

### 4) Filters / Export / Print — PASS

تم التحقق Runtime قبل 6.2.4 من أن:

- فلاتر Stock Balance تعمل.
- فلاتر Unified Movement / Stock Card تعمل.
- Excel وPDF يحترمان الفلاتر النشطة.
- Print يعمل.
- 6.2.3 cross-report targeted test = **4/4 PASS**.

ملاحظة التوقيت: فرض `Asia/Riyadh` لم يعتمد كمتطلب حاجب حاليًا بقرار المالك، لذلك لا يدعي هذا الإغلاق ضمان توقيت الرياض في جميع بيئات النشر.

## Accepted boundaries

- Reports remain **Read-only**.
- لا Historical Reconstruction أو fabricated Opening Balance.
- لا Historical Backfill أو Legacy Cleanup أو Revaluation.
- لا تعديل Workflow / Accounting / Posting / Numbering.
- لا Centralized Numbering.
- لا Batch Transfer all-or-nothing redesign.
- لا Production Cutover.
- لم يتم تعديل Live DB ضمن 6.2.4؛ استعلامات UAT كانت Read-only فقط.

## Closure decision

```text
6.2.1 — Stock Balance & Status
= OFFICIALLY CLOSED

6.2.2 — Stock Card & Unified Movement Report
= OFFICIALLY CLOSED

6.2.3 — Unified Export & Review
= OFFICIALLY CLOSED

6.2.4 — Runtime UAT & Closure
= RUNTIME UAT PASSED / OFFICIALLY CLOSED

6.2 — Stock Balance & Movement Reports
= COMPLETE / OFFICIALLY CLOSED

6.3 — Inventory Valuation & Accounting Reports
= NOT STARTED
```

**Official stop:** after 6.2 closure / before 6.3. Do not start 6.3 automatically.
