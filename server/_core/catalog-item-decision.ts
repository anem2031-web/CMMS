// ============================================================
// server/_core/catalog-item-decision.ts
// 2B-4 — حسم قرار Catalog Master لسطر الفاتورة
// ============================================================

export interface CatalogItemDecisionInput {
  itemName: string;
  linkedItemId?: number;
  isNewCatalogItem?: boolean;
  purchaseOrderItemId?: number;
}

export interface CatalogItemDecisionValidation {
  ok: boolean;
  message?: string;
}

/**
 * يمنع الحالات المتناقضة فقط:
 * - لا يجوز أن يكون السطر مرتبطاً بصنف Catalog ومعلماً "صنف جديد" في الوقت نفسه.
 * - لا يجوز اعتبار سطر PO مرتبط مسبقاً بالكتالوج "صنف جديد".
 *
 * عدم وجود linkedItemId وعدم تفعيل isNewCatalogItem يعني أن القرار لم يُحسم بعد،
 * ويمنعه الـFrontend قبل الإرسال، ويعاد التحقق منه في الراوتر.
 */
export function validateCatalogItemDecision(
  item: CatalogItemDecisionInput,
  poCatalogItemId?: number | null,
): CatalogItemDecisionValidation {
  if (item.isNewCatalogItem && item.linkedItemId) {
    return {
      ok: false,
      message: `الصنف "${item.itemName}" لا يمكن أن يكون مرتبطاً بالكتالوج ومعلماً كصنف جديد في الوقت نفسه`,
    };
  }

  if (item.isNewCatalogItem && poCatalogItemId) {
    return {
      ok: false,
      message: `الصنف "${item.itemName}" مرتبط مسبقاً بالكتالوج من بند طلب الشراء ولا يمكن اعتباره صنفاً جديداً`,
    };
  }

  // 2B-7: لا نسمح لطلب الاستلام بتبديل هوية Catalog المحمية أصلاً على بند PO.
  // هذا Backend guard حتى لو حاول عميل معدل إرسال linkedItemId مختلفاً.
  if (poCatalogItemId && item.linkedItemId && Number(poCatalogItemId) !== Number(item.linkedItemId)) {
    return {
      ok: false,
      message: `الصنف "${item.itemName}" يحمل هوية Catalog مختلفة عن الهوية المحفوظة في بند طلب الشراء`,
    };
  }

  if (!item.linkedItemId && !item.isNewCatalogItem) {
    return {
      ok: false,
      message: `يجب ربط الصنف "${item.itemName}" بصنف موجود في الكتالوج أو تحديده كـ«صنف جديد»`,
    };
  }

  return { ok: true };
}
