/**
 * ══════════════════════════════════════════════════════════════════════════
 * الحارس المركزي لطلبات الشراء — الطبقة 3: نقطة التنفيذ (Guard / PEP)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * هذا هو الملف الوحيد اللي الراوترات تستورد منه فعليًا. يجمع بين:
 *  - policy.ts  (البيانات: من المسموح له بماذا)
 *  - engine.ts  (القرار النقي: هل هذا مسموح؟)
 *  - استعلامات DB الصغيرة المطلوبة لتغذية القرار (معرّفات المندوب/المساعدين)
 *
 * الهدف: يستبدل كل الأنماط المتكررة يدويًا بكل ملف راوتر (isAdminOrOwner،
 * تكرار فحص الدور، تكرار جلب assistantIds/delegate items) باستدعاء واحد.
 */

import * as db from "../db";
import {
  assertCanPerformAction,
  assertCanPerformItemAction,
  assertCanPerformItemStatusAction,
  assertItemAssignedToDelegate,
  assertPOVisible,
  filterVisiblePOs,
  isItemAssignedToDelegate,
  isPOVisible,
  type ActionContext,
  type ItemActionSubject,
  type POActionSubject,
  type POVisibilitySubject,
  type VisibilityContext,
} from "./engine";
import type { ActionName } from "./policy";

export type { ActionName } from "./policy";
export { PO_STATUS } from "./policy";

interface MinimalCtxUser {
  id: number;
  role: string;
}

/**
 * يبني VisibilityContext كاملًا (بما فيه استعلامات DB الإضافية المطلوبة فقط
 * للأدوار التي تحتاجها: food_warehouse_manager و delegate). لباقي الأدوار
 * لا يوجد أي استعلام إضافي — صفر تكلفة أداء زائدة.
 */
async function buildVisibilityContext(user: MinimalCtxUser): Promise<VisibilityContext> {
  const ctx: VisibilityContext = { role: user.role, userId: user.id };

  if (user.role === "food_warehouse_manager") {
    ctx.assistantUserIds = await db.getUserIdsByRole("food_warehouse_assistant");
  }
  if (user.role === "delegate") {
    const items = await db.getPOItemsByDelegate(user.id);
    ctx.delegateAssignedPoIds = Array.from(new Set(items.map((i: any) => i.purchaseOrderId)));
  }

  return ctx;
}

/**
 * يُستخدم من getById(): يجلب ما يلزم من DB ثم يتحقق من الرؤية، ويرمي
 * FORBIDDEN تلقائيًا إن لم تكن مسموحة.
 */
export async function assertCanViewPurchaseOrder(user: MinimalCtxUser, po: POVisibilitySubject): Promise<void> {
  const visCtx = await buildVisibilityContext(user);
  assertPOVisible(visCtx, po);
}

/**
 * يُستخدم من list(): يجلب ما يلزم من DB مرة واحدة، ثم يفلتر قائمة الطلبات
 * الكاملة لنفس النطاق **تمامًا** المستخدم بـgetById — هذا هو الضمان العملي
 * لتطابق نطاقي القائمة والتفاصيل (بند #3 بجدول الصلاحيات المعتمد).
 */
export async function filterVisiblePurchaseOrders<T extends POVisibilitySubject>(
  user: MinimalCtxUser,
  pos: T[]
): Promise<T[]> {
  const visCtx = await buildVisibilityContext(user);
  return filterVisiblePOs(visCtx, pos);
}

/**
 * يُستخدم من أي إجراء (reject، approveAccounting، editItem، ...): يتحقق من
 * صلاحية تنفيذ الإجراء على طلب بحالته الحالية، ويرمي FORBIDDEN تلقائيًا.
 *
 * isCreator: يحدّده الراوتر بنفسه (عادة po.requestedById === ctx.user.id)
 * لأن الحارس لا يفترض شكل بيانات الطلب — فقط يستقبل نتيجة الفحص جاهزة.
 */
export function assertCanPerformPOAction(
  action: ActionName,
  user: MinimalCtxUser,
  po?: POActionSubject,
  opts?: { isCreator?: boolean }
): void {
  const actionCtx: ActionContext = { role: user.role, userId: user.id, isCreator: opts?.isCreator };
  assertCanPerformAction(action, actionCtx, po);
}

/** نسخة بلا رمي خطأ — للاستخدام بمنطق شرطي (مثال: إظهار/إخفاء زر أو فرع كود) */
export function canPerformPOAction(
  action: ActionName,
  user: MinimalCtxUser,
  po?: POActionSubject,
  opts?: { isCreator?: boolean }
): boolean {
  try {
    assertCanPerformPOAction(action, user, po, opts);
    return true;
  } catch {
    return false;
  }
}

/**
 * يُستخدم من editItem/deleteItem: فحص الصلاحية على مستوى الصنف (منطق أعقد من
 * PO-level، راجع policy.ts:ITEM_ACTION_POLICY للتفاصيل الكاملة).
 */
export function assertCanPerformItemPOAction(
  actionName: "editItem" | "deleteItem",
  user: MinimalCtxUser,
  subject: ItemActionSubject & { isCreator: boolean }
): void {
  const actionCtx: ActionContext = { role: user.role, userId: user.id, isCreator: subject.isCreator };
  assertCanPerformItemAction(actionName, actionCtx, subject);
}

/**
 * يُستخدم من estimateCost/confirmPurchase: هل الصنف مخصَّص لهذا المندوب؟
 * (owner/admin يتجاوزان دائمًا)
 */
export function assertPOItemAssignedToDelegate(
  user: MinimalCtxUser,
  item: { delegateId: number | null | undefined; itemName?: string }
): void {
  assertItemAssignedToDelegate({ role: user.role, userId: user.id }, item);
}

/** نسخة بلا رمي خطأ لنفس الفحص أعلاه — تُستخدم بمنطق الفلترة (مثال: submitPricedBatch) */
export function isItemAssignedToPODelegate(user: MinimalCtxUser, item: { delegateId: number | null | undefined }): boolean {
  return isItemAssignedToDelegate({ role: user.role, userId: user.id }, item);
}

/**
 * يُستخدم من confirmDeliveryToWarehouse/confirmDeliveryToRequester: الفحص على
 * حالة **الصنف** نفسه، لا حالة الطلب (طلب واحد قد يحوي أصنافًا بحالات مختلفة
 * أثناء الشراء الجزئي).
 */
export function assertCanPerformItemStatusPOAction(
  actionName: "confirmDeliveryToWarehouse" | "confirmDeliveryToRequester",
  user: MinimalCtxUser,
  itemStatus: string
): void {
  assertCanPerformItemStatusAction(actionName, { role: user.role, userId: user.id }, itemStatus);
}
