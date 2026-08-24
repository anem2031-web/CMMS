# CMMS — Main Phase 8 Optional Operational Enhancements Decision

**Date:** 2026-08-24  
**Decision owner:** Project Owner  
**Applies to:** Main Phase 8 — Operational Workflow Development

## 1) القرار المعتمد

بعد مراجعة الحاجة الفعلية إلى Main Phase 8، اعتمد صاحب المشروع القرار التالي:

> **Main Phase 8 لن تُنفذ كمرحلة كاملة إلزامية. يتحول نطاقها إلى Optional Operational Enhancements، ويُنفذ لاحقًا فقط ما تثبت الحاجة التشغيلية إليه وبعد موافقة صريحة منفصلة لكل عنصر.**

الحالة الحالية:

```text
Main Phase 6 = OFFICIALLY CLOSED
Main Phase 7 = DEFERRED / NOT STARTED — future direction: Option B Shared Posting Core
Main Phase 8 = DEFERRED / OPTIONAL / NOT STARTED
```

لم يبدأ أي Coding أو SQL أو DB/Schema/Workflow change نتيجة هذا القرار.

## 2) معنى Optional Operational Enhancements

Main Phase 8 لم تعد Package يجب تنفيذ جميع بنودها، ولم تعد Gate إلزامية قبل الانتقال إلى Final Project Hardening / Closure.

كل بند داخلها يصبح Candidate مستقلًا:

1. يُفحص الموجود فعليًا أولًا.
2. تُحدد الحاجة التشغيلية: `Need / Don't Need`.
3. إذا كانت `Need`، يُعرض الـWorkflow الحالي والمقترح والأثر.
4. لا يبدأ التنفيذ إلا بعد موافقة صريحة على البند المحدد.

يمكن اعتماد صفر أو بعض أو كل العناصر. عدم تنفيذ Candidate غير مطلوب لا يعتبر نقصًا في النظام ولا يعيد فتح أي مرحلة مغلقة.

## 3) Candidates الحالية

تظل العناصر التالية أمثلة مرشحة فقط، وليست Scope إلزاميًا:

- Settlement approvals.
- Disposal approvals.
- Maker / Checker.
- Direct Receipt approval.
- Warehouse Transfer `In Transit`.
- Destination Warehouse Receipt / confirmation.
- Repeated partial receiving.
- Repeated partial issue.
- Lot / Batch / Expiry enhancements فوق القدرات الموجودة فعليًا عند الحاجة.
- Rack / Bin / Location.
- Min / Max.
- Safety Stock.
- Reorder Point.

وجود Candidate في القائمة لا يعني أنه معتمد للتنفيذ.

## 4) Approval gate لكل عنصر

قبل تنفيذ أي Candidate يجب:

1. فحص أحدث Full Project باعتباره مصدر الحقيقة للكود والتوثيق الموجود فعليًا.
2. التعامل مع Live DB باعتبارها مصدر الحقيقة لهيكل وحالة البيانات عند الحاجة.
3. تحليل الـWorkflow الحالي وعدم افتراض أن الوظيفة غير موجودة أو ناقصة.
4. توضيح الحاجة والفائدة والتكلفة والمخاطر.
5. تحديد الأثر على UI / Permissions / DB / Posting / Accounting / Audit إن وجد.
6. الحصول على موافقة صريحة منفصلة من صاحب المشروع.

الموافقة على هذا المستند ليست موافقة على أي Candidate بعينه.

## 5) حدود ثابتة ما لم تُعتمد منفصلة

- لا Workflow redesign تلقائي.
- لا Maker/Checker أو Approval states جديدة تلقائيًا.
- لا `In Transit` أو Destination Receipt behavior تلقائيًا.
- Batch Transfer يبقى per-item / partial success ولا يتحول إلى all-or-nothing بدون موافقة منفصلة.
- Centralized Document Numbering يبقى DEFERRED؛ لا `receipt_number_counter` تلقائيًا.
- لا Historical Cleanup.
- لا Historical Backfill.
- لا Historical Revaluation.
- لا Historical Renumbering.
- لا Accounting behavior change بدون موافقة منفصلة.
- لا Cutover للبيانات التجريبية ضمن Main Phase 8.
- لا تعديل Live DB لمجرد مطابقة Project Schema.
- إذا احتجنا SQL مستقبلًا: أمر SQL واحد فقط في كل مرة، ينفذه صاحب المشروع يدويًا ويرسل النتيجة قبل الأمر التالي.

## 6) العلاقة مع Main Phase 7

قرار Main Phase 8 لا يغيّر قرار Main Phase 7:

- Main Phase 7 تبقى DEFERRED / NOT STARTED.
- عند استئنافها مستقبلًا يكون الاتجاه Option B — Shared Posting Core صغير ومحافظ.
- لا يلزم تنفيذ Main Phase 7 لمجرد مناقشة Candidate اختياري من Main Phase 8، والعكس صحيح؛ أي dependency فعلية تُحلل وقتها ولا تُفترض مسبقًا.

## 7) أثر القرار على الإغلاق النهائي

Main Phase 8 تبقى **آخر Main Phase اسمًا في الـRoadmap الحالي**، لكن تنفيذها الكامل ليس متطلبًا إلزاميًا لإغلاق المشروع.

عند الوصول إلى Final Project Hardening / Closure، يتم التعامل فقط مع البنود التي سبق اعتمادها أو التي تظهر كمتطلبات حاجبة فعلية؛ لا يُعاد إدخال كل Candidates الاختيارية تلقائيًا إلى Scope الإغلاق.

الـIndependent Cutover للبيانات التجريبية يبقى مرحلة منفصلة لاحقًا ولا يبدأ بهذا القرار.

## 8) حالة التنفيذ الآن

تم توثيق القرار فقط. لم يتم:

- تعديل Code.
- تعديل Schema.
- إنشاء Migration.
- تنفيذ SQL.
- تعديل Live DB.
- إضافة Approval Workflow.
- إضافة Maker/Checker.
- إضافة In-Transit workflow.
- تغيير Batch Transfer.
- تنفيذ Centralized Numbering.
- تنفيذ Historical work أو Cutover.

> **Current decision: Main Phase 8 = DEFERRED / OPTIONAL / NOT STARTED. Execute only explicitly selected operational enhancements later, if needed.**

## 9) الوثائق المرتبطة

- `docs/inventory/INVENTORY_DEVELOPMENT_PLAN_AND_CHANGE_CONTROL.md`
- `docs/PENDING_TASKS.md`
- `docs/INDEX.md`
- `docs/CMMS_MAIN_PHASE7_DEFERRAL_AND_OPTION_B_SHARED_POSTING_CORE_DECISION_2026-08-24.md`
- `docs/CMMS_MAIN_PHASE6_FINAL_RUNTIME_UAT_AND_OFFICIAL_CLOSURE_2026-08-24.md`
- `docs/CMMS_CENTRALIZED_DOCUMENT_NUMBERING_DEFERRED_2026-08-23.md`
