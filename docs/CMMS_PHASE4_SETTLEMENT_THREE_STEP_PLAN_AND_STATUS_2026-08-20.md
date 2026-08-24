# CMMS — Main Phase 4 Settlement Development — Three-Step Plan & Status

**Date:** 2026-08-20  
**Final status:** ✅ **COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED — STEP 1 COMPLETE / STEP 2 IMPLEMENTED + RUNTIME VALIDATED / STEP 3 COMPLETE**  
**Change-control:** لا يبدأ أي تغيير إضافي في Workflow أو UI behavior أو DB behavior أو Accounting behavior خارج النطاق المعتمد أدناه دون موافقة صريحة.

---

## 1) الهدف الرسمي للمرحلة الرئيسية الرابعة

Main Phase 4 مخصصة لتطوير Settlement بأقل نطاق لازم لتحقيق الأهداف التالية:

- تحديث **الكمية والقيمة معًا** عند التسوية.
- الحفاظ على **Average Cost** الصحيح حسب مصدر التسوية.
- جعل التسوية حركة واضحة وقابلة للتتبع.
- ربط التسوية بالجرد عندما تكون ناتجة عن Inventory Count.
- تنفيذ Posting داخل **Database Transaction واحدة**.
- حفظ الحد الأدنى من السبب والمرجع والأثر المالي.

### حدود النطاق المعتمدة

لا تشمل Main Phase 4 الحالية تلقائيًا:

- Approval Workflow جديد للتسويات.
- Revaluation system مستقل.
- Historical backfill أو إصلاح/تسوية بيانات قديمة.
- Legacy cleanup أو دمج/حذف Inventories تاريخية.
- Broad FK / UNIQUE rollout.
- جداول Settlement جديدة.
- حقول موسعة مثل `beforeValue`, `afterValue`, `beforeAverageCost`, `afterAverageCost` في هذا النطاق المصغّر.
- فتح/تصميم Manual Lot Settlement جديد عند تفعيل Lots؛ المسار اليدوي القديم يبقى محجوبًا ما لم تتم موافقة مستقلة صريحة على Workflow جديد للدفعات.

المبدأ الحاكم:

> **Future-only protection: طبّق قواعد Phase 4 على التسويات الجديدة دون إعادة كتابة التاريخ.**

---

# 2) التقسيم النهائي — ثلاث خطوات فقط

## Step 1 — Database Foundation

**الحالة:** ✅ **COMPLETE / LIVE DB VERIFIED**

### ما تم

تم تعديل **Live DB يدويًا، أمر SQL واحد في كل مرة**، وإضافة الحد الأدنى من حقول Phase 4:

### `inventory_settlement_items`

```text
unitCostUsed      DECIMAL(12,4) NULL
adjustmentValue  DECIMAL(14,2) NULL
```

### `inventory_settlements`

```text
reference         VARCHAR(255) NULL
```

تم التحقق من الحقول الثلاثة بعد الإضافة عبر `INFORMATION_SCHEMA.COLUMNS` وكانت الأنواع وNullable state مطابقة للنطاق المعتمد.

### سبب كون الحقول Nullable

- حماية السجلات التاريخية من أي Backfill أو إعادة حساب.
- التسويات القديمة تبقى `NULL` في الحقول الجديدة.
- بعد تنفيذ Step 2، الكود هو الذي يجب أن يضمن تعبئة الحقول المطلوبة لأي Settlement جديدة ضمن المسار المدعوم.

### ما لم يتم في Step 1

- لا Backfill.
- لا تعديل سجلات Settlement قديمة.
- لا Cleanup.
- لا FK / UNIQUE جديد.
- لا جدول جديد.
- لا تعديل كود أو UI.

### ملاحظة مزامنة مهمة

عند نهاية Step 1 كان Latest Project Schema داخل `drizzle/schema.ts` لا يحتوي الحقول الثلاثة الجديدة وكانت **Live DB متقدمة على code model**. تم لاحقًا ضمن Step 2 / 4.2.1 مزامنة code schema مع الحقول الموجودة فعليًا في Live DB، بدون إعادة تشغيل ALTER أو تعديل Live DB.

---

## Step 2 — Settlement Valuation & Posting Logic

**الحالة:** ✅ **IMPLEMENTED / TARGETED CHECKS PASSED / RUNTIME VALIDATED IN STEP 3**

### القرارات المعتمدة

#### A) Count Settlement — Surplus أو Shortage

مصدر تكلفة فرق الجرد:

```text
unitCostUsed = inventory_count_snapshots.averageCostSnapshot
```

معادلة قيمة فرق الجرد:

