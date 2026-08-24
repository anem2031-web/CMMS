// ============================================================
// قالب طباعة وثيقة المرتجع — مصدر واحد مشترك بين صفحة المرتجعات
// ومركز المستندات — انتُزع حرفيًا من
// client/src/pages/inventory/WarehouseReturnsList.tsx بلا أي تعديل
// ============================================================
import QRCode from "qrcode";

export function fmtDate(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

// طباعة وثيقة المرتجع — نفس القالب المستخدم بتبويب "التوثيق"
// يبني نص HTML الكامل للوثيقة (بلا فتح نافذة) — يُستخدم من الطباعة المباشرة
// ومن تصدير/عرض PDF الحقيقي عبر الخادم (Puppeteer) بنفس القالب حرفيًا
export async function buildReturnDocumentHtml(doc: any): Promise<string> {
  const qrValue = doc.manufacturerBarcode || doc.internalCode || doc.returnNumber;
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(qrValue, { width: 130, margin: 1 });
  } catch { /* لو فشل التوليد، نعرض الوثيقة بدون QR بدل ما نوقف الطباعة */ }

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"/><title>${doc.returnNumber}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Cairo',Arial,sans-serif;background:#fff;color:#1a1a1a;padding:32px 40px;font-size:13px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #7f1d1d;padding-bottom:14px;margin-bottom:20px}
.header-title{font-size:20px;font-weight:700;color:#7f1d1d}
.header-sub{font-size:11px;color:#555;margin-top:4px}
.header-meta{text-align:left;font-size:11px;color:#555;line-height:2}
.badge{display:inline-block;background:#7f1d1d;color:#fff;padding:3px 10px;border-radius:4px;font-size:13px;font-weight:700}
.section{margin-bottom:16px}
.section-title{font-size:12px;font-weight:700;color:#7f1d1d;background:#fef2f2;padding:5px 10px;border-radius:4px;margin-bottom:10px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}
.field{display:flex;flex-direction:column;gap:2px}
.field-label{font-size:10px;color:#777}
.field-value{font-size:13px;font-weight:600;color:#111}
.item-id-row{display:flex;align-items:center;gap:16px;border:1px solid #f3d2d2;border-radius:8px;padding:10px 14px;margin-bottom:16px;background:#fffafa}
.sig-section{margin-top:32px;display:grid;grid-template-columns:1fr 1fr;gap:32px}
.sig-box{border-top:1px solid #bbb;padding-top:8px;text-align:center;font-size:11px;color:#555}
.footer{margin-top:24px;border-top:1px solid #eee;padding-top:10px;display:flex;justify-content:space-between;font-size:10px;color:#aaa}
.print-count{font-size:11px;color:#888;background:#f4f6fa;border:1px solid #dde3ea;border-radius:20px;padding:2px 12px}
@media print{@page{margin:10mm}}
</style></head>
<body>
<div class="header">
  <div>
    <div class="header-title">↩️ وثيقة مرتجع</div>
    <div class="header-sub">نظام إدارة الصيانة المتكامل</div>
  </div>
  <div class="header-meta">
    <div>التاريخ: <strong>${new Date(doc.createdAt).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"})}</strong></div>
    <div><span class="badge">${doc.returnNumber}</span></div>
    ${doc.poNumber ? `<div>طلب شراء: <strong>${doc.poNumber}</strong></div>` : ""}
  </div>
</div>
${qrDataUrl ? `<div class="item-id-row">
  <img src="${qrDataUrl}" width="90" height="90" style="border:1px solid #eee;border-radius:6px"/>
  <div>
    <div class="field-label">رقم الصنف (باركود المصنع)</div>
    <div class="field-value" style="font-size:16px;font-family:monospace">${doc.manufacturerBarcode || doc.internalCode || "—"}</div>
  </div>
</div>` : ""}
<div class="section">
  <div class="section-title">بيانات المرتجع</div>
  <div class="grid">
    <div class="field"><span class="field-label">اسم الصنف</span><span class="field-value">${doc.itemName}</span></div>
    <div class="field"><span class="field-label">الكمية المُرجَعة</span><span class="field-value">${doc.returnedQuantity} ${doc.unit||""}</span></div>
    <div class="field"><span class="field-label">نفّذ الإرجاع</span><span class="field-value">${doc.returnedByName}</span></div>
    ${doc.sourceDeliveryNumber
      ? `<div class="field"><span class="field-label">سند الصرف الأصلي</span><span class="field-value">${doc.sourceDeliveryNumber}</span></div>
         <div class="field"><span class="field-label">المستلم الأصلي</span><span class="field-value">${doc.sourceDeliveredToName || doc.recipientName || "—"}</span></div>
         ${doc.lotCode ? `<div class="field"><span class="field-label">الـLot الأصلي</span><span class="field-value">${doc.lotCode}</span></div>` : ""}`
      : `${doc.receiptNumber ? `<div class="field"><span class="field-label">سند الاستلام المرتبط</span><span class="field-value">${doc.receiptNumber}</span></div>` : `<div class="field"><span class="field-label">سند الاستلام</span><span class="field-value">— (إرجاع عام بلا مصدر معروف)</span></div>`}
         ${doc.invoiceNumber ? `<div class="field"><span class="field-label">رقم فاتورة المورد</span><span class="field-value">${doc.invoiceNumber}</span></div>` : ""}
         ${doc.vendorName ? `<div class="field"><span class="field-label">المورد</span><span class="field-value">${doc.vendorName}</span></div>` : ""}`}
    <div class="field" style="grid-column:1/-1"><span class="field-label">سبب الإرجاع</span><span class="field-value">${doc.reason}</span></div>
  </div>
</div>
<div class="sig-section">
  ${doc.sourceDeliveryNumber
    ? `<div class="sig-box">توقيع مستلم المستودع<br/>${doc.returnedByName}</div>
       <div class="sig-box">توقيع مُعيد الصنف<br/>${doc.recipientName || doc.sourceDeliveredToName || "&nbsp;"}</div>`
    : `<div class="sig-box">توقيع منفّذ الإرجاع<br/>${doc.returnedByName}</div>
       <div class="sig-box">توقيع المستلم<br/>${doc.recipientName || "&nbsp;"}</div>`}
</div>
<div class="footer">
  <span>وثيقة آلية — نظام CMMS</span>
  <span class="print-count">عدد مرات الطباعة: <strong>${doc.printCount + 1}</strong></span>
</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`;

  return html;
}

// الطباعة المباشرة (نافذة منبثقة) — تستخدم نفس buildReturnDocumentHtml أعلاه
export async function printReturnDocument(doc: any, onPrinted: () => void) {
  onPrinted();
  // نفتح النافذة فوراً (متزامن مع الضغطة) لتفادي حظر المتصفح للنوافذ المنبثقة
  const win = window.open("", "_blank", "width=860,height=780");
  const html = await buildReturnDocumentHtml(doc);
  if (win) { win.document.write(html); win.document.close(); }
}
