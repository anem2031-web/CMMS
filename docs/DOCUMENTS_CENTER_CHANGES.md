# مركز المستندات — `/documents`

**التاريخ:** 2026-07-23

## الهدف
صفحة واحدة تجمع الأنواع الستة لمستندات دورة الشراء والمخزون، مبوبة ومرتبة زمنيًا، مع بحث وفلترة وإعادة طباعة — **بلا أي منطق أو صلاحيات جديدة**. كل شيء يُعاد استخدامه حرفيًا من الصفحات الأصلية.

## المبدأ المطبَّق: مصدر واحد للحقيقة
قبل بناء الصفحة، تم انتزاع 4 قوالب طباعة كانت محبوسة كدوال محلية داخل صفحاتها إلى ملفات مشتركة (`client/src/lib/print*.ts`)، ليستخدمها كل من الصفحة الأصلية ومركز المستندات **بنفس الكود تمامًا** دون نسخ:

| القالب | نُقل من | إلى |
|---|---|---|
| الجرد / التسوية / الاستبعاد | `InventoryOperations.tsx` (دوال محلية) | `client/src/lib/printInventoryOperationDocuments.ts` |
| المرتجع | `WarehouseReturnsList.tsx` | `client/src/lib/printReturnDocument.ts` |
| التسليم | `PurchaseCycle.tsx` | `client/src/lib/printDeliveryDocument.ts` |
| الاستلام (RCV) | (أُنشئ سابقًا) | `client/src/lib/printReceiptDocument.ts` |

الصفحات الثلاث الأصلية عُدّلت لتستورد من هذه الملفات بدل التعريف المحلي — **بلا أي تغيير في السلوك أو التصميم**.

## مصادر البيانات (بلا استعلام مجمَّع جديد في الخادم)
الصفحة تستدعي 7 استعلامات tRPC **موجودة أصلاً** بالتوازي، وتُطبّع نتائجها لعرض موحّد في المتصفح فقط (لا تعديل خادم):

| النوع | الاستعلام | ملاحظة الصلاحيات |
|---|---|---|
| طلب شراء | `purchaseOrders.list` | يطبّق نطاق الأدوار نفسه (operator/delegate/food_warehouse...) |
| سند استلام | `warehouseReceipts.list` | — |
| سند تسليم | `deliveryDocuments.list` | — |
| سند مرتجع | `returnDocuments.list` | — |
| عملية استبعاد | `disposal.list` | — |
| عملية جرد | `inventoryCount.listOperations` | — |
| تسوية جرد | `inventoryCount.listSettlements` | — |

## الطباعة لكل نوع (بدون تكرار منطق)
| النوع | عند الضغط على «طباعة» |
|---|---|
| طلب شراء | يفتح نفس نقطة التصدير الحالية `/api/export/po/:id/pdf` |
| سند استلام | `warehouseReceipts.getForPrint` ← `printReceiptDocument` |
| سند تسليم | بيانات الصف من القائمة نفسها ← `printDeliveryReceipt` + `deliveryDocuments.incrementPrint` |
| سند مرتجع | بيانات الصف من القائمة نفسها ← `printReturnDocument` + `returnDocuments.incrementPrint` |
| عملية استبعاد | `disposal.getById` ← `printDisposalDocument` |
| عملية جرد | `inventoryCount.operationDetails` ← `printCountDocument` |
| تسوية جرد | `inventoryCount.settlementDetails` ← `printSettlementDocument` |

## الموقع في الواجهة
- **المسار:** `/documents`
- **القائمة الجانبية:** قسم «اللوجستيات والشراء»، مباشرة بعد «دورة الشراء»
- **الأدوار:** نفس أدوار قسم اللوجستيات بالكامل (`warehouse`, `accountant`, `senior_management`, `executive_director`, `maintenance_manager`, `purchase_requester`, `food_warehouse_manager`, `food_warehouse_assistant`, `owner`, `admin`) — بلا توسيع

## الملفات المتأثرة

### جديدة (5)
- `client/src/pages/DocumentsCenter.tsx`
- `client/src/lib/printInventoryOperationDocuments.ts`
- `client/src/lib/printReturnDocument.ts`
- `client/src/lib/printDeliveryDocument.ts`
- `docs/DOCUMENTS_CENTER_CHANGES.md`

### معدّلة (6)
- `client/src/pages/inventory/InventoryOperations.tsx` (إزالة الدوال المحلية + استيراد من المكتبة المشتركة)
- `client/src/pages/inventory/WarehouseReturnsList.tsx` (نفس الشيء)
- `client/src/pages/purchase/PurchaseCycle.tsx` (نفس الشيء)
- `client/src/App.tsx` (تسجيل المسار `/documents`)
- `client/src/components/layout/DashboardLayout.tsx` (رابط القائمة الجانبية)
- `client/src/i18n/ar.ts` / `en.ts` / `ur.ts` (مفتاح `nav.documentsCenter`)

## ما لم يتغير
- تبويب «الوثائق» داخل `/purchase-cycle` تُرك كما هو تمامًا (بناءً على قرارك)
- لا صلاحيات جديدة، لا جداول جديدة، لا Workflow جديد
- لا تغيير في تصميم أو سلوك أي مستند مطبوع — نفس القوالب حرفيًا

## التحقق
- `tsc --noEmit`: 118 خطأ إجمالاً (تطابق تام مع عدد الأخطاء قبل هذا التغيير) — صفر أخطاء جديدة من ملفاتنا
- `vite build`: نجح كاملًا

## قيود معروفة في هذه النسخة الأولى
- التجميع والفرز والفلترة تتم في المتصفح بعد جلب كل نوع كاملاً (نفس سلوك الصفحات الأصلية لكل نوع اليوم، التي لا ترقّم صفحاتها من الخادم أصلًا)؛ إن كبر حجم البيانات مستقبلاً يُنصح بترقيم من الخادم
- طلب الشراء لا يملك `printCount` معروضًا في الصفحة (الحقل موجود على مستوى الصنف `purchase_order_items.printCount` وليس على مستوى الطلب ذاته)
