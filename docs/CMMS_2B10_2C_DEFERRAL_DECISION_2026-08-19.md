# CMMS — 2B-10-2C Deferral Decision

**Date:** 2026-08-19  
**Decision owner:** Project Owner  
**Status:** **DEFERRED — move to Final Project Hardening / Closure**

## Decision

تم اعتماد **تأجيل 2B-10-2C — Integrity Rules, UAT & Closure** إلى مرحلة التقوية والإغلاق النهائي للمشروع، بدل تنفيذها الآن.

هذا القرار لا يغيّر حالة الأجزاء المكتملة:

- **2B-10-1 — Catalog Governance / Permissions:** ✅ COMPLETE / UAT PASSED
- **2B-10-2A — Catalog Audit Trail:** ✅ COMPLETE / UAT PASSED
- **2B-10-2B — Catalog Relationship & Inactive Data Protection:** ✅ COMPLETE / UAT PASSED
- **2B-10-2C — Integrity Rules, UAT & Closure:** ⏳ DEFERRED

وبالتالي فإن الوصف الأدق لحالة `2B-10` حاليًا هو:

> **Implementation complete through 2B-10-2B; final integrity closure deferred.**

لا تُسجَّل `2B-10` كـFinal Closed حتى تنفيذ 2B-10-2C لاحقًا.

## Why defer 2B-10-2C

قواعد Integrity النهائية مثل FK / UNIQUE / constraints أو أي hardening شامل تكون أكثر أمانًا بعد استقرار بقية أجزاء المشروع والعلاقات النهائية بينها. تنفيذها الآن قد يفرض قيودًا مبكرة أو يربط قرارات سلامة البيانات بتصميم لم يكتمل بعد.

القرار يحافظ على المبدأ المعتمد في 2B-10:

> **Protect the future without rewriting existing production/business data or changing accepted workflows unless separately approved.**

## Scope when resumed at final project closure

عند العودة إلى 2B-10-2C في نهاية المشروع، يجب أولًا إعادة فحص **Live DB** ثم تحديد الفجوات الفعلية المتبقية، مع الفصل بين:

1. mandatory future protection،
2. application-level validation،
3. DB constraints التي ثبت أنها آمنة،
4. historical/legacy issues التي لا يجب إصلاحها تلقائيًا.

بعد اعتماد النطاق صراحةً فقط يتم التنفيذ، ثم UAT النهائي، ثم إغلاق 2B-10 رسميًا.

## Explicitly not done by this decision

هذا التوثيق **لا ينفذ** ولا يوافق تلقائيًا على أي من التالي:

- إضافة FK أو UNIQUE أو Migration،
- Backfill أو historical cleanup،
- إصلاح orphan inactive Catalog Items،
- إصلاح duplicate PO numbers،
- إصلاح `PR-2026-0378`،
- تغيير Workflow أو permissions أو architecture،
- أي Code / DB / Schema change.

## Next-phase note

يمكن الانتقال إلى المرحلة التالية المخطط لها في المشروع دون اعتبار 2B-10-2C منجزة. هذا القرار يؤجل **Final Integrity Closure** فقط، ولا يبدأ أي مرحلة أخرى تلقائيًا.
