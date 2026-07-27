// ============================================================
// قوالب طباعة مستندات عمليات المخزون (جرد / تسوية / استبعاد)
// مصدر واحد مشترك بين صفحة عمليات المخزون ومركز المستندات —
// انتُزعت حرفيًا من client/src/pages/inventory/InventoryOperations.tsx
// بلا أي تعديل على المنطق أو التصميم.
// ============================================================

export function fmtDate(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA");
}
export function fmtMoney(v: any) {
  if (!v) return "0 ر.س";
  return `${parseFloat(String(v)).toLocaleString()} ر.س`;
}

export function buildCountHtml(data: { operation: any; items: any[] }): string {
    const op = data.operation;
    const itemsRows = (data.items || []).map((it: any) => {
      const diff = it.diffQuantity !== null && it.diffQuantity !== undefined ? parseFloat(it.diffQuantity) : null;
      const diffCell = diff === null
        ? `<span style="color:#999">لم يُعدّ بعد</span>`
        : diff === 0
          ? `<span style="color:#059669;font-weight:700">مطابق</span>`
          : `<span style="color:${diff > 0 ? "#2563eb" : "#dc2626"};font-weight:700">${diff > 0 ? `+${diff}` : diff}</span>`;
      return `
      <tr>
        <td>${it.itemName}</td>
        <td style="text-align:center;font-family:monospace">${parseFloat(it.systemQuantity).toLocaleString()} ${it.unit || ""}</td>
        <td style="text-align:center;font-family:monospace">${it.countedQuantity !== null && it.countedQuantity !== undefined ? parseFloat(it.countedQuantity).toLocaleString() + " " + (it.unit || "") : "—"}</td>
        <td style="text-align:center">${diffCell}</td>
        <td style="text-align:center;font-size:11px">${it.lotNumber || "—"}${it.expiryDate ? ` / ${fmtDate(it.expiryDate)}` : ""}</td>
        <td style="font-size:11px;color:#555">${it.notes || "—"}</td>
      </tr>`;
    }).join("");

    const countedItems = (data.items || []).filter((it: any) => it.countedQuantity !== null && it.countedQuantity !== undefined);
    const discrepancies = countedItems.filter((it: any) => parseFloat(it.diffQuantity || "0") !== 0);
    const isFinal = op.status === "completed";
    const themeColor = "#0f766e"; // teal — يميّز وثيقة الجرد عن وثيقة الاستبعاد (أحمر)

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
<meta charset="UTF-8"/><title>وثيقة جرد ${op.operationNumber}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Cairo',Arial,sans-serif;background:#fff;color:#1a1a1a;padding:32px 40px;font-size:13px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${themeColor};padding-bottom:16px;margin-bottom:20px}
.header-title{font-size:22px;font-weight:900;color:${themeColor}}
.header-sub{font-size:11px;color:#666;margin-top:4px}
.header-meta{text-align:left;font-size:11px;color:#555;line-height:2.2}
.badge{display:inline-block;background:${themeColor};color:#fff;padding:4px 14px;border-radius:6px;font-size:14px;font-weight:700}
.status-badge{display:inline-block;padding:3px 10px;border-radius:5px;font-size:11px;font-weight:700;margin-right:6px}
.info-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.info-box{border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;background:#fafafa}
.info-label{font-size:10px;color:#888;margin-bottom:3px}
.info-value{font-size:13px;font-weight:700;color:#111}
.section-title{font-size:12px;font-weight:700;color:${themeColor};background:#f0fdfa;padding:6px 12px;border-radius:6px;margin-bottom:12px;border-right:4px solid ${themeColor}}
table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}
thead tr{background:${themeColor};color:#fff}
thead th{padding:8px 10px;text-align:right;font-weight:600}
tbody tr:nth-child(even){background:#f0fdfa}
tbody tr:nth-child(odd){background:#fff}
tbody td{padding:8px 10px;border-bottom:1px solid #f3f4f6}
.totals-row{background:#1a1a1a!important;color:#fff!important;font-weight:700}
.totals-row td{padding:10px;border:none!important;color:#fff}
.sig-section{margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
.sig-box{border-top:2px solid ${themeColor};padding-top:10px;text-align:center;font-size:11px;color:#555}
.sig-name{font-size:14px;font-weight:700;color:#1a1a1a;margin-top:4px}
.footer{margin-top:24px;border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;font-size:10px;color:#aaa}
@media print{@page{margin:12mm}body{padding:0}}
</style></head><body>
<div class="header">
  <div>
    <div class="header-title">📋 وثيقة جرد مخزون</div>
    <div class="header-sub">نظام إدارة الصيانة المتكامل — CMMS</div>
  </div>
  <div class="header-meta">
    <div>التاريخ: <strong>${new Date(op.operationDate).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"})}</strong> — اليوم: <strong>${op.riyadhDayName || "—"}</strong></div>
    <div>وقت البدء: <strong>${op.riyadhStartTime || "—"}</strong> (بتوقيت الرياض)</div>
    <div><span class="badge">${op.operationNumber}</span></div>
  </div>
</div>
<div class="info-grid">
  <div class="info-box"><div class="info-label">نطاق الجرد</div><div class="info-value">${op.scope === "full" ? "شامل" : "جزئي"}</div></div>
  <div class="info-box"><div class="info-label">المنفذ</div><div class="info-value">${op.creatorName || "—"}</div></div>
  <div class="info-box"><div class="info-label">عدد الأصناف المعدودة</div><div class="info-value">${countedItems.length} من ${data.items?.length || 0}</div></div>
  <div class="info-box"><div class="info-label">الحالة</div><div class="info-value"><span class="status-badge" style="background:${isFinal ? "#dcfce7" : "#fef3c7"};color:${isFinal ? "#166534" : "#92400e"}">${isFinal ? "✅ نهائي (مقفل)" : "مسودة"}</span></div></div>
</div>
<div class="section-title">تفاصيل الأصناف</div>
<table>
  <thead><tr>
    <th>اسم الصنف</th>
    <th style="text-align:center">كمية النظام</th>
    <th style="text-align:center">الكمية المعدودة</th>
    <th style="text-align:center">الفرق</th>
    <th style="text-align:center">دفعة/صلاحية</th>
    <th>ملاحظة</th>
  </tr></thead>
  <tbody>
    ${itemsRows}
    <tr class="totals-row">
      <td>الإجمالي</td>
      <td style="text-align:center">${data.items?.length || 0} صنف</td>
      <td style="text-align:center">${countedItems.length} معدود</td>
      <td style="text-align:center">${discrepancies.length} فرق</td>
      <td></td><td></td>
    </tr>
  </tbody>
</table>
<div class="sig-section">
  <div class="sig-box"><div>توقيع المنفذ</div><div class="sig-name">${op.creatorName || "—"}</div></div>
  <div class="sig-box"><div>اعتماد المسؤول</div><div class="sig-name">&nbsp;</div></div>
</div>
<div class="footer">
  <span>وثيقة آلية — نظام CMMS | ${op.operationNumber}</span>
  <span>تاريخ الطباعة: ${new Date().toLocaleDateString("ar-SA")}</span>
</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`;

    return html;
  }

// الطباعة المباشرة (نافذة منبثقة) — تستخدم نفس buildCountHtml أعلاه
export function printCountDocument(data: { operation: any; items: any[] }) {
  const html = buildCountHtml(data);
  const win = window.open("", "_blank", "width=900,height=800");
  if (win) { win.document.write(html); win.document.close(); }
}

export function buildSettlementHtml(data: { settlement: any; items: any[] }): string {
    const s = data.settlement;
    const itemsRows = (data.items || []).map((it: any) => {
      const diff = parseFloat(it.diffQuantity || "0");
      const diffCell = diff === 0
        ? `<span style="color:#059669;font-weight:700">لا يوجد فرق</span>`
        : `<span style="color:${diff > 0 ? "#2563eb" : "#dc2626"};font-weight:700">${diff > 0 ? `+${diff}` : diff}</span>`;
      return `
      <tr>
        <td>${it.itemName}</td>
        <td style="text-align:center;font-family:monospace">${parseFloat(it.beforeQuantity).toLocaleString()} ${it.unit || ""}</td>
        <td style="text-align:center;font-family:monospace">${parseFloat(it.afterQuantity).toLocaleString()} ${it.unit || ""}</td>
        <td style="text-align:center">${diffCell}</td>
        <td style="text-align:center;font-size:11px">${it.lotNumber || "—"}${it.expiryDate ? ` / ${fmtDate(it.expiryDate)}` : ""}</td>
      </tr>`;
    }).join("");
    const themeColor = "#7e22ce"; // بنفسجي — يميّز وثيقة التسوية

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
<meta charset="UTF-8"/><title>وثيقة تسوية ${s.settlementNumber}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Cairo',Arial,sans-serif;background:#fff;color:#1a1a1a;padding:32px 40px;font-size:13px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${themeColor};padding-bottom:16px;margin-bottom:20px}
.header-title{font-size:22px;font-weight:900;color:${themeColor}}
.header-sub{font-size:11px;color:#666;margin-top:4px}
.header-meta{text-align:left;font-size:11px;color:#555;line-height:2.2}
.badge{display:inline-block;background:${themeColor};color:#fff;padding:4px 14px;border-radius:6px;font-size:14px;font-weight:700}
.info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
.info-box{border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;background:#fafafa}
.info-label{font-size:10px;color:#888;margin-bottom:3px}
.info-value{font-size:13px;font-weight:700;color:#111}
.section-title{font-size:12px;font-weight:700;color:${themeColor};background:#faf5ff;padding:6px 12px;border-radius:6px;margin-bottom:12px;border-right:4px solid ${themeColor}}
.notes-box{border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;background:#fffbf0;font-size:12px;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}
thead tr{background:${themeColor};color:#fff}
thead th{padding:8px 10px;text-align:right;font-weight:600}
tbody tr:nth-child(even){background:#faf5ff}
tbody tr:nth-child(odd){background:#fff}
tbody td{padding:8px 10px;border-bottom:1px solid #f3f4f6}
.sig-section{margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
.sig-box{border-top:2px solid ${themeColor};padding-top:10px;text-align:center;font-size:11px;color:#555}
.sig-name{font-size:14px;font-weight:700;color:#1a1a1a;margin-top:4px}
.footer{margin-top:24px;border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;font-size:10px;color:#aaa}
@media print{@page{margin:12mm}body{padding:0}}
</style></head><body>
<div class="header">
  <div>
    <div class="header-title">🧾 وثيقة تسوية مخزون</div>
    <div class="header-sub">نظام إدارة الصيانة المتكامل — CMMS</div>
  </div>
  <div class="header-meta">
    <div>التاريخ: <strong>${new Date(s.appliedAt).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"})}</strong></div>
    <div>وقت الإصدار: <strong>${new Date().toLocaleTimeString("ar-SA")}</strong></div>
    <div><span class="badge">${s.settlementNumber}</span></div>
  </div>
</div>
<div class="info-grid">
  <div class="info-box"><div class="info-label">المصدر</div><div class="info-value">${s.sourceType === "from_count" ? "من عملية جرد" : "تسوية مستقلة"}</div></div>
  <div class="info-box"><div class="info-label">المسؤول</div><div class="info-value">${s.appliedByName || "—"}</div></div>
  <div class="info-box"><div class="info-label">عدد الأصناف</div><div class="info-value">${data.items?.length || 0} صنف</div></div>
</div>
<div class="notes-box">📝 <strong>سبب التسوية:</strong> ${s.reason}</div>
<div class="section-title">تفاصيل الأصناف المسوّاة</div>
<table>
  <thead><tr>
    <th>اسم الصنف</th>
    <th style="text-align:center">الكمية قبل</th>
    <th style="text-align:center">الكمية بعد</th>
    <th style="text-align:center">الفرق</th>
    <th style="text-align:center">دفعة/صلاحية</th>
  </tr></thead>
  <tbody>${itemsRows}</tbody>
</table>
<div class="sig-section">
  <div class="sig-box"><div>توقيع المنفذ</div><div class="sig-name">${s.appliedByName || "—"}</div></div>
  <div class="sig-box"><div>اعتماد المسؤول</div><div class="sig-name">&nbsp;</div></div>
</div>
<div class="footer">
  <span>وثيقة آلية — نظام CMMS | ${s.settlementNumber}</span>
  <span>تاريخ الطباعة: ${new Date().toLocaleDateString("ar-SA")}</span>
</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`;

    return html;
  }

// الطباعة المباشرة (نافذة منبثقة) — تستخدم نفس buildSettlementHtml أعلاه
export function printSettlementDocument(data: { settlement: any; items: any[] }) {
  const html = buildSettlementHtml(data);
  const win = window.open("", "_blank", "width=900,height=800");
  if (win) { win.document.write(html); win.document.close(); }
}

// طباعة وثيقة الاستبعاد
export function buildDisposalHtml(op: any): string {
    const REASON_AR: Record<string, string> = {
      damaged: "تالف", expired: "منتهي الصلاحية", missing: "مفقود", other: "أخرى"
    };
    const itemsRows = (op.items || []).map((item: any) => `
      <tr>
        <td>${item.itemName}</td>
        <td style="text-align:center">${parseFloat(item.quantity).toLocaleString()} ${item.unit || ""}</td>
        <td style="text-align:center">${REASON_AR[item.reason] || item.reason}</td>
        <td style="text-align:left;font-family:monospace">${parseFloat(item.unitCost || 0) > 0 ? parseFloat(item.unitCost).toLocaleString() + " ر.س" : "—"}</td>
        <td style="text-align:left;font-family:monospace;font-weight:700">${parseFloat(item.totalCost || 0) > 0 ? parseFloat(item.totalCost).toLocaleString() + " ر.س" : "—"}</td>
      </tr>`).join("");
    const totalValue = (op.items || []).reduce((s: number, i: any) => s + parseFloat(i.totalCost || 0), 0);
    const totalQty   = (op.items || []).reduce((s: number, i: any) => s + parseFloat(i.quantity || 0), 0);
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head>
<meta charset="UTF-8"/><title>وثيقة استبعاد ${op.operationNumber}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Cairo',Arial,sans-serif;background:#fff;color:#1a1a1a;padding:32px 40px;font-size:13px}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #7f1d1d;padding-bottom:16px;margin-bottom:20px}
.header-title{font-size:22px;font-weight:900;color:#7f1d1d}
.header-sub{font-size:11px;color:#666;margin-top:4px}
.header-meta{text-align:left;font-size:11px;color:#555;line-height:2.2}
.badge{display:inline-block;background:#7f1d1d;color:#fff;padding:4px 14px;border-radius:6px;font-size:14px;font-weight:700}
.info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
.info-box{border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;background:#fafafa}
.info-label{font-size:10px;color:#888;margin-bottom:3px}
.info-value{font-size:13px;font-weight:700;color:#111}
.section-title{font-size:12px;font-weight:700;color:#7f1d1d;background:#fef2f2;padding:6px 12px;border-radius:6px;margin-bottom:12px;border-right:4px solid #7f1d1d}
table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}
thead tr{background:#7f1d1d;color:#fff}
thead th{padding:8px 10px;text-align:right;font-weight:600}
tbody tr:nth-child(even){background:#fef2f2}
tbody tr:nth-child(odd){background:#fff}
tbody td{padding:8px 10px;border-bottom:1px solid #f3f4f6}
.totals-row{background:#1a1a1a!important;color:#fff!important;font-weight:700}
.totals-row td{padding:10px;border:none!important;color:#fff}
.sig-section{margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:40px}
.sig-box{border-top:2px solid #7f1d1d;padding-top:10px;text-align:center;font-size:11px;color:#555}
.sig-name{font-size:14px;font-weight:700;color:#1a1a1a;margin-top:4px}
.footer{margin-top:24px;border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;font-size:10px;color:#aaa}
.notes-box{border:1px solid #e5e7eb;border-radius:6px;padding:10px 14px;background:#fffbf0;font-size:12px;margin-bottom:16px}
@media print{@page{margin:12mm}body{padding:0}}
</style></head><body>
<div class="header">
  <div>
    <div class="header-title">📋 وثيقة استبعاد مخزون</div>
    <div class="header-sub">نظام إدارة الصيانة المتكامل — CMMS</div>
  </div>
  <div class="header-meta">
    <div>التاريخ: <strong>${new Date(op.operationDate).toLocaleDateString("ar-SA",{year:"numeric",month:"long",day:"numeric"})}</strong></div>
    <div>وقت الإصدار: <strong>${new Date().toLocaleTimeString("ar-SA")}</strong></div>
    <div><span class="badge">${op.operationNumber}</span></div>
  </div>
</div>
<div class="info-grid">
  <div class="info-box"><div class="info-label">المنفذ</div><div class="info-value">${op.creatorName || "—"}</div></div>
  <div class="info-box"><div class="info-label">عدد الأصناف</div><div class="info-value">${op.items?.length || 0} صنف</div></div>
  <div class="info-box"><div class="info-label">الحالة</div><div class="info-value">${op.status === "COMPLETED" ? "✅ مكتملة" : op.status}</div></div>
</div>
<div class="section-title">تفاصيل الأصناف المستبعدة</div>
<table>
  <thead><tr>
    <th>اسم الصنف</th>
    <th style="text-align:center">الكمية</th>
    <th style="text-align:center">سبب الاستبعاد</th>
    <th style="text-align:left">تكلفة الوحدة</th>
    <th style="text-align:left">إجمالي القيمة</th>
  </tr></thead>
  <tbody>
    ${itemsRows}
    <tr class="totals-row">
      <td>الإجمالي</td>
      <td style="text-align:center">${totalQty.toLocaleString()}</td>
      <td></td><td></td>
      <td style="text-align:left">${totalValue > 0 ? totalValue.toLocaleString() + " ر.س" : "—"}</td>
    </tr>
  </tbody>
</table>
${op.notes ? `<div class="notes-box">📝 <strong>ملاحظات:</strong> ${op.notes}</div>` : ""}
<div class="sig-section">
  <div class="sig-box"><div>توقيع المنفذ</div><div class="sig-name">${op.creatorName || "—"}</div></div>
  <div class="sig-box"><div>اعتماد المسؤول</div><div class="sig-name">&nbsp;</div></div>
</div>
<div class="footer">
  <span>وثيقة آلية — نظام CMMS | ${op.operationNumber}</span>
  <span>تاريخ الطباعة: ${new Date().toLocaleDateString("ar-SA")}</span>
</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`;

    return html;
  }

// الطباعة المباشرة (نافذة منبثقة) — تستخدم نفس buildDisposalHtml أعلاه
export function printDisposalDocument(op: any) {
  const html = buildDisposalHtml(op);
  const win = window.open("", "_blank", "width=900,height=800");
  if (win) { win.document.write(html); win.document.close(); }
}
