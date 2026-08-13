# إغلاق البلاغ الرئيسي متعدد الجهات + تجميد خطة الجهات بعده

تاريخ التنفيذ: 2026-08-12

## 1. المشكلة المبلَّغ عنها

سؤال صاحب المشروع: «البلاغات الفرعية بعد إغلاقها والمنبثقة من البلاغ الرئيسي، ما مصير البلاغ الرئيسي
في صفحة البلاغات؟» — مع طلب فحص `MT-2026-00253` مباشرة على قاعدة البيانات.

## 2. الدليل من قاعدة البيانات (لا استنتاج من الكود وحده)

```text
id        ticketNumber        status                 workflowModel      maintenancePath  closedAt
1860048   MT-2026-00253       department_planning    department_tasks   (null)           (null)
1860049   MT-2026-00253-01    requester_confirmed    sub_ticket         C                2026-08-12 16:39:34
1860050   MT-2026-00253-02    requester_confirmed    sub_ticket         A                2026-08-12 16:40:29
```

الابنان لم يُغلقا فحسب، بل وصلا إلى `requester_confirmed` (تأكيد مقدّم البلاغ نفسه). ومع ذلك بقي الرأس
`department_planning` بلا `closedAt`، و`updatedAt` متجمد عند `12:41:54` وهي لحظة تحويل آخر مهمة.

توابع الرأس عالقة كذلك:

- `ticket_departments`: جهة واحدة على `active`.
- `ticket_tasks`: مهمتان على `promoted` مع `convertedTicketId` صحيح.
- `ticket_items`: البند التوافقي (`isLegacySingleItem = 1`) على `department_planning`.

مسح شامل للقاعدة أظهر أن الحالة ليست شاذة: **كل** البلاغات الرئيسية عالقة.

```text
MT-2026-00252  department_planning  children=3  finished=2
MT-2026-00253  department_planning  children=2  finished=2
```

## 3. السبب الجذري

ثلاث فجوات متتالية، كل واحدة كافية وحدها:

1. **لا يوجد مسار إغلاق ينطبق على الرأس.** الرأس يُضبط عند الفرز المتعدد على `status = 'department_planning'`
   و`maintenancePath = null` (`tickets.workflow.ts::routeTicketAfterMultiTriage`). ومسارات الإغلاق الثلاثة:

   | الإجراء | الشرط | ينطبق؟ |
   |---|---|---|
   | `close` | `repaired` بلا مسار، أو `ready_for_closure` بمسار B/C | ✗ |
   | `closeBySupervisor` | `ready_for_closure` + مسار A | ✗ |
   | `finalClose` | `verified` بلا مسار | ✗ |

2. **لا يوجد rollup.** `tickets.closure.ts` لم يكن يذكر `parentTicketId` ولا مرة واحدة؛ إغلاق الابن
   لا يُعلم أباه بشيء.

3. **التوابع تمنع أي إغلاق لاحق.** حتى لو فُتح مسار للرأس، البند التوافقي العالق يُسقطه عند
   `assertAllTicketItemsClosed`.

**الأثر:** الرأس يبقى ضمن `openCondition()` إلى الأبد، فيُحتسب في عدّاد `all` وفي `stale` (لأن
`updatedAt` لن يتغير بعد آخر تحويل)، ويظهر في صفحة البلاغات بنفس شكل بلاغ لا يزال قيد العمل تمامًا.

## 4. القرار المعتمد

عُرض خياران على صاحب المشروع، واختار **الإغلاق اليدوي بحارس** لا التلقائي، حفاظًا على توقيع مسؤول فعلي
في سجل التدقيق، مع إضافة **نسبة اكتمال** على الرأس بناءً على حالة الأبناء.

### تعديل مقصود على طلب النسبة

الطلب الأصلي كان احتساب الاكتمال من `requester_confirmed`. رُفض هذا الأساس بعد فحص `confirmCompletion`:
التأكيد لا ينفّذه إلا **مقدّم البلاغ** (أو مالك/أدمن)، فإن لم يدخل أو ترك العمل تتجمد النسبة ويُحجب زر
الإغلاق إلى الأبد — أي إعادة إنتاج نفس العطل في موضع جديد. الفصل المعتمد:

- **الاكتمال** (يفتح زر الإغلاق) = `closed` **أو** `requester_confirmed` — تحت سيطرة الصيانة.
- **التأكيد** (عرض فقط) = `requester_confirmed` وحدها، تظهر كرقم إضافي بجانب النسبة.

