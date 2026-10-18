import { z } from "zod";
import { MAX_PURCHASE_DELIVERY_DAYS, purchaseDateOnly, remainingPurchaseCalendarDays, validPurchaseDeliveryDays, type PurchaseItemNeedTiming } from "../../../shared/purchaseItemNeedDate";

// Date-only input remains supported for existing clients and historical drafts.
export const purchaseItemNeedTimingShape = {
  deliveryLeadDays: z.number().int().min(0).max(MAX_PURCHASE_DELIVERY_DAYS).nullable().optional(),
  requiredDate: z.string().refine(value => Boolean(purchaseDateOnly(value)), "تاريخ الاحتياج غير صالح").nullable().optional(),
};

export function validatePurchaseItemNeedTiming(item: PurchaseItemNeedTiming, ctx: z.RefinementCtx) {
  if (item.deliveryLeadDays == null && !item.requiredDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["deliveryLeadDays"], message: "يجب تحديد مدة التوريد بالأيام" });
  }
  if (purchaseDateOnly(item.requiredDate) && !validPurchaseDeliveryDays(remainingPurchaseCalendarDays(item.requiredDate))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["requiredDate"], message: "اختر تاريخ احتياج من اليوم وحتى 3650 يومًا قبل الإرسال" });
  }
}
