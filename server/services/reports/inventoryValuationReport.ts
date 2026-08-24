import { and, asc, eq, like, or } from "drizzle-orm";
import { inventory, warehouses } from "../../../drizzle/schema";
import { getDb } from "../../_core/db/client";
import {
  buildReportContentDisposition,
  buildReportExcel,
  buildReportFilename,
  buildReportHtml,
  buildReportPdf,
  type ReportExportDefinition,
  type ReportFilterSummaryItem,
} from "./reportExportFoundation";

export type InventoryValuationStatus = "positive" | "zero" | "negative";
export type InventoryValuationStatusFilter = "all" | InventoryValuationStatus;

export interface InventoryValuationFilters {
  search?: string;
  warehouseId?: number;
  status?: InventoryValuationStatusFilter;
}

export interface InventoryValuationRow {
  inventoryId: number;
  itemName: string;
  internalCode: string | null;
  warehouseId: number | null;
  warehouseCode: string | null;
  warehouseNameAr: string | null;
  warehouseNameEn: string | null;
  quantity: number;
  unit: string | null;
  averageCost: number;
  totalCostValue: number;
  status: InventoryValuationStatus;
}

export interface InventoryValuationReportResult {
  generatedAt: string;
  readOnly: true;
  basis: "stored_inventory_value";
  filters: Required<Pick<InventoryValuationFilters, "status">> & Omit<InventoryValuationFilters, "status">;
  summary: {
    rows: number;
    totalValue: number;
    positiveValueRows: number;
    zeroValueRows: number;
    negativeValueRows: number;
    warehouses: number;
  };
  warehouses: Array<{
    id: number;
    code: string;
    nameAr: string;
    nameEn: string | null;
    isActive: number;
  }>;
  rows: InventoryValuationRow[];
}

const VALUE_EPSILON = 0.005;

function asNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function classifyInventoryValuationStatus(value: unknown): InventoryValuationStatus {
  const total = asNumber(value);
  if (total < -VALUE_EPSILON) return "negative";
  if (Math.abs(total) <= VALUE_EPSILON) return "zero";
  return "positive";
}

export function normalizeInventoryValuationFilters(filters: InventoryValuationFilters = {}) {
  const allowed = new Set<InventoryValuationStatusFilter>(["all", "positive", "zero", "negative"]);
  const status = allowed.has(filters.status || "all") ? (filters.status || "all") : "all";
  const search = String(filters.search || "").trim().slice(0, 200);
  const warehouseId = Number(filters.warehouseId || 0) > 0 ? Number(filters.warehouseId) : undefined;
  return { search, warehouseId, status } as const;
}

export function summarizeInventoryValuationRows(rows: InventoryValuationRow[]) {
  const warehouseIds = new Set<number>();
  const summary = {
    rows: rows.length,
    totalValue: 0,
    positiveValueRows: 0,
    zeroValueRows: 0,
    negativeValueRows: 0,
    warehouses: 0,
  };

  for (const row of rows) {
    summary.totalValue += row.totalCostValue;
    if (row.status === "positive") summary.positiveValueRows += 1;
    else if (row.status === "negative") summary.negativeValueRows += 1;
    else summary.zeroValueRows += 1;
    if (row.warehouseId && row.warehouseId > 0) warehouseIds.add(row.warehouseId);
  }

  summary.totalValue = Number(summary.totalValue.toFixed(2));
  summary.warehouses = warehouseIds.size;
  return summary;
}

