import { getInventoryCatalogTaxonomy } from "../../_core/db/inventory";
import {
  loadInventoryValuationReport,
  type InventoryValuationFilters,
  type InventoryValuationReportResult,
  type InventoryValuationRow,
} from "./inventoryValuationReport";
import {
  buildReportContentDisposition,
  buildReportExcel,
  buildReportFilename,
  buildReportHtml,
  buildReportPdf,
  type ReportExportDefinition,
  type ReportFilterSummaryItem,
} from "./reportExportFoundation";

export interface InventoryValueQuantityContextRow {
  unit: string | null;
  quantity: number;
}

export interface InventoryValueByWarehouseRow {
  warehouseId: number | null;
  warehouseCode: string | null;
  warehouseNameAr: string | null;
  warehouseNameEn: string | null;
  inventoryRows: number;
  quantityContext: InventoryValueQuantityContextRow[];
  totalValue: number;
  sharePercent: number | null;
}

export interface InventoryValueByCategoryRow {
  categoryNodeId: number | null;
  categoryCode: string | null;
  categoryNameAr: string | null;
  categoryNameEn: string | null;
  categoryPathAr: string | null;
  categoryPathEn: string | null;
  uncategorized: boolean;
  itemCount: number;
  inventoryRows: number;
  quantityContext: InventoryValueQuantityContextRow[];
  totalValue: number;
  sharePercent: number | null;
}

export interface InventoryValueDistributionReportResult {
  generatedAt: string;
  readOnly: true;
  basis: "stored_inventory_value";
  categoryBasis: "inventory_linked_catalog_taxonomy";
  filters: InventoryValuationReportResult["filters"];
  summary: InventoryValuationReportResult["summary"] & {
    warehouseGroups: number;
    categoryGroups: number;
    uncategorizedInventoryRows: number;
  };
  warehouses: InventoryValuationReportResult["warehouses"];
  byWarehouse: InventoryValueByWarehouseRow[];
  byCategory: InventoryValueByCategoryRow[];
}

type TaxonomyRow = {
  inventoryId: number;
  catalogItemId: number;
  catalogNodeId: number | null;
  catalogNodeCode: string | null;
  catalogNodeNameAr: string | null;
  catalogNodeNameEn: string | null;
  catalogCategoryPathAr: string | null;
  catalogCategoryPathEn: string | null;
};

const VALUE_EPSILON = 0.005;

