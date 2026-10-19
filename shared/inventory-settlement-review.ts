/** Inventory review is preparation only; the existing settlement writer remains the posting authority. */
export const SETTLEMENT_DRAFT_STATUSES = [
  "draft",
  "pending_review",
  "returned",
  "applied",
  "no_adjustment",
] as const;
export type SettlementDraftStatus = (typeof SETTLEMENT_DRAFT_STATUSES)[number];
export type SettlementReviewActor = { id: number; role: string };

export function canPrepareSettlementDraft(role?: string | null) {
  return role === "warehouse" || role === "admin" || role === "owner";
}
export function canReviewSettlementDraft(role?: string | null) {
  return role === "senior_management" || role === "admin" || role === "owner";
}
export function canReadSettlementDraft(role?: string | null) {
  return canPrepareSettlementDraft(role) || canReviewSettlementDraft(role);
}
export function settlementDraftEditable(status: string) {
  return status === "draft" || status === "returned";
}
export function assertSettlementReviewQuantity(value: number) {
  if (
    !Number.isFinite(value) ||
    value < 0 ||
    value > 999999999.999 ||
    Math.abs(value * 1000 - Math.round(value * 1000)) > 0.00001
  ) {
    throw new Error(
      "الكمية يجب أن تكون رقمًا غير سالب وبحد أقصى ثلاث منازل عشرية"
    );
  }
  return Number(value.toFixed(3));
}
