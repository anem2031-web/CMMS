# CMMS — 2B-10-2B Catalog Relationship & Inactive Data Protection

**Date:** 2026-08-19  
**Status:** ✅ **COMPLETE / UAT PASSED**  
**Previous:** 2B-10-2A — ✅ COMPLETE / UAT PASSED  
**Next:** 2B-10-2C — NOT STARTED

## 1) الهدف

حماية العلاقات الجديدة مع Master Catalog من استخدام هويات مفقودة أو معطّلة، مع الحفاظ على السجلات التاريخية والـWorkflow الحالي إذا تعطّل Master Data بعد إنشاء العلاقة الأصلية.

المبدأ المعتمد:

- **New relationship → Active Master required.**
- **Existing historical relationship → remains usable and is not rewritten.**
- لا Backfill ولا تنظيف تاريخي ولا FK/UNIQUE rollout ضمن هذا الجزء.

## 2) ما كان محمياً قبل 2B-10-2B

الفحص أثبت وجود حمايات قائمة لم نكررها:

- `catalog.items.list` و`catalog.nodes.list` يعرضان النشط افتراضياً.
- Supplier selection في Warehouse Receipt يتحقق Backend من `catalog_suppliers.isActive`.
- Supplier Candidate `linkExisting` يطلب Supplier نشطاً.
- Item Candidate `linkExisting` يطلب Catalog Item نشطاً.
- Opening Balance يطلب Catalog Item نشطاً.
- إنشاء Warehouse فرعي تحت Catalog Node يتحقق من Node نشط.
- Catalog Candidate `approveNew` يتحقق من Leaf Category نشطة.

## 3) الفجوات التي تم إصلاحها

### A. Purchase Order Catalog links

قبل التنفيذ كان `create/saveDraft/updateDraft` يتحقق من **وجود** `catalogItemId` فقط، وليس من كونه Active.

تم التنفيذ:

- إضافة `getActiveCatalogItemIds()` في طبقة DB.
- `create` و`saveDraft`: كل Catalog link جديد يجب أن يكون Active.
- `updateDraft`:
  - إذا بقي نفس `catalogItemId` الموجود تاريخياً على بند المسودة، يسمح به حتى لو تعطّل Master Item بعد ذلك.
  - إضافة بند جديد أو تغيير الرابط إلى Catalog Item آخر يتطلب أن يكون الهدف Active.
- فحص العلاقات يسبق أي كتابة على المسودة.

هذا يمنع forged/stale client من ربط PO جديد بصنف معطّل، بدون كسر Draft تاريخية موجودة.

### B. Warehouse Receipt Catalog links

تمت إضافة Preflight واضحة لكل `linkedItemId`:

- Catalog Item المفقود: مرفوض دائماً.
- ربط جديد أثناء الاستلام: يجب أن يكون Catalog Item Active.
- استمرار نفس `catalogItemId` المحفوظ مسبقاً على PO Item: مسموح حتى لو تعطّل Master Item بعد إنشاء PO.

ولمنع إنشاء علاقة مستقبلية جانبية إلى Master معطّل:

- إذا كانت الهوية التاريخية الموروثة Inactive، يستمر الاستلام لكن **لا يتم إنشاء/إعادة تنشيط Supplier Item Alias جديد** لذلك الصنف.

### C. Catalog Taxonomy relationships

تمت إضافة `assertActiveCatalogNodePath()`:

- إنشاء Node جديد تحت Parent يتطلب أن يكون كامل المسار حتى الجذر موجوداً ونشطاً.
- إنشاء Catalog Item مباشر يتطلب Node path نشطاً.
- Candidate `approveNew` يستخدم نفس الحماية بالإضافة إلى شرط Leaf الموجود سابقاً.
- لا تغيير لأي `nodeId` تاريخي ولا إصلاح Orphans قديمة.

### D. Historical Candidate + inactive Supplier

عند حسم Catalog Item Candidate تاريخي قد يكون `catalogSupplierId` قد تعطّل بعد الاستلام.

السلوك الجديد:

- نسمح بحسم Candidate نفسه.
- لكن لا ننشئ/نعيد تنشيط `catalog_supplier_item_aliases` إذا كان Supplier Master مفقوداً أو Inactive.

## 4) Units — Active-only future use + Admin reactivation

أثناء UAT اعتمد المستخدم أن `catalog_units` يجب أن تحكم الاستخدام المستقبلي للوحدات في جميع قوائم الاختيار المرتبطة بها، مع بقاء التاريخ كما هو.

السلوك المنفذ:

