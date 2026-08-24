# CMMS — Main Phase 3 / Step 3 — Settlement Cut-off, Lot Freeze & Closure UAT

**Date:** 2026-08-20  
**Status:** ✅ **COMPLETE / RUNTIME UAT PASSED**

## القرار المعتمد

بقرار صاحب المشروع، تم توسيع Step 3 قبل إغلاق Main Phase 3 لتشمل اختبار Settlement الحقيقي مع استمرار التشغيل أثناء الجرد دون خلط الدفعات.

القاعدة المعتمدة:

> **الدفعة التي دخلت ضمن الجرد تبقى مرجعاً مستقلاً. الدفعات الجديدة الناتجة عن فواتير/استلام بعد فتح الجرد تبقى Lots مستقلة ويمكن أن تستمر حركاتها. عند Settlement لا يتم ضبط المخزون إلى رقم عد قديم؛ يطبق النظام فرق الجرد المحفوظ فقط فوق الرصيد الحالي.**

مثال مبسط:

```text
رصيد الجرد = 2
العد الفعلي = 3  => فرق الجرد +1
دخلت فاتورة جديدة = +4 في Lot جديد
صُرف منها = 1    => المتبقي في Lot الفاتورة = 3
Settlement يطبق +1 على Lot الجرد
الرصيد النهائي = 3 Lot الجرد + 3 Lot الفاتورة = 6
```

## Cut-off timestamps

لا يلزم Schema جديد؛ الحقول المطلوبة موجودة بالفعل:

- `inventory_count_operations.completedAt` = وقت الحفظ النهائي/إقفال الجرد.
- `inventory_settlements.appliedAt` = وقت تطبيق Settlement.

## Lot movement freeze

تمت إضافة Future-facing application guard لعمليات الجرد التي تملك Main Phase 3 opening snapshot فقط؛ الجرد التاريخي القديم لا يُجمّد بأثر رجعي.

السلوك:

1. Lot موجود كـCount Item في جرد دوري `in_progress` يمنع مؤقتاً من الحركات التي تنقص/تنقل رصيده.
2. بعد Final Save:
   - `diff = 0` => يُفتح Lot للحركة.
   - `diff != 0` => يبقى مجمداً حتى وجود Applied Settlement Item لنفس `operationId + inventoryId + lotId`.
3. Lot جديد نتج عن Receipt بعد فتح الجرد ليس Count Target، لذلك يبقى مستقلاً ومتاحاً للحركة وفق Workflow العادي.

رسائل المنع Backend بالعربية وتوضح للمستخدم أن الدفعة تحت الجرد أو بها فرق لم تتم تسويته بعد.

المسارات المغطاة بالحماية المركزية:

- Issue / Delivery
- Supplier Return (decrement path)
- Disposal
- Warehouse Transfer source/target

## Settlement posting rule

في الجرد الدوري Lot-based:

```text
frozenDiff = countedQuantity - systemQuantity
newLotBalance = currentLotBalance + frozenDiff
newInventoryQuantity = currentInventoryQuantity + frozenDiff
```

Settlement لا يعيد Lot إلى `countedQuantity` القديمة ولا يمس Lots الجديدة المستقلة.

## Finalized count immutability

- Backend لا يثق بأي `afterQuantity` معدل من العميل عند Settlement من جرد دوري.
- القيمة المصدر هي `inventory_count_items.countedQuantity` المحفوظة نهائياً.
- واجهة تسوية الجرد لم تعد تعرض الكمية النهائية كحقل قابل للتعديل؛ تعرض System / Counted / Diff فقط.
- يجب تطبيق جميع فروقات الجرد المحفوظة معاً؛ لا حذف Lot ولا إضافة Lot آخر في نفس Settlement.

## Duplicate protection

- تمت إضافة قفل للرأس `FOR UPDATE` داخل Transaction قبل تطبيق Lot settlement.
- إذا وجد Applied Settlement سابق لنفس Count Operation يرفض Backend تطبيق الفرق مرة ثانية.

## Historical safety

- لا Merge/Delete/Backfill لأي Inventory/Lot تاريخي.
- لا SQL/Migration/Schema change جديد.
- لا DB UNIQUE/FK جديد.
- الحركة الجديدة فقط تخضع للقاعدة الجديدة.

## Technical verification

- TypeScript syntax/transpile على الملفات المعدلة: PASS.
- Source regression assertions للحماية/معادلة Settlement/عدم تعديل Count من الواجهة: PASS.
- Full Vitest/full-project `tsc` غير مُدعى في البيئة المرفوعة لعدم توفر toolchain المحلي الكامل.

## Runtime UAT — النتيجة النهائية

تم تنفيذ Runtime UAT على `CNT-2026-60028` بنجاح:

1. منع الصرف من Count `Lot 10` قبل Settlement برسالة عربية بسبب فرق غير مسوّى = PASS.
2. تطبيق `ADJ-2026-30006` على فرق `+1` = PASS.
3. Live DB بعد التسوية: Lot `10` أصبح `2.000 → 3.000`، و`inventory.quantity=4.000` و`SUM(lot balances)=4.000` = PASS.
4. الكمية المستقلة الناتجة عن Receipt لاحق بقيت ضمن الإجمالي ولم تُستبدل بكمية العد القديمة = PASS.
5. بعد Settlement تم فك التجميد والصرف من Lot `10` بنجاح عبر `DLV-2026-300182` = PASS.
6. فحص ما بعد الصرف: `inventory.quantity=3.000`, `Lot 10=2.000`, `SUM(lot balances)=3.000` = PASS.

ملاحظة غير حاجبة: لم يُنفذ Runtime retry مستقل لنفس Settlement لاختبار duplicate guard، ولم يُنفذ استعلام مستقل لـ`inventory_lots.remainingQuantity` بعد آخر صرف. الحمايات البرمجية موجودة، وقرار الإغلاق اعتمد على Runtime evidence أعلاه.

مرجع الإغلاق النهائي: `docs/CMMS_PHASE3_INVENTORY_COUNT_FINAL_CLOSURE_2026-08-20.md`.

**Final status:** ✅ **STEP 3 COMPLETE / RUNTIME UAT PASSED — MAIN PHASE 3 CLOSED.**
