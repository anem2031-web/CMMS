export const INVALID_CONVERSION_MESSAGE = "معامل التحويل صفر أو غير صالح، يرجى إدخال رقم أكبر من صفر.";
export function receiptConversionPreview(quantity: number, unitCost: number, factor: number) {
  if (![quantity, unitCost, factor].every(Number.isFinite) || quantity <= 0 || unitCost < 0 || factor <= 0) return null;
  const stockQuantity = Math.round((quantity * factor + Number.EPSILON) * 1000) / 1000;
  const issueUnitCost = Math.round((unitCost / factor + Number.EPSILON) * 10000) / 10000;
  if (stockQuantity < 0.001) return null;
  return { stockQuantity, issueUnitCost };
}

/** Preserve PO units: an actual carton must not be recorded as one ordered piece.
 * If neither physical unit matches the order, a second conversion is unknown.
 */
export function receiptInOrderUnits(input: { orderUnit: string; receivedUnit: string; issueUnit: string; quantity: number; unitCost: number; factor: number }) {
  const canonical = (unit: string) => unit.trim().toLocaleLowerCase();
  if (canonical(input.orderUnit) === canonical(input.receivedUnit)) return { quantity: input.quantity, unitCost: input.unitCost };
  if (canonical(input.orderUnit) === canonical(input.issueUnit)) {
    const preview = receiptConversionPreview(input.quantity, input.unitCost, input.factor);
    return preview ? { quantity: preview.stockQuantity, unitCost: preview.issueUnitCost } : null;
  }
  return null;
}
