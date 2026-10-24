/**
 * Normalize boolean-like values returned by database-backed read models.
 *
 * Database flags are commonly exposed as 0/1 while API mutation contracts
 * deliberately remain strict booleans. Keep this conversion at the read/form
 * boundary instead of weakening mutation validation.
 */
export function normalizeBooleanFlag(value: boolean | number | string | null | undefined): boolean {
  return value === true || value === 1 || value === "1";
}