export async function loadInventoryValuationReport(filtersInput: InventoryValuationFilters = {}): Promise<InventoryValuationReportResult> {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");

  const filters = normalizeInventoryValuationFilters(filtersInput);
  const conditions: any[] = [];
  if (filters.warehouseId) conditions.push(eq(inventory.warehouseId, filters.warehouseId));
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(or(
      like(inventory.itemName, pattern),
      like(inventory.internalCode, pattern),
    ));
  }

  const [inventoryRows, warehouseRows] = await Promise.all([
    db.select({
      inventoryId: inventory.id,
      itemName: inventory.itemName,
      internalCode: inventory.internalCode,
      warehouseId: inventory.warehouseId,
      warehouseCode: warehouses.code,
      warehouseNameAr: warehouses.nameAr,
      warehouseNameEn: warehouses.nameEn,
      quantity: inventory.quantity,
      unit: inventory.unit,
      averageCost: inventory.averageCost,
      totalCostValue: inventory.totalCostValue,
    })
      .from(inventory)
      .leftJoin(warehouses, eq(warehouses.id, inventory.warehouseId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(warehouses.nameAr), asc(inventory.itemName), asc(inventory.id)),
    db.select({
      id: warehouses.id,
      code: warehouses.code,
      nameAr: warehouses.nameAr,
      nameEn: warehouses.nameEn,
      isActive: warehouses.isActive,
    }).from(warehouses).orderBy(asc(warehouses.type), asc(warehouses.nameAr)),
  ]);

  let rows: InventoryValuationRow[] = (inventoryRows as any[]).map((row) => {
    const totalCostValue = asNumber(row.totalCostValue);
    return {
      inventoryId: Number(row.inventoryId),
      itemName: String(row.itemName || ""),
      internalCode: row.internalCode == null ? null : String(row.internalCode),
      warehouseId: row.warehouseId == null ? null : Number(row.warehouseId),
      warehouseCode: row.warehouseCode == null ? null : String(row.warehouseCode),
      warehouseNameAr: row.warehouseNameAr == null ? null : String(row.warehouseNameAr),
      warehouseNameEn: row.warehouseNameEn == null ? null : String(row.warehouseNameEn),
      quantity: asNumber(row.quantity),
      unit: row.unit == null ? null : String(row.unit),
      averageCost: asNumber(row.averageCost),
      totalCostValue,
      status: classifyInventoryValuationStatus(totalCostValue),
    };
  });

  if (filters.status !== "all") rows = rows.filter((row) => row.status === filters.status);

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    basis: "stored_inventory_value",
    filters,
    summary: summarizeInventoryValuationRows(rows),
    warehouses: (warehouseRows as any[]).map((row) => ({
      id: Number(row.id),
      code: String(row.code),
      nameAr: String(row.nameAr),
      nameEn: row.nameEn == null ? null : String(row.nameEn),
      isActive: Number(row.isActive || 0),
    })),
    rows,
  };
}

type SupportedLanguage = "ar" | "en" | "ur";

const COPY: Record<SupportedLanguage, {
  locale: string;
  direction: "rtl" | "ltr";
  title: string;
  sheetName: string;
  filters: { search: string; warehouse: string; status: string };
  columns: Record<"item" | "code" | "warehouse" | "quantity" | "unit" | "averageCost" | "value" | "status", string>;
  statuses: Record<InventoryValuationStatusFilter, string>;
  allWarehouses: string;
}> = {
  ar: {
    locale: "ar-SA",
    direction: "rtl",
    title: "تقرير تقييم المخزون",
    sheetName: "تقييم المخزون",
    filters: { search: "البحث", warehouse: "المخزن", status: "حالة القيمة" },
    columns: {
      item: "الصنف",
      code: "الكود",
      warehouse: "المخزن",
      quantity: "الكمية",
      unit: "الوحدة",
      averageCost: "متوسط التكلفة",
      value: "قيمة المخزون الحالية",
      status: "حالة القيمة",
    },
    statuses: { all: "كل القيم", positive: "قيمة موجبة", zero: "قيمة صفرية", negative: "قيمة سالبة" },
    allWarehouses: "كل المخازن",
  },
  en: {
    locale: "en-US",
    direction: "ltr",
    title: "Inventory Valuation Report",
    sheetName: "Inventory Valuation",
    filters: { search: "Search", warehouse: "Warehouse", status: "Value status" },
    columns: {
      item: "Item",
      code: "Code",
      warehouse: "Warehouse",
      quantity: "Quantity",
      unit: "Unit",
      averageCost: "Average Cost",
      value: "Current Inventory Value",
      status: "Value Status",
    },
    statuses: { all: "All values", positive: "Positive value", zero: "Zero value", negative: "Negative value" },
    allWarehouses: "All warehouses",
  },
  ur: {
    locale: "ur-PK",
    direction: "rtl",
    title: "انوینٹری ویلیوایشن رپورٹ",
    sheetName: "انوینٹری ویلیو",
    filters: { search: "تلاش", warehouse: "گودام", status: "ویلیو حالت" },
    columns: {
      item: "آئٹم",
      code: "کوڈ",
      warehouse: "گودام",
      quantity: "مقدار",
      unit: "یونٹ",
      averageCost: "اوسط لاگت",
      value: "موجودہ انوینٹری ویلیو",
      status: "ویلیو حالت",
    },
    statuses: { all: "تمام ویلیوز", positive: "مثبت ویلیو", zero: "صفر ویلیو", negative: "منفی ویلیو" },
    allWarehouses: "تمام گودام",
  },
};