```text
adjustmentValue = diffQuantity × averageCostSnapshot
```

القاعدة تنطبق على:

```text
Count Surplus  (+)
Count Shortage (-)
```

بعد Posting، يتم تحديث قيمة المخزون ومتوسط التكلفة انطلاقًا من **الحالة الحالية وقت التنفيذ + فرق الجرد التاريخي المقيّم بالـSnapshot**؛ ولا يعاد تقييم فرق الجرد باستخدام Current Average Cost.

الهدف: تبقى قيمة Settlement مطابقة لقيمة الفرق التي أظهرها الجرد من Opening Snapshot حتى لو حدث Receipt أو تغير Average Cost بعد فتح الجرد.

#### B) Manual Settlement — Positive أو Negative

القاعدة المعتمدة للتقييم عندما يكون Manual Settlement مسموحًا في Workflow القائم:

```text
unitCostUsed = Current Inventory Average Cost at posting
adjustmentValue = diffQuantity × Current Average Cost
```

وبما أن الكمية والقيمة تتحركان بنفس Current Average Cost، فالأصل أن Average Cost يبقى دون تغيير بسبب Manual Settlement نفسها.

**حد Workflow:** الكود الحالي يحجب Manual Aggregate Settlement عندما يكون Lots مفعّلًا. Step 2 لا تعتبر موافقة على إزالة هذا الحجب أو إنشاء Manual Lot Workflow جديد.

### ما تم تنفيذه في Step 2

1. مزامنة code schema مع Live DB:
   - `inventorySettlementItems.unitCostUsed`
   - `inventorySettlementItems.adjustmentValue`
   - `inventorySettlements.reference`
2. Count Settlement:
   - قراءة `averageCostSnapshot` الموثوق لنفس `operationId + inventoryId + lotId`.
   - استخدام Snapshot Cost بدل Current Average Cost لتقييم `diffQuantity`.
   - حفظ `unitCostUsed` و`adjustmentValue` في Settlement Item.
   - تحديث `inventory.totalCostValue` و`inventory.averageCost` وفق القيمة الجديدة والكمية الجديدة.
3. Manual Settlement في المسار المسموح حاليًا:
   - استخدام Current `inventory.averageCost` وقت Posting.
   - حفظ `unitCostUsed` و`adjustmentValue`.
   - عدم إدخال تكلفة يدوية من المستخدم.
4. حفظ `reference` في Settlement Header عند توفيره.
5. الحفاظ على حمايات Main Phase 3 دون تغيير:
   - Finalized Count immutability.
   - Frozen difference only.
   - Apply delta فوق Current balance، لا reset إلى counted quantity القديمة.
   - Lot freeze / unfreeze.
   - Duplicate Count Settlement protection.
   - New Receipt Lots تبقى مستقلة.
6. جعل جميع تحديثات الكمية/القيمة/المتوسط وسجلات Settlement/Transaction جزءًا من **نفس DB Transaction** في المسارات التي تنفذ Posting.

### خط الأساس الذي تم التحقق منه قبل التنفيذ

- Periodic Lot Count Settlement كانت تستخدم DB Transaction وتحافظ على duplicate guard وحماية frozen diff من Phase 3.
- قبل Step 2 كانت تستخدم **Current `inventory.averageCost`** في الأثر المالي للحركة ولا تحفظ `unitCostUsed` أو `adjustmentValue`; تم تصحيح ذلك في 4.2.2 حسب التصميم المعتمد.
- Manual Aggregate Settlement القديمة محجوبة عند تفعيل Lots؛ هذا الحاجز بقي كما هو ولم يتم فتح Workflow جديد.

### تنفيذ Step 2 الداخلي — 4.2.1 / 4.2.2 / 4.2.3

- **4.2.1 — Schema + Settlement Inputs:** تم مزامنة `drizzle/schema.ts` مع الأعمدة الموجودة مسبقًا في Live DB، وتم تمرير `reference` اختياريًا للـBackend بدون UI change.
- **4.2.2 — Valuation + Financial Posting:** Count Settlement تستخدم Opening `averageCostSnapshot`; يتم حفظ `unitCostUsed` و`adjustmentValue`; ويتم تحديث `totalCostValue` و`averageCost` وفق الحالة الحالية + قيمة الفرق التاريخية. Manual supported path تبقى على Current Average Cost.
- **4.2.3 — Atomicity + Regression Protection + Documentation:** جميع مسارات Posting المدعومة أصبحت تدخل `db.transaction(...)`; رقم Settlement يُولّد باستخدام نفس transaction writer؛ Count source يُقفل ويعاد التحقق من `completed` داخل Transaction؛ وأضيفت source-regression checks ووثيقة تنفيذ Step 2.

