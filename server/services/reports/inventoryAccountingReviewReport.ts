import { getInventoryCatalogTaxonomy } from "../../_core/db/inventory";
import { runInventoryReconciliation } from "../inventory-reconciliation";
import type {
  InventoryReconciliationCode,
  InventoryReconciliationException,
} from "../inventory-reconciliation-core";
import {
  loadInventoryValuationReport,
  type InventoryValuationFilters,
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

export type InventoryAccountingReviewCondition =
  | "value_mismatch"
  | "negative_stored_value"
  | "negative_quantity"
  | "reconciliation_exception";
export type InventoryAccountingReviewConditionFilter = "all" | InventoryAccountingReviewCondition;

export interface InventoryAccountingReviewFilters extends InventoryValuationFilters {
  category?: string;
  condition?: InventoryAccountingReviewConditionFilter;
}

export interface InventoryAccountingReviewCategoryOption {
  key: string;
  nodeId: number | null;
  code: string | null;
  nameAr: string | null;
  nameEn: string | null;
  pathAr: string | null;
  pathEn: string | null;
  uncategorized: boolean;
}

export interface InventoryAccountingReviewConditionDetail {
  condition: InventoryAccountingReviewCondition;
  reconciliationCode: InventoryReconciliationCode | null;
  currentValue: number | null;
  expectedValue: number | null;
  difference: number | null;
  tolerance: number | null;
  message: string | null;
}

export interface InventoryAccountingReviewRow extends InventoryValuationRow {
  categoryKey: string;
  categoryNodeId: number | null;
  categoryCode: string | null;
  categoryNameAr: string | null;
  categoryNameEn: string | null;
  categoryPathAr: string | null;
  categoryPathEn: string | null;
  uncategorized: boolean;
  conditions: InventoryAccountingReviewConditionDetail[];
  reconciliationCodes: InventoryReconciliationCode[];
}

export interface InventoryAccountingReviewReportResult {
  generatedAt: string;
  readOnly: true;
  basis: "stored_inventory_value";
  reconciliationBasis: "main_phase_5_4_read_only";
  autoFixIncluded: false;
  revaluationIncluded: false;
  historicalBackfillIncluded: false;
  filters: {
    search: string;
    warehouseId?: number;
    status: "all" | "positive" | "zero" | "negative";
    category: string;
    condition: InventoryAccountingReviewConditionFilter;
  };
  summary: {
    checkedInventoryRows: number;
    reviewRows: number;
    withoutDetectedReview: number;
    valueMismatchRows: number;
    negativeStoredValueRows: number;
    negativeQuantityRows: number;
    otherReconciliationRows: number;
  };
  warehouses: Awaited<ReturnType<typeof loadInventoryValuationReport>>["warehouses"];
  categories: InventoryAccountingReviewCategoryOption[];
  reconciliationPath: "/inventory/reconciliation";
  rows: InventoryAccountingReviewRow[];
}

type TaxonomyRow = {
  inventoryId: number;
  catalogNodeId: number | null;
  catalogNodeCode: string | null;
  catalogNodeNameAr: string | null;
  catalogNodeNameEn: string | null;
  catalogCategoryPathAr: string | null;
  catalogCategoryPathEn: string | null;
};

const CONDITION_ORDER: InventoryAccountingReviewCondition[] = [
  "value_mismatch",
  "negative_stored_value",
  "negative_quantity",
  "reconciliation_exception",
];

const VALUE_RECONCILIATION_CODES = new Set<InventoryReconciliationCode>(["INVENTORY_VALUE_MISMATCH"]);
const NEGATIVE_QTY_CODES = new Set<InventoryReconciliationCode>(["NEGATIVE_INVENTORY_QUANTITY"]);
const ACCOUNTING_RECONCILIATION_CODES = new Set<InventoryReconciliationCode>([
  "INVENTORY_LOT_QUANTITY_MISMATCH",
  "INVENTORY_VALUE_MISMATCH",
  "NEGATIVE_INVENTORY_QUANTITY",
  "INVENTORY_WITHOUT_WAREHOUSE",
  "ORPHAN_WAREHOUSE_REFERENCE",
]);

function normalizeCategory(value: unknown) {
  const raw = String(value || "all").trim();
  if (raw === "uncategorized") return raw;
  if (/^node:\d+$/.test(raw) && Number(raw.slice(5)) > 0) return raw;
  return "all";
}

export function normalizeInventoryAccountingReviewFilters(filters: InventoryAccountingReviewFilters = {}) {
  const allowedConditions = new Set<InventoryAccountingReviewConditionFilter>(["all", ...CONDITION_ORDER]);
  const condition = allowedConditions.has(filters.condition || "all") ? (filters.condition || "all") : "all";
  const status = ["all", "positive", "zero", "negative"].includes(String(filters.status || "all"))
    ? (filters.status || "all") as "all" | "positive" | "zero" | "negative"
    : "all";
  return {
    search: String(filters.search || "").trim().slice(0, 200),
    warehouseId: Number(filters.warehouseId || 0) > 0 ? Number(filters.warehouseId) : undefined,
    status,
    category: normalizeCategory(filters.category),
    condition,
  } as const;
}

function taxonomyInfo(row: InventoryValuationRow, taxonomyByInventoryId: Map<number, TaxonomyRow>) {
  const taxonomy = taxonomyByInventoryId.get(row.inventoryId);
  const nodeId = Number(taxonomy?.catalogNodeId || 0) || null;
  return {
    categoryKey: nodeId ? `node:${nodeId}` : "uncategorized",
    categoryNodeId: nodeId,
    categoryCode: nodeId ? taxonomy?.catalogNodeCode || null : null,
    categoryNameAr: nodeId ? taxonomy?.catalogNodeNameAr || null : null,
    categoryNameEn: nodeId ? taxonomy?.catalogNodeNameEn || null : null,
    categoryPathAr: nodeId ? taxonomy?.catalogCategoryPathAr || null : null,
    categoryPathEn: nodeId ? taxonomy?.catalogCategoryPathEn || null : null,
    uncategorized: !nodeId,
  };
}

function reconcileCondition(exception: InventoryReconciliationException): InventoryAccountingReviewCondition {
  if (VALUE_RECONCILIATION_CODES.has(exception.code)) return "value_mismatch";
  if (NEGATIVE_QTY_CODES.has(exception.code)) return "negative_quantity";
  return "reconciliation_exception";
}

function conditionDetail(
  condition: InventoryAccountingReviewCondition,
  exception?: InventoryReconciliationException,
): InventoryAccountingReviewConditionDetail {
  return {
    condition,
    reconciliationCode: exception?.code || null,
    currentValue: exception?.currentValue ?? null,
    expectedValue: exception?.expectedValue ?? null,
    difference: exception?.difference ?? null,
    tolerance: exception?.tolerance ?? null,
    message: exception?.message || null,
  };
}

export function buildInventoryAccountingReviewRows(
  valuationRows: InventoryValuationRow[],
  taxonomyRows: TaxonomyRow[],
  reconciliationExceptions: InventoryReconciliationException[],
): InventoryAccountingReviewRow[] {
  const taxonomyByInventoryId = new Map(taxonomyRows.map((row) => [Number(row.inventoryId), row]));
  const reconciliationByInventoryId = new Map<number, InventoryReconciliationException[]>();
  for (const exception of reconciliationExceptions) {
    if (!exception.inventoryId || !ACCOUNTING_RECONCILIATION_CODES.has(exception.code)) continue;
    const current = reconciliationByInventoryId.get(Number(exception.inventoryId)) || [];
    current.push(exception);
    reconciliationByInventoryId.set(Number(exception.inventoryId), current);
  }

  const rows: InventoryAccountingReviewRow[] = [];
  for (const valuationRow of valuationRows) {
    const conditionMap = new Map<InventoryAccountingReviewCondition, InventoryAccountingReviewConditionDetail>();

    // Negative stored value is already an explicit 6.3.1 current-value status.
    // It is surfaced for review only; no accounting correction is implied.
    if (valuationRow.status === "negative") {
      conditionMap.set("negative_stored_value", conditionDetail("negative_stored_value"));
    }

    for (const exception of reconciliationByInventoryId.get(valuationRow.inventoryId) || []) {
      const condition = reconcileCondition(exception);
      // Keep the authoritative 5.4 exception evidence if multiple exceptions map to one review condition.
      if (!conditionMap.has(condition)) conditionMap.set(condition, conditionDetail(condition, exception));
    }

    if (conditionMap.size === 0) continue;
    const conditions = CONDITION_ORDER
      .map((condition) => conditionMap.get(condition))
      .filter(Boolean) as InventoryAccountingReviewConditionDetail[];

    rows.push({
      ...valuationRow,
      ...taxonomyInfo(valuationRow, taxonomyByInventoryId),
      conditions,
      reconciliationCodes: Array.from(new Set(
        (reconciliationByInventoryId.get(valuationRow.inventoryId) || []).map((exception) => exception.code),
      )),
    });
  }

  return rows;
}

function categoryOptions(rows: InventoryValuationRow[], taxonomyRows: TaxonomyRow[]) {
  const taxonomyByInventoryId = new Map(taxonomyRows.map((row) => [Number(row.inventoryId), row]));
  const options = new Map<string, InventoryAccountingReviewCategoryOption>();
  for (const row of rows) {
    const info = taxonomyInfo(row, taxonomyByInventoryId);
    if (!options.has(info.categoryKey)) {
      options.set(info.categoryKey, {
        key: info.categoryKey,
        nodeId: info.categoryNodeId,
        code: info.categoryCode,
        nameAr: info.categoryNameAr,
        nameEn: info.categoryNameEn,
        pathAr: info.categoryPathAr,
        pathEn: info.categoryPathEn,
        uncategorized: info.uncategorized,
      });
    }
  }
  return Array.from(options.values()).sort((a, b) => {
    if (a.uncategorized !== b.uncategorized) return a.uncategorized ? 1 : -1;
    return String(a.pathAr || a.pathEn || a.code || "").localeCompare(String(b.pathAr || b.pathEn || b.code || ""), "ar");
  });
}

export async function loadInventoryAccountingReviewReport(
  filtersInput: InventoryAccountingReviewFilters = {},
): Promise<InventoryAccountingReviewReportResult> {
  const filters = normalizeInventoryAccountingReviewFilters(filtersInput);
  const [valuation, taxonomy, reconciliation] = await Promise.all([
    loadInventoryValuationReport({
      search: filters.search || undefined,
      warehouseId: filters.warehouseId,
      status: filters.status,
    }),
    getInventoryCatalogTaxonomy(),
    runInventoryReconciliation(),
  ]);

  const taxonomyRows = taxonomy as TaxonomyRow[];
  const categories = categoryOptions(valuation.rows, taxonomyRows);
  const taxonomyByInventoryId = new Map(taxonomyRows.map((row) => [Number(row.inventoryId), row]));
  const scopedRows = filters.category === "all"
    ? valuation.rows
    : valuation.rows.filter((row) => taxonomyInfo(row, taxonomyByInventoryId).categoryKey === filters.category);

  const allReviewRows = buildInventoryAccountingReviewRows(scopedRows, taxonomyRows, reconciliation.exceptions);
  const visibleRows = filters.condition === "all"
    ? allReviewRows
    : allReviewRows.filter((row) => row.conditions.some((item) => item.condition === filters.condition));

  const countRowsWith = (condition: InventoryAccountingReviewCondition) =>
    allReviewRows.filter((row) => row.conditions.some((item) => item.condition === condition)).length;
  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    basis: "stored_inventory_value",
    reconciliationBasis: "main_phase_5_4_read_only",
    autoFixIncluded: false,
    revaluationIncluded: false,
    historicalBackfillIncluded: false,
    filters,
    summary: {
      checkedInventoryRows: scopedRows.length,
      reviewRows: visibleRows.length,
      withoutDetectedReview: Math.max(0, scopedRows.length - allReviewRows.length),
      valueMismatchRows: countRowsWith("value_mismatch"),
      negativeStoredValueRows: countRowsWith("negative_stored_value"),
      negativeQuantityRows: countRowsWith("negative_quantity"),
      otherReconciliationRows: countRowsWith("reconciliation_exception"),
    },
    warehouses: valuation.warehouses,
    categories,
    reconciliationPath: "/inventory/reconciliation",
    rows: visibleRows,
  };
}

