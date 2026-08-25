import { and, asc, eq, gt, inArray, like, or } from "drizzle-orm";
import {
  inventory,
  inventoryLotBalances,
  inventoryLots,
  warehouses,
} from "../../../drizzle/schema";
import { getDb } from "../../_core/db/client";
import { isInventoryLotsEnabled } from "../../_core/inventory-lots";
import {
  buildReportContentDisposition,
  buildReportExcel,
  buildReportFilename,
  buildReportHtml,
  buildReportPdf,
  type ReportExportDefinition,
  type ReportFilterSummaryItem,
} from "./reportExportFoundation";

export type StockBalanceStatus = "normal" | "low" | "zero" | "negative";
export type StockBalanceStatusFilter = "all" | StockBalanceStatus;

export interface StockBalanceFilters {
  search?: string;
  warehouseId?: number;
  status?: StockBalanceStatusFilter;
}

export interface StockBalanceLotRow {
  lotId: number;
  lotCode: string;
  trackingToken: string;
  balanceQuantity: number;
  remainingQuantity: number;
  expiryDate: string | null;
}

export interface StockBalanceRow {
  inventoryId: number;
  itemName: string;
  internalCode: string | null;
  warehouseId: number | null;
  warehouseCode: string | null;
  warehouseNameAr: string | null;
  warehouseNameEn: string | null;
  quantity: number;
  unit: string | null;
  minQuantity: number;
  averageCost: number;
  totalCostValue: number;
  status: StockBalanceStatus;
  lotTracked: boolean;
  lots: StockBalanceLotRow[];
}

export interface StockBalanceReportResult {
  generatedAt: string;
  readOnly: true;
  filters: Required<Pick<StockBalanceFilters, "status">> & Omit<StockBalanceFilters, "status">;
  summary: {
    rows: number;
    normal: number;
    low: number;
    zero: number;
    negative: number;
    lotTracked: number;
  };
  warehouses: Array<{
    id: number;
    code: string;
    nameAr: string;
    nameEn: string | null;
    isActive: number;
  }>;
  rows: StockBalanceRow[];
}

const QUANTITY_EPSILON = 0.0005;

function asNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function classifyStockBalanceStatus(quantityValue: unknown, minQuantityValue: unknown): StockBalanceStatus {
  const quantity = asNumber(quantityValue);
  const minQuantity = Math.max(0, asNumber(minQuantityValue));

  if (quantity < -QUANTITY_EPSILON) return "negative";
  if (Math.abs(quantity) <= QUANTITY_EPSILON) return "zero";
  if (minQuantity > QUANTITY_EPSILON && quantity <= minQuantity + QUANTITY_EPSILON) return "low";
  return "normal";
}

export function normalizeStockBalanceFilters(filters: StockBalanceFilters = {}) {
  const allowedStatuses = new Set<StockBalanceStatusFilter>(["all", "normal", "low", "zero", "negative"]);
  const status = allowedStatuses.has(filters.status || "all") ? (filters.status || "all") : "all";
  const search = String(filters.search || "").trim().slice(0, 200);
  const warehouseId = Number(filters.warehouseId || 0) > 0 ? Number(filters.warehouseId) : undefined;
  return { search, warehouseId, status } as const;
}

export function summarizeStockBalanceRows(rows: StockBalanceRow[]) {
  return rows.reduce(
    (summary, row) => {
      summary.rows += 1;
      summary[row.status] += 1;
      if (row.lotTracked) summary.lotTracked += 1;
      return summary;
    },
    { rows: 0, normal: 0, low: 0, zero: 0, negative: 0, lotTracked: 0 },
  );
}

