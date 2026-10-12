type PurchaseTimestamp = string | Date | null;

interface PurchaseSubmissionFields {
  status?: string;
  submittedAt?: PurchaseTimestamp;
  createdAt?: PurchaseTimestamp;
  submittedAtIso?: string | null;
}

/** Server only: resolve timezone-free DB strings using the server clock used by the existing writer. */
export function withPurchaseSubmissionTime<T extends PurchaseSubmissionFields>(order: T) {
  const value = order.submittedAt ?? order.createdAt;
  const date = value ? new Date(value instanceof Date ? value.getTime() : value.replace(" ", "T")) : null;
  return {
    ...order,
    submittedAtIso: order.status !== "draft" && date && !Number.isNaN(date.getTime())
      ? date.toISOString()
      : null,
  };
}

/** Display only: never shift the stored instant or other workflow timestamps. */
export function formatPurchaseSubmissionTime(order: PurchaseSubmissionFields, locale: string): string {
  if (order.status === "draft") {
    return order.createdAt ? new Date(order.createdAt).toLocaleDateString(locale) : "—";
  }
  if (!order.submittedAtIso) return "—";
  const date = new Date(order.submittedAtIso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