function roundValue(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function computeSharePercent(value: number, total: number): number | null {
  // Percentage is useful only when the active result has a positive total value.
  // This avoids presenting misleading percentages for a zero/negative denominator.
  if (total <= VALUE_EPSILON) return null;
  return roundValue((value / total) * 100, 2);
}

function addQuantity(quantityMap: Map<string, number>, row: InventoryValuationRow) {
  const unit = String(row.unit || "").trim();
  const key = unit || "__NO_UNIT__";
  quantityMap.set(key, (quantityMap.get(key) || 0) + Number(row.quantity || 0));
}

function buildQuantityContext(quantityMap: Map<string, number>): InventoryValueQuantityContextRow[] {
  return Array.from(quantityMap.entries())
    .map(([unit, quantity]) => ({ unit: unit === "__NO_UNIT__" ? null : unit, quantity: roundValue(quantity, 3) }))
    .filter((row) => Math.abs(row.quantity) > 0.0005)
    .sort((a, b) => String(a.unit || "").localeCompare(String(b.unit || ""), "ar"));
}

export function groupInventoryValueByWarehouse(
  rows: InventoryValuationRow[],
  activeTotalValue: number,
): InventoryValueByWarehouseRow[] {
  const groups = new Map<string, {
    warehouseId: number | null;
    warehouseCode: string | null;
    warehouseNameAr: string | null;
    warehouseNameEn: string | null;
    inventoryRows: number;
    totalValue: number;
    quantities: Map<string, number>;
  }>();

  for (const row of rows) {
    const key = row.warehouseId == null ? "unassigned" : `warehouse:${row.warehouseId}`;
    const current = groups.get(key) || {
      warehouseId: row.warehouseId,
      warehouseCode: row.warehouseCode,
      warehouseNameAr: row.warehouseNameAr,
      warehouseNameEn: row.warehouseNameEn,
      inventoryRows: 0,
      totalValue: 0,
      quantities: new Map<string, number>(),
    };
    current.inventoryRows += 1;
    current.totalValue += row.totalCostValue;
    addQuantity(current.quantities, row);
    groups.set(key, current);
  }

  return Array.from(groups.values())
    .map((group) => {
      const totalValue = roundValue(group.totalValue, 2);
      return {
        warehouseId: group.warehouseId,
        warehouseCode: group.warehouseCode,
        warehouseNameAr: group.warehouseNameAr,
        warehouseNameEn: group.warehouseNameEn,
        inventoryRows: group.inventoryRows,
        quantityContext: buildQuantityContext(group.quantities),
        totalValue,
        sharePercent: computeSharePercent(totalValue, activeTotalValue),
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue || String(a.warehouseCode || "").localeCompare(String(b.warehouseCode || "")));
}

export function groupInventoryValueByCategory(
  rows: InventoryValuationRow[],
  taxonomyRows: TaxonomyRow[],
  activeTotalValue: number,
): InventoryValueByCategoryRow[] {
  const taxonomyByInventoryId = new Map<number, TaxonomyRow>(
    taxonomyRows.map((row) => [Number(row.inventoryId), row]),
  );

  const groups = new Map<string, {
    categoryNodeId: number | null;
    categoryCode: string | null;
    categoryNameAr: string | null;
    categoryNameEn: string | null;
    categoryPathAr: string | null;
    categoryPathEn: string | null;
    uncategorized: boolean;
    itemKeys: Set<string>;
    inventoryRows: number;
    totalValue: number;
    quantities: Map<string, number>;
  }>();

  for (const row of rows) {
    const taxonomy = taxonomyByInventoryId.get(row.inventoryId);
    const hasCategory = Boolean(taxonomy?.catalogNodeId);
    const key = hasCategory ? `category:${taxonomy!.catalogNodeId}` : "uncategorized";
    const current = groups.get(key) || {
      categoryNodeId: hasCategory ? Number(taxonomy!.catalogNodeId) : null,
      categoryCode: hasCategory ? taxonomy!.catalogNodeCode : null,
      categoryNameAr: hasCategory ? taxonomy!.catalogNodeNameAr : null,
      categoryNameEn: hasCategory ? taxonomy!.catalogNodeNameEn : null,
      categoryPathAr: hasCategory ? taxonomy!.catalogCategoryPathAr : null,
      categoryPathEn: hasCategory ? taxonomy!.catalogCategoryPathEn : null,
      uncategorized: !hasCategory,
      itemKeys: new Set<string>(),
      inventoryRows: 0,
      totalValue: 0,
      quantities: new Map<string, number>(),
    };

    if (taxonomy?.catalogItemId) current.itemKeys.add(`catalog:${taxonomy.catalogItemId}`);
    else current.itemKeys.add(`unmapped:${String(row.itemName || row.internalCode || row.inventoryId).trim().toLocaleLowerCase()}`);
    current.inventoryRows += 1;
    current.totalValue += row.totalCostValue;
    addQuantity(current.quantities, row);
    groups.set(key, current);
  }

  return Array.from(groups.values())
    .map((group) => {
      const totalValue = roundValue(group.totalValue, 2);
      return {
        categoryNodeId: group.categoryNodeId,
        categoryCode: group.categoryCode,
        categoryNameAr: group.categoryNameAr,
        categoryNameEn: group.categoryNameEn,
        categoryPathAr: group.categoryPathAr,
        categoryPathEn: group.categoryPathEn,
        uncategorized: group.uncategorized,
        itemCount: group.itemKeys.size,
        inventoryRows: group.inventoryRows,
        quantityContext: buildQuantityContext(group.quantities),
        totalValue,
        sharePercent: computeSharePercent(totalValue, activeTotalValue),
      };
    })
    .sort((a, b) => {
      if (a.uncategorized !== b.uncategorized) return a.uncategorized ? 1 : -1;
      return b.totalValue - a.totalValue || String(a.categoryCode || "").localeCompare(String(b.categoryCode || ""));
    });
}

export async function loadInventoryValueDistributionReport(
  filters: InventoryValuationFilters = {},
): Promise<InventoryValueDistributionReportResult> {
  // Reuse the accepted 6.3.1 service so filters, current stored value basis, and
  // value-status rules stay identical. Taxonomy is the read-only 2B-9 resolver.
  const [valuation, taxonomy] = await Promise.all([
    loadInventoryValuationReport(filters),
    getInventoryCatalogTaxonomy(),
  ]);

  const byWarehouse = groupInventoryValueByWarehouse(valuation.rows, valuation.summary.totalValue);
  const byCategory = groupInventoryValueByCategory(valuation.rows, taxonomy as TaxonomyRow[], valuation.summary.totalValue);

  return {
    generatedAt: valuation.generatedAt,
    readOnly: true,
    basis: "stored_inventory_value",
    categoryBasis: "inventory_linked_catalog_taxonomy",
    filters: valuation.filters,
    summary: {
      ...valuation.summary,
      warehouseGroups: byWarehouse.length,
      categoryGroups: byCategory.length,
      uncategorizedInventoryRows: byCategory.find((row) => row.uncategorized)?.inventoryRows || 0,
    },
    warehouses: valuation.warehouses,
    byWarehouse,
    byCategory,
  };
}

type SupportedLanguage = "ar" | "en" | "ur";
type DistributionView = "warehouse" | "category";

const COPY: Record<SupportedLanguage, {
  locale: string;
  direction: "rtl" | "ltr";
  filters: { search: string; warehouse: string; status: string };
  statuses: Record<"all" | "positive" | "zero" | "negative", string>;
  allWarehouses: string;
  uncategorized: string;
  noWarehouse: string;
  noUnit: string;
  warehouse: { title: string; sheetName: string; columns: { warehouse: string; inventoryRows: string; quantityContext: string; value: string; share: string } };
  category: { title: string; sheetName: string; columns: { category: string; itemCount: string; inventoryRows: string; quantityContext: string; value: string; share: string } };
}> = {
  ar: {
    locale: "ar-SA", direction: "rtl",
    filters: { search: "البحث", warehouse: "المخزن", status: "حالة القيمة" },
    statuses: { all: "كل القيم", positive: "قيمة موجبة", zero: "قيمة صفرية", negative: "قيمة سالبة" },
    allWarehouses: "كل المخازن", uncategorized: "غير مصنف", noWarehouse: "بدون مخزن محدد", noUnit: "بدون وحدة",
    warehouse: { title: "قيمة المخزون حسب المخزن", sheetName: "القيمة حسب المخزن", columns: { warehouse: "المخزن", inventoryRows: "سجلات المخزون", quantityContext: "سياق الكميات حسب الوحدة", value: "قيمة المخزون الحالية", share: "النسبة من الإجمالي" } },
    category: { title: "قيمة المخزون حسب التصنيف", sheetName: "القيمة حسب التصنيف", columns: { category: "التصنيف", itemCount: "عدد الأصناف", inventoryRows: "سجلات المخزون", quantityContext: "سياق الكميات حسب الوحدة", value: "قيمة المخزون الحالية", share: "النسبة من الإجمالي" } },
  },
  en: {
    locale: "en-US", direction: "ltr",
    filters: { search: "Search", warehouse: "Warehouse", status: "Value status" },
    statuses: { all: "All values", positive: "Positive value", zero: "Zero value", negative: "Negative value" },
    allWarehouses: "All warehouses", uncategorized: "Uncategorized", noWarehouse: "No warehouse", noUnit: "No unit",
    warehouse: { title: "Inventory Value by Warehouse", sheetName: "Value by Warehouse", columns: { warehouse: "Warehouse", inventoryRows: "Inventory rows", quantityContext: "Quantity context by unit", value: "Current inventory value", share: "Share of total" } },
    category: { title: "Inventory Value by Category", sheetName: "Value by Category", columns: { category: "Category", itemCount: "Item count", inventoryRows: "Inventory rows", quantityContext: "Quantity context by unit", value: "Current inventory value", share: "Share of total" } },
  },
  ur: {
    locale: "ur-PK", direction: "rtl",
    filters: { search: "تلاش", warehouse: "گودام", status: "ویلیو حالت" },
    statuses: { all: "تمام ویلیوز", positive: "مثبت ویلیو", zero: "صفر ویلیو", negative: "منفی ویلیو" },
    allWarehouses: "تمام گودام", uncategorized: "غیر درجہ بند", noWarehouse: "گودام متعین نہیں", noUnit: "یونٹ متعین نہیں",
    warehouse: { title: "گودام کے لحاظ سے انوینٹری ویلیو", sheetName: "گودام کے لحاظ سے ویلیو", columns: { warehouse: "گودام", inventoryRows: "انوینٹری ریکارڈز", quantityContext: "یونٹ کے لحاظ سے مقدار", value: "موجودہ انوینٹری ویلیو", share: "کل میں حصہ" } },
    category: { title: "زمرے کے لحاظ سے انوینٹری ویلیو", sheetName: "زمرے کے لحاظ سے ویلیو", columns: { category: "زمرہ", itemCount: "آئٹمز کی تعداد", inventoryRows: "انوینٹری ریکارڈز", quantityContext: "یونٹ کے لحاظ سے مقدار", value: "موجودہ انوینٹری ویلیو", share: "کل میں حصہ" } },
  },
};

function resolveLanguage(value: unknown): SupportedLanguage {
  const raw = String(value || "ar").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("ur")) return "ur";
  return "ar";
}

function quantityContextDisplay(rows: InventoryValueQuantityContextRow[], language: SupportedLanguage) {
  const copy = COPY[language];
  const formatter = new Intl.NumberFormat(copy.locale, { maximumFractionDigits: 3 });
  if (!rows.length) return "—";
  return rows.map((row) => `${formatter.format(row.quantity)} ${row.unit || copy.noUnit}`).join(" • ");
}

function shareDisplay(value: number | null, language: SupportedLanguage) {
  if (value == null) return "—";
  return `${new Intl.NumberFormat(COPY[language].locale, { maximumFractionDigits: 2 }).format(value)}%`;
}

function selectedWarehouseLabel(report: InventoryValueDistributionReportResult, language: SupportedLanguage) {
  const copy = COPY[language];
  if (!report.filters.warehouseId) return copy.allWarehouses;
  const warehouse = report.warehouses.find((row) => row.id === report.filters.warehouseId);
  if (!warehouse) return copy.allWarehouses;
  const name = language === "en" ? (warehouse.nameEn || warehouse.nameAr) : warehouse.nameAr;
  return [warehouse.code, name].filter(Boolean).join(" - ");
}

function commonFilterSummary(report: InventoryValueDistributionReportResult, language: SupportedLanguage): ReportFilterSummaryItem[] {
  const copy = COPY[language];
  return [
    ...(report.filters.search ? [{ label: copy.filters.search, value: report.filters.search }] : []),
    { label: copy.filters.warehouse, value: selectedWarehouseLabel(report, language) },
    { label: copy.filters.status, value: copy.statuses[report.filters.status] },
  ];
}

export function buildInventoryValueDistributionExportDefinition(
  report: InventoryValueDistributionReportResult,
  view: DistributionView,
  languageValue?: unknown,
): ReportExportDefinition<Record<string, any>> {
  const language = resolveLanguage(languageValue);
  const copy = COPY[language];
  const common = {
    generatedAt: new Date(report.generatedAt),
    direction: copy.direction,
    locale: copy.locale,
    orientation: "landscape" as const,
    filters: commonFilterSummary(report, language),
  };

  if (view === "warehouse") {
    return {
      ...common,
      title: copy.warehouse.title,
      sheetName: copy.warehouse.sheetName,
      columns: [
        { key: "warehouse", header: copy.warehouse.columns.warehouse, kind: "text", width: 30 },
        { key: "inventoryRows", header: copy.warehouse.columns.inventoryRows, kind: "number", decimals: 0, width: 16 },
        { key: "quantityContext", header: copy.warehouse.columns.quantityContext, kind: "text", width: 30 },
        { key: "value", header: copy.warehouse.columns.value, kind: "currency", decimals: 2, width: 20 },
        { key: "share", header: copy.warehouse.columns.share, kind: "text", width: 16 },
      ],
      rows: report.byWarehouse.map((row) => {
        const name = language === "en" ? (row.warehouseNameEn || row.warehouseNameAr) : (row.warehouseNameAr || row.warehouseNameEn);
        return {
          warehouse: [row.warehouseCode, name].filter(Boolean).join(" - ") || copy.noWarehouse,
          inventoryRows: row.inventoryRows,
          quantityContext: quantityContextDisplay(row.quantityContext, language),
          value: row.totalValue,
          share: shareDisplay(row.sharePercent, language),
        };
      }),
    };
  }

  return {
    ...common,
    title: copy.category.title,
    sheetName: copy.category.sheetName,
    columns: [
      { key: "category", header: copy.category.columns.category, kind: "text", width: 36 },
      { key: "itemCount", header: copy.category.columns.itemCount, kind: "number", decimals: 0, width: 14 },
      { key: "inventoryRows", header: copy.category.columns.inventoryRows, kind: "number", decimals: 0, width: 16 },
      { key: "quantityContext", header: copy.category.columns.quantityContext, kind: "text", width: 30 },
      { key: "value", header: copy.category.columns.value, kind: "currency", decimals: 2, width: 20 },
      { key: "share", header: copy.category.columns.share, kind: "text", width: 16 },
    ],
    rows: report.byCategory.map((row) => {
      const path = language === "en" ? (row.categoryPathEn || row.categoryPathAr) : (row.categoryPathAr || row.categoryPathEn);
      const name = language === "en" ? (row.categoryNameEn || row.categoryNameAr) : (row.categoryNameAr || row.categoryNameEn);
      return {
        category: row.uncategorized ? copy.uncategorized : (path || [row.categoryCode, name].filter(Boolean).join(" - ") || copy.uncategorized),
        itemCount: row.itemCount,
        inventoryRows: row.inventoryRows,
        quantityContext: quantityContextDisplay(row.quantityContext, language),
        value: row.totalValue,
        share: shareDisplay(row.sharePercent, language),
      };
    }),
  };
}

async function buildDistributionExcel(view: DistributionView, filters: InventoryValuationFilters, language?: unknown) {
  const report = await loadInventoryValueDistributionReport(filters);
  const definition = buildInventoryValueDistributionExportDefinition(report, view, language);
  const generatedAt = new Date(report.generatedAt);
  const buffer = await buildReportExcel(definition);
  const filename = buildReportFilename(definition.sheetName || `inventory-value-by-${view}`, "xlsx", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

async function buildDistributionPdf(view: DistributionView, filters: InventoryValuationFilters, language?: unknown) {
  const report = await loadInventoryValueDistributionReport(filters);
  const definition = buildInventoryValueDistributionExportDefinition(report, view, language);
  const generatedAt = new Date(report.generatedAt);
  const buffer = await buildReportPdf(definition);
  const filename = buildReportFilename(definition.sheetName || `inventory-value-by-${view}`, "pdf", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

async function buildDistributionPrintHtml(view: DistributionView, filters: InventoryValuationFilters, language?: unknown) {
  const report = await loadInventoryValueDistributionReport(filters);
  return buildReportHtml(buildInventoryValueDistributionExportDefinition(report, view, language));
}

export const buildInventoryValueByWarehouseExcel = (filters: InventoryValuationFilters, language?: unknown) => buildDistributionExcel("warehouse", filters, language);
export const buildInventoryValueByWarehousePdf = (filters: InventoryValuationFilters, language?: unknown) => buildDistributionPdf("warehouse", filters, language);
export const buildInventoryValueByWarehousePrintHtml = (filters: InventoryValuationFilters, language?: unknown) => buildDistributionPrintHtml("warehouse", filters, language);
export const buildInventoryValueByCategoryExcel = (filters: InventoryValuationFilters, language?: unknown) => buildDistributionExcel("category", filters, language);
export const buildInventoryValueByCategoryPdf = (filters: InventoryValuationFilters, language?: unknown) => buildDistributionPdf("category", filters, language);
export const buildInventoryValueByCategoryPrintHtml = (filters: InventoryValuationFilters, language?: unknown) => buildDistributionPrintHtml("category", filters, language);
