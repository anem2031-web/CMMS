# CMMS — Main Phase 7 Deferral & Future Option B Decision

**Date:** 2026-08-24  
**Decision owner:** Project Owner  
**Applies to:** Main Phase 7 — Inventory Posting Engine  

## 1) القرار المعتمد

بعد إغلاق Main Phase 6 رسميًا ومراجعة الحاجة الفعلية إلى Main Phase 7، قرر صاحب المشروع ما يلي:

> **Main Phase 7 مؤجلة الآن ولن يبدأ تنفيذها. وعند العودة إليها مستقبلًا، يكون اتجاه التنفيذ المعتمد هو Option B: Shared Posting Core صغير ومحافظ، وليس Full Centralized Inventory Posting Engine.**

الحالة الحالية:

```text
Main Phase 6 = OFFICIALLY CLOSED
Main Phase 7 = DEFERRED / NOT STARTED
Main Phase 8 = NOT STARTED
```

هذا القرار لا يعني بدء Main Phase 8 تلقائيًا، ولا يعطي موافقة مسبقة على أي Coding أو DB/Schema/Workflow change.

## 2) ما الذي يعنيه Option B عند استئناف Main Phase 7؟

عند الموافقة لاحقًا على استئناف Main Phase 7، يكون الهدف **استخراج Shared Posting Core محدود** للأجزاء المشتركة التي توجد فائدة واضحة من توحيدها، مع إبقاء Business Rules وسياسات التكلفة الخاصة بكل Workflow داخل خدمته المتخصصة.

أمثلة للـshared primitives المرشحة، بعد إعادة الفحص وقت التنفيذ:

- Inventory row locking / concurrency guard.
- Negative-stock protection.
- Safe quantity mutation primitives.
- Safe stored-value mutation primitives عندما تكون القاعدة نفسها فعلًا.
- Inventory transaction recording primitives.
- Shared atomicity helpers داخل Transaction الحالية للعملية.

هذه أمثلة تصميمية فقط وليست موافقة مسبقة على أسماء APIs أو ملفات أو Migration أو Implementation محدد.

## 3) ما الذي لن يتحول إلى Full Engine؟

لا يعتمد القرار الحالي إنشاء محرك ضخم يقرر كل قواعد Receipt / Issue / Return / Transfer / Disposal / Settlement من مكان واحد.

تبقى السياسات الخاصة داخل Workflows، ومنها على سبيل المثال:

- Receipt weighted-average costing.
- Issue/current-average costing behavior.
- Recipient Return original-issue-cost behavior.
- Supplier Return behavior الحالي.
- Transfer source/destination valuation and Lot movement behavior.
- Disposal behavior الحالي.
- Settlement costing/snapshot rules الحالية.

لا يتم توحيد هذه القواعد قسرًا تحت generic `post(delta, cost)` contract، ولا يتم تمرير اختيار التكلفة الحساسة إلى caller بشكل يسمح بتغيير Accounting behavior المقبول.

## 4) حدود ثابتة عند التنفيذ المستقبلي

عند العودة إلى Main Phase 7، تبقى الحدود التالية ما لم يعتمد صاحب المشروع تغييرًا منفصلًا وصريحًا:

1. **Batch Transfer يبقى per-item / partial success**؛ لا يتحول إلى all-or-nothing batch transaction.
2. **Centralized Document Numbering يبقى خارج Main Phase 7**؛ لا إنشاء `receipt_number_counter` ولا تغيير numbering policy تلقائيًا.
3. لا Historical Cleanup.
4. لا Historical Backfill.
5. لا Historical Revaluation.
6. لا Historical Renumbering.
7. لا Cutover للبيانات التجريبية ضمن Main Phase 7.
8. لا Workflow redesign أو Approval/Maker-Checker/In-Transit behavior جديد ضمن هذا القرار.
9. لا Accounting behavior change بدون موافقة منفصلة.
10. لا تعديل Live DB لمجرد مطابقة Project Schema.
11. إذا احتاج التنفيذ لاحقًا فحص Live DB، فالـLive DB هي مصدر الحقيقة ويُستخدم **SQL واحد فقط في كل مرة** يرسله المساعد لينفذه صاحب المشروع يدويًا.

## 5) Transaction / Audit boundary

Option B يجب أن يحافظ على atomicity والسلوك الحالي لكل Workflow بدل فرض Transaction topology جديدة على كل العمليات.

خصوصًا:

- Shared Core لا يعني Transaction واحدة لكل Batch Transfer.
- لا يتم جعل Audit side-effect حرجًا/داخل transaction إذا كان نقله سيغيّر behavior المقبول حاليًا؛ أي تغيير كهذا يحتاج قرارًا منفصلًا.

## 6) حالة التنفيذ الآن

لم يتم تنفيذ أي كود ضمن Main Phase 7 نتيجة هذا القرار.

لم يتم:

- تعديل Schema.
- تنفيذ Migration أو SQL.
- تعديل Live DB.
- نقل أي Receipt/Issue/Return/Transfer/Disposal/Settlement إلى Shared Core.
- إضافة Centralized Numbering.
- تغيير Batch Transfer.

> **Current stop remains after Main Phase 6 official closure. Main Phase 7 is deferred and not started. Future implementation direction is Option B only, subject to a fresh pre-implementation review and explicit owner approval.**

## 7) الوثائق المرتبطة

- `docs/inventory/INVENTORY_DEVELOPMENT_PLAN_AND_CHANGE_CONTROL.md`
- `docs/PENDING_TASKS.md`
- `docs/INDEX.md`
- `docs/CMMS_MAIN_PHASE6_FINAL_RUNTIME_UAT_AND_OFFICIAL_CLOSURE_2026-08-24.md`
- `docs/CMMS_CENTRALIZED_DOCUMENT_NUMBERING_DEFERRED_2026-08-23.md`
