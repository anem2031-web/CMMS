# CMMS — Main Phase 3 / Step 1 — Inventory Count Opening Snapshot

**Date:** 2026-08-20  
**Phase:** Main Phase 3 — تطوير الجرد  
**Step:** 1 — تثبيت Snapshot الجرد عند الفتح  
**Status:** **COMPLETE / RUNTIME UAT PASSED**

## 1) القرار المعتمد

تم اعتماد أن المرجع التاريخي لأي **جرد دوري** هو حالة المخزون لحظة فتح عملية الجرد:

- `systemQuantity` = كمية النظام وقت فتح الجرد.
- `averageCostSnapshot` = **متوسط التكلفة الفعلي `inventory.averageCost` وقت فتح الجرد**.
- وقت الفتح المرجعي موجود أصلًا في `inventory_count_operations.createdAt`، مع `riyadhStartTime` للعرض.
- أي استلام/صرف/تحويل/تسوية أو تغير لاحق في `inventory.averageCost` لا يعيد كتابة Snapshot الخاصة بالجرد المفتوح.

`opening_balance` مستثنى لأنه ليس جردًا دوريًا؛ له مسار تأسيس مستقل سبق اعتماده.

## 2) Live DB verification

تم فحص الجداول الحية يدويًا قبل التنفيذ:

- `inventory_count_items`: يحتوي `systemQuantity` ولا يحتوي Snapshot للتكلفة.
- `inventory_count_operations`: يحتوي وقت فتح العملية (`createdAt`) ووقت الرياض (`riyadhStartTime`).
- `inventory`: يحتوي `quantity DECIMAL(12,3)` و`averageCost DECIMAL(12,4)` و`totalCostValue DECIMAL(14,2)`.

تم إنشاء الجدول الجديد يدويًا في Live DB ثم التحقق منه بـ`SHOW CREATE TABLE`:

`inventory_count_snapshots`

ويحفظ:

- `operationId`
- `inventoryId`
- `lotId`
- `systemQuantity DECIMAL(12,3)`
- `averageCostSnapshot DECIMAL(12,4)`
- `expiryDate`
- `createdAt`

لا FK / UNIQUE / historical backfill ضمن هذه الخطوة.

## 3) السلوك التنفيذي

### الجرد الدوري Lot/QR

عند فتح الجرد، يلتقط Backend Snapshot لكل Lot Balance موجود داخل نطاق المستودع، أو داخل Catalog subtree المختار عند جرد التصنيف.

الجرد الكامل/حسب التصنيف ينشئ أسطر العد للأرصدة الموجبة كما كان سابقًا، بينما تبقى Snapshot مستقلة كمرجع افتتاحي ثابت.

### الجرد الجزئي اليدوي بالـQR

تظل شاشة العد **فارغة** كما هو الـWorkflow المعتمد، لكن Backend يلتقط Snapshot افتتاحية وقت إنشاء العملية. عند مسح QR لاحقًا:

- لا يستخدم الرصيد الحالي للـLot.
- يستخدم `systemQuantity` المحفوظة وقت الفتح.
- يعيد `averageCostSnapshot` المحفوظة وقت الفتح.
- إذا كان الـLot لم يكن موجودًا في Snapshot الافتتاحية، يُرفض إدخاله إلى نفس الجرد برمز `COUNT_LOT_NOT_IN_OPENING_SNAPSHOT`.

هذا يمنع Lot دخل المستودع بعد فتح الجرد من الظهور وكأنه كان جزءًا من حالة الافتتاح.

### المسار القديم بدون Lots

تم الحفاظ على نفس القاعدة للمسار القديم إذا كان Feature Flag غير مفعّل: الأصناف اليدوية لا يمكن إضافتها لاحقًا إلا إذا كانت موجودة في Snapshot الافتتاحية.

### حذف مسودة الجرد

عند حذف جرد غير مكتمل، تُحذف Snapshot التابعة له قبل حذف رأس العملية، حتى لا تبقى بيانات Snapshot يتيمة على مستوى التطبيق.