export async function loadInventoryStockBalanceReport(filtersInput: StockBalanceFilters = {}): Promise<StockBalanceReportResult> {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");

  const filters = normalizeStockBalanceFilters(filtersInput);
  const conditions: any[] = [];
  if (filters.warehouseId) conditions.push(eq(inventory.warehouseId, filters.warehouseId));
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(or(
      like(inventory.itemName, pattern),
      like(inventory.internalCode, pattern),
    ));
  }

  const inventoryRows = await db
    .select({
      inventoryId: inventory.id,
      itemName: inventory.itemName,
      internalCode: inventory.internalCode,
      warehouseId: inventory.warehouseId,
      warehouseCode: warehouses.code,
      warehouseNameAr: warehouses.nameAr,
      warehouseNameEn: warehouses.nameEn,
      quantity: inventory.quantity,
      unit: inventory.unit,
      minQuantity: inventory.minQuantity,
      averageCost: inventory.averageCost,
      totalCostValue: inventory.totalCostValue,
    })
    .from(inventory)
    .leftJoin(warehouses, eq(warehouses.id, inventory.warehouseId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(warehouses.nameAr), asc(inventory.itemName), asc(inventory.id));

  const warehouseRows = await db
    .select({
      id: warehouses.id,
      code: warehouses.code,
      nameAr: warehouses.nameAr,
      nameEn: warehouses.nameEn,
      isActive: warehouses.isActive,
    })
    .from(warehouses)
    .orderBy(asc(warehouses.type), asc(warehouses.nameAr));

  const lotRowsByInventory = new Map<number, StockBalanceLotRow[]>();
  const inventoryIds = inventoryRows.map((row: any) => Number(row.inventoryId)).filter((id: number) => id > 0);

  if (isInventoryLotsEnabled() && inventoryIds.length > 0) {
    const lotBalanceRows = await db
      .select({
        inventoryId: inventoryLotBalances.inventoryId,
        lotId: inventoryLots.id,
        lotCode: inventoryLots.lotCode,
        trackingToken: inventoryLots.trackingToken,
        balanceQuantity: inventoryLotBalances.quantity,
        remainingQuantity: inventoryLots.remainingQuantity,
        expiryDate: inventoryLots.expiryDate,
      })
      .from(inventoryLotBalances)
      .innerJoin(inventoryLots, eq(inventoryLots.id, inventoryLotBalances.lotId))
      .where(and(
        inArray(inventoryLotBalances.inventoryId, inventoryIds),
        gt(inventoryLotBalances.quantity, "0"),
      ))
      .orderBy(asc(inventoryLots.lotCode));

    for (const row of lotBalanceRows as any[]) {
      const inventoryId = Number(row.inventoryId);
      const current = lotRowsByInventory.get(inventoryId) || [];
      current.push({
        lotId: Number(row.lotId),
        lotCode: String(row.lotCode),
        trackingToken: String(row.trackingToken),
        balanceQuantity: asNumber(row.balanceQuantity),
        remainingQuantity: asNumber(row.remainingQuantity),
        expiryDate: row.expiryDate == null ? null : String(row.expiryDate),
      });
      lotRowsByInventory.set(inventoryId, current);
    }
  }

  let rows: StockBalanceRow[] = (inventoryRows as any[]).map((row) => {
    const inventoryId = Number(row.inventoryId);
    const lots = lotRowsByInventory.get(inventoryId) || [];
    const quantity = asNumber(row.quantity);
    const minQuantity = asNumber(row.minQuantity);
    return {
      inventoryId,
      itemName: String(row.itemName || ""),
      internalCode: row.internalCode == null ? null : String(row.internalCode),
      warehouseId: row.warehouseId == null ? null : Number(row.warehouseId),
      warehouseCode: row.warehouseCode == null ? null : String(row.warehouseCode),
      warehouseNameAr: row.warehouseNameAr == null ? null : String(row.warehouseNameAr),
      warehouseNameEn: row.warehouseNameEn == null ? null : String(row.warehouseNameEn),
      quantity,
      unit: row.unit == null ? null : String(row.unit),
      minQuantity,
      averageCost: asNumber(row.averageCost),
      totalCostValue: asNumber(row.totalCostValue),
      status: classifyStockBalanceStatus(quantity, minQuantity),
      lotTracked: lots.length > 0,
      lots,
    };
  });

  if (filters.status !== "all") rows = rows.filter((row) => row.status === filters.status);

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    filters,
    summary: summarizeStockBalanceRows(rows),
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
  columns: Record<"item" | "code" | "warehouse" | "quantity" | "unit" | "averageCost" | "value" | "minimum" | "status" | "lots", string>;
  statuses: Record<StockBalanceStatusFilter, string>;
  allWarehouses: string;
}> = {
  ar: {
    locale: "ar-SA-u-nu-latn",
    direction: "rtl",
    title: "تقرير رصيد المخزون والحالة",
    sheetName: "رصيد المخزون",
    filters: { search: "البحث", warehouse: "المخزن", status: "الحالة" },
    columns: {
      item: "الصنف",
      code: "الكود",
      warehouse: "المخزن",
      quantity: "الكمية",
      unit: "الوحدة",
      averageCost: "متوسط التكلفة",
      value: "قيمة المخزون",
      minimum: "الحد الأدنى",
      status: "الحالة",
      lots: "الدفعات (Lots)",
    },
    statuses: { all: "كل الحالات", normal: "طبيعي", low: "مخزون منخفض", zero: "رصيد صفري", negative: "رصيد سالب" },
    allWarehouses: "كل المخازن",
  },
  en: {
    locale: "en-US",
    direction: "ltr",
    title: "Stock Balance & Status Report",
    sheetName: "Stock Balance",
    filters: { search: "Search", warehouse: "Warehouse", status: "Status" },
    columns: {
      item: "Item",
      code: "Code",
      warehouse: "Warehouse",
      quantity: "Quantity",
      unit: "Unit",
      averageCost: "Average Cost",
      value: "Stock Value",
      minimum: "Minimum",
      status: "Status",
      lots: "Lots",
    },
    statuses: { all: "All statuses", normal: "Normal", low: "Low stock", zero: "Zero stock", negative: "Negative stock" },
    allWarehouses: "All warehouses",
  },
  ur: {
    locale: "ur-PK-u-nu-latn",
    direction: "rtl",
    title: "اسٹاک بیلنس اور حالت رپورٹ",
    sheetName: "اسٹاک بیلنس",
    filters: { search: "تلاش", warehouse: "گودام", status: "حالت" },
    columns: {
      item: "آئٹم",
      code: "کوڈ",
      warehouse: "گودام",
      quantity: "مقدار",
      unit: "یونٹ",
      averageCost: "اوسط لاگت",
      value: "اسٹاک ویلیو",
      minimum: "کم از کم",
      status: "حالت",
      lots: "Lots",
    },
    statuses: { all: "تمام حالتیں", normal: "نارمل", low: "کم اسٹاک", zero: "صفر اسٹاک", negative: "منفی اسٹاک" },
    allWarehouses: "تمام گودام",
  },
};