## 5. ما نُفِّذ

| الملف | التغيير |
|---|---|
| `shared/ticketUiRules.ts` | `summarizeSubTicketFamily()` — مصدر وحيد لحساب الاكتمال، مع `total > 0` قبل `every()` (قاعدة #1) |
| `server/_core/db/tickets.ts` | `getSubTicketsByParent()` — أبناء بلاغ واحد مرتبين بتسلسل الفرع |
| `server/routers/tickets/tickets.closure.ts` | `closeParentTicket` — الحارس + الإغلاق داخل transaction |
| `server/routers/tickets/tickets.workflow.ts` | `assertDepartmentPlanEditable` + إرجاع `subTicketsSummary` و`pendingSubTickets` من `departmentPlan` |
| `client/src/pages/tickets/TicketDetail.tsx` | لوحة تقدّم + زر الإغلاق + تجميد أزرار الخطة |
| `client/src/pages/tickets/GeneralTicketsList.tsx` | شارة نسبة الاكتمال على بطاقة الرأس |
| `scripts/fix_stuck_parent_tickets.sql` | تصحيح جماعي اختياري للرؤوس العالقة قبل النشر |

### الحارس

`closeParentTicket` يرفض: غير `department_tasks`، الرأس المغلق أصلًا، وجود أي ابن غير منتهٍ (مع تسمية
المتبقي بالاسم في الرسالة)، وحالة `total === 0` (رأس لم تُحوَّل مهامه ليس مكتملًا بل لم يبدأ).

### الإغلاق

داخل transaction واحدة: الرأس (`closed` + `closedAt`) → البنود غير المكتملة → `ticket_departments` إلى
`completed` → `ticket_tasks` من `promoted` إلى `completed`. ثم `ticket_status_history` + `audit_logs`
(`close_parent_ticket`) + إشعارات لمقدّم البلاغ والمديرين.

### تجميد الخطة بعد الإغلاق

سؤال لاحق من صاحب المشروع كشف نقصًا في النسخة الأولى: لم يكن شيء يمنع التعديل بعد الإغلاق. أُضيف
`assertDepartmentPlanEditable` في المواضع الثلاثة. أخطر ما كان ممكنًا قبله:

- `assignDepartmentTask` ينفّذ `updateTicketDepartment(status: 'active')` → جهة "قيد العمل" تحت بلاغ مغلق.
- `promoteDepartmentTask` يحجز تسلسلًا جديدًا وينشئ ابنًا مفتوحًا تحت أب مغلق → ينكسر الحارس والنسبة معًا.

**قرار صريح: لا استثناء لـ admin/owner.** تعديل بلاغ مغلق ليس صلاحية أعلى بل تجاوز لسجل مكتمل؛ من أراد
عملًا إضافيًا يفتح بلاغًا جديدًا. الواجهة تعكس نفس القاعدة (`canManageDept` تصبح `false`) فلا يظهر زر يفشل
عند الضغط.

## 6. قاعدة البيانات

**لا Migration ولا DDL.** القيمتان `completed` في `ticket_departments.status` و`ticket_tasks.status`
موجودتان أصلًا في enum المخطط (`drizzle/schema.ts`)، و`closed` قيمة قائمة في `tickets.status`.

السجلات العالقة قبل النشر لا تُصحح تلقائيًا. الأفضل إغلاق كل رأس مؤهل **من الواجهة** بعد النشر ليُسجَّل
باسم من أغلقه؛ `scripts/fix_stuck_parent_tickets.sql` بديل جماعي فقط عند تراكم أعداد كبيرة، وهو يكتب
`@actor` يدويًا ولا يرسل إشعارات.

## 7. قيود معروفة / خارج النطاق

- **البلاغات الفرعية بعد إغلاق الأب لا تزال قابلة للتعديل.** دورة حياة الابن مستقلة تمامًا (مساره A/B/C
  وحراسه الخاصة)، وتقييدها يمس مسارات الصيانة الثلاثة كلها لا الهيكل الجديد وحده. تُركت عمدًا كمهمة منفصلة.
- **لا يوجد إجراء "إعادة فتح" للرأس.** الإغلاق نهائي حاليًا؛ استئناف العمل يكون ببلاغ جديد.
- **لم يُختبر البناء (`tsc`) في بيئة التنفيذ** لعدم توفر `node_modules` هناك — التحقق كان بالقراءة.
  يجب تشغيل البناء قبل النشر.