- `catalog.units.list` يبقى **Active-only افتراضياً** لكل الاستخدامات التشغيلية.
- Owner/Admin داخل تبويب الوحدات يمكنهما طلب النشط + المعطّل لأغراض الإدارة فقط.
- الوحدة المعطّلة تبقى ظاهرة في تبويب الوحدات بعلامة **«معطّل»**.
- زر العملية أصبح **«تعطيل»** وليس حذفاً فعلياً.
- إضافة `catalog.units.reactivate` لإعادة تفعيل **نفس Unit identity** مع Audit `isActive: false -> true`.
- بعد التعطيل تختفي الوحدة تلقائياً من:
  - اختيار وحدة Catalog Item.
  - اعتماد Catalog Item Candidate جديد.
  - طلبات الشراء الجديدة.
  - الإضافة اليدوية أثناء الجرد/المخزون التي تستخدم قائمة Catalog Units.
- إذا كان Catalog Item تاريخي ما زال يحمل نص وحدة تم تعطيلها، لا يتم نقل هذه الوحدة تلقائياً إلى PO جديد؛ يجب اختيار وحدة Active.
- Draft تاريخية يمكن أن تعرض الوحدة القديمة كقيمة **تاريخية/معطّلة غير قابلة للاختيار من جديد**، ولا يتم تعديل السجل القديم تلقائياً.
- Backend يمنع الاستخدام الجديد لوحدة Catalog معطّلة حتى لو حاول Client قديم/مصطنع إرسالها مباشرة في PO أو مسار Inventory اليدوي.
- عند إنشاء/تعديل Catalog Item جديد بعلاقة Unit جديدة، يجب أن تكون الوحدة المختارة موجودة ونشطة في `catalog_units`.
- عند اعتماد Item Candidate جديد، لا يتم ترحيل `purchaseUnit` تاريخية إلى Master Item إلا إذا كانت تطابق وحدة Catalog نشطة؛ وإلا تبقى الوحدة الجديدة فارغة حتى اختيار وحدة نشطة.

مهم: حقول الوحدات التاريخية ما زالت نصوص snapshot وليست `unitId` FK. هذا التنفيذ يضيف Governance مستقبلية بدون Migration أو تحويل للسجلات القديمة.

## 5) Suppliers — لا تغيير Workflow

لم نغير Soft Delete للموردين.

الحمايات التشغيلية المهمة كانت موجودة بالفعل:

- اختيار Supplier موجود في Receipt يتطلب Active Supplier.
- Supplier Candidate link-existing يتطلب Active Supplier.
- Catalog supplier/item matching endpoints المهمة تتحقق من Active Supplier/Item.

لم تتم إضافة أي منع تاريخي جديد.

## 6) الملفات البرمجية المعدلة

- `server/_core/db/purchase.ts`
- `server/routers/purchase/purchase-orders.router.ts`
- `server/routers/catalog/catalog.router.ts`
- `server/routers/inventory/receipts.v2.router.ts`
- `server/tests/catalogRelationshipGovernance.test.ts` — جديد/محدث
- `server/_core/catalog-unit-governance.ts` — جديد
- `server/routers/inventory/inventoryCount.router.ts`
- `client/src/components/catalog/UnitsManager.tsx`
- `client/src/components/catalog/ItemsManager.tsx`
- `client/src/components/catalog/CatalogItemCandidatesManager.tsx`
- `client/src/pages/purchase/CreatePurchaseOrder.tsx`

## 7) Database / migrations

**لا يوجد:**

- SQL
- Migration
- Schema change
- FK rollout
- UNIQUE constraint
- Backfill
- تعديل بيانات قديمة

## 8) التحقق الفني المنفذ

- TypeScript syntax/transpile للملفات المعدلة: **PASS**.
- Source regression assertions للحمايات الأساسية: **PASS**.
- Vitest الكامل: **لم يُشغّل** لأن حزمة `vitest` غير موجودة في `node_modules` للنسخة المرفوعة.
- Full `tsc`: **لم يُشغّل** لأن CLI/اعتماديات التطوير الكاملة غير متوفرة في بيئة النسخة المرفوعة.

الحالة النهائية بعد UAT: **✅ COMPLETE / UAT PASSED**. راجع ملف الإغلاق الرسمي المذكور في القسم 15.

## 9) UAT plan used

### UAT-1 — New PO link to Active Item
إنشاء Draft/PO بصنف Catalog نشط → يجب النجاح.

### UAT-2 — New PO link to Inactive Item (Backend guard)
تعطيل Catalog Item تجريبي ثم محاولة إدخاله كرابط جديد عبر مسار قادر على إرسال ID القديم → يجب الرفض.