type SupportedLanguage = "ar" | "en" | "ur";

const COPY: Record<SupportedLanguage, {
  locale: string;
  direction: "rtl" | "ltr";
  title: string;
  sheetName: string;
  filters: { search: string; warehouse: string; status: string; category: string; condition: string };
  allWarehouses: string;
  allCategories: string;
  uncategorized: string;
  statuses: Record<"all" | "positive" | "zero" | "negative", string>;
  conditions: Record<InventoryAccountingReviewConditionFilter, string>;
  columns: Record<"item" | "code" | "warehouse" | "category" | "quantity" | "unit" | "averageCost" | "storedValue" | "condition" | "expected" | "difference" | "tolerance" | "evidence", string>;
}> = {
  ar: {
    locale: "ar-SA", direction: "rtl", title: "فروقات المخزون والمراجعة المحاسبية", sheetName: "المراجعة المحاسبية",
    filters: { search: "البحث", warehouse: "المخزن", status: "حالة القيمة", category: "التصنيف", condition: "حالة المراجعة" },
    allWarehouses: "كل المخازن", allCategories: "كل التصنيفات", uncategorized: "غير مصنف",
    statuses: { all: "كل القيم", positive: "قيمة موجبة", zero: "قيمة صفرية", negative: "قيمة سالبة" },
    conditions: { all: "كل حالات المراجعة", value_mismatch: "فرق قيمة وفق مطابقة 5.4", negative_stored_value: "قيمة مخزنة سالبة", negative_quantity: "كمية سالبة وفق مطابقة 5.4", reconciliation_exception: "استثناء مطابقة مرتبط" },
    columns: { item: "الصنف", code: "الكود", warehouse: "المخزن", category: "التصنيف", quantity: "الكمية", unit: "الوحدة", averageCost: "متوسط التكلفة", storedValue: "القيمة المخزنة", condition: "حالة المراجعة", expected: "القيمة المرجعية", difference: "الفرق", tolerance: "حد التقريب", evidence: "دليل المطابقة" },
  },
  en: {
    locale: "en-US", direction: "ltr", title: "Inventory Variance & Accounting Review", sheetName: "Accounting Review",
    filters: { search: "Search", warehouse: "Warehouse", status: "Value status", category: "Category", condition: "Review condition" },
    allWarehouses: "All warehouses", allCategories: "All categories", uncategorized: "Uncategorized",
    statuses: { all: "All values", positive: "Positive value", zero: "Zero value", negative: "Negative value" },
    conditions: { all: "All review conditions", value_mismatch: "Value variance from 5.4 reconciliation", negative_stored_value: "Negative stored value", negative_quantity: "Negative quantity from 5.4 reconciliation", reconciliation_exception: "Linked reconciliation exception" },
    columns: { item: "Item", code: "Code", warehouse: "Warehouse", category: "Category", quantity: "Quantity", unit: "Unit", averageCost: "Average Cost", storedValue: "Stored Value", condition: "Review Condition", expected: "Reference Value", difference: "Difference", tolerance: "Tolerance", evidence: "Reconciliation Evidence" },
  },
  ur: {
    locale: "ur-PK", direction: "rtl", title: "انوینٹری فرق اور اکاؤنٹنگ جائزہ", sheetName: "اکاؤنٹنگ جائزہ",
    filters: { search: "تلاش", warehouse: "گودام", status: "ویلیو حالت", category: "زمرہ", condition: "جائزہ حالت" },
    allWarehouses: "تمام گودام", allCategories: "تمام زمرے", uncategorized: "غیر درجہ بند",
    statuses: { all: "تمام ویلیوز", positive: "مثبت ویلیو", zero: "صفر ویلیو", negative: "منفی ویلیو" },
    conditions: { all: "تمام جائزہ حالتیں", value_mismatch: "5.4 مطابقت کے مطابق ویلیو فرق", negative_stored_value: "منفی محفوظ ویلیو", negative_quantity: "5.4 مطابقت کے مطابق منفی مقدار", reconciliation_exception: "منسلک مطابقت استثنا" },
    columns: { item: "آئٹم", code: "کوڈ", warehouse: "گودام", category: "زمرہ", quantity: "مقدار", unit: "یونٹ", averageCost: "اوسط لاگت", storedValue: "محفوظ ویلیو", condition: "جائزہ حالت", expected: "حوالہ ویلیو", difference: "فرق", tolerance: "رواداری", evidence: "مطابقت ثبوت" },
  },
};

