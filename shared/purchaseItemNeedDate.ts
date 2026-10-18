/** Calendar deadlines for purchase items; submission and countdown use Riyadh. */
export const DEFAULT_PURCHASE_DELIVERY_DAYS = 4;
export const MAX_PURCHASE_DELIVERY_DAYS = 3650;
const DAY_MS = 86_400_000;

export function purchaseDateOnly(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(`${value}T00:00:00Z`);
  return year >= 1000 && parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? value : null;
}

export function validPurchaseDeliveryDays(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_PURCHASE_DELIVERY_DAYS;
}

export function riyadhPurchaseDate(now = new Date()): string {
  if (Number.isNaN(now.getTime())) throw new Error("Invalid purchase clock");
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Riyadh", calendar: "iso8601", numberingSystem: "latn",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function purchaseRequiredDateFromSubmission(days: number, submittedAt: Date): string {
  if (!validPurchaseDeliveryDays(days)) throw new Error("Invalid purchase delivery days");
  const date = new Date(`${riyadhPurchaseDate(submittedAt)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  if (!purchaseDateOnly(result)) throw new Error("Invalid purchase required date");
  return result;
}

export interface PurchaseItemNeedTiming {
  deliveryLeadDays?: number | null;
  requiredDate?: string | null;
}

/** Drafts keep only the duration. Legacy dates remain unchanged, without backfill. */
export function resolvePurchaseItemNeedTiming(item: PurchaseItemNeedTiming, submittedAt?: Date) {
  if (item.deliveryLeadDays != null) {
    if (!validPurchaseDeliveryDays(item.deliveryLeadDays)) throw new Error("مدة التوريد غير صالحة");
    return {
      deliveryLeadDays: item.deliveryLeadDays,
      requiredDate: submittedAt ? purchaseRequiredDateFromSubmission(item.deliveryLeadDays, submittedAt) : null,
    };
  }
  if (!purchaseDateOnly(item.requiredDate)) throw new Error("يجب تحديد مدة التوريد أو تاريخ احتياج محفوظ سابقًا");
  return { deliveryLeadDays: null, requiredDate: item.requiredDate! };
}

export function remainingPurchaseCalendarDays(requiredDate: string | null | undefined, now = new Date()): number | null {
  const date = purchaseDateOnly(requiredDate);
  if (!date || Number.isNaN(now.getTime())) return null;
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${riyadhPurchaseDate(now)}T00:00:00Z`)) / DAY_MS);
}

export function comparePurchaseRequiredDates(a: { id?: number; requiredDate?: string | null }, b: { id?: number; requiredDate?: string | null }): number {
  const aDate = purchaseDateOnly(a.requiredDate) || "9999-12-31";
  const bDate = purchaseDateOnly(b.requiredDate) || "9999-12-31";
  return aDate.localeCompare(bDate) || Number(a.id || 0) - Number(b.id || 0);
}