### UAT-3 — Historical Draft continuity
1. إنشاء Draft مربوط بصنف Active.
2. تعطيل الصنف بعد إنشاء Draft.
3. تعديل ملاحظة/كمية مع إبقاء نفس Catalog link.
4. يجب أن ينجح حفظ Draft ولا يُكسر الرابط التاريخي.

### UAT-4 — Receipt inherited inactive Catalog Item
1. PO Item يحمل Catalog Item Active.
2. تعطيل الصنف بعد إنشاء PO.
3. استلام نفس PO Item بنفس `catalogItemId`.
4. يجب أن ينجح الاستلام بوصفه استمراراً تاريخياً، بدون إنشاء Supplier Item Alias جديد للصنف المعطّل.

### UAT-5 — New taxonomy relationship protection
- محاولة إنشاء Child تحت Node معطّل → يجب الرفض.
- محاولة إنشاء Item جديد تحت Node/ancestor معطّل → يجب الرفض.
- إنشاء Node/Item تحت مسار Active → يجب النجاح.

## 10) نقطة التوقف

**2B-10-2B = ✅ COMPLETE / UAT PASSED.**

**Exact stop: BEFORE `2B-10-2C — Integrity Rules, UAT & Closure`.**

## 11) UAT refinement — Inactive Item visibility in Catalog management

أثناء UAT أكد المستخدم أن Soft Delete للصنف يعني **تعطيل** وليس اختفاء من شاشة إدارة الكتالوج.

السلوك المعتمد والمنفذ:

- Owner/Admin داخل Catalog Items يرون **النشط + المعطّل**.
- الصنف المعطّل يبقى ظاهراً مع علامة واضحة **«معطّل»**.
- زر العملية أصبح **«تعطيل»** بدلاً من «حذف» لتوضيح أن السجل لا يُحذف فعلياً.
- زر التعطيل لا يظهر على صنف معطّل لمنع تكرار Deactivate بلا معنى.
- Construction & Procurement Manager والقراءات التشغيلية (PO/Receipt/Inventory وغيرها) تبقى **Active-only** افتراضياً.
- Backend لا يسمح بـ`includeInactive` إلا لـOwner/Admin؛ لذلك لا تعتمد الحماية على الواجهة وحدها.
- لا SQL / Migration / Backfill / data rewrite.

هذا التغيير هو **Visibility/Governance داخل شاشة الإدارة فقط** ولا يعيد الصنف المعطّل إلى قوائم الاختيار للعمليات الجديدة.

## 12) UAT refinement — Catalog Item reactivation

أثناء UAT اعتمد المستخدم أن الصنف المعطّل يجب ألا يبقى في حالة نهائية غير قابلة للعكس داخل إدارة الكتالوج.

تم التنفيذ:

- Owner/Admin يرى زر **«إعادة تفعيل»** على الصنف المعطّل.
- إعادة التفعيل تعيد **نفس Catalog Item identity** ولا تنشئ صنفاً جديداً.
- Backend mutation مستقلة `catalog.items.reactivate` محمية بـ`catalogAdminProcedure`.
- إذا كان الصنف Active بالفعل، يرفض Backend الطلب لمنع Audit مكرر بلا معنى.
- Soft Delete يرفض كذلك إعادة تعطيل صنف معطّل بالفعل عبر طلب مباشر.
- قبل إعادة التفعيل، يجب أن يكون `nodeId` ومسار Taxonomy حتى الجذر نشطاً؛ لأن إعادة التفعيل تجعل الصنف متاحاً للعمليات الجديدة.
- Audit يسجل إعادة التفعيل كـ`action=update` مع:
  - `oldValues = { isActive: false }`
  - `newValues = { isActive: true }`
- لا SQL / Migration / Schema change / Backfill.

UAT الفعلي: الصنف `code=910001` / `id=1140006` نجح في Deactivate/Reactivate، اختفى من PO الجديدة أثناء التعطيل، عاد بعد التفعيل، وسجل Audit `false → true`.

## 13) UAT refinement — Taxonomy Node visibility and reactivation

أثناء UAT أكد المستخدم أن حذف التصنيف في الواجهة هو **Soft Delete / Deactivation**، وأن التصنيف المعطّل يجب أن يبقى ظاهراً للإدارة وقابلاً لإعادة التفعيل مثل Catalog Items.

تم التنفيذ:

- Owner/Admin داخل إدارة التصنيفات يرون **النشط + المعطّل**.
- التصنيف المعطّل يبقى ظاهراً مع علامة **«معطّل»**.
- زر العملية أصبح **«تعطيل»** بدلاً من «حذف» لتوضيح أن السجل لا يُحذف فعلياً.
- زر **«إعادة تفعيل»** يظهر للتصنيف المعطّل لـOwner/Admin فقط.
- إعادة التفعيل تعيد **نفس `catalog_nodes.id`** ولا تنشئ Node جديداً.
- Backend mutation مستقلة `catalog.nodes.reactivate` محمية بـ`catalogAdminProcedure`.
- إعادة التفعيل ترفض إذا كان التصنيف Active بالفعل.
- التعطيل يرفض إذا كان التصنيف Inactive بالفعل.
- إذا كان للتصنيف أب، يجب أن يكون الأب وكامل المسار الأعلى Active قبل إعادة التفعيل؛ لأن التصنيف سيصبح متاحاً لعلاقات جديدة.
- لا يظهر زر إضافة فرع تحت Node معطّل في الواجهة، ويبقى Backend guard `assertActiveCatalogNodePath()` هو الحماية الملزمة.
- Audit لإعادة التفعيل يسجل `action=update` و`entityType=node` مع:
  - `oldValues = { isActive: false }`
  - `newValues = { isActive: true }`
- لا SQL / Migration / Schema change / Backfill.

UAT الفعلي: التصنيف `code=1051` / `id=540002` نجح في Soft Deactivate/Reactivate، وعاد `isActive=1` مع Audit `false → true`.


## 14) UAT refinement — Catalog Units visibility, deactivation and reactivation

اعتمد المستخدم أن الوحدة المعطّلة يجب أن تختفي من **أي اختيار مستقبلي يعتمد على Catalog Units** وأن تعود تلقائياً بعد إعادة التفعيل.

تم التنفيذ كما يلي:

- Owner/Admin يرى الوحدة المعطّلة في تبويب الوحدات بعلامة «معطّل».
- زر «تعطيل» للوحدة Active، وزر «إعادة تفعيل» للوحدة Inactive.
- `catalog.units.reactivate` يعيد نفس `catalog_units.id` ويسجل Audit `false -> true`.
- كل استدعاءات `catalog.units.list` التشغيلية تبقى Active-only؛ الإدارة وحدها تستخدم `includeInactive`.
- Catalog Item create/update لا يقبل علاقة Unit جديدة إلا إلى وحدة موجودة ونشطة.
- Candidate approval لا يعيد استخدام وحدة مصدر تاريخية/معطّلة كـMaster Unit جديدة.
- PO جديد لا ينسخ وحدة معطّلة من Catalog Item تاريخي؛ Dropdown يعرض Active Units فقط.
- PO Backend يرفض أي استخدام جديد لوحدة Catalog معطّلة، مع السماح للقيمة التاريخية نفسها في Draft قديمة دون إعادة كتابة التاريخ.
- Inventory manual add-new يرفض Backend وحدة Catalog معطّلة حتى مع Client قديم.
- لا SQL / Migration / Schema / Backfill.

**UAT الفعلي:** الوحدة `م3 / M3` / `id=60001` نجحت في Deactivate/Reactivate؛ اختفت من PO الجديدة أثناء التعطيل، بقيت قيمة تاريخية في `PR-2026-0383`، عادت بعد التفعيل، وسجل Audit `false -> true`.


## 15) UAT closure — 2026-08-19

تم اعتماد الإغلاق الرسمي بعد نجاح UAT الفعلي. المرجع التفصيلي:

`docs/CMMS_2B10_2B_CATALOG_RELATIONSHIP_INACTIVE_PROTECTION_UAT_CLOSURE_2026-08-19.md`

أهم الأدلة:

- Catalog Item `910001` / `1140006`: Soft Deactivate + Reactivate + Active-only future PO selection + Audit = PASS.
- `PR-2026-0384`: الصنف أصبح Inactive بعد إنشاء PO، واستمر Warehouse Receipt `420127` بنفس `catalogItemId=1140006` = PASS.
- Unit `م3` / `60001`: التاريخ في `PR-2026-0383` بقي كما هو، الاختيار الجديد اختفى أثناء التعطيل وعاد بعد Reactivation، Audit = PASS.
- Node `1051` / `540002`: Deactivate/Reactivate + Audit = PASS.
- Supplier `30003` (`RED  MAN`): اختفاء من الاختيارات أثناء التعطيل، العودة بعد التفعيل، Audit = PASS.
- لم يسجل UAT Runtime مستقل لمحاولة إنشاء Item/Child تحت Node معطّل؛ Backend/UI guard موجود، والبند موثق كـnon-blocking spot-check بعد اعتماد المستخدم للإغلاق.

**Final status: ✅ COMPLETE / UAT PASSED.**

**Exact stop: BEFORE 2B-10-2C — Integrity Rules, UAT & Closure.**
