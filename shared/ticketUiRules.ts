import { APP_ROLE } from "./roles";

/** Roles allowed to retain ticket documents after closure and download the archive record. */
export const TICKET_DOCUMENT_MANAGER_ROLES = new Set<string>([
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.ADMIN,
  APP_ROLE.OWNER,
]);

export const TICKET_CLOSED_STATUSES = new Set<string>([
  "closed",
  "requester_confirmed",
]);

export function isTicketClosedForDocuments(status?: string | null): boolean {
  return !!status && TICKET_CLOSED_STATUSES.has(status);
}

/** Ticket details can only be edited while still waiting for classification. */
export function isTicketEditableBeforeTriage(status?: string | null): boolean {
  return status === "pending_triage";
}


export const TICKET_REPAIR_START_STATUSES = new Set<string>([
  "work_approved",
  "assigned",
]);

/**
 * Starting repair is path-aware:
 * - Path A starts after work approval/direct assignment.
 * - Path B starts only after every active purchased item is delivered to the technician.
 * - Path C starts only after gate entry, warehouse receipt, and handover for reinstall.
 * - Legacy tickets without a path keep the old direct-repair behavior.
 */
export function canStartTicketRepair(
  isExecutor: boolean,
  status?: string | null,
  maintenancePath?: string | null,
): boolean {
  if (!isExecutor || !status) return false;
  if (maintenancePath === "B") return status === "received_warehouse";
  if (maintenancePath === "C") return status === "received_warehouse";
  return TICKET_REPAIR_START_STATUSES.has(status);
}

/** Path A completion controls become available only after Start Repair moves the ticket to in_progress. */
export function isPathARepairCompletionStage(
  status?: string | null,
  maintenancePath?: string | null,
): boolean {
  return status === "in_progress" && maintenancePath === "A";
}

export function canSubmitPathARepair(
  isExecutor: boolean,
  status?: string | null,
  maintenancePath?: string | null,
): boolean {
  return isExecutor && isPathARepairCompletionStage(status, maintenancePath);
}

/** Both Path A and Path B require written repair notes and an after-repair photo. */
export function isRepairEvidenceComplete(
  repairNotes?: string | null,
  afterPhotoUrl?: string | null,
): boolean {
  return Boolean(repairNotes?.trim() && afterPhotoUrl?.trim());
}

export const isPathARepairEvidenceComplete = isRepairEvidenceComplete;
export const isPathBRepairEvidenceComplete = isRepairEvidenceComplete;

/** The legacy/general completion form must not compete with Path A, B, or C. */
export function canSubmitStandardRepair(
  isExecutor: boolean,
  status?: string | null,
  maintenancePath?: string | null,
): boolean {
  return Boolean(
    isExecutor &&
    status === "in_progress" &&
    maintenancePath !== "A" &&
    maintenancePath !== "B" &&
    maintenancePath !== "C"
  );
}

/** Path B is completed only after Start Repair and with evidence. */
export function canSubmitPathBRepair(
  isExecutor: boolean,
  status?: string | null,
  maintenancePath?: string | null,
): boolean {
  return Boolean(isExecutor && status === "in_progress" && maintenancePath === "B");
}

export const TICKET_PURCHASE_ORDER_CREATION_STATUSES = new Set<string>([
  "work_approved",
]);

/** Ticket-linked purchase orders belong exclusively to Path B. */
export function isPurchaseOrderAllowedForMaintenancePath(maintenancePath?: string | null): boolean {
  return maintenancePath === "B";
}

export function canCreateTicketPurchaseOrder(
  isManager: boolean,
  status?: string | null,
  maintenancePath?: string | null,
  hasActiveLinkedPurchaseOrder = false,
): boolean {
  return Boolean(
    isManager &&
    status &&
    !hasActiveLinkedPurchaseOrder &&
    isPurchaseOrderAllowedForMaintenancePath(maintenancePath) &&
    TICKET_PURCHASE_ORDER_CREATION_STATUSES.has(status),
  );
}

/**
 * The field task sheet appears immediately after classification.
 * After closure it is retained only for the archival/manager roles.
 */
export function canPrintTicketTask(role?: string | null, status?: string | null): boolean {
  if (!role || !status || status === "new" || status === "pending_triage") return false;
  if (isTicketClosedForDocuments(status)) {
    return !!role && TICKET_DOCUMENT_MANAGER_ROLES.has(role);
  }
  return true;
}

/** The full archive report is available only after closure to the approved roles. */
export function canDownloadTicketArchive(role?: string | null, status?: string | null): boolean {
  return !!role && isTicketClosedForDocuments(status) && TICKET_DOCUMENT_MANAGER_ROLES.has(role);
}

