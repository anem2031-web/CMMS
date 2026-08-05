/**
 * Ticket PDF documents
 * - task: field work sheet available after classification
 * - archive: full closed-ticket record with the complete workflow trail
 */

import { htmlToPdf } from "./htmlToPdfService";
import { storageGetStream } from "../../_core/storage";
import {
  getAttachments,
  getAuditLogs,
  getInspectionResultsByTicket,
  getExternalMaintenanceJobByTicketId,
  getPurchaseOrders,
  getSections,
  getSiteById,
  getTechnicianById,
  getTicketById,
  getTicketConfirmation,
  getTicketHistory,
  getUserById,
} from "../../_core/db";

export type TicketPdfDocumentType = "task" | "archive";

const STATUS_LABELS: Record<string, string> = {
  new: "جديد",
  pending_triage: "بانتظار الفرز والتصنيف",
  under_inspection: "قيد الفحص",
  work_approved: "تم اعتماد مسار التنفيذ",
  ready_for_closure: "جاهز للإغلاق",
  approved: "معتمد",
  assigned: "تم الإسناد",
  in_progress: "قيد التنفيذ",
  needs_purchase: "يحتاج طلب شراء",
  purchase_pending_estimate: "طلب الشراء بانتظار التسعير",
  purchase_pending_accounting: "طلب الشراء بانتظار الحسابات",
  purchase_pending_management: "طلب الشراء بانتظار الإدارة",
  purchase_approved: "تم اعتماد الشراء",
  partial_purchase: "شراء جزئي",
  purchased: "تم الشراء",
  received_warehouse: "تم الاستلام في المستودع",
  out_for_repair: "خرج للإصلاح الخارجي",
  repaired: "تم الإصلاح",
  verified: "تم التحقق",
  closed: "مغلق",
  requester_confirmed: "مغلق ومؤكد من مقدم البلاغ",
  rejected: "مرفوض",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

const CATEGORY_LABELS: Record<string, string> = {
  electrical: "كهرباء",
  plumbing: "سباكة",
  hvac: "تكييف",
  structural: "إنشائي",
  mechanical: "ميكانيكي",
  general: "عام",
  safety: "سلامة",
  cleaning: "نظافة",
  elevator: "مصاعد",
  fire_safety: "سلامة وحريق",
  other: "أخرى",
};

const INSPECTION_STATUS_LABELS: Record<string, string> = {
  maintenance_inspection_result_draft: "مسودة محفوظة — لم تُرسل للمراجعة",
  maintenance_inspection_result_submitted: "مرسلة للمراجعة",
  maintenance_inspection_result_returned: "معادة للتصحيح",
  maintenance_inspection_result_approved: "معتمدة",
  maintenance_inspection_result_superseded: "مستبدلة",
};

const DEPARTMENT_LABELS: Record<string, string> = {
  maintenance_report_department_general: "الصيانة العامة",
  maintenance_report_department_construction: "قسم الإنشاءات",
};

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(value: unknown, withTime = false): string {
  if (!value) return "—";
  const date = new Date(value as any);
  if (Number.isNaN(date.getTime())) return "—";
  return withTime
    ? date.toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })
    : date.toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
}

