// ============================================================
// حساب مراحل طلب الشراء على مستوى الطلب ككل (وليس مستوى الصنف)
// ============================================================
// ✅ مصدر حقيقة وحيد لمنطق "مراحل الطلب" في تقرير دورة الشراء.
// نشأت الحاجة لهذا الملف بعد اكتشاف وجود ملفين منفصلين (reports.router.ts
// وpurchase-reports.router.ts) يحملان نسختين مختلفتين تقريبًا من نفس هذا
// المنطق — أحدهما (purchase-reports.router.ts) كان معطَّلًا تمامًا (كود ميت
// لا تستدعيه الواجهة إطلاقًا)، بينما ظل الآخر (reports.router.ts) هو
// المُستخدَم فعليًا لكنه لم يُحدَّث بالإصلاحات. أدى هذا لساعات من التشخيص
// المُتعِب بسبب تعديل الملف الخطأ. راجع docs/CHANGELOG_TECHNICAL.md
// (بند 2026-07-21) للتفاصيل الكاملة لهذه الحادثة.
//
// أي تطوير مستقبلي على مراحل طلب الشراء يجب أن يمر من هنا فقط — لا يجوز
// إنشاء نسخة موازية من هذا المنطق في أي ملف راوتر مباشرة.

export type PurchaseOrderPhaseStatus = "مكتملة" | "قيد التنفيذ" | "بانتظار التنفيذ" | "لم تبدأ";

export interface PurchaseOrderPhase {
  phase: string;
  startAt: Date | null;
  endAt: Date | null;
  durationHours: number | null;
  actor: string;
  actors: { itemName: string; name: string }[];
  status: PurchaseOrderPhaseStatus;
}

/** تُقرِّب مدة بالميلي ثانية إلى ساعات بخانة عشرية واحدة */
export function msToHours(ms: number): number {
  return Math.round((ms / 3600000) * 10) / 10;
}

/**
 * يحسب إحدى الحالات الأربع لمرحلة معيّنة:
 * - "مكتملة": توجد قيمة إنجاز فعلية (doneAt).
 * - "قيد التنفيذ": المرحلة تُطابق حالة الطلب الحالية بالضبط.
 * - "بانتظار التنفيذ": المرحلة التالية مباشرة بعد الحالة الحالية.
 * - "لم تبدأ": غير ذلك.
 */
export function computeStageStatus(
  doneAt: unknown,
  isCurrentActive: boolean,
  isNextInQueue: boolean
): PurchaseOrderPhaseStatus {
  if (doneAt) return "مكتملة";
  if (isCurrentActive) return "قيد التنفيذ";
  if (isNextInQueue) return "بانتظار التنفيذ";
  return "لم تبدأ";
}

export interface PurchaseOrderForPhases {
  createdAt: string | Date;
  status: string;
  reviewedAt?: string | Date | null;
  accountingApprovedAt?: string | Date | null;
  managementApprovedAt?: string | Date | null;
}

/**
 * يحسب مراحل طلب الشراء الأربع (على مستوى الطلب ككل، لا الصنف):
 * إنشاء الطلب، مراجعة الأصناف، موافقة الحسابات، موافقة الإدارة.
 *
 * لا تشمل هذه الدالة عمدًا مراحل التسعير/الشراء/الاستلام لأنها تختلف فعليًا
 * من صنف لآخر ضمن نفس الطلب (قد يُنفِّذها مناديب/موظفون مختلفون) — تفصيلها
 * الكامل يبقى في تقرير الأصناف المنفصل (itemsReport)، وليس هنا.
 */
export function computePurchaseOrderPhases(
  po: PurchaseOrderForPhases,
  names: {
    requestedBy: string;
    reviewedBy?: string | null;
    accountingApprovedBy?: string | null;
    managementApprovedBy?: string | null;
  }
): PurchaseOrderPhase[] {
  const NOT_ASSIGNED = "لم يتم التعيين";
  const now = Date.now();
  const t0 = new Date(po.createdAt).getTime();
  const tReview = po.reviewedAt ? new Date(po.reviewedAt).getTime() : null;
  const t1 = po.accountingApprovedAt ? new Date(po.accountingApprovedAt).getTime() : null;
  const t2 = po.managementApprovedAt ? new Date(po.managementApprovedAt).getTime() : null;

  const reviewStatus = computeStageStatus(po.reviewedAt, po.status === "pending_review", po.status === "draft");
  const accountingStatus = computeStageStatus(po.accountingApprovedAt, po.status === "pending_accounting", po.status === "pending_estimate");
  const managementStatus = computeStageStatus(po.managementApprovedAt, po.status === "pending_management", po.status === "pending_accounting");

  return [
    {
      phase: "إنشاء الطلب",
      startAt: new Date(po.createdAt),
      endAt: new Date(po.createdAt),
      durationHours: 0,
      actor: names.requestedBy,
      actors: [{ itemName: "", name: names.requestedBy }],
      status: "مكتملة",
    },
    {
      phase: "مراجعة الأصناف",
      startAt: new Date(po.createdAt),
      endAt: tReview ? new Date(tReview) : null,
      durationHours: tReview
        ? msToHours(tReview - t0)
        : (reviewStatus === "قيد التنفيذ" ? msToHours(now - t0) : null),
      actor: names.reviewedBy || NOT_ASSIGNED,
      actors: [{ itemName: "", name: names.reviewedBy || NOT_ASSIGNED }],
      status: reviewStatus,
    },
    {
      phase: "موافقة الحسابات",
      startAt: tReview ? new Date(tReview) : null,
      endAt: t1 ? new Date(t1) : null,
      durationHours: (tReview && t1)
        ? msToHours(t1 - tReview)
        : (accountingStatus === "قيد التنفيذ" && tReview ? msToHours(now - tReview) : null),
      actor: names.accountingApprovedBy || NOT_ASSIGNED,
      actors: [{ itemName: "", name: names.accountingApprovedBy || NOT_ASSIGNED }],
      status: accountingStatus,
    },
    {
      phase: "موافقة الإدارة",
      startAt: t1 ? new Date(t1) : null,
      endAt: t2 ? new Date(t2) : null,
      durationHours: (t1 && t2)
        ? msToHours(t2 - t1)
        : (managementStatus === "قيد التنفيذ" && t1 ? msToHours(now - t1) : null),
      actor: names.managementApprovedBy || NOT_ASSIGNED,
      actors: [{ itemName: "", name: names.managementApprovedBy || NOT_ASSIGNED }],
      status: managementStatus,
    },
  ];
}
