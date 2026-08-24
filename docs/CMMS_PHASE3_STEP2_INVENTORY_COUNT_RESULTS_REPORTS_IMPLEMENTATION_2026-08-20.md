# CMMS — Main Phase 3 / Step 2 — Inventory Count Results & Reports

**Date:** 2026-08-20  
**Phase:** Main Phase 3 — تطوير الجرد  
**Step:** 2 — استكمال منطق الجرد والنتائج والتقارير  
**Status:** **IMPLEMENTED / RUNTIME UAT PENDING**

## 1) القرار التنفيذي

تقييم نتائج الجرد الدوري أصبح يعتمد حصريًا على Snapshot الافتتاحية التي تم تثبيتها في Step 1:

```text
فرق الكمية = الكمية المعدودة - كمية النظام وقت فتح الجرد
قيمة الفرق = فرق الكمية × متوسط التكلفة وقت فتح الجرد
```

لا يتم استخدام `inventory.averageCost` الحالي لتقييم فرق جرد تاريخي بعد الآن.

## 2) Backend

تم تحديث `getCountOperationDetails()` لربط كل Count Item مع `inventory_count_snapshots` الخاصة بنفس:

- `operationId`
- `inventoryId`
- `lotId`، أو Legacy row بدون Lot عند الحاجة

ويعيد الحقول التالية:

- `averageCostSnapshot`
- `systemValueSnapshot`
- `countedValueAtSnapshotCost`
- `diffValue`
- `hasOpeningCostSnapshot`

إذا كانت عملية جرد تاريخية قديمة لا تملك Snapshot تكلفة افتتاحية، لا يقوم Backend بالرجوع إلى التكلفة الحالية؛ تبقى القيمة المالية `null` صراحةً بدل إعطاء تقييم تاريخي مضلل.

كما أصبح `getCountDiscrepancies()` يعيد نفس بيانات Snapshot valuation المستخدمة في تفاصيل الجرد.

## 3) شاشة الجرد

تم تحديث تقرير الفروقات ليستخدم `diffValue` المحسوبة من Snapshot بدل:

```text
current averageCost × diffQuantity
```

ويعرض لكل بند:

- كمية النظام Snapshot.
- الكمية المعدودة.
- فرق الكمية.
- **متوسط التكلفة وقت فتح الجرد**.
- **قيمة الفرق باستخدام Snapshot**.
- Lot / الصلاحية / الملاحظة.

كما يتم حساب:

- إجمالي قيمة النقص.
- إجمالي قيمة الزيادة.
- صافي الأثر المالي.

كلها باستخدام تكلفة Snapshot فقط.

إذا كان هناك جرد قديم بلا Cost Snapshot، تظهر رسالة واضحة أن التقييم المالي غير متاح بدل استخدام التكلفة الحالية.

## 4) وثيقة الطباعة

تم تحديث `buildCountHtml()` لتعرض:

- متوسط التكلفة وقت الفتح.
- قيمة الفرق لكل بند.
- إجمالي النقص والزيادة وصافي الأثر المالي على تكلفة Snapshot.
- تحذير لأي بنود قديمة لا تحتوي Snapshot تكلفة افتتاحية.

## 5) قاعدة عدم Posting

لم يتم تغيير Workflow تطبيق الرصيد:

- فتح الجرد لا يغير Inventory.
- تسجيل العد لا يغير Inventory.
- إكمال الجرد لا يغير Inventory.
- Settlement فقط يبقى مسار تعديل الرصيد الفعلي.

تطوير Settlement المحاسبي نفسه يبقى ضمن Main Phase 4.

## 6) Schema / DB

لا يوجد أي SQL أو Migration أو Schema change جديد في Step 2.

تم استخدام `inventory_count_snapshots` المنشأ في Step 1 فقط.

## 7) الملفات المعدلة/الجديدة

- `server/_core/db/invoice-drafts.ts`
- `client/src/pages/inventory/InventoryOperations.tsx`
- `client/src/lib/printInventoryOperationDocuments.ts`
- `server/tests/inventoryCountSnapshotValuation.test.ts`
- ملفات التوثيق ذات الصلة

## 8) Technical Verification

- TypeScript syntax/transpile للملفات المعدلة: **PASS**.
- Source regression assertions لـSnapshot valuation وعدم استخدام current averageCost: **PASS**.
- Full Vitest / full-project `tsc`: لم يتم الادعاء بنجاحهما لأن نسخة المشروع المرفوعة لا تحتوي toolchain/dependencies كاملة.

## 9) Runtime UAT المطلوب

بعد نشر Step 2:

1. استخدام `CNT-2026-60028` أو جرد جديد يحتوي Snapshot تكلفة.
2. تسجيل Counted Quantity لبند لديه فرق فعلي.
3. التحقق أن `diffQuantity` محسوب من `systemQuantity` Snapshot.
4. التحقق أن `diffValue` = `diffQuantity × averageCostSnapshot`.
5. تغيير Current Average Cost بعد فتح الجرد أو استخدام السيناريو المثبت مسبقًا ثم التأكد أن قيمة الفرق لا تتغير.
6. التحقق أن شاشة التقرير ووثيقة الطباعة تعرضان نفس القيمة.
7. التأكد أن تسجيل العد/إكمال الجرد لم يغير الرصيد قبل Settlement.

**Step 2 = IMPLEMENTED / RUNTIME UAT PENDING.**
