/**
 * ══════════════════════════════════════════════════════════════════════════
 * "بانتظار إجرائي" — تحديد الطلبات التي تنتظر إجراءً من المستخدم الحالي
 * ══════════════════════════════════════════════════════════════════════════
 *
 * المشكلة المعالَجة (بكلام صاحب المشروع): «الطلبات كثيرة ولا أعرف ما يحتاج
 * موافقتي فيضيع ضمن صفوف الطلبات، ولا أعرف موقع الطلب الآن».
 *
 * المبدأ: لا نسأل «ما مرحلة الطلب؟» بل «هل هذا الطلب واقف بانتظار فعل من هذا
 * المستخدم تحديدًا؟» — وهي ثلاث فئات مختلفة، لا فئة واحدة:
 *
 *   1. طلب بمرحلة يستطيع دور المستخدم التصرف فيها (اعتماد/مراجعة/تسعير/استلام).
 *   2. طلب رُدّ لمنشئه للمراجعة (revision_needed).
 *   3. طلب فيه صنف ملغى أو يحتاج مراجعة، والقرار بيد منشئ الطلب.
 *
 * الفئتان 2 و3 هما الأخطر عمليًا: الطلب واقف تمامًا، وحالته العامة لا تدل على
 * أن الكرة بملعب المستخدم، فيسهل ضياعه — وهذا جوهر الشكوى الأصلية.
 *
 * ⚠️ مبدأ تصميمي: هذا الملف **لا يعرّف صلاحيات جديدة إطلاقًا**. يستدعي
 * `canPerformAction` من الحارس المركزي (server/_core/authz) كمصدر وحيد للحقيقة.
 * فما يظهر هنا هو بالضبط ما يستطيع المستخدم تنفيذه فعليًا — لا أكثر ولا أقل.
 */

import { canPerformAction, canPerformItemAction } from "../../_core/authz/engine";
import { PO_STATUS } from "../../_core/authz/policy";

/** حالات الأصناف التي تتطلب قرارًا من منشئ الطلب */
const ITEM_STATUSES_NEEDING_CREATOR = ["needs_item_revision", "purchase_cancelled"];

export interface ActionablePO {
  id: number;
  poNumber: string;
  status: string;
  /** سبب ظهور الطلب — نص عربي مفهوم يُعرض للمستخدم مباشرة */
  reason: string;
  /** الإجراء المقترح — نص الزر */
  actionLabel: string;
  /** ملخص الأصناف: "تم شراء 3 من 5" — يُعرض عند وجود تقدم جزئي */
  itemsSummary?: string;
}

interface UserCtx {
  id: number;
  role: string;
}

interface POInput {
  id: number;
  poNumber: string;
  status: string;
  requestedById: number | null;
}

interface ItemInput {
  purchaseOrderId: number;
  status: string;
}

/**
 * ترجمة حالة الطلب إلى سبب مفهوم + إجراء، للفئة الأولى (مرحلة الدور).
 * تُرجع null إذا لم يكن للمستخدم إجراء بهذي المرحلة.
 */
function describeStageAction(ctx: UserCtx, po: POInput): { reason: string; actionLabel: string } | null {
  const subject = { status: po.status };
  const actionCtx = { role: ctx.role, userId: ctx.id };

  if (canPerformAction("reviewItems", actionCtx, subject)) {
    return { reason: "يحتاج مراجعتك وتوزيع الأصناف", actionLabel: "راجع" };
  }
  if (canPerformAction("approveAccounting", actionCtx, subject)) {
    return { reason: "يحتاج اعتمادك المحاسبي", actionLabel: "اعتمد" };
  }
  if (canPerformAction("approveManagement", actionCtx, subject)) {
    return { reason: "يحتاج اعتمادك الإداري", actionLabel: "اعتمد" };
  }
  if (canPerformAction("confirmPurchase", actionCtx, subject)) {
    return { reason: "بانتظار تنفيذ الشراء", actionLabel: "تنفيذ الشراء" };
  }
  return null;
}

/** يبني ملخص الأصناف: "تم شراء 3 من 5" — يُعرض فقط عند وجود تقدم جزئي فعلي */
function buildItemsSummary(items: ItemInput[]): string | undefined {
  if (items.length === 0) return undefined;
  const purchased = items.filter((i) =>
    ["purchased", "delivered_to_warehouse", "delivered_to_requester"].includes(i.status)
  ).length;
  if (purchased === 0 || purchased === items.length) return undefined;
  return `تم شراء ${purchased} من ${items.length}`;
}

/**
 * الدالة الرئيسية: تُرجع الطلبات التي تنتظر إجراءً من هذا المستخدم، مع سبب
 * ظهور كل طلب والإجراء المقترح.
 *
 * @param pos    الطلبات التي يملك المستخدم صلاحية رؤيتها (مفلترة مسبقًا بالحارس)
 * @param items  كل أصناف تلك الطلبات (لتفادي استعلام منفصل لكل طلب)
 */
export function computeActionablePOs(
  ctx: UserCtx,
  pos: POInput[],
  items: ItemInput[]
): ActionablePO[] {
  const itemsByPO = new Map<number, ItemInput[]>();
  for (const it of items) {
    const list = itemsByPO.get(it.purchaseOrderId) ?? [];
    list.push(it);
    itemsByPO.set(it.purchaseOrderId, list);
  }

  const result: ActionablePO[] = [];

  for (const po of pos) {
    const poItems = itemsByPO.get(po.id) ?? [];
    const isCreator = po.requestedById === ctx.id;
    const itemsSummary = buildItemsSummary(poItems);

    // ── الفئة 2: طلب رُدّ لمنشئه للمراجعة ─────────────────────────────
    if (po.status === PO_STATUS.REVISION_NEEDED && isCreator) {
      result.push({
        id: po.id, poNumber: po.poNumber, status: po.status,
        reason: "رُدّ إليك للمراجعة",
        actionLabel: "تعديل وإعادة إرسال",
        itemsSummary,
      });
      continue;
    }

    // ── الفئة 3: صنف ملغى أو يحتاج مراجعة، والقرار بيد منشئ الطلب ─────
    const needyItems = poItems.filter((i) => ITEM_STATUSES_NEEDING_CREATOR.includes(i.status));
    if (needyItems.length > 0) {
      // نتحقق عبر الحارس المركزي أن المستخدم يستطيع فعلًا التصرف بهذا الصنف
      const canAct = canPerformItemAction(
        "editItem",
        { role: ctx.role, userId: ctx.id, isCreator },
        { itemStatus: needyItems[0].status, poStatus: po.status }
      );
      if (canAct) {
        const cancelled = needyItems.filter((i) => i.status === "purchase_cancelled").length;
        const label = cancelled > 0 ? "صنف ملغى يحتاج قرارك" : "صنف يحتاج مراجعتك";
        result.push({
          id: po.id, poNumber: po.poNumber, status: po.status,
          reason: `${label} — ${needyItems.length} من ${poItems.length} أصناف`,
          actionLabel: "معالجة",
          itemsSummary,
        });
        continue;
      }
    }

    // ── الفئة 1: طلب بمرحلة يستطيع دور المستخدم التصرف فيها ───────────
    const stage = describeStageAction(ctx, po);
    if (stage) {
      result.push({
        id: po.id, poNumber: po.poNumber, status: po.status,
        reason: stage.reason,
        actionLabel: stage.actionLabel,
        itemsSummary,
      });
    }
  }

  return result;
}
