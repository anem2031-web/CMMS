# CMMS — 2B-10-2B Catalog Relationship & Inactive Data Protection — UAT Closure

**Date:** 2026-08-19  
**Final Status:** ✅ **COMPLETE / UAT PASSED**  
**Phase:** 2B-10-2B — Catalog Relationship & Inactive Data Protection  
**Previous:** 2B-10-2A — ✅ COMPLETE / UAT PASSED  
**Exact stop after closure:** **BEFORE 2B-10-2C — Integrity Rules, UAT & Closure**

## 1) Closure decision

تم اعتماد إغلاق 2B-10-2B بعد نجاح UAT الوظيفي على بيئة المستخدم وقاعدة البيانات الحية للحماية المستقبلية الخاصة بالأصناف والتصنيفات والوحدات والموردين، مع الحفاظ على العلاقات والسجلات التاريخية بعد تعطيل الـMaster Data.

المبدأ الذي تم إثباته عمليًا:

- **New relationship → Active Master required.**
- **Existing historical relationship → remains visible/usable and is not rewritten.**
- **Deactivate → Soft Delete only; same identity remains in DB.**
- **Reactivate → same identity returns Active and becomes selectable again.**

لا توجد Migration أو Schema change أو Backfill أو تنظيف تاريخي ضمن هذا الجزء.

## 2) Catalog Items — UAT PASSED

### 2.1 Soft Delete / visibility

العينة الرئيسية: Catalog Item code `910001`, id `1140006`.

- بعد الضغط على التعطيل بقي السجل موجودًا في `catalog_items` مع `isActive = 0`: PASS.
- Owner/Admin يرى الصنف المعطّل داخل إدارة Catalog بعلامة **«معطّل»**: PASS.
- الصنف المعطّل لا يظهر في اختيار Catalog Item لطلب شراء جديد: PASS.
- زر العملية في الإدارة يعامل الحذف كـDeactivate وليس Hard Delete.

### 2.2 Reactivation

- تمت إعادة تفعيل نفس Item identity `1140006`: PASS.
- Live DB بعد إعادة التفعيل أظهر `isActive = 1`: PASS.
- بعد إعادة التفعيل عاد الصنف للظهور في طلبات الشراء الجديدة: PASS.
- Audit سجّل إعادة التفعيل كـ`action=update` مع `oldValues={"isActive":false}` و`newValues={"isActive":true}`: PASS.

### 2.3 New PO active selection

طلب الاختبار `PR-2026-0382`:

- تم إنشاء PO بصنف Catalog نشط: PASS.
- Live DB أكد ارتباط PO Item بـCatalog Item نشط وقت الفحص: PASS.
- بعد اختيار الصنف داخل PO لم يختفِ من السجل القائم عند تغير حالة الـMaster لاحقًا: PASS وظيفي.

### 2.4 Historical PO / Receipt continuity after deactivation

طلب الاختبار `PR-2026-0384`:

1. تم إنشاء الطلب والصنف `910001` Active.
2. بعد إنشاء الطلب تم تعطيل الصنف.
3. استمرت بقية دورة الشراء حتى Warehouse Receipt والصنف ما زال Inactive.

Live DB evidence:

- PO `PR-2026-0384` = `purchaseOrderId 3600089`.
- PO Item = `3570222`.
- `catalogItemId = 1140006`, code `910001`, وكان `catalog_items.isActive = 0` وقت التحقق.
- Warehouse Receipt = `420127`.
- Receipt Item = `240168`.
- Receipt احتفظ بنفس `purchaseOrderItemId = 3570222` ونفس `catalogItemId = 1140006` بينما الـMaster ما زال Inactive.

النتيجة: **Existing PO → Item later deactivated → Warehouse Receipt = PASS.**

هذا يثبت أن التعطيل يمنع الاستخدام الجديد ولا يكسر العلاقة التاريخية القائمة.

## 3) Catalog Nodes / Categories — UAT PASSED

العينة: Node code `1051`, id `540002`, parent `360006`.

- التعطيل كان Soft Delete؛ Live DB أظهر `isActive = 0` وليس حذف السجل: PASS.
- التصنيف المعطّل بقي ظاهرًا للإدارة مع نمط التعطيل/إعادة التفعيل المعتمد: PASS.
- تمت إعادة تفعيل **نفس Node identity**: PASS.
- Live DB بعد إعادة التفعيل أظهر `isActive = 1`: PASS.
- Audit سجّل التعطيل `true -> false`: PASS.
- Audit سجّل إعادة التفعيل `false -> true`: PASS.

