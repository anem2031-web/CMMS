/**
 * خطوات تنفيذ بند البلاغ — نقاط مرتبة بدل نص حر.
 * الخطوة 2 من ميزة "البلاغ متعدد الجهات والمسارات" (2026-08-08).
 *
 * يُبقي منطق "أي حالة تقابل أي خطوة؟" في مكان واحد يستخدمه أكثر من مكوّن
 * (بطاقات بنود شاشة تفاصيل البلاغ + بطاقات صفحة بلاغات الإنشاءات لاحقًا)،
 * بدل تكرار سلسلة switch/if بكل مكان يعرض حالة بند.
 *
 * ⚠️ ticket_items.status يستخدم نفس قائمة حالات tickets.status الـ21 حرفيًا
 * (قرار مقصود موثَّق بالخطوة 1) — هذا الملف يُترجم تلك الحالات لأربع خطوات
 * مبسّطة للعرض فقط، ولا يغيّر قيمة status نفسها.
 */

export const TICKET_ITEM_STEPS = [
  { key: "inspect", label: "الفحص" },
  { key: "path", label: "تحديد المسار" },
  { key: "execute", label: "التنفيذ" },
  { key: "close", label: "الإغلاق" },
] as const;

export type TicketItemStepKey = typeof TICKET_ITEM_STEPS[number]["key"];

const CLOSED_STATUSES = new Set(["closed", "requester_confirmed", "verified"]);
const EXECUTE_STATUSES = new Set([
  "repaired", "ready_for_closure", "out_for_repair", "in_progress", "assigned",
  "needs_purchase", "purchase_pending_estimate", "purchase_pending_accounting",
  "purchase_pending_management", "purchase_approved", "partial_purchase",
  "purchased", "received_warehouse",
]);
const PATH_STATUSES = new Set(["work_approved", "approved"]);

/**
 * يُعيد فهرس الخطوة الحالية (0..3) ضمن TICKET_ITEM_STEPS، بناءً على حالة البند
 * ومساره. حالات ما قبل الفرز (new/pending_triage/under_inspection) تُعامَل
 * كخطوة "الفحص" — البند لم يُحدَّد مساره بعد.
 */
export function getTicketItemStepIndex(status: string | null | undefined, maintenancePath?: string | null): number {
  if (!status) return 0;
  if (CLOSED_STATUSES.has(status)) return 3;
  if (EXECUTE_STATUSES.has(status)) return 2;
  if (PATH_STATUSES.has(status)) return maintenancePath ? 2 : 1;
  return 0; // new / pending_triage / under_inspection
}

export function isTicketItemStepDone(stepIndex: number, currentIndex: number): boolean {
  return stepIndex < currentIndex || (stepIndex === 3 && currentIndex === 3);
}
