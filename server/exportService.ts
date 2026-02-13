import ExcelJS from "exceljs";
import * as db from "./db";

// ============================================================
// EXCEL EXPORT HELPERS
// ============================================================

function styleHeader(worksheet: ExcelJS.Worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1B7A4A" } };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };
  headerRow.height = 30;
  worksheet.columns.forEach(col => {
    col.width = Math.max(col.width || 15, 15);
  });
}

function addRtlSupport(worksheet: ExcelJS.Worksheet) {
  worksheet.views = [{ rightToLeft: true }];
}

// ============================================================
// TICKETS EXPORT
// ============================================================
export async function exportTicketsToExcel(): Promise<Buffer> {
  const tickets = await db.getTickets();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("البلاغات");
  addRtlSupport(ws);

  ws.columns = [
    { header: "رقم البلاغ", key: "id", width: 12 },
    { header: "العنوان", key: "title", width: 35 },
    { header: "الوصف", key: "description", width: 45 },
    { header: "الحالة", key: "status", width: 18 },
    { header: "الأولوية", key: "priority", width: 15 },
    { header: "الفئة", key: "category", width: 18 },
    { header: "الموقع", key: "siteId", width: 12 },
    { header: "تاريخ الإنشاء", key: "createdAt", width: 22 },
  ];
  styleHeader(ws);

  const statusMap: Record<string, string> = {
    open: "مفتوح", in_progress: "قيد التنفيذ", pending_approval: "بانتظار الاعتماد",
    pending_quote: "بانتظار التسعير", pending_po: "بانتظار طلب شراء",
    pending_funding: "بانتظار التمويل", closed: "مغلق", rejected: "مرفوض",
  };
  const priorityMap: Record<string, string> = {
    low: "منخفضة", medium: "متوسطة", high: "عالية", critical: "حرجة",
  };
  const categoryMap: Record<string, string> = {
    electrical: "كهرباء", plumbing: "سباكة", hvac: "تكييف", structural: "إنشائي",
    elevator: "مصاعد", fire_safety: "سلامة", cleaning: "نظافة", other: "أخرى",
  };

  tickets.forEach(t => {
    ws.addRow({
      id: t.id,
      title: t.title,
      description: t.description,
      status: statusMap[t.status] || t.status,
      priority: priorityMap[t.priority] || t.priority,
      category: categoryMap[t.category] || t.category,
      siteId: t.siteId,
      createdAt: new Date(t.createdAt).toLocaleString("ar-SA"),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================
// PURCHASE ORDERS EXPORT
// ============================================================
export async function exportPurchaseOrdersToExcel(): Promise<Buffer> {
  const pos = await db.getPurchaseOrders();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("طلبات الشراء");
  addRtlSupport(ws);

  ws.columns = [
    { header: "رقم الطلب", key: "poNumber", width: 18 },
    { header: "الملاحظات", key: "notes", width: 40 },
    { header: "الحالة", key: "status", width: 18 },
    { header: "التكلفة المقدرة", key: "estimated", width: 18 },
    { header: "التكلفة الفعلية", key: "actual", width: 18 },
    { header: "تاريخ الإنشاء", key: "createdAt", width: 22 },
  ];
  styleHeader(ws);

  const poStatusMap: Record<string, string> = {
    draft: "مسودة", pending_approval: "بانتظار الاعتماد", approved: "معتمد",
    quoted: "تم التسعير", funded: "تم التمويل", purchased: "تم الشراء",
    received: "تم الاستلام", rejected: "مرفوض", cancelled: "ملغي",
  };

  pos.forEach(po => {
    ws.addRow({
      poNumber: po.poNumber,
      notes: po.notes || "-",
      status: poStatusMap[po.status] || po.status,
      estimated: parseFloat(po.totalEstimatedCost || "0"),
      actual: parseFloat(po.totalActualCost || "0"),
      createdAt: new Date(po.createdAt).toLocaleString("ar-SA"),
    });
  });

  // Format currency columns
  ws.getColumn("estimated").numFmt = '#,##0.00 "ر.س"';
  ws.getColumn("actual").numFmt = '#,##0.00 "ر.س"';

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================
// TECHNICIAN PERFORMANCE EXPORT
// ============================================================
export async function exportTechnicianPerformanceToExcel(filters?: { dateFrom?: Date; dateTo?: Date }): Promise<Buffer> {
  const data = await db.getTechnicianPerformance(filters);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("أداء الفنيين");
  addRtlSupport(ws);

  ws.columns = [
    { header: "اسم الفني", key: "name", width: 25 },
    { header: "البلاغات المسندة", key: "assigned", width: 18 },
    { header: "المكتملة", key: "completed", width: 15 },
    { header: "نسبة الإنجاز", key: "completionRate", width: 18 },
    { header: "متوسط وقت الحل (ساعة)", key: "avgTime", width: 25 },
    { header: "درجة الأداء", key: "score", width: 18 },
  ];
  styleHeader(ws);

  data.forEach((t: any) => {
    ws.addRow({
      name: t.name,
      assigned: t.assignedTickets,
      completed: t.completedTickets,
      completionRate: `${t.completionRate}%`,
      avgTime: t.avgResolutionTime,
      score: t.performanceScore,
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================
// AUDIT LOG EXPORT
// ============================================================
export async function exportAuditLogToExcel(filters?: any): Promise<Buffer> {
  const logs = await db.getAuditLogsEnhanced(filters);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("سجل التدقيق");
  addRtlSupport(ws);

  ws.columns = [
    { header: "التاريخ", key: "date", width: 22 },
    { header: "المستخدم", key: "user", width: 20 },
    { header: "الإجراء", key: "action", width: 18 },
    { header: "نوع الكيان", key: "entityType", width: 18 },
    { header: "رقم الكيان", key: "entityId", width: 12 },
    { header: "الوصف", key: "description", width: 45 },
    { header: "القيم القديمة", key: "oldValues", width: 40 },
    { header: "القيم الجديدة", key: "newValues", width: 40 },
  ];
  styleHeader(ws);

  const actionMap: Record<string, string> = {
    create: "إنشاء", update: "تعديل", delete: "حذف",
    status_change: "تغيير حالة", approve: "اعتماد", reject: "رفض",
    assign: "إسناد", purchase: "شراء", deliver: "توريد",
  };
  const entityMap: Record<string, string> = {
    ticket: "بلاغ", purchase_order: "طلب شراء", po_item: "صنف شراء",
    inventory: "مخزون", site: "موقع", user: "مستخدم",
  };

  logs.forEach((log: any) => {
    ws.addRow({
      date: new Date(log.createdAt).toLocaleString("ar-SA"),
      user: log.userName || `مستخدم #${log.userId}`,
      action: actionMap[log.action] || log.action,
      entityType: entityMap[log.entityType] || log.entityType,
      entityId: log.entityId,
      description: log.description,
      oldValues: log.oldValues ? JSON.stringify(log.oldValues, null, 0) : "",
      newValues: log.newValues ? JSON.stringify(log.newValues, null, 0) : "",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ============================================================
// INVENTORY EXPORT
// ============================================================
export async function exportInventoryToExcel(): Promise<Buffer> {
  const items = await db.getInventoryItems();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = new Date();

  const ws = workbook.addWorksheet("المخزون");
  addRtlSupport(ws);

  ws.columns = [
    { header: "اسم الصنف", key: "name", width: 30 },
    { header: "رقم القطعة", key: "partNumber", width: 18 },
    { header: "الكمية", key: "quantity", width: 12 },
    { header: "الحد الأدنى", key: "minQuantity", width: 15 },
    { header: "الوحدة", key: "unit", width: 12 },
    { header: "الموقع", key: "location", width: 20 },
    { header: "تاريخ الإضافة", key: "createdAt", width: 22 },
  ];
  styleHeader(ws);

  items.forEach((item: any) => {
    ws.addRow({
      name: item.itemName,
      partNumber: item.partNumber || "-",
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      unit: item.unit,
      location: item.location || "-",
      createdAt: new Date(item.createdAt).toLocaleString("ar-SA"),
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
