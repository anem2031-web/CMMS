# عرض وتنزيل PDF — إضافة إلى مركز المستندات

**التاريخ:** 2026-07-23

## الهدف
زرّان إضافيان بجانب زر «طباعة» لكل مستند في مركز المستندات (`/documents`): 👁️ **عرض PDF** و⬇️ **تنزيل PDF** — لكل الأنواع الستة، بلا أي تكرار لمنطق القوالب.

## المبدأ: نفس HTML، مخرج مختلف فقط
كل قوالب الطباعة كانت تبني نص HTML ثم تفتحه مباشرة في نافذة طباعة تفاعلية. لدعم عرض/تنزيل **ملف PDF حقيقي**، تم فصل كل قالب إلى طبقتين:

| الطبقة | الوظيفة |
|---|---|
| `buildXxxHtml(...)` | دالة نقية تُرجع نص HTML فقط (بلا فتح نافذة) |
| `printXxx(...)` | تستدعي `buildXxxHtml` ثم تفتح نافذة الطباعة التفاعلية (**نفس السلوك القديم تمامًا، بلا أي تغيير**) |

نفس نص الـHTML الذي يُطبَع الآن يُرسَل أيضًا لنقطة تصدير عامة بالخادم تحوّله لملف PDF حقيقي عبر خدمة Puppeteer الموجودة مسبقًا بالمشروع (`htmlToPdfService.ts`، نفس المحرك المستخدم لتصدير طلبات الشراء) — **بلا كتابة أي قالب تصميم جديد**.

## الملفات

### جديدة (2)
| المسار | الوصف |
|---|---|
| `client/src/lib/exportHtmlToPdf.ts` | `viewDocumentAsPdf(html, filename)` يفتح تبويب جديد بملف PDF، و`downloadDocumentAsPdf(html, filename)` ينزّله مباشرة — كلاهما عبر نفس نقطة التصدير بالخادم |
| `docs/DOCUMENTS_PDF_VIEW_DOWNLOAD.md` | هذا الملف |

### معدّلة (6)
| المسار | التغيير |
|---|---|
| `server/_core/index.ts` | نقطة تصدير جديدة `POST /api/export/html-to-pdf` — تستقبل `{ html, filename }` وتُرجع PDF عبر `htmlToPdf()` الموجودة، مع `?download=1` للتنزيل أو بدونها للعرض المباشر (`inline`) |
| `client/src/lib/printReceiptDocument.ts` | فصل `buildReceiptHtml` عن `printReceiptDocument` |
| `client/src/lib/printDeliveryDocument.ts` | فصل `buildDeliveryReceiptHtml` عن `printDeliveryReceipt` |
| `client/src/lib/printReturnDocument.ts` | فصل `buildReturnDocumentHtml` عن `printReturnDocument` |
| `client/src/lib/printInventoryOperationDocuments.ts` | فصل `buildCountHtml` / `buildSettlementHtml` / `buildDisposalHtml` عن دوال الطباعة الثلاث |
| `client/src/pages/DocumentsCenter.tsx` | زرّا 👁️ عرض و⬇️ تنزيل بجانب 🖨️ طباعة لكل صف؛ دالة موحّدة `buildHtmlForRow` تبني الـHTML مرة واحدة وتُستخدم للطباعة وللعرض وللتنزيل معًا |

## طلب الشراء (استثناء)
طلب الشراء له مسار تصدير PDF حقيقي موجود مسبقًا (`/api/export/po/:id/pdf`, يستخدم Puppeteer أيضًا لكن بقالب خاص بطلبات الشراء). العرض والتنزيل له يستخدمان نفس هذه النقطة الموجودة، وليس النقطة العامة الجديدة.

## ملاحظة مهمة: عدّاد الطباعة لا يتأثر بالعرض/التنزيل
عدّادات الطباعة (`printCount`) الموجودة على سند الاستلام والتسليم والمرتجع **تُحدَّث فقط عند الضغط على زر «طباعة»**، وليس عند العرض أو التنزيل، لتبقى الأرقام معبّرة عن الطباعة الفعلية فقط. إن كنت تفضّل اعتبار التنزيل/العرض "طباعة" أيضًا لأغراض العدّاد، يمكن تعديل هذا لاحقًا بسهولة.

## الأثر التقني
نقطة التصدير الجديدة تستخدم نفس متصفح Chromium المشترك (Puppeteer) المُدار مسبقًا في `htmlToPdfService.ts` لتصدير طلبات الشراء — لا عبء تقني جديد، ولا تثبيت حزم إضافية.

## التحقق
- `tsc --noEmit`: 118 خطأ إجمالاً (نفس العدد قبل هذا التغيير تمامًا) — صفر أخطاء جديدة
- `vite build`: نجح كاملًا