function resolveLanguage(value: unknown): SupportedLanguage {
  const raw = String(value || "ar").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("ur")) return "ur";
  return "ar";
}

function warehouseDisplay(row: InventoryAccountingReviewRow, language: SupportedLanguage) {
  const name = language === "en" ? (row.warehouseNameEn || row.warehouseNameAr) : (row.warehouseNameAr || row.warehouseNameEn);
  return [row.warehouseCode, name].filter(Boolean).join(" - ") || "—";
}

function categoryDisplay(row: InventoryAccountingReviewRow, language: SupportedLanguage, uncategorized: string) {
  if (row.uncategorized) return uncategorized;
  return language === "en"
    ? (row.categoryPathEn || row.categoryPathAr || row.categoryNameEn || row.categoryNameAr || row.categoryCode || uncategorized)
    : (row.categoryPathAr || row.categoryPathEn || row.categoryNameAr || row.categoryNameEn || row.categoryCode || uncategorized);
}

export function buildInventoryAccountingReviewExportDefinition(
  report: InventoryAccountingReviewReportResult,
  languageValue?: unknown,
): ReportExportDefinition<Record<string, any>> {
  const language = resolveLanguage(languageValue);
  const copy = COPY[language];
  const selectedWarehouse = report.filters.warehouseId
    ? report.warehouses.find((warehouse) => warehouse.id === report.filters.warehouseId)
    : null;
  const selectedCategory = report.filters.category === "all"
    ? null
    : report.categories.find((category) => category.key === report.filters.category);

  const filterSummary: ReportFilterSummaryItem[] = [
    ...(report.filters.search ? [{ label: copy.filters.search, value: report.filters.search }] : []),
    { label: copy.filters.warehouse, value: selectedWarehouse ? [selectedWarehouse.code, language === "en" ? (selectedWarehouse.nameEn || selectedWarehouse.nameAr) : selectedWarehouse.nameAr].filter(Boolean).join(" - ") : copy.allWarehouses },
    { label: copy.filters.status, value: copy.statuses[report.filters.status] },
    { label: copy.filters.category, value: selectedCategory ? (selectedCategory.uncategorized ? copy.uncategorized : (language === "en" ? (selectedCategory.pathEn || selectedCategory.pathAr) : (selectedCategory.pathAr || selectedCategory.pathEn)) || selectedCategory.code || copy.uncategorized) : copy.allCategories },
    { label: copy.filters.condition, value: copy.conditions[report.filters.condition] },
  ];

  const rows = report.rows.map((row) => {
    const mainEvidence = row.conditions.find((item) => item.condition === "value_mismatch")
      || row.conditions.find((item) => item.reconciliationCode)
      || row.conditions[0];
    return {
      item: row.itemName,
      code: row.internalCode || "—",
      warehouse: warehouseDisplay(row, language),
      category: categoryDisplay(row, language, copy.uncategorized),
      quantity: row.quantity,
      unit: row.unit || "—",
      averageCost: row.averageCost,
      storedValue: row.totalCostValue,
      condition: row.conditions.map((item) => copy.conditions[item.condition]).join(" | "),
      expected: mainEvidence?.expectedValue ?? null,
      difference: mainEvidence?.difference ?? null,
      tolerance: mainEvidence?.tolerance ?? null,
      evidence: row.reconciliationCodes.join(" | ") || "—",
    };
  });

  return {
    title: copy.title,
    sheetName: copy.sheetName,
    generatedAt: new Date(report.generatedAt),
    direction: copy.direction,
    locale: copy.locale,
    orientation: "landscape",
    filters: filterSummary,
    columns: [
      { key: "item", header: copy.columns.item, kind: "text", width: 34 },
      { key: "code", header: copy.columns.code, kind: "text", width: 16 },
      { key: "warehouse", header: copy.columns.warehouse, kind: "text", width: 26 },
      { key: "category", header: copy.columns.category, kind: "text", width: 34 },
      { key: "quantity", header: copy.columns.quantity, kind: "quantity", decimals: 3, width: 14 },
      { key: "unit", header: copy.columns.unit, kind: "text", width: 12 },
      { key: "averageCost", header: copy.columns.averageCost, kind: "currency", decimals: 4, width: 16 },
      { key: "storedValue", header: copy.columns.storedValue, kind: "currency", decimals: 2, width: 16 },
      { key: "condition", header: copy.columns.condition, kind: "text", width: 36 },
      { key: "expected", header: copy.columns.expected, kind: "currency", decimals: 2, width: 16 },
      { key: "difference", header: copy.columns.difference, kind: "currency", decimals: 2, width: 14 },
      { key: "tolerance", header: copy.columns.tolerance, kind: "currency", decimals: 2, width: 14 },
      { key: "evidence", header: copy.columns.evidence, kind: "text", width: 30 },
    ],
    rows,
  };
}

export async function buildInventoryAccountingReviewExcel(filters: InventoryAccountingReviewFilters, language?: unknown) {
  const report = await loadInventoryAccountingReviewReport(filters);
  const definition = buildInventoryAccountingReviewExportDefinition(report, language);
  const generatedAt = new Date(report.generatedAt);
  const buffer = await buildReportExcel(definition);
  const filename = buildReportFilename(definition.sheetName || "inventory-accounting-review", "xlsx", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export async function buildInventoryAccountingReviewPdf(filters: InventoryAccountingReviewFilters, language?: unknown) {
  const report = await loadInventoryAccountingReviewReport(filters);
  const definition = buildInventoryAccountingReviewExportDefinition(report, language);
  const generatedAt = new Date(report.generatedAt);
  const buffer = await buildReportPdf(definition);
  const filename = buildReportFilename(definition.sheetName || "inventory-accounting-review", "pdf", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export async function buildInventoryAccountingReviewPrintHtml(filters: InventoryAccountingReviewFilters, language?: unknown) {
  const report = await loadInventoryAccountingReviewReport(filters);
  return buildReportHtml(buildInventoryAccountingReviewExportDefinition(report, language));
}
