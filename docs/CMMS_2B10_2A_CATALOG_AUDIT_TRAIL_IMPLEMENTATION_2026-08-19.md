# CMMS — 2B-10-2A Catalog Audit Trail

**Date:** 2026-08-19  
**Status:** ✅ COMPLETE / UAT PASSED  
**Scope:** Catalog Governance & Audit — الجزء A فقط

## 1) الهدف

تقوية سجل تدقيق Master Catalog للتغييرات المستقبلية بدون تعديل البيانات التاريخية، وبدون Schema/SQL/Migration جديد.

المبدأ المعتمد:

- أي تغيير Master Data يغطيه هذا الجزء يجب أن ينجح مع Audit في نفس Transaction أو يفشلا معًا.
- لا Backfill للسجلات القديمة في `catalog_audit_logs`.
- تبقى أسماء العمليات الحالية (`create` / `update` / `delete`) للحفاظ على التوافق، مع جعل Soft Delete/Deactivate واضحًا عبر `oldValues` و`newValues`.
- مشاهدة Catalog Audit من الواجهة متاحة لـ `owner/admin` فقط.

## 2) فحص Live DB قبل التنفيذ

تمت مراجعة الجدول الحقيقي يدويًا عبر `SHOW CREATE TABLE catalog_audit_logs`.

الجدول الحالي يوفر الحقول اللازمة بالفعل:

- `userId`
- `action`
- `entityType`
- `entityId`
- `oldValues`
- `newValues`
- `ipAddress`
- `userAgent`
- `createdAt`

لذلك لا توجد حاجة لتغيير بنية قاعدة البيانات في 2B-10-2A.

الفحص التجميعي قبل التنفيذ وجد 603 سجلات تاريخية؛ `oldValues` كان فارغًا في جميعها، وUnits لم يكن لها Audit، وإنشاء Catalog Item المباشر لم يكن يسجل Create Audit.

## 3) التنفيذ

### Catalog Items

- Create: أصبح يسجل `create` مع snapshot للقيم الجديدة.
- Update: يحفظ القيم السابقة للحقول المطلوبة في `oldValues` والقيم الجديدة في `newValues`.
- Soft Delete: يبقى action=`delete` للتوافق، لكنه يسجل الآن `isActive: true -> false`.

### Catalog Nodes / Categories

- Create: Audit داخل نفس Transaction.
- Update: `oldValues` + `newValues`.
- Soft Delete: `isActive` قبل/بعد.

### Units

أضيف Audit كامل كان مفقودًا:

- Create
- Update
- Soft Delete

### Suppliers

- بقي سلوك Soft Delete/Deactivation المعتمد كما هو.
- Create/Update/Delete أصبح Audit فيها إلزاميًا داخل نفس Transaction.
- Update يسجل old/new values.
- Delete يسجل `isActive` قبل/بعد.

### Catalog Item Candidates

حُفظت العمليات الحالية، لكن Audit لم يعد best-effort:

- merge
- separate
- link existing
- approve new

وعند `approve new` يسجل أيضًا `create` مستقل للـCatalog Item الناتج.

### Supplier Candidates

- link existing: Audit داخل نفس Transaction.
- approve new: Audit اعتماد المرشح + `create` مستقل للمورد الناتج داخل نفس Transaction.

## 4) شاشة Audit

أضيف endpoint قراءة `catalog.audit.list` بصلاحية `catalogAdminProcedure`، أي `owner/admin` فقط.

شاشة `/audit-log` تجمع الآن:

- `audit_logs` العام
- `catalog_audit_logs`

وترتب السجلات زمنيًا، مع وسم `Catalog Audit` لسجلات الكتالوج ودعم عرض `oldValues/newValues` سواء كانت JSON فعلية أو JSON مخزنة كنص.

## 5) ما لم يتغير

- لا Schema change.
- لا SQL write يدوي.
- لا Migration.
- لا Backfill أو تعديل للسجلات الـ603 التاريخية.
- لا تغيير لصلاحيات 2B-10-1.
- لا تغيير لـSupplier Soft Delete behavior.
- لا معالجة لـPO duplicate numbering.
- لا معالجة لـ`PR-2026-0378`.
- لا بدء لـ2B-10-2B أو 2B-10-2C.

## 6) الملفات البرمجية

- `server/_core/catalog-audit.ts` — جديد
- `server/routers/catalog/catalog.router.ts`
- `client/src/pages/admin/AuditLog.tsx`
- `server/tests/catalogAuditGovernance.test.ts` — جديد

## 7) التحقق الفني قبل التسليم

