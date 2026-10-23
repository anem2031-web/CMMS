export type CatalogCodeAliasIdentity = {
  entityType: "node" | "item";
  entityId: number;
  oldCode: string;
};

export function buildCatalogCodeAliasIndex(
  rows: CatalogCodeAliasIdentity[],
  entityType: "node" | "item",
): Map<string, Set<number>> {
  const index = new Map<string, Set<number>>();
  for (const row of rows) {
    if (row.entityType !== entityType) continue;
    const oldCode = String(row.oldCode || "").trim();
    const entityId = Number(row.entityId || 0);
    if (!oldCode || !entityId) continue;
    const ids = index.get(oldCode) || new Set<number>();
    ids.add(entityId);
    index.set(oldCode, ids);
  }
  return index;
}

export function resolveUniqueCatalogCodeAlias(
  index: Map<string, Set<number>>,
  codeInput: string,
  entityLabel: "تصنيف" | "صنف",
): number | undefined {
  const code = String(codeInput || "").trim();
  const ids = index.get(code);
  if (!ids || ids.size === 0) return undefined;
  if (ids.size > 1) {
    const suffix = entityLabel === "تصنيف" ? "أو حدّد التصنيف بالمسار الكامل" : "";
    throw new Error(`الكود التاريخي ${code} يطابق أكثر من ${entityLabel}؛ استخدم الكود الجديد${suffix ? ` ${suffix}` : ""}`);
  }
  return Array.from(ids)[0];
}

export function boundedDistinctCatalogCodeAliasEntityIds(
  rows: Array<{ entityId: number | string | null | undefined }>,
  maxIds = 500,
): number[] {
  const ids = new Set<number>();
  for (const row of rows) {
    const entityId = Number(row.entityId);
    if (!Number.isFinite(entityId) || entityId <= 0) continue;
    ids.add(entityId);
    if (ids.size >= maxIds) break;
  }
  return Array.from(ids);
}
