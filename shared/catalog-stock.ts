export type StockQuantity = { unit: string; quantity: number };
export type CatalogStockSummary = {
  catalogItemId: number;
  totals: StockQuantity[];
  warehouses: Array<StockQuantity & {
    warehouseId: number | null;
    nameAr: string | null;
    nameEn: string | null;
  }>;
};

export type CatalogStockRow = {
  catalogItemId: number;
  catalogUnit: string | null;
  inventoryId: number | null;
  warehouseId: number | null;
  nameAr: string | null;
  nameEn: string | null;
  quantity: string | number | null;
  unit: string | null;
};

/** Quantities only: keep incompatible historical units separate, never guess a conversion. */
export function summarizeCatalogStock(
  rows: CatalogStockRow[],
  units: Array<{ nameAr: string; nameEn: string | null }>,
): CatalogStockSummary[] {
  const aliases = new Map<string, string>();
  for (const unit of units) {
    for (const name of [unit.nameAr, unit.nameEn]) {
      if (name?.trim()) aliases.set(name.trim().toLowerCase(), unit.nameAr.trim());
    }
  }
  const canonical = (value: string | null) => aliases.get((value || "").trim().toLowerCase()) || (value || "").trim();
  const summaries = new Map<number, CatalogStockSummary>();
  for (const row of rows) {
    let summary = summaries.get(row.catalogItemId);
    if (!summary) {
      summary = { catalogItemId: row.catalogItemId, totals: [], warehouses: [] };
      summaries.set(row.catalogItemId, summary);
    }
    if (row.inventoryId == null) {
      if (summary.totals.length === 0) summary.totals.push({ unit: canonical(row.catalogUnit), quantity: 0 });
      continue;
    }
    const quantity = Number(row.quantity);
    if (!Number.isFinite(quantity)) throw new Error("Invalid stock quantity");
    const unit = canonical(row.unit || row.catalogUnit);
    let total = summary.totals.find(value => value.unit === unit);
    if (!total) { total = { unit, quantity: 0 }; summary.totals.push(total); }
    total.quantity = Math.round(total.quantity * 1000 + quantity * 1000) / 1000;
    let warehouse = summary.warehouses.find(value => value.warehouseId === row.warehouseId && value.unit === unit);
    if (!warehouse) {
      warehouse = { warehouseId: row.warehouseId, nameAr: row.nameAr, nameEn: row.nameEn, unit, quantity: 0 };
      summary.warehouses.push(warehouse);
    }
    warehouse.quantity = Math.round(warehouse.quantity * 1000 + quantity * 1000) / 1000;
  }
  return Array.from(summaries.values());
}