function resolveLanguage(value: unknown): SupportedLanguage {
  const raw = String(value || "ar").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("ur")) return "ur";
  return "ar";
}

function warehouseDisplay(row: StockBalanceRow, language: SupportedLanguage) {
  const name = language === "en" ? (row.warehouseNameEn || row.warehouseNameAr) : (row.warehouseNameAr || row.warehouseNameEn);
  return [row.warehouseCode, name].filter(Boolean).join(" - ") || "—";
}

export function buildStockBalanceExportDefinition(
  report: StockBalanceReportResult,
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
    minimum: row.minQuantity,
    status: copy.statuses[row.status],
    lots: row.lots.length
      ? row.lots.map((lot) => `${lot.lotCode}: ${lot.balanceQuantity}`).join(" | ")
      : "—",
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
      { key: "value", header: copy.columns.value, kind: "currency", decimals: 2, width: 16 },
      { key: "minimum", header: copy.columns.minimum, kind: "quantity", decimals: 3, width: 14 },
      { key: "status", header: copy.columns.status, kind: "text", width: 20 },
      { key: "lots", header: copy.columns.lots, kind: "text", width: 34 },
    ],
    rows,
  };
}

export async function buildInventoryStockBalanceExcel(filters: StockBalanceFilters, language?: unknown) {
  const report = await loadInventoryStockBalanceReport(filters);
  const definition = buildStockBalanceExportDefinition(report, language);
  const generatedAt = new Date(report.generatedAt);
  const buffer = await buildReportExcel(definition);
  const filename = buildReportFilename(definition.sheetName || "stock-balance", "xlsx", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export async function buildInventoryStockBalancePdf(filters: StockBalanceFilters, language?: unknown) {
  const report = await loadInventoryStockBalanceReport(filters);
  const definition = buildStockBalanceExportDefinition(report, language);
  const generatedAt = new Date(report.generatedAt);
  const buffer = await buildReportPdf(definition);
  const filename = buildReportFilename(definition.sheetName || "stock-balance", "pdf", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export async function buildInventoryStockBalancePrintHtml(filters: StockBalanceFilters, language?: unknown) {
  const report = await loadInventoryStockBalanceReport(filters);
  return buildReportHtml(buildStockBalanceExportDefinition(report, language));
}