function fmtMoney(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return escapeHtml(value);
  return `${number.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
}

function resolveFileKey(value: any): string | null {
  const direct = value?.fileKey;
  if (typeof direct === "string" && direct.startsWith("cmms/")) return direct;
  const rawUrl = value?.fileUrl || value?.url;
  if (typeof rawUrl !== "string" || !rawUrl) return direct || null;
  try {
    const url = new URL(rawUrl, "http://local");
    const recovered = url.searchParams.get("key");
    return recovered ? decodeURIComponent(recovered) : direct || null;
  } catch {
    return direct || null;
  }
}

async function fileKeyToBase64(fileKey: string): Promise<string | null> {
  try {
    const { stream, contentType } = await storageGetStream(fileKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as any) chunks.push(Buffer.from(chunk));
    return `data:${contentType};base64,${Buffer.concat(chunks).toString("base64")}`;
  } catch (error) {
    console.error("[Ticket PDF] Failed to read image:", fileKey, error);
    return null;
  }
}

async function loadImageData(items: any[], limit: number): Promise<Array<{ src: string; label: string }>> {
  const seen = new Set<string>();
  const candidates: Array<{ key: string; label: string }> = [];
  for (const item of items) {
    const key = resolveFileKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    candidates.push({ key, label: item?.fileName || item?.label || "صورة البلاغ" });
    if (candidates.length >= limit) break;
  }
  const loaded = await Promise.all(candidates.map(async item => ({ ...item, src: await fileKeyToBase64(item.key) })));
  return loaded.filter((item): item is { key: string; label: string; src: string } => !!item.src)
    .map(({ src, label }) => ({ src, label }));
}

async function loadTicketContext(ticketId: number) {
  const ticket: any = await getTicketById(ticketId);
  if (!ticket) throw new Error("البلاغ غير موجود");

  const [site, sections, attachments, history, auditLogs, inspectionResults, allPurchaseOrders, confirmation, externalTechnician, externalMaintenanceJob] = await Promise.all([
    ticket.siteId ? getSiteById(ticket.siteId) : null,
    getSections(ticket.siteId ?? undefined),
    getAttachments("ticket", ticketId),
    getTicketHistory(ticketId),
    getAuditLogs({ entityType: "ticket", entityId: ticketId }),
    getInspectionResultsByTicket(ticketId),
    getPurchaseOrders({}),
    getTicketConfirmation(ticketId),
    ticket.assignedTechnicianId ? getTechnicianById(ticket.assignedTechnicianId) : null,
    ticket.maintenancePath === "C" ? getExternalMaintenanceJobByTicketId(ticketId) : null,
  ]);

  const purchaseOrders = (allPurchaseOrders as any[]).filter(po => po.ticketId === ticketId);
  const section = (sections as any[])?.find(sectionRow => sectionRow.id === ticket.sectionId) || null;

  const userIds = new Set<number>();
  const addId = (id: unknown) => {
    const number = Number(id);
    if (Number.isInteger(number) && number > 0) userIds.add(number);
  };
  [
    ticket.reportedById,
    ticket.assignedToId,
    ticket.approvedById,
    ticket.supervisorId,
    ticket.inspectionPerformedById,
    ticket.inspectionRecordedById,
    ticket.inspectionSubmittedById,
    ticket.inspectionApprovedById,
    ticket.inspectionReturnedById,
    ticket.gateExitApprovedById,
    ticket.gateEntryApprovedById,
    ticket.externalRepairCompletedById,
    ticket.maintenanceResponsibleManagerId,
    ticket.maintenanceRoutedById,
    confirmation?.confirmedById,
    externalMaintenanceJob?.delegateId,
    externalMaintenanceJob?.warehousePreparedById,
    externalMaintenanceJob?.gateExitApprovedById,
    externalMaintenanceJob?.delegateReadyForReturnById,
    externalMaintenanceJob?.gateEntryApprovedById,
    externalMaintenanceJob?.warehouseReceivedById,
    externalMaintenanceJob?.assignedTechnicianId,
    externalMaintenanceJob?.actualRecipientId,
    externalMaintenanceJob?.handoverById,
  ].forEach(addId);
  (history as any[]).forEach(row => addId(row.changedById));
  (auditLogs as any[]).forEach(row => addId(row.userId));
  (inspectionResults as any[]).forEach(row => {
    addId(row.inspectorId);
    addId(row.performedById);
    addId(row.recordedById);
    addId(row.approvedById);
    addId(row.returnedById);
  });
  purchaseOrders.forEach(po => {
    addId(po.requestedById);
    addId(po.reviewedById);
    addId(po.accountingApprovedById);
    addId(po.managementApprovedById);
  });

  const users = await Promise.all([...userIds].map(async id => [id, await getUserById(id)] as const));
  const userMap = new Map<number, any>(users);
  const userName = (id: unknown) => {
    const user = userMap.get(Number(id));
    return user?.name || user?.username || user?.email || (id ? `مستخدم #${id}` : "—");
  };

  const imageItems = [
    ...(ticket.beforePhotoUrl ? [{ fileUrl: ticket.beforePhotoUrl, label: "صورة قبل التنفيذ" }] : []),
    ...(ticket.afterPhotoUrl ? [{ fileUrl: ticket.afterPhotoUrl, label: "صورة بعد التنفيذ" }] : []),
    ...(externalMaintenanceJob?.assetBeforePhotoUrl ? [{ fileUrl: externalMaintenanceJob.assetBeforePhotoUrl, label: "الأصل قبل خروجه للصيانة الخارجية" }] : []),
    ...(externalMaintenanceJob?.assetAfterReturnPhotoUrl ? [{ fileUrl: externalMaintenanceJob.assetAfterReturnPhotoUrl, label: "الأصل بعد عودته من الصيانة الخارجية" }] : []),
    ...(attachments as any[]).filter(a => a.mimeType?.startsWith("image/")),
  ];

  return {
    ticket,
    site,
    section,
    attachments: attachments as any[],
    history: history as any[],
    auditLogs: auditLogs as any[],
    inspectionResults: inspectionResults as any[],
    purchaseOrders,
    confirmation,
    externalTechnician,
    externalMaintenanceJob,
    userName,
    images: await loadImageData(imageItems, 12),
  };
}

