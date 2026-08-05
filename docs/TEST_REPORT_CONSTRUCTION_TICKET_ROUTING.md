# تقرير اختبار — توجيه بلاغات الإنشاءات

**التاريخ:** 2026-08-02

## الاختبارات المضافة أو المحدّثة

- `server/tests/constructionTicketRouting.test.ts`
- `server/tests/ticketsAccess.test.ts`
- `server/tests/attachmentsAccess.test.ts`
- `server/tests/splitMaintenanceRoles.test.ts`

## التحقق المنفذ في بيئة التسليم

- فحص تحويل نحوي بواسطة TypeScript لجميع ملفات TS/TSX المتأثرة: **نجح، 27 ملفًا**.
- تحقق ثابت من وجود قيم الجهة المميزة، حقول المخطط والترحيل، مسار صفحة بلاغات الإنشاءات، حارس المسؤول المحدد،
  ومنع مدير الإنشاءات من الفرز وصندوق البلاغات: **نجح**.

## قيد بيئة الاختبار

لم يمكن تثبيت التبعيات لتشغيل `vitest run` أو `tsc --noEmit` الكامل؛ أمر `npm ci` توقف لأن سجل npm الداخلي أعاد
`404 Not Found` للحزمة `zwitch@2.0.4`. لذلك لا تُسجل المجموعة الكاملة كناجحة في هذا التقرير. يجب تشغيل الأوامر
التالية بعد فك الملفات في بيئة المشروع التي تتوفر فيها التبعيات:

```bash
npm ci
npm run check
npm test -- --run server/tests/constructionTicketRouting.test.ts server/tests/ticketsAccess.test.ts server/tests/attachmentsAccess.test.ts server/tests/splitMaintenanceRoles.test.ts
```