### Non-blocking taxonomy guard spot-check

لم يتم تسجيل UAT مستقل في هذه الجلسة لمحاولة **إنشاء Item جديد تحت Node/ancestor معطّل** أو إنشاء Child جديد تحت Node معطّل. Backend guard `assertActiveCatalogNodePath()` والـUI guard موجودان في التنفيذ، لكن هذا السيناريو المحدد لم يُسجّل كاختبار Runtime مستقل. اعتمد المستخدم إغلاق 2B-10-2B بعد نجاح بقية UAT.

## 4) Catalog Units — UAT PASSED

العينة: Unit `م3 / M3`, id `60001`.

طلب الاختبار: `PR-2026-0383`.

### 4.1 Historical snapshot preserved

- تم إنشاء الطلب والوحدة `م3` Active.
- بعد الحفظ تم تعطيل الوحدة.
- PO Item التاريخي احتفظ بقيمة `unit = م3`: PASS.
- تعطيل الوحدة لم يعدّل نص الوحدة داخل الطلب القديم: PASS.

### 4.2 Future selection blocked while inactive

- Live DB أثناء التعطيل أظهر `catalog_units.id = 60001`, `isActive = 0`: PASS.
- الوحدة `م3` لم تظهر في طلب شراء جديد أثناء التعطيل: PASS.

### 4.3 Reactivation

- تمت إعادة تفعيل نفس Unit identity `60001`: PASS.
- Live DB أظهر `isActive = 1`: PASS.
- بعد إعادة التفعيل عادت الوحدة للظهور في طلب شراء جديد: PASS.
- Audit سجّل التعطيل `true -> false` وإعادة التفعيل `false -> true`: PASS.

النتيجة: **Historical unit snapshot preserved + inactive future selection blocked + same-unit reactivation = PASS.**

## 5) Suppliers — UAT PASSED

العينة: Supplier id `30003`, English name `RED  MAN`.

- Supplier Soft Delete بقي Deactivation وليس Hard Delete: PASS.
- Live DB بعد إعادة التفعيل أظهر `isActive = 1`: PASS.
- أثناء التعطيل لم يظهر المورد في الاختيارات الجديدة: PASS.
- بعد إعادة التفعيل عاد للظهور: PASS.
- Audit سجّل Deactivate وReactivate مع انتقال الحالة في الاتجاهين: PASS.
- تعدد سجلات التفعيل/التعطيل في UAT كان نتيجة تكرار المستخدم للعملية فعليًا، وليس Duplicate Audit تلقائيًا.

## 6) Governance behavior confirmed

بعد UAT أصبح السلوك المعتمد كالتالي:

### Catalog Items
- Admin management view: active + inactive.
- Operational selection: active only.
- Existing PO/Receipt relationship survives later deactivation.
- Reactivation restores same identity to future selection.

### Categories
- Admin management view preserves inactive node.
- Deactivate/Reactivate use same Node identity and are audited.
- New relationship guards remain Backend-enforced against inactive taxonomy paths.

### Units
- Admin management view preserves inactive units.
- Operational unit choices are Active-only.
- Historical unit text snapshots remain unchanged.
- Reactivation restores same Unit identity to future choices.

### Suppliers
- Soft Delete remains accepted behavior.
- Inactive supplier is excluded from new operational choices.
- Reactivation restores same Supplier identity.

## 7) Database / migration boundary

خلال 2B-10-2B لم يتم تنفيذ:

- SQL write أو data repair.
- Migration.
- Schema change.
- FK rollout.
- UNIQUE constraint.
- Backfill.
- Historical data rewrite.

البيانات القديمة، بما فيها Legacy Catalog/Inventory findings السابقة، لم تُصلح أو تُعدل ضمن هذا الجزء.

## 8) Deferred / out of scope remain unchanged

لا تزال خارج 2B-10-2B:

- duplicate `purchase_orders.poNumber` governance.
- `PR-2026-0378` approval race-condition repair.
- broad FK rollout.
- broad historical Inventory cleanup.
- FIFO / FEFO / direct issue without QR.

## 9) Final state

**2B-10-2B = ✅ COMPLETE / UAT PASSED.**

**2B-10-2C = NOT STARTED.**

**Exact stop: BEFORE 2B-10-2C — Integrity Rules, UAT & Closure.**

لا يبدأ أي Code / Schema / Workflow change للجزء 2B-10-2C قبل مناقشة نطاقه واعتماده صراحة.