### حالة إغلاق Step 2

- Code implementation ضمن النطاق المعتمد: **COMPLETE**.
- Targeted TypeScript syntax/transpile + source regression: **PASS**.
- لا UI change ولا Live DB SQL/Migration في 4.2.1–4.2.3.
- لا Historical Backfill/Cleanup ولا Manual Lot Workflow جديد.
- Runtime UAT تم تنفيذه ضمن Step 3 ونجح في Count Surplus/Shortage وSnapshot valuation وfreeze/unfreeze وduplicate guard وquantity/lot invariant وAtomicity/Rollback.
- ملاحظة ترقيم: `inventory_settlement_number_counter` يعتمد MySQL AUTO_INCREMENT؛ إدخاله داخل نفس Transaction يمنع commit مستقل لسجل العداد، لكن rollback قد يستهلك رقم AUTO_INCREMENT ويترك gap. لم يتم تغيير schema أو سياسة الترقيم لجعل الأرقام gapless.

---

## Step 3 — UI + Runtime UAT + Closure

**الحالة:** ✅ **COMPLETE / RUNTIME UAT PASSED / CLOSED**

### UI

- Count Settlement preview تعرض Opening Snapshot cost وقيمة التسوية بوضوح.
- Count valuation موضحة بأنها تعتمد Opening Snapshot وليس Current Average Cost.
- Snapshot cost غير قابلة للتعديل.
- Settlement details/print تعرض `unitCostUsed` و`adjustmentValue` والمرجع عند وجوده.
- Manual preview لا تسمح بإدخال Unit Cost يدوي.
- Manual Aggregate Settlement بقي محجوبًا عند Lots Enabled.
- لا Approval Workflow جديد ولا Wide UI redesign.

### Runtime UAT — النتائج الفعلية

- **Count Surplus (+):** `CNT-2026-60030` / `ADJ-2026-30008` = PASS.
  - Snapshot بقي `2.000 @ 10.0000` رغم تغيّر Current Average Cost إلى `16.0000` بعد Receipt لاحق.
  - `diff=+1`, `unitCostUsed=10.0000`, `adjustmentValue=+10.00`.
  - بعد Settlement: Inventory `16.000`, Value `250.00`, Average `15.6250`, SUM Lots `16.000`.
  - Lot freeze قبل Settlement = PASS؛ unfreeze بعده و`DLV-2026-300202` = PASS.
  - duplicate retry rejection = PASS.
- **Count Shortage (-):** `CNT-2026-60031` / `ADJ-2026-30009` = PASS.
  - `diff=-1`, `unitCostUsed=8.5714`, `adjustmentValue=-8.57`.
  - بعد Settlement: Inventory `6.000`, Value `51.43`, Average `8.5717`, SUM Lots `6.000`.
  - freeze قبل Settlement = PASS؛ unfreeze بعده و`DLV-2026-300203` = PASS.
- **Atomicity / Rollback:** `CNT-2026-60032` = PASS.
  - Failpoint اختباري مؤقت ومقيد بالجرد أجبر فشلًا داخل Transaction.
  - بعد الفشل: Inventory/Lot `3.000`, Value `3.00`, Settlement rows `0`, Item rows `0`, Adjustment transactions `0`.
  - تم حذف الـFailpoint وإعادة تشغيل الخادم، ثم نجح `ADJ-2026-30011` ووصل Inventory/Lot إلى `4.000` وValue `4.00`.
- **Manual Settlement boundary:** زر التسوية المستقلة بقي Disabled مع Lots Enabled = PASS حسب النطاق المعتمد؛ لم يتم إنشاء Manual Lot Workflow جديد.

التفاصيل الكاملة والقيم المثبتة موثقة في:

- `docs/CMMS_PHASE4_STEP3_SETTLEMENT_UI_RUNTIME_UAT_2026-08-22.md`
- `docs/CMMS_PHASE4_SETTLEMENT_FINAL_CLOSURE_2026-08-22.md`

---

# 3) الحالة النهائية

```text
Main Phase 4 — Settlement Development
✅ COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED

Step 1 — Database Foundation
✅ COMPLETE / LIVE DB VERIFIED

Step 2 — Settlement Valuation & Posting Logic
✅ IMPLEMENTED / TARGETED CHECKS PASSED / RUNTIME VALIDATED

Step 3 — UI + Runtime UAT + Closure
✅ COMPLETE / RUNTIME UAT PASSED / CLOSED
```

### Final stop

> **MAIN PHASE 4 IS CLOSED. DO NOT START MAIN PHASE 5 AUTOMATICALLY.**