- Static TypeScript syntax/transpile للملفات المعدلة: **PASS**.
- Runtime check لدوال Audit الجديدة: **PASS**.
- فحص source: لا توجد `catch` من نوع best-effort حول `catalogAuditLogs` في `catalog.router.ts` بعد التعديل.
- `npm run check` الكامل لم يُنفذ في نسخة التسليم لأن المشروع المرفوع لا يحتوي `node_modules`؛ محاولة `npm ci` داخل بيئة الفحص لم تكتمل ضمن المهلة. هذا لا يُسجل كـPASS.

## 8) UAT النهائي — ✅ PASSED

تم تنفيذ UAT فعلي على Live DB للتغييرات المستقبلية بعد نشر 2B-10-2A، ونجحت المسارات الأساسية التالية:

### Catalog Item

العينة: `catalog_items.id = 1140011`, code=`91002`.

- Create Audit: **PASS** — `action=create`, `entityType=item`, مع `newValues` كاملة.
- Update Audit: **PASS** — تم حفظ الاسم الإنجليزي قبل/بعد في `oldValues/newValues`.
- Deactivate Audit: **PASS** — `isActive: true -> false`.
- تم التأكد أن اختلاف `userId` في التعطيل كان متوقعًا لأن العملية نفذها مستخدم آخر.

### Catalog Node / Category

العينة: `catalog_nodes.id = 540001`, code=`1061`.

- Create: **PASS**.
- Update: **PASS** مع old/new values.
- Deactivate: **PASS** مع `isActive: true -> false`.

### Unit

العينة: `entityType=unit`, `entityId=150001`.

- Create: **PASS**.
- Update: **PASS** مع old/new values.
- Deactivate: **PASS** مع `isActive: true -> false`.

### Supplier

العينة: `entityType=supplier`, `entityId=30003`.

- Create: **PASS**.
- Update: **PASS** مع old/new values.
- Deactivate: **PASS** مع `isActive: true -> false`.
- تكرار سجلات تفعيل/تعطيل المورد خلال الاختبار كان نتيجة قيام المستخدم بتعطيله وإعادته أكثر من مرة، وليس فقدانًا أو تكرارًا غير مفسر في الـAudit.

### Catalog Item Candidate -> New Item

العينة: Candidate `#8` -> Catalog Item `1140012`.

- `catalog_item_candidate / approve_item_candidate`: **PASS**.
- `item / create` للـMaster Item الناتج: **PASS**.
- السجلان ظهرا معًا في نفس مسار الاعتماد.

### Supplier Candidate -> New Supplier

العينة المرتبطة بطلب `PR-2026-0381`: Supplier Candidate `#2` -> Supplier `30004`.

- `supplier_candidate / approve_supplier_candidate`: **PASS**.
- `supplier / create` للمورد الناتج: **PASS**.
- السجلان ظهرا معًا في نفس مسار الاعتماد.

## 9) UAT follow-up — Supplier edit boolean normalization

أثناء UAT للموردين ظهر خطأ validation عند تعديل مورد: `isManufacturer` وصل من الواجهة كرقم `0/1` بينما Backend يتوقع Boolean.

تم تصحيح `client/src/components/catalog/SuppliersManager.tsx` بحيث يتم تحويل القيمة عند فتح نموذج التعديل عبر `Boolean(s.isManufacturer)`.

بعد التصحيح أعيد اختبار Supplier Update ونجح Audit مع `oldValues/newValues`، لذلك يعتبر هذا الـBug **مغلقًا ضمن UAT 2B-10-2A**.

- لا تغيير DB / Schema / Migration.
- لا تغيير Workflow.
- التصحيح يقتصر على تطبيع نوع القيمة قبل إرسال Update.

## 10) Spot-check غير منفذ في هذه الجلسة

لم يتم تنفيذ Runtime UAT مستقل في هذه الجلسة على النقطتين التاليتين:

- مشاهدة سجلات Catalog داخل `/audit-log` كـOwner/Admin.
- محاولة الوصول إلى Catalog Audit بدور `construction_procurement_manager` والتأكد من المنع Runtime.

الحماية موجودة في التنفيذ عبر Backend authorization (`catalogAdminProcedure`) والواجهة، وتم اعتماد إغلاق الجزء من المستخدم بعد نجاح UAT الوظيفي للـAudit في Live DB. تعتبر هاتان النقطتان Spot-check غير حاجب، ولا يترتب عليهما أي تغيير DB أو Workflow.

## 11) الحالة النهائية ونقطة التوقف

**2B-10-2A — Catalog Audit Trail = ✅ COMPLETE / UAT PASSED.**

- لا Backfill للسجلات التاريخية.
- لا SQL / Migration / Schema change.
- لا تغيير في صلاحيات 2B-10-1.
- لا تغيير في Supplier Soft Delete behavior.
- لم يبدأ `2B-10-2B`.

**Exact stop: BEFORE 2B-10-2B — Catalog Relationship & Inactive Data Protection.**
