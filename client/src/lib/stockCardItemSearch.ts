export type StockCardSearchItem = {
  key: string;
  itemName: string;
  internalCode?: string | null;
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export function filterStockCardItems<T extends StockCardSearchItem>(items: T[], rawSearch: string): T[] {
  const search = normalize(rawSearch);
  if (!search) return items;

  return items.filter((item) => {
    const itemName = normalize(item.itemName);
    const internalCode = normalize(item.internalCode);
    return itemName.includes(search) || internalCode.includes(search);
  });
}

/**
 * Resolve an item for Stock Card search without guessing:
 * - exact item-name/code match wins when it is unique;
 * - otherwise a single partial match may be selected;
 * - ambiguous/no-match searches intentionally return null.
 */
export function resolveStockCardItemFromSearch<T extends StockCardSearchItem>(items: T[], rawSearch: string): T | null {
  const search = normalize(rawSearch);
  if (!search) return null;

  const exactMatches = items.filter((item) => {
    const itemName = normalize(item.itemName);
    const internalCode = normalize(item.internalCode);
    return itemName === search || internalCode === search;
  });
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) return null;

  const matches = filterStockCardItems(items, rawSearch);
  return matches.length === 1 ? matches[0] : null;
}
