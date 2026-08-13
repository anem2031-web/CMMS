import * as db from "../../_core/db";
import { detectLanguage, translateFields, type SupportedLanguage } from "../../services/translation/translation";
// ⚠️ منقول إلى server/_core/authz/policy.ts (الحارس المركزي، 2026-07-28) — هذا
// إعادة تصدير فقط للتوافق مع أي كود قديم قد يستورد من هنا؛ التعريف الفعلي
// (مصدر الحقيقة الوحيد) أصبح بملف policy.ts.
export { OWN_REQUESTS_ONLY_ROLES } from "../../_core/authz/policy";

export { detectLanguage, translateFields };
export type { SupportedLanguage };

/**
 * إشعار **مشرف البلاغ المعني وحده** بدل بثّ لكل المشرفين — 2026-08-10.
 *
 * `tickets.supervisorId` يُملأ عند الفرز (`routeTicketAfterTriage`) ويحمل مَن
 * فرز البلاغ فعليًا، فهو "صاحب العلاقة" الطبيعي بكل إجراء لاحق عليه.
 *
 * ⚠️ **سقوط احتياطي إلزامي**: لو كان `supervisorId` فارغًا (بلاغات قديمة
 * أُنشئت قبل ميزة الفرز 2026-08-02، أو بلاغ لم يُفرَز بعد)، نعود للبثّ لكل
 * المشرفين — **الأسوأ من الضجيج هو ألا يصل الإشعار لأحد فيعلق البلاغ**.
 * لا تُزل هذا السقوط الاحتياطي.
 *
 * `extraRecipients` لدمج مستلمين إضافيين (مديرو المسار مثلًا) بلا تكرار —
 * الإرسال يمر على Map بالمعرّف فيمنع وصول إشعارين لنفس الشخص.
 */
export async function notifyTicketSupervisor(
  ticket: { id: number; supervisorId?: number | null },
  notification: { title: string; message: string; type: string; relatedTicketId?: number; relatedPoId?: number },
  options: { excludeUserId?: number; extraRecipients?: Array<{ id: number }> } = {},
) {
  const recipients = new Map<number, { id: number }>();

  if (ticket.supervisorId) {
    recipients.set(ticket.supervisorId, { id: ticket.supervisorId });
  } else {
    const supervisors = await db.getUsersByRole("supervisor");
    for (const sup of supervisors) recipients.set(sup.id, sup);
  }

  for (const extra of options.extraRecipients || []) recipients.set(extra.id, extra);

  for (const recipient of recipients.values()) {
    if (options.excludeUserId && recipient.id === options.excludeUserId) continue;
    await db.createNotification({ userId: recipient.id, ...notification });
  }
}

/**
 * Notify a list of users fetched by role.
 */
export async function notifyByRole(
  role: string,
  notification: { title: string; message: string; type: string; relatedTicketId?: number; relatedPoId?: number }
) {
  const users = await db.getUsersByRole(role);
  for (const user of users) {
    await db.createNotification({ userId: user.id, ...notification });
  }
}

/**
 * Notify maintenance managers.
 */
export async function notifyManagers(
  notification: { title: string; message: string; type: string; relatedTicketId?: number; relatedPoId?: number },
  excludeUserId?: number
) {
  const managers = await db.getOperationalManagerUsers();
  for (const mgr of managers) {
    if (excludeUserId && mgr.id === excludeUserId) continue;
    await db.createNotification({ userId: mgr.id, ...notification });
  }
}

/**
 * Notify the PO requester that one of their items was rejected or cancelled,
 * and log it as a procurement comment so the full attribution (who + reason)
 * is visible in the PO's comment thread — mirrors the requestItemRevision flow.
 * Used by reviewItems, approveAccounting, approveManagement, and cancelItem
 * so rejection/cancellation is handled the same way regardless of which
 * stage of the purchase cycle it happens at.
 */
export async function notifyItemRejection(params: {
  poId: number;
  poNumber: string;
  requestedById: number;
  itemId?: number;
  itemName: string;
  actorId: number;
  actorName: string;
  actorRole: string;
  reason: string;
  kind: "rejected" | "cancelled";
}) {
  const isCancel = params.kind === "cancelled";
  const verb = isCancel ? "تم إلغاء" : "تم رفض";

  await db.createProcurementComment({
    purchaseOrderId: params.poId,
    purchaseOrderItemId: params.itemId,
    userId: params.actorId,
    userName: params.actorName,
    userRole: params.actorRole,
    actionType: isCancel ? "item_cancelled" : "item_rejected",
    note: `${verb} الصنف: ${params.itemName}\n\nالسبب:\n${params.reason}`,
  });

  if (params.requestedById && params.requestedById !== params.actorId) {
    await db.createNotification({
      userId: params.requestedById,
      title: isCancel ? "⚠️ تم إلغاء صنف من طلب الشراء" : "❌ تم رفض صنف من طلب الشراء",
      message: `${verb} الصنف "${params.itemName}" من طلب الشراء رقم ${params.poNumber} بواسطة ${params.actorName}.\n\nالسبب:\n${params.reason}`,
      type: isCancel ? "warning" : "error",
      relatedPoId: params.poId,
    });
  }
}

/**
 * Auto-translate text fields and return translation map.
 */
export async function autoTranslate(
  fields: Record<string, string>,
  logPrefix = "[translate]"
): Promise<Record<string, any>> {
  if (Object.keys(fields).length === 0) return {};
  try {
    const firstValue = Object.values(fields)[0];
    const lang = (await detectLanguage(firstValue)) as SupportedLanguage;
    const translations = await translateFields(fields, lang);
    const result: Record<string, any> = { originalLanguage: lang };
    for (const [key, val] of Object.entries(translations)) {
      if (val) {
        result[`${key}_ar`] = val.ar;
        result[`${key}_en`] = val.en;
        result[`${key}_ur`] = val.ur;
      }
    }
    return result;
  } catch (e) {
    console.error(`${logPrefix} Translation failed:`, e);
    return {};
  }
}
