import { eq, or } from "drizzle-orm";
import { catalogUnits } from "../../drizzle/schema";
import { getDb } from "./db/client";

function normalizeUnitName(value: string | null | undefined): string {
  return (value || "").trim();
}

export async function findCatalogUnitByName(
  value: string | null | undefined,
  database?: any,
): Promise<any | null> {
  const unitName = normalizeUnitName(value);
  if (!unitName) return null;

  const db = database || await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(catalogUnits)
    .where(or(
      eq(catalogUnits.nameAr, unitName),
      eq(catalogUnits.nameEn, unitName),
    ))
    .limit(1);

  return rows[0] || null;
}

export async function getActiveCatalogUnitCanonicalName(
  value: string | null | undefined,
  database?: any,
): Promise<string | null> {
  const unit = await findCatalogUnitByName(value, database);
  if (!unit || Number(unit.isActive) !== 1) return null;
  return String(unit.nameAr || "").trim() || null;
}

/**
 * Returns only values that are known Catalog Units and currently inactive.
 * Unknown/free-text legacy units are intentionally ignored so existing non-Catalog
 * workflows are not converted into hard master-data dependencies by 2B-10-2B.
 */
export async function findKnownInactiveCatalogUnitNames(
  values: Array<string | null | undefined>,
  database?: any,
): Promise<string[]> {
  const db = database || await getDb();
  if (!db) return [];

  const unique = [...new Set(values.map(normalizeUnitName).filter(Boolean))];
  if (unique.length === 0) return [];

  const allUnits = await db.select().from(catalogUnits);
  const inactiveKeys = new Set<string>();
  for (const unit of allUnits as any[]) {
    if (Number(unit.isActive) === 1) continue;
    const nameAr = normalizeUnitName(unit.nameAr).toLocaleLowerCase();
    const nameEn = normalizeUnitName(unit.nameEn).toLocaleLowerCase();
    if (nameAr) inactiveKeys.add(nameAr);
    if (nameEn) inactiveKeys.add(nameEn);
  }

  return unique.filter(value => inactiveKeys.has(value.toLocaleLowerCase()));
}