/** Technician assignment/reassignment management is restricted to these roles. */
export function hasTicketTechnicianAssignmentRole(role?: string | null): boolean {
  return !!role && TICKET_DOCUMENT_MANAGER_ROLES.has(role);
}

// ══════════════════════════════════════════════════════════════════════
// اكتمال بنود البلاغ — المرحلة 6 من ميزة البلاغ متعدد الجهات (2026-08-10)
//
// قرار صريح من صاحب المشروع: **كل بند يُعتمَد ويُغلق بشكل مستقل**، والبلاغ
// لا يُغلق إلا بعد أن تكون *كل* بنوده مغلقة فعليًا. حالة "جاهز للإغلاق"
// (ready_for_closure) **لا تُعدّ اكتمالًا** — تعني أن الفني أنهى عمله لكن
// المدير/المشرف لم يعتمد بعد.
// ══════════════════════════════════════════════════════════════════════

/** الحالات التي تُعدّ البند فيها مكتملًا فعليًا (مغلقًا باعتماد). */
export const TICKET_ITEM_COMPLETE_STATUSES = new Set<string>([
  "closed",
  "verified",
  "requester_confirmed",
]);

export function isTicketItemComplete(status?: string | null): boolean {
  return !!status && TICKET_ITEM_COMPLETE_STATUSES.has(status);
}

/**
 * هل اكتملت كل بنود البلاغ؟ يُستخدم كشرط إضافي قبل إغلاق البلاغ.
 *
 * ⚠️ **قاعدة #1 بـCLAUDE.md**: `length > 0` **قبل** `every()` إلزامي — مصفوفة
 * فارغة تُرجع `true` من `every()` فتسمح بإغلاق بلاغ بلا بنود إطلاقًا. هذا
 * بالضبط الخلل الذي وقع سابقًا بطلبات الشراء (الإصلاح #1 الموثَّق).
 */
export function areAllTicketItemsComplete(
  items: Array<{ status?: string | null }>,
): boolean {
  return items.length > 0 && items.every((item) => isTicketItemComplete(item.status));
}

/**
 * البنود غير المكتملة — لعرض رسالة تبيّن *أي* بند يمنع الإغلاق تحديدًا،
 * بدل رسالة عامة لا تدل المستخدم على الإجراء المطلوب.
 */
export function getIncompleteTicketItems<T extends { status?: string | null }>(
  items: T[],
): T[] {
  return items.filter((item) => !isTicketItemComplete(item.status));
}

// ============================================================
// عائلة البلاغ الرئيسي متعدد الجهات (workflowModel = department_tasks)
// ============================================================

/**
 * الحالات التي تُعدّ "انتهاء فعلي" للبلاغ الفرعي.
 *
 * ⚠️ قرار مقصود: `requester_confirmed` **ليست** شرطًا للاكتمال، لأنها تعتمد على
 * دخول مقدّم البلاغ وتأكيده — وهو فعل خارج سيطرة الصيانة قد لا يحدث أبدًا.
 * اشتراطها كان سيعيد إنتاج نفس عطل التعليق في موضع جديد. لذلك:
 *   • الاكتمال (شرط إغلاق الأب) = closed أو requester_confirmed.
 *   • التأكيد (مؤشر إضافي للعرض فقط) = requester_confirmed وحدها.
 */
const SUB_TICKET_FINISHED_STATUSES = new Set(["closed", "requester_confirmed"]);

export interface SubTicketFamilySummary {
  total: number;
  finished: number;
  confirmed: number;
  /** نسبة الاكتمال 0-100 — تُرجع 0 عند غياب الأبناء بدل NaN */
  percent: number;
  /** جاهز للإغلاق: يوجد أبناء فعليًا **وكلهم** منتهون */
  allFinished: boolean;
}

/**
 * ملخّص اكتمال البلاغات الفرعية تحت بلاغ رئيسي واحد.
 *
 * ⚠️ **قاعدة #1 بـCLAUDE.md**: `total > 0` **قبل** `every()` — بلاغ رئيسي لم
 * تُحوَّل مهامه بعد ليس "مكتملًا بنسبة 100%"، ومصفوفة فارغة تُرجع true من
 * every() فتفتح زر الإغلاق على بلاغ لم يبدأ العمل فيه أصلًا.
 */
export function summarizeSubTicketFamily(
  subTickets: Array<{ status?: string | null }> | null | undefined,
): SubTicketFamilySummary {
  const list = Array.isArray(subTickets) ? subTickets : [];
  const total = list.length;
  const finished = list.filter((t) => !!t.status && SUB_TICKET_FINISHED_STATUSES.has(t.status)).length;
  const confirmed = list.filter((t) => t.status === "requester_confirmed").length;
  return {
    total,
    finished,
    confirmed,
    percent: total > 0 ? Math.round((finished / total) * 100) : 0,
    allFinished: total > 0 && finished === total,
  };
}
