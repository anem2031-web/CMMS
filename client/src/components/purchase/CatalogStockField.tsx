import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { getLocalizedCatalogUnitName } from "@/i18n/catalogMasterData";
import type { CatalogStockSummary } from "@shared/catalog-stock";

export function CatalogStockField({ stock, loading, failed, canRead, units }: {
  stock?: CatalogStockSummary;
  loading: boolean;
  failed: boolean;
  canRead: boolean;
  units: any[];
}) {
  const { t, language, dir } = useTranslation();
  const text = t.purchaseOrders.catalogStock;
  const formatQuantity = (quantity: number) => quantity.toLocaleString(
    language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US", { maximumFractionDigits: 3 },
  );
  const formatUnit = (unit: string) => getLocalizedCatalogUnitName(unit, units, language) || t.tickets.unspecified;
  const unavailable = !canRead ? text.notAllowed : loading ? t.common.loading : failed || !stock ? text.unavailable : null;
  return <div className="space-y-1 max-w-xs" dir={dir}>
    <span className="text-xs text-muted-foreground">{text.label}</span>
    {unavailable ? <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground" role="status">{unavailable}</div> : (
      <details className="relative group">
        <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 cursor-pointer rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={text.details}>
          <span>{stock!.totals.map(value => `${formatQuantity(value.quantity)} ${formatUnit(value.unit)}`).join(" / ")}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 group-open:rotate-180" />
        </summary>
        <div className="absolute top-full start-0 z-40 mt-1 min-w-full w-72 max-w-[85vw] rounded-md border bg-popover p-3 text-popover-foreground shadow-md space-y-2">
          <p className="text-xs font-medium">{text.details}</p>
          {stock!.totals.length > 1 && <p className="text-xs text-amber-700 dark:text-amber-400">{text.mixedUnits}</p>}
          {stock!.warehouses.length === 0 ? <p className="text-xs text-muted-foreground">{text.noStock}</p> : (
            <ul className="max-h-52 overflow-y-auto space-y-2 text-xs">
              {stock!.warehouses.map((warehouse, index) => <li key={`${warehouse.warehouseId}:${warehouse.unit}:${index}`} className="flex items-center justify-between gap-3">
                <span>{(language === "ar" ? warehouse.nameAr || warehouse.nameEn : warehouse.nameEn || warehouse.nameAr) || text.unknownWarehouse}</span>
                <span className="font-medium whitespace-nowrap">{formatQuantity(warehouse.quantity)} {formatUnit(warehouse.unit)}</span>
              </li>)}
            </ul>
          )}
        </div>
      </details>
    )}
  </div>;
}
