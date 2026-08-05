/**
 * قواعد ربط صرف مواد المخزون ببلاغ المسار B.
 *
 * الكمية المشتراة قد تكون أكبر من احتياج البلاغ. لذلك يكفي تسجيل عملية صرف
 * موجبة واحدة لكل صنف فعّال مرتبط بالبلاغ حتى يُعد احتياج ذلك الصنف مسلّماً،
 * بينما يبقى الرصيد الزائد في المخزون كمخزون عام.
 */

export const CLOSED_TICKET_MATERIAL_LINK_STATUSES = new Set<string>([
  "closed",
  "requester_confirmed",
]);

export const TERMINAL_PURCHASE_ORDER_ITEM_STATUSES = new Set<string>([
  "cancelled",
  "rejected",
]);

export interface TicketMaterialLinkSnapshot {
  ticketId?: number | null;
  ticketStatus?: string | null;
  maintenancePath?: string | null;
  assignedTechnicianId?: number | null;
  purchaseOrderItemId?: number | null;
  purchaseOrderItemStatus?: string | null;
}

/** هل ما زال بند المخزون يمثل احتياجًا غير مكتمل لبلاغ B مفتوح؟ */
export function isPendingTicketMaterialLink(
  snapshot: TicketMaterialLinkSnapshot,
): boolean {
  if (snapshot.maintenancePath !== "B") return false;
  if (!snapshot.ticketId || !snapshot.purchaseOrderItemId) return false;
  if (!snapshot.ticketStatus || CLOSED_TICKET_MATERIAL_LINK_STATUSES.has(snapshot.ticketStatus)) {
    return false;
  }
  if (!snapshot.purchaseOrderItemStatus) return false;
  if (TERMINAL_PURCHASE_ORDER_ITEM_STATUSES.has(snapshot.purchaseOrderItemStatus)) return false;
  return snapshot.purchaseOrderItemStatus !== "delivered_to_requester";
}

/**
 * يقرر هل يجب عرض حلقة ربط البلاغ في شاشة الصرف.
 * بعد تسليم احتياج الصنف أو إغلاق البلاغ يتحول الرصيد المتبقي إلى مخزون عام،
 * فلا يظهر اسم فني البلاغ القديم عند عمليات الصرف اللاحقة.
 */
export function shouldExposeTicketMaterialLink(
  snapshot: TicketMaterialLinkSnapshot,
): boolean {
  return isPendingTicketMaterialLink(snapshot) && !!snapshot.assignedTechnicianId;
}

/** المستلم الفعلي اختيار إلزامي في كل عملية تسليم. */
export function hasActualDeliveryRecipient(recipientId?: number | null): boolean {
  return Number.isInteger(recipientId) && Number(recipientId) > 0;
}