function infoRow(label: string, value: unknown): string {
  return `<div class="info-row"><span class="info-label">${escapeHtml(label)}</span><span class="info-value">${escapeHtml(value)}</span></div>`;
}

function renderTaskPdf(ctx: Awaited<ReturnType<typeof loadTicketContext>>): string {
  const { ticket, site, section, externalTechnician, userName, images } = ctx;
  const assignedName = ticket.assignedToId ? userName(ticket.assignedToId) : externalTechnician?.name || "غير معين";
  const taskImages = images.slice(0, 4);
  const photos = taskImages.length
    ? `<section><h2>صور البلاغ</h2><div class="photo-grid">${taskImages.map(image => `<figure><img src="${image.src}"/><figcaption>${escapeHtml(image.label)}</figcaption></figure>`).join("")}</div></section>`
    : "";

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><style>
    @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;font-size:12px;line-height:1.55;margin:0}
    .header{background:#1e3a8a;color:#fff;padding:14px 16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center}.header h1{margin:0;font-size:20px}.num{font-size:18px;font-weight:800}
    .badges{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.badge{padding:4px 10px;border-radius:999px;background:#eef2ff;font-weight:700}
    section{margin:10px 0;break-inside:avoid}h2{font-size:15px;color:#1e3a8a;border-bottom:2px solid #dbeafe;padding-bottom:5px;margin:0 0 7px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;border:1px solid #d9e2f2;border-radius:8px;padding:10px}.info-row{display:flex;justify-content:space-between;gap:12px;border-bottom:1px dashed #e5e7eb;padding:3px 0}.info-label{color:#64748b;font-weight:700}.info-value{font-weight:600;text-align:left}
    .description{border:1px solid #d9e2f2;border-radius:8px;padding:10px;background:#f8fafc;white-space:pre-wrap}.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.photo-grid figure{margin:0;border:1px solid #d9e2f2;border-radius:8px;overflow:hidden}.photo-grid img{width:100%;height:130px;object-fit:contain;background:#f8fafc}.photo-grid figcaption{text-align:center;padding:3px;color:#64748b;font-size:10px}
    .field{border:2px solid #1e3a8a;border-radius:10px;padding:12px;min-height:170px}.lines div{height:22px;border-bottom:1px dashed #94a3b8}.signatures{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:15px}.signature{text-align:center}.signature span{display:block;margin-bottom:22px;font-size:10px;color:#64748b}.signature i{display:block;border-bottom:1px solid #334155}
    .footer{margin-top:10px;border-top:1px solid #e5e7eb;padding-top:6px;color:#94a3b8;font-size:9px;display:flex;justify-content:space-between}
  </style></head><body>
    <div class="header"><div><h1>نموذج مهمة صيانة</h1><div>وثيقة عمل ميدانية بعد تصنيف البلاغ</div></div><div class="num">${escapeHtml(ticket.ticketNumber)}</div></div>
    <div class="badges"><span class="badge">${escapeHtml(STATUS_LABELS[ticket.status] || ticket.status)}</span><span class="badge">الأولوية: ${escapeHtml(PRIORITY_LABELS[ticket.priority] || ticket.priority)}</span><span class="badge">التصنيف: ${escapeHtml(CATEGORY_LABELS[ticket.category] || ticket.category)}</span></div>
    <section><h2>بيانات المهمة</h2><div class="grid">
      ${infoRow("العنوان", ticket.title)}${infoRow("الموقع", site?.name || ticket.locationDetail)}${infoRow("القسم", section?.name)}${infoRow("مقدم البلاغ", userName(ticket.reportedById))}
      ${infoRow("الجهة المسؤولة", DEPARTMENT_LABELS[ticket.maintenanceResponsibleDepartment] || ticket.maintenanceResponsibleDepartment)}${infoRow("مدير الجهة", userName(ticket.maintenanceResponsibleManagerId))}${infoRow("الفني المسند", assignedName)}${infoRow("تاريخ الإسناد", fmtDate(ticket.assignedAt, true))}
    </div></section>
    <section><h2>وصف البلاغ</h2><div class="description"><strong>${escapeHtml(ticket.title)}</strong><br/>${escapeHtml(ticket.description || "لا يوجد وصف إضافي")}</div></section>
    ${photos}
    <section><h2>تسجيل العمل الميداني</h2><div class="field"><strong>الملاحظات والإجراءات المنفذة</strong><div class="lines"><div></div><div></div><div></div><div></div><div></div></div><div class="signatures"><div class="signature"><span>اسم الفني</span><i></i></div><div class="signature"><span>التوقيع</span><i></i></div><div class="signature"><span>التاريخ</span><i></i></div><div class="signature"><span>اعتماد المسؤول</span><i></i></div></div></div></section>
    <div class="footer"><span>طُبعت بتاريخ ${fmtDate(new Date(), true)}</span><span>نظام الحارس المركزي</span></div>
  </body></html>`;
}

function renderArchivePdf(ctx: Awaited<ReturnType<typeof loadTicketContext>>): string {
  const { ticket, site, section, attachments, history, auditLogs, inspectionResults, purchaseOrders, confirmation, externalTechnician, externalMaintenanceJob, userName, images } = ctx;
  const assignedName = ticket.assignedToId ? userName(ticket.assignedToId) : externalTechnician?.name || "غير معين";
  const timeline = [...history].reverse();
  const nonImageAttachments = attachments.filter(a => !a.mimeType?.startsWith("image/"));

  const inspectionHtml = inspectionResults.length
    ? inspectionResults.map(result => `
      <article class="record">
        <div class="record-head"><strong>نسخة نتيجة الفحص رقم ${escapeHtml(result.revisionNumber || 1)}</strong><span class="status-chip">${escapeHtml(INSPECTION_STATUS_LABELS[result.workflowStatus] || result.workflowStatus)}</span></div>
        <div class="two-col">
          ${infoRow("من قام بالفحص ميدانيًا", userName(result.performedById || result.inspectorId))}
          ${infoRow("من أدخل النتيجة في النظام", userName(result.recordedById || result.inspectorId))}
          ${infoRow("مستوى الخطورة", PRIORITY_LABELS[result.severity] || result.severity)}
          ${infoRow("تاريخ الإنشاء", fmtDate(result.createdAt, true))}
          ${infoRow("تاريخ الإرسال", fmtDate(result.submittedAt, true))}
          ${infoRow("تاريخ الاعتماد", fmtDate(result.approvedAt, true))}
        </div>
        ${result.inspectionNotes ? `<div class="text-block"><b>الملاحظات الفنية:</b> ${escapeHtml(result.inspectionNotes)}</div>` : ""}
        ${result.rootCause ? `<div class="text-block"><b>السبب الجذري:</b> ${escapeHtml(result.rootCause)}</div>` : ""}
        ${result.findings ? `<div class="text-block"><b>النتائج:</b> ${escapeHtml(result.findings)}</div>` : ""}
        ${result.recommendedAction ? `<div class="text-block"><b>الإجراء الموصى به:</b> ${escapeHtml(result.recommendedAction)}</div>` : ""}
        ${result.returnReason ? `<div class="text-block warning"><b>سبب الإعادة للتصحيح:</b> ${escapeHtml(result.returnReason)}</div>` : ""}
      </article>`).join("")
    : `<p class="empty">لا توجد نتائج فحص مسجلة.</p>`;

  const purchaseHtml = purchaseOrders.length
    ? `<table><thead><tr><th>رقم الطلب</th><th>الحالة</th><th>المنشئ</th><th>التقديري</th><th>الفعلي</th><th>تاريخ الإنشاء</th></tr></thead><tbody>${purchaseOrders.map(po => `<tr><td>${escapeHtml(po.poNumber)}</td><td>${escapeHtml(po.status)}</td><td>${escapeHtml(po.requestedByName || userName(po.requestedById))}</td><td>${fmtMoney(po.totalEstimatedCost)}</td><td>${fmtMoney(po.totalActualCost)}</td><td>${fmtDate(po.createdAt, true)}</td></tr>`).join("")}</tbody></table>`
    : `<p class="empty">لا توجد طلبات شراء مرتبطة.</p>`;


  const externalMaintenanceHtml = externalMaintenanceJob
    ? `<div class="two-col">
        ${infoRow("حالة دورة الصيانة الخارجية", externalMaintenanceJob.status)}
        ${infoRow("اسم الأصل", externalMaintenanceJob.assetName)}
        ${infoRow("المندوب المسؤول", userName(externalMaintenanceJob.delegateId))}
        ${infoRow("وثيقة الخروج", externalMaintenanceJob.exitDocumentNumber)}
        ${infoRow("جهزه المستودع", userName(externalMaintenanceJob.warehousePreparedById))}
        ${infoRow("وقت تجهيز المستودع", fmtDate(externalMaintenanceJob.warehousePreparedAt, true))}
        ${infoRow("اعتمد الخروج", userName(externalMaintenanceJob.gateExitApprovedById))}
        ${infoRow("وقت الخروج", fmtDate(externalMaintenanceJob.gateExitApprovedAt, true))}
        ${infoRow("حامل الأصل عند الخروج", externalMaintenanceJob.gateExitCarrierName)}
        ${infoRow("اعتمد الدخول", userName(externalMaintenanceJob.gateEntryApprovedById))}
        ${infoRow("وقت الدخول", fmtDate(externalMaintenanceJob.gateEntryApprovedAt, true))}
        ${infoRow("معيد الأصل", externalMaintenanceJob.gateEntryCarrierName)}
        ${infoRow("وثيقة استلام العودة", externalMaintenanceJob.returnDocumentNumber)}
        ${infoRow("استلمه في المستودع", userName(externalMaintenanceJob.warehouseReceivedById))}
        ${infoRow("وقت استلام المستودع", fmtDate(externalMaintenanceJob.warehouseReceivedAt, true))}
        ${infoRow("حالة الأصل عند العودة", externalMaintenanceJob.returnCondition)}
        ${infoRow("تقرير/فاتورة الورشة", externalMaintenanceJob.workshopReportUrl)}
        ${infoRow("وثيقة التسليم للتركيب", externalMaintenanceJob.handoverDocumentNumber)}
        ${infoRow("الفني المسند", userName(externalMaintenanceJob.assignedTechnicianId))}
        ${infoRow("المستلم الفعلي", userName(externalMaintenanceJob.actualRecipientId))}
        ${infoRow("سلّمه من المستودع", userName(externalMaintenanceJob.handoverById))}
        ${infoRow("وقت التسليم للتركيب", fmtDate(externalMaintenanceJob.handoverAt, true))}
      </div>
      ${externalMaintenanceJob.assetBeforeCondition ? `<div class="text-block"><b>حالة الأصل قبل الخروج:</b> ${escapeHtml(externalMaintenanceJob.assetBeforeCondition)}</div>` : ""}
      ${externalMaintenanceJob.warehouseReturnNotes ? `<div class="text-block"><b>ملاحظات استلام العودة:</b> ${escapeHtml(externalMaintenanceJob.warehouseReturnNotes)}</div>` : ""}
      ${externalMaintenanceJob.handoverNotes ? `<div class="text-block"><b>ملاحظات التسليم للتركيب:</b> ${escapeHtml(externalMaintenanceJob.handoverNotes)}</div>` : ""}`
    : `<p class="empty">لا توجد دورة صيانة خارجية مرتبطة.</p>`;

  const timelineHtml = timeline.length
    ? timeline.map((event, index) => `<div class="timeline-item"><div class="timeline-dot">${index + 1}</div><div><div class="timeline-title">${escapeHtml(STATUS_LABELS[event.fromStatus] || event.fromStatus || "إنشاء البلاغ")} ← ${escapeHtml(STATUS_LABELS[event.toStatus] || event.toStatus)}</div><div class="muted">${fmtDate(event.createdAt, true)} — بواسطة ${escapeHtml(userName(event.changedById))}</div>${event.notes ? `<div class="timeline-notes">${escapeHtml(event.notes)}</div>` : ""}</div></div>`).join("")
    : `<p class="empty">لا يوجد سجل انتقالات.</p>`;

  const auditHtml = auditLogs.length
    ? [...auditLogs].reverse().map((entry, index) => `<div class="audit-item"><div><b>${index + 1}. ${escapeHtml(entry.action)}</b> — ${fmtDate(entry.createdAt, true)} — ${escapeHtml(userName(entry.userId))}</div>${entry.oldValues ? `<pre><b>القيم السابقة:</b> ${escapeHtml(JSON.stringify(entry.oldValues, null, 2))}</pre>` : ""}${entry.newValues ? `<pre><b>القيم الجديدة:</b> ${escapeHtml(JSON.stringify(entry.newValues, null, 2))}</pre>` : ""}</div>`).join("")
    : `<p class="empty">لا توجد عمليات تدقيق إضافية.</p>`;

  const photosHtml = images.length
    ? `<div class="photo-grid">${images.map(image => `<figure><img src="${image.src}"/><figcaption>${escapeHtml(image.label)}</figcaption></figure>`).join("")}</div>`
    : `<p class="empty">لا توجد صور محفوظة.</p>`;

  const attachmentsHtml = nonImageAttachments.length
    ? `<ul>${nonImageAttachments.map(file => `<li>${escapeHtml(file.fileName || file.fileKey)} — ${escapeHtml(file.mimeType || "ملف")}</li>`).join("")}</ul>`
    : `<p class="empty">لا توجد مرفقات إضافية.</p>`;

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><style>
    @page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;font-size:11px;line-height:1.6;margin:0}.header{background:#0f3a67;color:#fff;padding:16px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.header h1{font-size:21px;margin:0}.header p{margin:3px 0 0;color:#dbeafe}.ticket-number{font-size:18px;font-weight:900;border:1px solid #93c5fd;border-radius:8px;padding:8px 14px}
    .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:12px}.summary div{background:#f1f5f9;border:1px solid #dbe4ef;border-radius:7px;padding:7px}.summary b{display:block;color:#64748b;font-size:9px}.summary span{font-weight:800}
    section{margin:12px 0;break-inside:auto}h2{font-size:15px;color:#0f3a67;border-bottom:2px solid #bfdbfe;padding-bottom:5px;margin:0 0 8px}.two-col{display:grid;grid-template-columns:1fr 1fr;gap:3px 16px}.info-row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dashed #e2e8f0;padding:4px 0}.info-label{color:#64748b;font-weight:700}.info-value{text-align:left;font-weight:600}.text-block{background:#f8fafc;border-right:3px solid #3b82f6;border-radius:5px;padding:7px;margin-top:6px;white-space:pre-wrap}.warning{background:#fff7ed;border-color:#f97316}.record{border:1px solid #dbe4ef;border-radius:8px;padding:9px;margin-bottom:8px;break-inside:avoid}.record-head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:5px}.status-chip{background:#e0e7ff;color:#3730a3;padding:2px 7px;border-radius:999px;font-size:9px;font-weight:700}
    table{width:100%;border-collapse:collapse;font-size:9.5px}th,td{border:1px solid #dbe4ef;padding:5px;text-align:right}th{background:#eaf2fb;color:#0f3a67}.timeline-item{display:grid;grid-template-columns:25px 1fr;gap:8px;margin-bottom:8px;break-inside:avoid}.audit-item{border:1px solid #e2e8f0;border-radius:6px;padding:6px;margin-bottom:6px;break-inside:avoid}.audit-item pre{white-space:pre-wrap;word-break:break-word;background:#f8fafc;border-radius:4px;padding:5px;margin:4px 0 0;font-family:Arial,sans-serif;font-size:8.5px}.timeline-dot{width:22px;height:22px;background:#0f3a67;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px}.timeline-title{font-weight:800}.timeline-notes{background:#f8fafc;border-radius:4px;padding:4px;margin-top:3px}.muted,.empty{color:#64748b}.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.photo-grid figure{margin:0;border:1px solid #dbe4ef;border-radius:7px;overflow:hidden;break-inside:avoid}.photo-grid img{width:100%;height:170px;object-fit:contain;background:#f8fafc}.photo-grid figcaption{text-align:center;padding:4px;color:#64748b}.footer{margin-top:16px;border-top:1px solid #cbd5e1;padding-top:7px;color:#64748b;font-size:9px;display:flex;justify-content:space-between}ul{padding-right:20px}
  </style></head><body>
    <div class="header"><div><h1>التقرير الأرشيفي الكامل للبلاغ</h1><p>وثيقة نهائية تشمل بيانات البلاغ وإجراءاته من الإنشاء حتى الإغلاق</p></div><div class="ticket-number">${escapeHtml(ticket.ticketNumber)}</div></div>
    <div class="summary"><div><b>الحالة النهائية</b><span>${escapeHtml(STATUS_LABELS[ticket.status] || ticket.status)}</span></div><div><b>الأولوية</b><span>${escapeHtml(PRIORITY_LABELS[ticket.priority] || ticket.priority)}</span></div><div><b>تاريخ الإنشاء</b><span>${fmtDate(ticket.createdAt)}</span></div><div><b>تاريخ الإغلاق</b><span>${fmtDate(ticket.closedAt)}</span></div></div>

    <section><h2>1. بيانات البلاغ الأساسية</h2><div class="two-col">
      ${infoRow("العنوان", ticket.title)}${infoRow("التصنيف الفني", CATEGORY_LABELS[ticket.category] || ticket.category)}${infoRow("الموقع", site?.name || ticket.locationDetail)}${infoRow("القسم", section?.name)}${infoRow("مقدم البلاغ", userName(ticket.reportedById))}${infoRow("نوع البلاغ", ticket.ticketType)}${infoRow("اللغة الأصلية", ticket.originalLanguage)}${infoRow("رقم الأصل", ticket.assetId)}
    </div><div class="text-block"><b>الوصف:</b> ${escapeHtml(ticket.description || "لا يوجد وصف")}</div></section>

    <section><h2>2. الفرز والتوجيه والمسؤوليات</h2><div class="two-col">
      ${infoRow("الجهة المسؤولة", DEPARTMENT_LABELS[ticket.maintenanceResponsibleDepartment] || ticket.maintenanceResponsibleDepartment)}${infoRow("مدير الجهة", userName(ticket.maintenanceResponsibleManagerId))}${infoRow("من قام بالتوجيه", userName(ticket.maintenanceRoutedById))}${infoRow("وقت التوجيه", fmtDate(ticket.maintenanceRoutedAt, true))}${infoRow("الفني المسند", assignedName)}${infoRow("وقت الإسناد", fmtDate(ticket.assignedAt, true))}${infoRow("المشرف", userName(ticket.supervisorId))}${infoRow("المسار التنفيذي", ticket.maintenancePath)}
    </div>${ticket.triageNotes ? `<div class="text-block"><b>ملاحظات الفرز:</b> ${escapeHtml(ticket.triageNotes)}</div>` : ""}${ticket.maintenanceRoutingNote ? `<div class="text-block"><b>ملاحظات التوجيه:</b> ${escapeHtml(ticket.maintenanceRoutingNote)}</div>` : ""}${ticket.justification ? `<div class="text-block"><b>مبرر المسار:</b> ${escapeHtml(ticket.justification)}</div>` : ""}</section>

    <section><h2>3. نتائج الفحص ومراجعاتها</h2>${inspectionHtml}</section>

    <section><h2>4. التنفيذ والإقفال</h2><div class="two-col">
      ${infoRow("اعتمد بواسطة", userName(ticket.approvedById))}${infoRow("تكلفة تقديرية", fmtMoney(ticket.estimatedCost))}${infoRow("تكلفة فعلية", fmtMoney(ticket.actualCost))}${infoRow("تاريخ الإغلاق", fmtDate(ticket.closedAt, true))}${infoRow("اعتماد الخروج", userName(ticket.gateExitApprovedById))}${infoRow("وقت الخروج", fmtDate(ticket.gateExitApprovedAt, true))}${infoRow("اعتماد الدخول", userName(ticket.gateEntryApprovedById))}${infoRow("وقت الدخول", fmtDate(ticket.gateEntryApprovedAt, true))}
    </div>${ticket.repairNotes ? `<div class="text-block"><b>ملاحظات الإصلاح:</b> ${escapeHtml(ticket.repairNotes)}</div>` : ""}${ticket.materialsUsed ? `<div class="text-block"><b>المواد المستخدمة:</b> ${escapeHtml(ticket.materialsUsed)}</div>` : ""}</section>

    ${ticket.maintenancePath === "C" ? `<section><h2>5. دورة الصيانة الخارجية وحركة الأصل</h2>${externalMaintenanceHtml}</section>` : ""}
    <section><h2>${ticket.maintenancePath === "C" ? "6" : "5"}. طلبات الشراء المرتبطة</h2>${purchaseHtml}</section>
    <section><h2>${ticket.maintenancePath === "C" ? "7" : "6"}. التسلسل الكامل لإجراءات البلاغ</h2>${timelineHtml}</section>
    <section><h2>${ticket.maintenancePath === "C" ? "8" : "7"}. سجل التدقيق التفصيلي</h2>${auditHtml}</section>
    <section><h2>${ticket.maintenancePath === "C" ? "9" : "8"}. الصور</h2>${photosHtml}</section>
    <section><h2>${ticket.maintenancePath === "C" ? "10" : "9"}. المرفقات الأخرى</h2>${attachmentsHtml}</section>
    ${confirmation ? `<section><h2>${ticket.maintenancePath === "C" ? "11" : "10"}. تأكيد مقدم البلاغ</h2><div class="two-col">${infoRow("المؤكد", userName(confirmation.confirmedById))}${infoRow("وقت التأكيد", fmtDate(confirmation.createdAt, true))}</div><div class="text-block"><b>ملاحظة التأكيد:</b> ${escapeHtml(confirmation.note)}</div></section>` : ""}
    <div class="footer"><span>تم إنشاء الوثيقة آليًا بتاريخ ${fmtDate(new Date(), true)}</span><span>نظام الحارس المركزي — وثيقة أرشيفية</span></div>
  </body></html>`;
}

export async function generateTicketPDF(
  ticketId: number,
  documentType: TicketPdfDocumentType = "task",
): Promise<Buffer> {
  const context = await loadTicketContext(ticketId);
  return htmlToPdf(documentType === "archive" ? renderArchivePdf(context) : renderTaskPdf(context));
}
