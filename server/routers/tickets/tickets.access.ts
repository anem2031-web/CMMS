/**
 * ══════════════════════════════════════════════════════════════════════════
 * حارس رؤية البلاغات (Tickets) — نفس مبدأ حارس طلبات الشراء
 * ══════════════════════════════════════════════════════════════════════════
 *
 * الخلفية: `tickets.list`/`listPaginated`/`inboxCounts` تُقيّد النطاق فعليًا
 * (operator ← بلاغاته التي أبلغ عنها، technician ← البلاغات المسنَدة له)، لكن
 * `tickets.getById` كانت `protectedProcedure` عارية بلا أي فحص — أي مستخدم
 * مسجّل دخول يقدر يقرأ **أي بلاغ** بمجرد معرفة رقمه (API أو رابط مباشر).
 *
 * نفس نمط الثغرة المكتشَف والمُعالَج سابقًا بطلبات الشراء (القائمة مقيّدة،
 * التفاصيل مفتوحة). هذا الملف يوحّد القرار بمصدر واحد يستدعيه الاثنان.
 *
 * ⚠️ مبدأ مقصود: القواعد أدناه **تطابق حرفيًا** ما تطبّقه `list()` اليوم — لم
 * نشدّد ولم نوسّع. الهدف إغلاق فجوة "القائمة مقيّدة والتفاصيل مفتوحة" فقط، لا
 * إعادة تصميم صلاحيات البلاغات (وهو مشروع مستقل أكبر لو أُريد لاحقًا).
 */

import { TRPCError } from "@trpc/server";

/**
 * الأدوار الممنوعة كليًا من البلاغات — مستخرجة **حرفيًا** من قائمة الأدوار
 * المسموح لها بقسم البلاغات بالواجهة (`client/src/components/layout/DashboardLayout.tsx`،
 * عنصرا `nav.tickets` و`nav.ticketsInbox`). أي دور غير مذكور بتلك القائمة كان
 * محجوبًا عن البلاغات بالواجهة، لكن الخادم كان يسمح له بالكامل (list وgetById) —
 * وهي بالضبط فئة "صلاحية مطبَّقة بالواجهة فقط وغير محمية بالخادم".
 *
 * ⚠️ إذا عُدّلت قائمة الأدوار بالواجهة مستقبلًا، يجب تحديث هذي القائمة معها.
 */
const ROLES_DENIED_FROM_TICKETS = [
  "accountant",
  "purchase_manager",
  "warehouse",
  "purchase_requester",
  "food_warehouse_manager",
  "food_warehouse_assistant",
];

/** أدوار مقيّدة بالبلاغات التي أبلغت عنها بنفسها */
const REPORTER_SCOPED_ROLES = ["operator"];

/** أدوار مقيّدة بالبلاغات المسنَدة إليها */
const ASSIGNEE_SCOPED_ROLES = ["technician"];

interface TicketAccessUser {
  id: number;
  role: string;
}

export interface TicketVisibilitySubject {
  reportedById: number | null;
  assignedToId: number | null;
  assignedTechnicianId?: number | null;
}

/** هل هذا الدور ممنوع كليًا من وحدة البلاغات؟ (يُستخدم أيضًا لفلترة list) */
export function isRoleDeniedFromTickets(role: string): boolean {
  return ROLES_DENIED_FROM_TICKETS.includes(role);
}

/**
 * هل يملك المستخدم صلاحية الاطلاع على هذا البلاغ؟
 * 1. الأدوار المحجوبة بالواجهة → ممنوعة كليًا (إغلاق فجوة الواجهة/الخادم).
 * 2. غير ذلك: نفس منطق `list()` بالضبط — operator ← بلاغاته، technician ←
 *    المسنَد له، وأي دور آخر ← كل البلاغات.
 */
export function isTicketVisible(user: TicketAccessUser, ticket: TicketVisibilitySubject): boolean {
  if (isRoleDeniedFromTickets(user.role)) return false;

  if (REPORTER_SCOPED_ROLES.includes(user.role)) {
    return ticket.reportedById === user.id;
  }
  if (ASSIGNEE_SCOPED_ROLES.includes(user.role)) {
    // `list()` تفلتر بـassignedToId؛ نقبل كذلك assignedTechnicianId لأن بعض
    // مسارات الإسناد بالنظام تكتب فيه، فمنعه كان سيحجب عن الفني بلاغًا مسنَدًا
    // له فعليًا (تشديد غير مقصود لم يكن موجودًا بالسلوك الأصلي).
    return ticket.assignedToId === user.id || ticket.assignedTechnicianId === user.id;
  }
  return true;
}

/** نسخة "ارمِ خطأ" — تُستخدم مباشرة داخل getById */
export function assertTicketVisible(
  user: TicketAccessUser,
  ticket: TicketVisibilitySubject,
  message = "ليس لديك صلاحية للاطلاع على هذا البلاغ"
): void {
  if (!isTicketVisible(user, ticket)) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}
