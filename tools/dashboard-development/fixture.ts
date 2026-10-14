import type { DashboardData, DashboardFilters, DashboardTicket, DashboardPurchase } from "../../shared/dashboard-overview";
export const NOW = Date.parse("2026-10-13T12:00:00+03:00");
export const FILTERS: DashboardFilters = { period: "month", department: "all" };
export const HOUR = 3600000;
export function ticket(id: number, overrides: Partial<DashboardTicket> = {}): DashboardTicket {
  return {
    id, ticketNumber: `MT-2026-${String(id).padStart(5, "0")}`, title: `بلاغ تجربة ${id}`,
    status: "in_progress", priority: "medium", workflowModel: "legacy", parentTicketId: null,
    siteId: 1, department: "maintenance_report_department_general", managerId: 10, assignedToId: 12,
    createdAt: NOW - 72 * HOUR, closedAt: null, assignedAt: NOW - 60 * HOUR, ...overrides,
  };
}
export function purchase(id: number, overrides: Partial<DashboardPurchase> = {}): DashboardPurchase {
  return { id, orderId: 100, itemName: `مادة ${id}`, status: "delivered_to_warehouse", quantity: 5, receivedQuantity: 5,
    unit: "قطعة", actualTotalCost: "50.10", receivedAt: NOW - HOUR, purchasedAt: NOW - 10 * HOUR, delegateId: 20, ...overrides };
}
export function fixture(): DashboardData {
  return {
    tickets: [
      ticket(1, { workflowModel: "department_tasks", title: "البلاغ الرئيسي — إصلاح إنارة الموقع", status: "department_planning" }),
      ticket(2, { workflowModel: "sub_ticket", parentTicketId: 1, ticketNumber: "MT-2026-00001-01", title: "إصلاح إنارة المدخل", status: "closed", closedAt: NOW - 2 * HOUR }),
      ticket(3, { workflowModel: "sub_ticket", parentTicketId: 1, ticketNumber: "MT-2026-00001-02", title: "إصلاح إنارة الممر", status: "requester_confirmed", closedAt: NOW - 5 * HOUR }),
      ticket(4, { workflowModel: "sub_ticket", parentTicketId: 1, ticketNumber: "MT-2026-00001-03", title: "إنارة خارجية — انتظار المواد", priority: "critical" }),
      ticket(5, { title: "صيانة مضخة المياه", department: "maintenance_report_department_construction", managerId: 11, createdAt: NOW - 120 * HOUR }),
      ticket(6, { title: "إصلاح باب المستودع", status: "closed", createdAt: Date.parse("2026-09-20T12:00:00+03:00"), closedAt: Date.parse("2026-09-30T12:00:00+03:00") }),
      ticket(7, { title: "فحص اللوحة الكهربائية", status: "under_inspection", createdAt: NOW - 2 * HOUR }),
    ],
    itemScopes: [], departmentScopes: [{ ticketId: 1, department: "maintenance_report_department_general", managerId: 10 }],
    orders: [{ id: 100, poNumber: "PR-2026-00100", status: "partial_purchase", ticketId: 4, siteId: 1, requestedById: 10 }],
    purchases: [purchase(1), purchase(2, { status: "approved", actualTotalCost: null, receivedAt: null }), purchase(3, { status: "purchased", receivedAt: null }), purchase(4, { status: "cancelled", receivedAt: null }), purchase(5, { actualTotalCost: null })],
    teams: [{ id: 40, ticketId: 4, managerId: 10, stage: "waiting_material", teamName: "فريق الكهرباء", createdAt: NOW - 70 * HOUR, enteredAt: NOW - 65 * HOUR, note: "توفير مواد الإنارة" }],
    teamPurchaseLinks: [{ ticketId: 4, purchaseItemId: 2 }, { ticketId: 4, purchaseItemId: 3 }],
    statusEntries: [{ ticketId: 5, enteredAt: NOW - 70 * HOUR }, { ticketId: 7, enteredAt: NOW - HOUR }],
    users: [{ id: 10, name: "مدير الصيانة", role: "general_maintenance_manager" }, { id: 11, name: "مدير الإنشاءات", role: "construction_procurement_manager" }, { id: 12, name: "فني الفريق", role: "technician" }, { id: 20, name: "مندوب المشتريات", role: "delegate" }],
    sites: [{ id: 1, name: "الموقع الرئيسي" }, { id: 2, name: "الموقع الثاني" }], externalJobs: [],
  };
}