## 4) مصدر متوسط التكلفة

لا يتم اشتقاق تكلفة الجرد من PO أو Receipt Item أو Lot مباشرة. المصدر المعتمد هو:

`inventory.averageCost`

وهو المتوسط المرجح المتحرك الفعلي الذي يحافظ عليه النظام، بدقة 4 منازل عشرية. هذه الخطوة **تجمّد القيمة فقط** ولا تغير معادلة التكلفة أو منطق الاستلام/التحويل/التسوية.

## 5) الملفات التنفيذية

- `drizzle/schema.ts`
- `drizzle/migrations/2026_08_20_inventory_count_opening_snapshot.sql`
- `server/_core/db/invoice-drafts.ts`
- `server/routers/inventory/inventoryCount.router.ts`
- `client/src/pages/inventory/InventoryOperations.tsx`
- `client/src/i18n/ar.ts`
- `client/src/i18n/en.ts`
- `client/src/i18n/ur.ts`
- `server/tests/inventoryCountOpeningSnapshot.test.ts`

## 6) Verification

- Live DB table creation: **PASS**.
- `SHOW CREATE TABLE inventory_count_snapshots`: **PASS** ومطابق للتصميم.
- TypeScript syntax/transpile للملفات المعدلة: **PASS**.
- Source regression assertions لقواعد Snapshot: **PASS**.
- Runtime UAT على `CNT-2026-60028`: تم إنشاء Snapshot افتتاحية بنجاح.
- Runtime UAT لكمية النظام: **PASS** — الصنف `ذراع طبي` (`inventoryId=210214`, `lotId=13`) كان `snapshotQuantity=1.000`، وبعد سند الصرف `DLV-2026-300181` أصبح الرصيد الحالي `0.000` بينما بقيت Snapshot `1.000`.
- Runtime UAT لثبات متوسط التكلفة: **PASS** — بعد نشر Receipt Inventory Identity Future Guard تم اختبار `PR-2026-0389` على Catalog Item `360002` / Inventory `210211`. كانت Snapshot وقت فتح الجرد: quantity=`2.000`, averageCostSnapshot=`5.0000`. بعد استلام كمية `1` بتكلفة `20.00` أعيد استخدام نفس Inventory وأصبح current quantity=`3.000`, current averageCost=`10.0000`, totalCostValue=`30.00`، بينما بقيت Snapshot quantity=`2.000` وaverageCostSnapshot=`5.0000`.
- Full Vitest / full-project `tsc`: لم يتم الادعاء بنجاحهما لأن النسخة المرفوعة لا تحتوي `node_modules`/toolchain الكامل.

## 7) حدود هذه الخطوة

لم يتم تنفيذ الخطوة 2 هنا. لذلك لا تغيير حاليًا في:

- معادلة `diffQuantity` القائمة إلا استخدام Snapshot الافتتاحية عند إنشاء سطر متأخر.
- حساب **قيمة فرق الجرد** في التقارير.
- Settlement accounting.
- Workflow الجرد الحالي.

هذه كانت حدود حزمة Step 1 وقت تنفيذها. تم لاحقًا تنفيذ **Main Phase 3 / Step 2** لاستخدام `averageCostSnapshot` في قيمة الفرق والتقارير؛ المرجع: `docs/CMMS_PHASE3_STEP2_INVENTORY_COUNT_RESULTS_REPORTS_IMPLEMENTATION_2026-08-20.md`.

## 8) الحالة بعد التنفيذ

**Main Phase 3 / Step 1 = COMPLETE / RUNTIME UAT PASSED.**  
**Main Phase 3 overall = IN PROGRESS.**  
مرجع إغلاق UAT: `docs/CMMS_PHASE3_STEP1_INVENTORY_COUNT_OPENING_SNAPSHOT_UAT_CLOSURE_2026-08-20.md`.  
**Step 2 = IMPLEMENTED / RUNTIME UAT PENDING.**
