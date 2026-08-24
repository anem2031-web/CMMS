/**
 * Catalog audit helpers shared by Catalog governance mutations.
 *
 * catalog_audit_logs stores JSON snapshots in TEXT columns in the live DB, so
 * callers should pass the returned objects through JSON.stringify at insert time.
 */
export function pickAuditValues(source: Record<string, any> | null | undefined, patch: Record<string, any>) {
  const values: Record<string, any> = {};
  for (const key of Object.keys(patch)) {
    values[key] = source?.[key] ?? null;
  }
  return values;
}

export function catalogAuditJson(values: Record<string, any> | null | undefined): string | null {
  if (!values) return null;
  return JSON.stringify(values);
}
