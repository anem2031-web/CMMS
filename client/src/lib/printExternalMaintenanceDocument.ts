import { mediaUrl } from "@/lib/mediaUrl";

type ExternalDocumentType = "exit" | "return" | "handover";

function esc(value: unknown): string {
  return String(value ?? "—")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmt(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleString("ar-SA");
}

// يبني جدول بيانات رسمي: عمودان من أزواج (عنوان/قيمة) في كل صف — يعطي مظهر نموذج مطبوع.
function infoTable(fields: [string, unknown][]): string {
  const rows: string[] = [];
  for (let i = 0; i < fields.length; i += 2) {
    const [label1, value1] = fields[i];
    const pair = fields[i + 1];
    rows.push(`
      <tr>
        <td class="label">${esc(label1)}</td>
        <td class="value">${esc(value1)}</td>
        ${pair ? `<td class="label">${esc(pair[0])}</td><td class="value">${esc(pair[1])}</td>` : `<td class="label"></td><td class="value"></td>`}
      </tr>`);
  }
  return `<table class="info">${rows.join("")}</table>`;
}

// صف بيانات يمتد على عرض الجدول كاملاً (لملاحظات/أوصاف طويلة).
function fullRow(label: string, value: unknown): string {
  return `
    <table class="info">
      <tr><td class="label" style="width:22%">${esc(label)}</td><td class="value" colspan="3">${esc(value)}</td></tr>
    </table>`;
}

// جدول توقيعات/بيانات ميدانية تُملأ يدويًا (حارس، مستلم...) — كسطر فارغ داخل خلية جدول رسمية بدل نقاط متفرقة.
function blankFieldsTable(fieldLabels: string[]): string {
  const rows = fieldLabels.map(label => `
    <tr><td class="label" style="width:32%">${esc(label)}</td><td class="blank"></td></tr>`).join("");
  return `<table class="info">${rows}</table>`;
}

export function printExternalMaintenanceDocument(type: ExternalDocumentType, row: any) {
  const job = row.job || row;
  const title = type === "exit"
    ? "وثيقة تسليم أصل للصيانة الخارجية / تصريح خروج"
    : type === "return"
      ? "وثيقة استلام أصل عائد من الصيانة الخارجية"
      : "وثيقة تسليم أصل لإعادة التركيب";
  const documentNumber = type === "exit"
    ? job.exitDocumentNumber
    : type === "return"
      ? job.returnDocumentNumber
      : job.handoverDocumentNumber;
  const photoUrl = type === "exit" ? job.assetBeforePhotoUrl : job.assetAfterReturnPhotoUrl;
  const assetName = job.assetName || row.assetRegisteredName;

  let mainTable = "";
  let extraRows = "";
  let gateSection = "";
  let signatures = "";

  if (type === "exit") {
    // حقول موافقة الحراسة تُملأ فقط من الحارس عند الاعتماد الفعلي بالنظام —
    // تبقى مخفية بالكامل في الوثيقة قبل ذلك بدل عرضها فارغة أو بعبارة انتظار،
    // وتظهر تلقائيًا بمجرد إعادة طباعة/عرض الوثيقة بعد اعتماد الحراسة للخروج.
    const gateApproved = !!job.gateExitApprovedAt;
    const baseFields: [string, unknown][] = [
      ["رقم البلاغ", row.ticketNumber],
      ["اسم الأصل", assetName],
      ["المندوب المسؤول", row.delegateName],
      ["موظف المستودع", row.warehousePreparedByName],
      ["تاريخ التجهيز", fmt(job.warehousePreparedAt)],
      ["الفني المسند للبلاغ", row.assignedTechnicianName],
    ];
    const gateFields: [string, unknown][] = gateApproved ? [
      ["موافقة الحراسة بالنظام", row.gateExitApprovedByName],
      ["وقت الخروج المسجل بالنظام", fmt(job.gateExitApprovedAt)],
      ["حامل الأصل المسجل بالنظام", job.gateExitCarrierName],
    ] : [];
    mainTable = infoTable([...baseFields, ...gateFields]);
    if (!gateApproved) {
      mainTable += `<div class="pending-note">⏳ بانتظار اعتماد الحراسة لخروج الأصل بالنظام — ستُستكمل بيانات الخروج تلقائيًا في الوثيقة بعد الاعتماد</div>`;
    }
    extraRows = fullRow("حالة الأصل قبل الخروج", job.assetBeforeCondition) + fullRow("ملاحظات المستودع", job.warehouseNotes);
    gateSection = `
      <h2>قسم الحراسة عند الخروج (يُعبأ يدويًا)</h2>
      ${blankFieldsTable([
        "اسم الحارس المناوب",
        "تاريخ ووقت الخروج الفعلي",
        "اسم الشخص الذي أخرج الأصل",
      ])}
      <table class="info signatures">
        <tr>
          <td class="label" style="width:32%">توقيع حامل الأصل</td><td class="blank"></td>
          <td class="label" style="width:16%">توقيع الحارس</td><td class="blank"></td>
        </tr>
      </table>`;
  } else if (type === "return") {
    mainTable = infoTable([
      ["رقم البلاغ", row.ticketNumber],
      ["اسم الأصل", assetName],
      ["وثيقة الخروج", job.exitDocumentNumber],
      ["تاريخ دخول الحراسة", fmt(job.gateEntryApprovedAt)],
      ["الشخص الذي أعاد الأصل", job.gateEntryCarrierName],
      ["تاريخ استلام المستودع", fmt(job.warehouseReceivedAt)],
      ["الحارس الذي وافق على الدخول", row.gateEntryApprovedByName],
      ["موظف المستودع المستلم", row.warehouseReceivedByName],
    ]);
    extraRows = fullRow("حالة الأصل عند العودة", job.returnCondition) + fullRow("ملاحظات المستودع", job.warehouseReturnNotes);
  } else {
    mainTable = infoTable([
      ["رقم البلاغ", row.ticketNumber],
      ["اسم الأصل", assetName],
      ["الفني المسند للبلاغ", row.assignedTechnicianName],
      ["المستلم فعليًا", row.actualRecipientName],
      ["تاريخ التسليم", fmt(job.handoverAt)],
      ["وثيقة استلام العودة", job.returnDocumentNumber],
      ["موظف المستودع المسلّم", row.handoverByName],
    ]);
    extraRows = fullRow("ملاحظات التسليم", job.handoverNotes);
    signatures = `
      <table class="info signatures">
        <tr>
          <td class="label" style="width:32%">توقيع موظف المستودع</td><td class="blank"></td>
          <td class="label" style="width:16%">توقيع المستلم</td><td class="blank"></td>
        </tr>
      </table>`;
  }

  const win = window.open("", "_blank", "width=900,height=900");
  if (!win) return;
  win.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/>
    <title>${esc(documentNumber)}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Arial,Tahoma,sans-serif;color:#18212f;padding:10mm;line-height:1.35;font-size:12px}
      header{display:flex;justify-content:space-between;align-items:center;border-bottom:2.5px solid #1e3a5f;padding-bottom:8px;margin-bottom:10px}
      h1{font-size:16px;margin:0;color:#1e3a5f}
      header .sub{font-size:10.5px;color:#64748b;margin-top:2px}
      .number{font-weight:700;border:1px solid #1e3a5f;padding:4px 10px;border-radius:5px;font-size:12px;white-space:nowrap}
      h2{color:#1e3a5f;font-size:12.5px;margin:12px 0 5px;border-right:3px solid #1e3a5f;padding-right:6px}
      table.info{width:100%;border-collapse:collapse;margin-bottom:8px;table-layout:fixed}
      table.info td{border:1px solid #c3ccd6;padding:4px 8px;font-size:11.5px;vertical-align:top;overflow-wrap:anywhere}
      table.info td.label{background:#eef2f7;font-weight:700;color:#1e3a5f;width:20%}
      table.info td.value{width:30%}
      table.info td.blank{width:auto}
      table.info.signatures{margin-top:14px}
      table.info.signatures td.blank{height:26px}
      .photo-wrap{text-align:center;margin:6px 0 10px}
      .photo{max-height:110px;max-width:220px;border:1px solid #ddd;border-radius:6px;display:inline-block}
      .pending-note{background:#fff7e6;border:1px solid #f0c36d;color:#8a5a00;border-radius:5px;padding:6px 10px;font-size:11px;margin:-2px 0 8px}
      footer{margin-top:10px;border-top:1px solid #ddd;padding-top:6px;color:#64748b;font-size:9.5px}
      @media print{@page{size:A4;margin:10mm}button{display:none}}
    </style></head><body>
    <header>
      <div><h1>${title}</h1><div class="sub">نظام الحارس المركزي لإدارة الصيانة</div></div>
      <div class="number">${esc(documentNumber)}</div>
    </header>
    ${photoUrl ? `<div class="photo-wrap"><img class="photo" src="${esc(mediaUrl(photoUrl))}" alt="صورة الأصل"/></div>` : ""}
    ${mainTable}
    ${extraRows}
    ${gateSection}
    ${signatures}
    <footer>طُبعت الوثيقة بتاريخ ${new Date().toLocaleString("ar-SA")}. النسخة الورقية الموقعة تُعاد للمستودع وتحفظ مع سجل البلاغ.</footer>
    <script>window.onload=()=>setTimeout(()=>window.print(),350)</script></body></html>`);
  win.document.close();
}
