# CMMS — Main Phase 3 / Step 1 — Opening Snapshot UAT Closure

**Date:** 2026-08-20  
**Phase:** Main Phase 3 — تطوير الجرد  
**Step:** 1 — تثبيت Snapshot الجرد عند الفتح  
**Status:** **COMPLETE / RUNTIME UAT PASSED**

## 1) الهدف الذي تم إثباته

تم إثبات أن الجرد الدوري يحتفظ بحالة افتتاحية ثابتة لحظة فتح العملية، وتشمل:

- `systemQuantity` لكل Inventory/Lot داخل نطاق الجرد.
- `averageCostSnapshot` = `inventory.averageCost` الفعلي وقت فتح الجرد.
- وقت فتح العملية من `inventory_count_operations.createdAt`.

أي حركة لاحقة لا تعيد كتابة Snapshot التاريخية الخاصة بالجرد المفتوح.

## 2) عملية UAT

- Count Operation: `CNT-2026-60028`
- Operation ID: `60028`
- Warehouse: `1`
- Count Type: `periodic`
- Scope: `full`
- Status وقت الاختبار: `in_progress`
- Opening time: `2026-08-20 07:54:29`

تم التحقق من إنشاء 13 سجلًا في `inventory_count_snapshots` بنفس وقت فتح العملية.

## 3) UAT — ثبات كمية النظام بعد حركة لاحقة

الصنف المستخدم:

- Item: `ذراع طبي`
- Inventory ID: `210214`
- Lot ID: `13`
- Snapshot quantity وقت الفتح: `1.000`
- Snapshot average cost: `1.0000`

بعد تنفيذ سند الصرف:

- Delivery: `DLV-2026-300181`
- Current Lot Quantity أصبحت: `0.000`

التحقق النهائي:

- `snapshotQuantity = 1.000`
- `currentLotQuantity = 0.000`
- Snapshot لم تتغير.

**Result: PASS.**

## 4) UAT — ثبات متوسط التكلفة بعد استلام بتكلفة مختلفة

بعد إصلاح Receipt Inventory Identity Future Guard تم استخدام:

- Purchase Order: `PR-2026-0389`
- Catalog Item: `360002`
- Inventory ID: `210211`
- Snapshot quantity: `2.000`
- Snapshot average cost: `5.0000`

تم استلام:

- quantity = `1`
- actualUnitCost = `20.00`

بعد التأكيد:

- تم استخدام نفس `inventoryId = 210211`.
- current quantity = `3.000`.
- current averageCost = `10.0000`.
- current totalCostValue = `30.00`.

المتوسط المرجح المتوقع:

```text
(2 × 5 + 1 × 20) ÷ 3 = 10.0000
```

بينما بقيت Snapshot الجرد:

- `snapshotQuantity = 2.000`
- `averageCostSnapshot = 5.0000`

**Result: PASS.**

## 5) النتيجة النهائية

تم إثبات القاعدتين الأساسيتين للخطوة الأولى:

1. الكمية المرجعية للجرد تبقى كمية وقت فتح الجرد حتى لو تغير الرصيد لاحقًا.
2. تكلفة تقييم الجرد تبقى متوسط التكلفة الفعلي وقت فتح الجرد حتى لو تغير Moving Weighted Average لاحقًا.

**Main Phase 3 / Step 1 = COMPLETE / RUNTIME UAT PASSED.**

الخطوة التالية: **Step 2 — استكمال منطق النتائج والتقارير باستخدام Snapshot الثابتة.**
