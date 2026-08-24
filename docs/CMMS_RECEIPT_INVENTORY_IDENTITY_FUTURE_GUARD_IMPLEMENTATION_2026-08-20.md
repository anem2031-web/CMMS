# CMMS — Receipt Inventory Identity Future Guard

**Date:** 2026-08-20  
**Status:** IMPLEMENTED / RUNTIME UAT PASSED  
**Scope:** Future-facing protection only; no legacy merge/backfill/cleanup.

## 1. لماذا نُفذ هذا الإصلاح

أثناء UAT للمرحلة الرئيسية 3 / Step 1 تم استخدام الصنف:

- Catalog Item `960014` — `دهان جوتن ناري مطفي S 5040-Y30R`
- Warehouse `1`

وكان لديه Inventory قائم:

- `inventory.id = 210200`
- quantity = `3.000`
- averageCost = `1.0000`

بعد استلام جديد عبر `PR-2026-0387` لكمية `1` بسعر `10.00`، أنشأ مسار الاستلام سجل Inventory جديدًا:

- `inventory.id = 210222`
- نفس `warehouseId = 1`
- نفس `linkedItemId = 960014`
- quantity = `1.000`
- averageCost = `10.0000`

بدل إعادة استخدام Inventory القائم وحساب المتوسط المرجح عليه.

## 2. السبب الجذري

مسار الاستلام كان يعتمد على `inventoryId` القادم من العميل:

- إذا وصل `inventoryId` → يحدث السجل المحدد.
- إذا لم يصل `inventoryId` → ينشئ Inventory جديدًا.

وجود `linkedItemId` + `warehouseId` لم يكن يُستخدم تلقائيًا للبحث عن Inventory القائم، رغم أن قرار Phase 2 المعماري اعتمد أن:

> Catalog Item هو Master Identity، وInventory هو Stock State للصنف داخل مستودع معين.

## 3. السلوك الجديد

عند الاستلام المستقبلي، إذا كان `inventoryId` غير مرسل وكان `catalogItemId/linkedItemId` معروفًا:

1. يبحث الخادم عن Inventory بنفس:
   - Catalog Item
   - Warehouse
2. إذا وجد **سجلًا واحدًا فقط** → يعاد استخدامه تلقائيًا.
3. إذا لم يجد أي سجل → يبقى سلوك إنشاء Inventory جديد كما هو.
4. إذا وجد **أكثر من سجل قديم** لنفس Catalog Item + Warehouse → يرفض إنشاء سجل ثالث ويعرض خطأ واضحًا؛ لا يختار سجلًا قديمًا عشوائيًا ولا يدمج البيانات القديمة.
5. إذا كان `inventoryId` مرسلًا صراحةً، يبقى المسار التاريخي الحالي متوافقًا ولا يجري دمجًا تلقائيًا.

## 4. المسارات المشمولة

تم تطبيق الحماية في:

- `server/routers/inventory/receipts.v2.router.ts`
- `server/_core/db/invoice-drafts.ts` لمسار اعتماد Receipt Draft القديم

وتمت إضافة lookup مشتركة في:

- `server/_core/db/inventory.ts`

## 5. ما لم يتغير

هذا الإصلاح لا يقوم بأي من الآتي:

- لا دمج للسجلات `210200` و`210222`.
- لا حذف لأي Inventory قديم.
- لا تعديل Quantity / Average Cost / Lots / Transactions تاريخية.
- لا Backfill.
- لا FK أو UNIQUE constraint.
- لا Migration أو SQL جديد.
- لا تغيير في Catalog Item identity.
- لا إزالة لخيار الربط اليدوي من UI في هذه الحزمة.

السجلات القديمة المكررة تبقى Legacy Data وتُراجع لاحقًا بشكل مستقل إذا وافق صاحب المشروع.

## 6. الاختبارات البرمجية

أُضيف:

- `server/tests/receiptInventoryIdentityGovernance.test.ts`

ويتحقق من:

- lookup بـCatalog Item + Warehouse.
- إعادة استخدام السجل الوحيد في receipts.v2.
- تطبيق نفس الحماية على Approved Receipt Drafts.
- منع إنشاء سجل جديد عند وجود Legacy ambiguity.
- عدم وجود أي منطق حذف/دمج تلقائي للسجلات القديمة.

## 7. Runtime UAT بعد النشر

تم تنفيذ UAT ناجح على:

- Purchase Order: `PR-2026-0389`
- Catalog Item: `360002`
- Inventory القائم: `210211`
- Warehouse: `1`
- الكمية قبل الاستلام: `2.000`
- متوسط التكلفة قبل الاستلام: `5.0000`
- الاستلام الجديد: quantity=`1`, actualUnitCost=`20.00`

النتيجة بعد التأكيد:

- بقي نفس `inventoryId = 210211`؛ لم يُنشأ Inventory ثانٍ.
- current quantity = `3.000`.
- current averageCost = `10.0000`.
- current totalCostValue = `30.00`.
- المتوسط المرجح صحيح: `(2×5 + 1×20) ÷ 3 = 10.0000`.
- Snapshot الجرد المفتوح `CNT-2026-60028` بقيت `snapshotQuantity=2.000` و`averageCostSnapshot=5.0000`.

**Runtime UAT = PASS.**

## 8. الحالة الحالية

**IMPLEMENTED / RUNTIME UAT PASSED**

الفجوة المستقبلية مغلقة Runtime. Legacy duplicates القديمة ما زالت مؤجلة بدون Merge/Delete/Backfill.
