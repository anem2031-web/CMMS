# CMMS — قرار إعادة تجميع وترقيم المراحل الرئيسية المتبقية للمخزون

**التاريخ:** 2026-08-22  
**الحالة:** APPROVED ROADMAP DOCUMENTATION UPDATE  
**نوع التغيير:** Documentation / Roadmap only — لا Code ولا SQL ولا Live DB change

## 1. نقطة الانطلاق

- Main Phase 3 = COMPLETE / RUNTIME UAT PASSED / CLOSED.
- Main Phase 4 = COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED.
- التوقف يبقى بعد Phase 4 وقبل بدء Main Phase 5.
- لا تعيد إعادة الترقيم فتح Phase 3 أو Phase 4.

## 2. القرار المعتمد

بقرار صاحب المشروع تم تجميع وإعادة ترقيم المراحل المتبقية كما يلي:

| النطاق السابق | النطاق الحالي المعتمد |
|---|---|
| المرحلة 5 — Disposal / Write-off | Main Phase 5 / 5.1 |
| المرحلة 6 — Returns | Main Phase 5 / 5.2 |
| المرحلة 7 — Receipt / Issue / Transfer Review | Main Phase 5 / 5.3 |
| المرحلة 8 — Inventory Reconciliation | Main Phase 5 / 5.4 |
| المرحلة 9 — Inventory & Accounting Reports | Main Phase 6 |
| المرحلة 10 — Inventory Posting Engine | Main Phase 7 |
| المرحلة 11 — Operational Workflow Development | Main Phase 8 |

## 3. الـRoadmap الحالي بعد القرار

### Main Phase 5 — تطوير وضبط العمليات المخزنية والمطابقة

تجمع أربعة مسارات ضمن مرحلة رئيسية واحدة:

1. **5.1 — Disposal / Write-off**
2. **5.2 — Returns**
3. **5.3 — Receipt / Issue / Warehouse Transfer Review**
4. **5.4 — Inventory Reconciliation**

**الحالة:** NOT STARTED.

### Main Phase 6 — التقارير المخزنية والمحاسبية

هو نطاق المرحلة 9 سابقًا، دون تغيير وظيفي في النطاق.

**الحالة:** NOT STARTED.

### Main Phase 7 — Inventory Posting Engine

هو نطاق المرحلة 10 سابقًا. الهدف محرك مركزي لحركات المخزون مع الحفاظ على Workflow/السلوك الحالي أثناء الـrefactor ما لم تتم الموافقة صراحة على خلاف ذلك.

**الحالة:** NOT STARTED.

### Main Phase 8 — تطوير الـWorkflow التشغيلي

هو نطاق المرحلة 11 سابقًا. لا يبدأ تلقائيًا، وكل تغيير Workflow داخله يحتاج موافقة صريحة مستقلة على العنصر المحدد.

**الحالة:** NOT STARTED / EXPLICIT APPROVAL REQUIRED PER ITEM.

## 4. ما لم يتغير بهذا القرار

- لا Code change.
- لا Schema/Migration/SQL.
- لا تعديل Live DB.
- لا Historical Backfill.
- لا Legacy Cleanup.
- لا Accounting behavior change.
- لا Workflow change.
- لا إعادة فتح Phase 3 أو Phase 4.
- `2B-10-2C — Integrity Rules, UAT & Closure` يبقى مؤجلًا إلى Final Project Hardening / Closure.

## 5. قاعدة الرجوع للمستندات القديمة

أي وثيقة تاريخية كتبت قبل هذا القرار قد تستخدم أرقام المراحل القديمة 5–11. عند التعارض في **الترقيم فقط**، تستخدم خريطة التحويل في هذه الوثيقة والخطة الرئيسية الحالية. لا يعاد كتابة وثائق الإغلاق التاريخية لمجرد تغيير ترقيم الـRoadmap.

## 6. نقطة التوقف بعد إعادة التوثيق

> **STOP AFTER MAIN PHASE 4 OFFICIAL CLOSURE / BEFORE NEW MAIN PHASE 5. DO NOT START MAIN PHASE 5 AUTOMATICALLY.**
