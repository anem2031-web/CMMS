export type PurchaseCycleDatedItem = {
  createdAt?: string | number | Date | null;
};

function toTimestamp(value: PurchaseCycleDatedItem["createdAt"]): number {
  if (value === null || value === undefined || value === "") {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

/**
 * يعيد نسخة جديدة من القائمة مرتبة من الأحدث إلى الأقدم حسب createdAt.
 * العناصر التي لا تحتوي تاريخًا صالحًا تبقى في نهاية القائمة مع الحفاظ على ترتيبها الأصلي.
 */
export function sortPurchaseCycleItemsNewestFirst<T extends PurchaseCycleDatedItem>(items: readonly T[]): T[] {
  return items
    .map((item, originalIndex) => ({
      item,
      originalIndex,
      timestamp: toTimestamp(item.createdAt),
    }))
    .sort((a, b) => {
      if (a.timestamp === b.timestamp) {
        return a.originalIndex - b.originalIndex;
      }
      return b.timestamp - a.timestamp;
    })
    .map(({ item }) => item);
}