function resolveLanguage(value: unknown): SupportedLanguage {
  const raw = String(value || "ar").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("ur")) return "ur";
  return "ar";
}

function warehouseDisplay(row: InventoryValuationRow, language: SupportedLanguage) {
  const name = language === "en" ? (row.warehouseNameEn || row.warehouseNameAr) : (row.warehouseNameAr || row.warehouseNameEn);
  return [row.warehouseCode, name].filter(Boolean).join(" - ") || "—";
}

export function buildInventoryValuationExportDefinition(
  report: InventoryValuationReportResult,
  languageValue?: unknown,
): ReportExportDefinition<Record<string, any>> {
  const language = resolveLanguage(languageValue);
  const copy = COPY[language];
  const selectedWarehouse = report.filters.warehouseId
    ? report.warehouses.find((warehouse) => warehouse.id === report.filters.warehouseId)
    : null;

  const filterSummary: ReportFilterSummaryItem[] = [
    ...(report.filters.search ? [{ label: copy.filters.search, value: report.filters.search }] : []),
    {
      label: copy.filters.warehouse,
      value: selectedWarehouse
        ? [selectedWarehouse.code, language === "en" ? (selectedWarehouse.nameEn || selectedWarehouse.nameAr) : selectedWarehouse.nameAr].filter(Boolean).join(" - ")
        : copy.allWarehouses,
    },
    { label: copy.filters.status, value: copy.statuses[report.filters.status] },
  ];

  const rows = report.rows.map((row) => ({
    item: row.itemName,
    code: row.internalCode || "—",
    warehouse: warehouseDisplay(row, language),
    quantity: row.quantity,
    unit: row.unit || "—",
    averageCost: row.averageCost,
    value: row.totalCostValue,
    status: copy.statuses[row.status],
  }));

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
      { key: "quantity", header: copy.columns.quantity, kind: "quantity", decimals: 3, width: 14 },
      { key: "unit", header: copy.columns.unit, kind: "text", width: 12 },
      { key: "averageCost", header: copy.columns.averageCost, kind: "currency", decimals: 4, width: 16 },
      { key: "value", header: copy.columns.value, kind: "currency", decimals: 2, width: 18 },
      { key: "status", header: copy.columns.status, kind: "text", width: 18 },
    ],
    rows,
  };
}

export async function buildInventoryValuationExcel(filters: InventoryValuationFilters, language?: unknown) {
  const report = await loadInventoryValuationReport(filters);
  const definition = buildInventoryValuationExportDefinition(report, language);
  const generatedAt = new Date(report.generatedAt);
  const buffer = await buildReportExcel(definition);
  const filename = buildReportFilename(definition.sheetName || "inventory-valuation", "xlsx", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export async function buildInventoryValuationPdf(filters: InventoryValuationFilters, language?: unknown) {
  const report = await loadInventoryValuationReport(filters);
  const definition = buildInventoryValuationExportDefinition(report, language);
  const generatedAt = new Date(report.generatedAt);
  const buffer = await buildReportPdf(definition);
  const filename = buildReportFilename(definition.sheetName || "inventory-valuation", "pdf", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export async function buildInventoryValuationPrintHtml(filters: InventoryValuationFilters, language?: unknown) {
  const report = await loadInventoryValuationReport(filters);
  return buildReportHtml(buildInventoryValuationExportDefinition(report, language));
}
