import { asc, eq, gt, inArray } from "drizzle-orm";
import {
  inventory,
  inventoryLotBalances,
  inventoryLots,
  inventoryTransactions,
  warehouses,
} from "../../../drizzle/schema";
import { getDb } from "../../_core/db/client";
import { getInventoryCatalogTaxonomy } from "../../_core/db/inventory";
import {
  buildReportContentDisposition,
  buildReportExcel,
  buildReportFilename,
  buildReportHtml,
  buildReportPdf,
  type ReportExportDefinition,
  type ReportFilterSummaryItem,
} from "./reportExportFoundation";
import {
  buildAbcClassification,
  calculateTurnoverIndicator,
  classifyAgingBucket,
  classifyMovementVelocity,
  daysBetween,
  normalizeInventoryAnalyticsFilters,
  type AgingBucket,
  type InventoryAnalyticsFilters,
  type InventoryAnalyticsView,
  type MovementVelocityStatus,
} from "./inventoryAnalyticsReportCore";

export type { InventoryAnalyticsFilters, InventoryAnalyticsView } from "./inventoryAnalyticsReportCore";

interface CategoryInfo {
  key: string;
  nodeId: number | null;
  code: string | null;
  nameAr: string | null;
  nameEn: string | null;
  pathAr: string | null;
  pathEn: string | null;
  uncategorized: boolean;
}

export interface InventoryAnalyticsBaseRow {
  inventoryId: number;
  itemKey: string;
  linkedItemId: number | null;
  itemName: string;
  internalCode: string | null;
  warehouseId: number | null;
  warehouseCode: string | null;
  warehouseNameAr: string | null;
  warehouseNameEn: string | null;
  quantity: number;
  unit: string | null;
  currentStoredValue: number;
  category: CategoryInfo;
}

export interface InventoryVelocityRow extends InventoryAnalyticsBaseRow {
  lastOutboundAt: string | null;
  daysSinceLastOutbound: number | null;
  status: MovementVelocityStatus;
}

export interface InventoryAbcRow {
  itemKey: string;
  itemName: string;
  internalCode: string | null;
  category: CategoryInfo;
  inventoryRows: number;
  warehouseCount: number;
  currentStoredValue: number;
  sharePercent: number | null;
  cumulativePercent: number | null;
  abcClass: "A" | "B" | "C";
}

export interface InventoryAgingRow {
  lotId: number;
  lotCode: string;
  inventoryId: number;
  itemName: string;
  internalCode: string | null;
  warehouseId: number | null;
  warehouseCode: string | null;
  warehouseNameAr: string | null;
  warehouseNameEn: string | null;
  category: CategoryInfo;
  balanceQuantity: number;
  unit: string | null;
  lotCreatedAt: string | null;
  ageDays: number | null;
  bucket: AgingBucket;
  expiryDate: string | null;
}

export interface InventoryTurnoverRow extends InventoryAnalyticsBaseRow {
  periodDays: number;
  recordedOutboundValue: number;
  valuedOutboundMovements: number;
  unvaluedOutboundMovements: number;
  turnoverIndicator: number | null;
}

export interface InventoryAnalyticsReportResult {
  generatedAt: string;
  readOnly: true;
  historicalBackfillIncluded: false;
  revaluationIncluded: false;
  accountingTurnoverClaimed: false;
  filters: ReturnType<typeof normalizeInventoryAnalyticsFilters>;
  warehouses: Array<{ id: number; code: string; nameAr: string; nameEn: string | null; isActive: number }>;
  categories: CategoryInfo[];
  summary: {
    inventoryRowsInScope: number;
    positiveQuantityRows: number;
    noOutboundHistoryRows: number;
    slowRows: number;
    deadRows: number;
    abcItems: number;
    agingLots: number;
    agingUncoveredInventoryRows: number;
    turnoverRows: number;
    turnoverValuedOutboundMovements: number;
    turnoverUnvaluedOutboundMovements: number;
  };
  slowRows: InventoryVelocityRow[];
  deadRows: InventoryVelocityRow[];
  abcRows: InventoryAbcRow[];
  agingRows: InventoryAgingRow[];
  agingBuckets: Record<AgingBucket, number>;
  turnoverRows: InventoryTurnoverRow[];
}

const UNCATEGORIZED: CategoryInfo = {
  key: "uncategorized",
  nodeId: null,
  code: null,
  nameAr: null,
  nameEn: null,
  pathAr: null,
  pathEn: null,
  uncategorized: true,
};

function asNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function itemKey(row: { linkedItemId?: unknown; internalCode?: unknown; inventoryId?: unknown }) {
  const linked = Number(row.linkedItemId || 0);
  if (linked > 0) return `linked:${linked}`;
  const code = String(row.internalCode || "").trim();
  return code ? `code:${code}` : `inventory:${Number(row.inventoryId || 0)}`;
}

function categoryFromTaxonomy(row: any): CategoryInfo {
  if (!row || !Number(row.catalogNodeId || 0)) return { ...UNCATEGORIZED };
  return {
    key: `node:${Number(row.catalogNodeId)}`,
    nodeId: Number(row.catalogNodeId),
    code: row.catalogNodeCode == null ? null : String(row.catalogNodeCode),
    nameAr: row.catalogNodeNameAr == null ? null : String(row.catalogNodeNameAr),
    nameEn: row.catalogNodeNameEn == null ? null : String(row.catalogNodeNameEn),
    pathAr: row.catalogCategoryPathAr == null ? null : String(row.catalogCategoryPathAr),
    pathEn: row.catalogCategoryPathEn == null ? null : String(row.catalogCategoryPathEn),
    uncategorized: false,
  };
}

function categoryMatches(category: CategoryInfo, filter: string) {
  return filter === "all" || category.key === filter;
}

export async function loadInventoryAnalyticsReport(filtersInput: InventoryAnalyticsFilters = {}): Promise<InventoryAnalyticsReportResult> {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");

  const generatedAtDate = new Date();
  const generatedAt = generatedAtDate.toISOString();
  const filters = normalizeInventoryAnalyticsFilters(filtersInput);

  const [inventoryRowsRaw, warehouseRows, taxonomyRows] = await Promise.all([
    db.select({
      inventoryId: inventory.id,
      linkedItemId: inventory.linkedItemId,
      itemName: inventory.itemName,
      internalCode: inventory.internalCode,
      warehouseId: inventory.warehouseId,
      warehouseCode: warehouses.code,
      warehouseNameAr: warehouses.nameAr,
      warehouseNameEn: warehouses.nameEn,
      quantity: inventory.quantity,
      unit: inventory.unit,
      totalCostValue: inventory.totalCostValue,
    })
      .from(inventory)
      .leftJoin(warehouses, eq(warehouses.id, inventory.warehouseId))
      .orderBy(asc(inventory.itemName), asc(inventory.id)),
    db.select({
      id: warehouses.id,
      code: warehouses.code,
      nameAr: warehouses.nameAr,
      nameEn: warehouses.nameEn,
      isActive: warehouses.isActive,
    }).from(warehouses).orderBy(asc(warehouses.type), asc(warehouses.nameAr)),
    getInventoryCatalogTaxonomy(),
  ]);

  const taxonomyByInventory = new Map<number, CategoryInfo>();
  for (const row of taxonomyRows as any[]) taxonomyByInventory.set(Number(row.inventoryId), categoryFromTaxonomy(row));

  let baseRows: InventoryAnalyticsBaseRow[] = (inventoryRowsRaw as any[]).map((row) => ({
    inventoryId: Number(row.inventoryId),
    itemKey: itemKey(row),
    linkedItemId: row.linkedItemId == null ? null : Number(row.linkedItemId),
    itemName: String(row.itemName || ""),
    internalCode: row.internalCode == null ? null : String(row.internalCode),
    warehouseId: row.warehouseId == null ? null : Number(row.warehouseId),
    warehouseCode: row.warehouseCode == null ? null : String(row.warehouseCode),
    warehouseNameAr: row.warehouseNameAr == null ? null : String(row.warehouseNameAr),
    warehouseNameEn: row.warehouseNameEn == null ? null : String(row.warehouseNameEn),
    quantity: asNumber(row.quantity),
    unit: row.unit == null ? null : String(row.unit),
    currentStoredValue: asNumber(row.totalCostValue),
    category: taxonomyByInventory.get(Number(row.inventoryId)) || { ...UNCATEGORIZED },
  }));

  if (filters.search) {
    const needle = filters.search.toLocaleLowerCase();
    baseRows = baseRows.filter((row) => `${row.itemName} ${row.internalCode || ""}`.toLocaleLowerCase().includes(needle));
  }
  if (filters.warehouseId) baseRows = baseRows.filter((row) => row.warehouseId === filters.warehouseId);
  baseRows = baseRows.filter((row) => categoryMatches(row.category, filters.category));

  const inventoryIds = baseRows.map((row) => row.inventoryId);
  const [transactionRowsRaw, agingRowsRaw] = inventoryIds.length === 0
    ? [[], []]
    : await Promise.all([
      db.select({
        inventoryId: inventoryTransactions.inventoryId,
        direction: inventoryTransactions.type,
        createdAt: inventoryTransactions.createdAt,
        totalCost: inventoryTransactions.totalCost,
      })
        .from(inventoryTransactions)
        .where(inArray(inventoryTransactions.inventoryId, inventoryIds)),
      db.select({
        lotId: inventoryLots.id,
        lotCode: inventoryLots.lotCode,
        inventoryId: inventoryLotBalances.inventoryId,
        balanceQuantity: inventoryLotBalances.quantity,
        lotCreatedAt: inventoryLots.createdAt,
        expiryDate: inventoryLots.expiryDate,
      })
        .from(inventoryLotBalances)
        .innerJoin(inventoryLots, eq(inventoryLots.id, inventoryLotBalances.lotId))
        .where(inArray(inventoryLotBalances.inventoryId, inventoryIds)),
    ]);

  const lastOutboundByInventory = new Map<number, string>();
  const turnoverStart = new Date(generatedAtDate.getTime() - filters.turnoverDays * 86_400_000);
  const turnoverByInventory = new Map<number, { value: number; valued: number; unvalued: number }>();
  for (const tx of transactionRowsRaw as any[]) {
    if (String(tx.direction) !== "out") continue;
    const id = Number(tx.inventoryId);
    const createdAt = String(tx.createdAt || "");
    const previous = lastOutboundByInventory.get(id);
    if (createdAt && (!previous || new Date(createdAt).getTime() > new Date(previous).getTime())) lastOutboundByInventory.set(id, createdAt);

    const txDate = new Date(createdAt);
    if (Number.isNaN(txDate.getTime()) || txDate < turnoverStart || txDate > generatedAtDate) continue;
    const current = turnoverByInventory.get(id) || { value: 0, valued: 0, unvalued: 0 };
    if (tx.totalCost == null || tx.totalCost === "" || !Number.isFinite(Number(tx.totalCost))) {
      current.unvalued += 1;
    } else {
      current.value += Math.max(0, Number(tx.totalCost));
      current.valued += 1;
    }
    turnoverByInventory.set(id, current);
  }

  const positiveRows = baseRows.filter((row) => row.quantity > 0);
  const velocityRows: InventoryVelocityRow[] = positiveRows.map((row) => {
    const lastOutboundAt = lastOutboundByInventory.get(row.inventoryId) || null;
    const daysSinceLastOutbound = daysBetween(generatedAtDate, lastOutboundAt);
    return {
      ...row,
      lastOutboundAt,
      daysSinceLastOutbound,
      status: classifyMovementVelocity(daysSinceLastOutbound, filters.slowDays, filters.deadDays),
    };
  });
  const slowRows = velocityRows.filter((row) => row.status === "slow").sort((a, b) => (b.daysSinceLastOutbound || 0) - (a.daysSinceLastOutbound || 0));
  const deadRows = velocityRows.filter((row) => row.status === "dead").sort((a, b) => (b.daysSinceLastOutbound || 0) - (a.daysSinceLastOutbound || 0));

  const abcGroups = new Map<string, Omit<InventoryAbcRow, "sharePercent" | "cumulativePercent" | "abcClass"> & { warehouseIds: Set<number> }>();
  for (const row of baseRows) {
    const existing = abcGroups.get(row.itemKey);
    if (existing) {
      existing.inventoryRows += 1;
      existing.currentStoredValue += row.currentStoredValue;
      if (row.warehouseId) existing.warehouseIds.add(row.warehouseId);
    } else {
      const warehouseIds = new Set<number>();
      if (row.warehouseId) warehouseIds.add(row.warehouseId);
      abcGroups.set(row.itemKey, {
        itemKey: row.itemKey,
        itemName: row.itemName,
        internalCode: row.internalCode,
        category: row.category,
        inventoryRows: 1,
        warehouseCount: 0,
        currentStoredValue: row.currentStoredValue,
        warehouseIds,
      });
    }
  }
  const positiveAbcGroups = Array.from(abcGroups.values()).filter((row) => row.currentStoredValue > 0);
  const abcByKey = new Map(buildAbcClassification(positiveAbcGroups.map((row) => ({ key: row.itemKey, value: row.currentStoredValue }))).map((row) => [row.key, row]));
  const abcRows: InventoryAbcRow[] = positiveAbcGroups
    .map(({ warehouseIds, ...row }) => {
      const classification = abcByKey.get(row.itemKey)!;
      return {
        ...row,
        currentStoredValue: Number(row.currentStoredValue.toFixed(2)),
        warehouseCount: warehouseIds.size,
        sharePercent: classification.sharePercent,
        cumulativePercent: classification.cumulativePercent,
        abcClass: classification.abcClass,
      };
    })
    .sort((a, b) => b.currentStoredValue - a.currentStoredValue || a.itemName.localeCompare(b.itemName));

  const baseById = new Map(baseRows.map((row) => [row.inventoryId, row]));
  const agingRows: InventoryAgingRow[] = [];
  const agingInventoryIds = new Set<number>();
  for (const raw of agingRowsRaw as any[]) {
    const balanceQuantity = asNumber(raw.balanceQuantity);
    if (balanceQuantity <= 0) continue;
    const base = baseById.get(Number(raw.inventoryId));
    if (!base) continue;
    agingInventoryIds.add(base.inventoryId);
    const lotCreatedAt = raw.lotCreatedAt == null ? null : String(raw.lotCreatedAt);
    const ageDays = daysBetween(generatedAtDate, lotCreatedAt);
    agingRows.push({
      lotId: Number(raw.lotId),
      lotCode: String(raw.lotCode || ""),
      inventoryId: base.inventoryId,
      itemName: base.itemName,
      internalCode: base.internalCode,
      warehouseId: base.warehouseId,
      warehouseCode: base.warehouseCode,
      warehouseNameAr: base.warehouseNameAr,
      warehouseNameEn: base.warehouseNameEn,
      category: base.category,
      balanceQuantity,
      unit: base.unit,
      lotCreatedAt,
      ageDays,
      bucket: classifyAgingBucket(ageDays),
      expiryDate: raw.expiryDate == null ? null : String(raw.expiryDate),
    });
  }
  agingRows.sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.itemName.localeCompare(b.itemName));
  const agingBuckets: Record<AgingBucket, number> = { "0_30": 0, "31_90": 0, "91_180": 0, "181_365": 0, "365_plus": 0, unknown: 0 };
  for (const row of agingRows) agingBuckets[row.bucket] += 1;

  const turnoverRows: InventoryTurnoverRow[] = baseRows
    .filter((row) => row.currentStoredValue > 0)
    .map((row) => {
      const movement = turnoverByInventory.get(row.inventoryId) || { value: 0, valued: 0, unvalued: 0 };
      return {
        ...row,
        periodDays: filters.turnoverDays,
        recordedOutboundValue: Number(movement.value.toFixed(2)),
        valuedOutboundMovements: movement.valued,
        unvaluedOutboundMovements: movement.unvalued,
        turnoverIndicator: calculateTurnoverIndicator(movement.value, row.currentStoredValue),
      };
    })
    .sort((a, b) => (b.turnoverIndicator ?? -1) - (a.turnoverIndicator ?? -1) || b.recordedOutboundValue - a.recordedOutboundValue);

  const categoriesMap = new Map<string, CategoryInfo>();
  for (const row of (inventoryRowsRaw as any[])) {
    const category = taxonomyByInventory.get(Number(row.inventoryId)) || { ...UNCATEGORIZED };
    categoriesMap.set(category.key, category);
  }
  const categories = Array.from(categoriesMap.values()).sort((a, b) => {
    if (a.uncategorized !== b.uncategorized) return a.uncategorized ? 1 : -1;
    return String(a.pathAr || a.nameAr || a.code || "").localeCompare(String(b.pathAr || b.nameAr || b.code || ""), "ar");
  });

  return {
    generatedAt,
    readOnly: true,
    historicalBackfillIncluded: false,
    revaluationIncluded: false,
    accountingTurnoverClaimed: false,
    filters,
    warehouses: (warehouseRows as any[]).map((row) => ({
      id: Number(row.id), code: String(row.code), nameAr: String(row.nameAr), nameEn: row.nameEn == null ? null : String(row.nameEn), isActive: Number(row.isActive || 0),
    })),
    categories,
    summary: {
      inventoryRowsInScope: baseRows.length,
      positiveQuantityRows: positiveRows.length,
      noOutboundHistoryRows: velocityRows.filter((row) => row.status === "no_outbound_history").length,
      slowRows: slowRows.length,
      deadRows: deadRows.length,
      abcItems: abcRows.length,
      agingLots: agingRows.length,
      agingUncoveredInventoryRows: positiveRows.filter((row) => !agingInventoryIds.has(row.inventoryId)).length,
      turnoverRows: turnoverRows.length,
      turnoverValuedOutboundMovements: Array.from(turnoverByInventory.values()).reduce((sum, row) => sum + row.valued, 0),
      turnoverUnvaluedOutboundMovements: Array.from(turnoverByInventory.values()).reduce((sum, row) => sum + row.unvalued, 0),
    },
    slowRows,
    deadRows,
    abcRows,
    agingRows,
    agingBuckets,
    turnoverRows,
  };
}

type SupportedLanguage = "ar" | "en" | "ur";
const COPY: Record<SupportedLanguage, any> = {
  ar: {
    locale: "ar-SA", direction: "rtl", allWarehouses: "كل المخازن", allCategories: "كل التصنيفات", uncategorized: "غير مصنف",
    filters: { search: "البحث", warehouse: "المخزن", category: "التصنيف", slowDays: "حد الحركة البطيئة (يوم)", deadDays: "حد المخزون الراكد (يوم)", turnoverDays: "فترة مؤشر الدوران (يوم)" },
    titles: { slow: "تحليل المخزون — الحركة البطيئة", dead: "تحليل المخزون — المخزون الراكد", abc: "تحليل المخزون — ABC حسب القيمة الحالية", aging: "تحليل المخزون — أعمار الدفعات الحالية", turnover: "تحليل المخزون — مؤشر الدوران التخطيطي" },
    columns: { item: "الصنف", code: "الكود", warehouse: "المخزن", category: "التصنيف", quantity: "الكمية الحالية", unit: "الوحدة", currentValue: "القيمة الحالية المخزنة", lastOutbound: "آخر خروج مسجل", days: "الأيام", itemRows: "سجلات المخزون", warehouses: "عدد المخازن", share: "النسبة %", cumulative: "التراكمي %", abc: "فئة ABC", lot: "Lot Code", lotQty: "رصيد الدفعة", lotCreated: "تاريخ إنشاء الدفعة", bucket: "شريحة العمر", expiry: "الانتهاء", outboundValue: "قيمة الخروج المسجلة", valuedMovements: "حركات خروج بقيمة", unvaluedMovements: "حركات خروج بلا قيمة", turnover: "مؤشر الدوران" },
  },
  en: {
    locale: "en-US", direction: "ltr", allWarehouses: "All warehouses", allCategories: "All categories", uncategorized: "Uncategorized",
    filters: { search: "Search", warehouse: "Warehouse", category: "Category", slowDays: "Slow threshold (days)", deadDays: "Dead-stock threshold (days)", turnoverDays: "Turnover indicator period (days)" },
    titles: { slow: "Inventory Analytics — Slow Moving", dead: "Inventory Analytics — Dead Moving", abc: "Inventory Analytics — ABC by Current Value", aging: "Inventory Analytics — Current Lot Aging", turnover: "Inventory Analytics — Planning Turnover Indicator" },
    columns: { item: "Item", code: "Code", warehouse: "Warehouse", category: "Category", quantity: "Current Quantity", unit: "Unit", currentValue: "Current Stored Value", lastOutbound: "Last Recorded Outbound", days: "Days", itemRows: "Inventory Rows", warehouses: "Warehouses", share: "Share %", cumulative: "Cumulative %", abc: "ABC Class", lot: "Lot Code", lotQty: "Lot Balance", lotCreated: "Lot Created At", bucket: "Age Bucket", expiry: "Expiry", outboundValue: "Recorded Outbound Value", valuedMovements: "Valued Outbound Movements", unvaluedMovements: "Unvalued Outbound Movements", turnover: "Turnover Indicator" },
  },
  ur: {
    locale: "ur-PK", direction: "rtl", allWarehouses: "تمام گودام", allCategories: "تمام زمرے", uncategorized: "غیر درجہ بند",
    filters: { search: "تلاش", warehouse: "گودام", category: "زمرہ", slowDays: "سست حرکت کی حد (دن)", deadDays: "ڈیڈ اسٹاک حد (دن)", turnoverDays: "ٹرن اوور اشاریہ مدت (دن)" },
    titles: { slow: "انوینٹری تجزیہ — سست حرکت", dead: "انوینٹری تجزیہ — ڈیڈ اسٹاک", abc: "انوینٹری تجزیہ — موجودہ قدر کے لحاظ سے ABC", aging: "انوینٹری تجزیہ — موجودہ لاٹ عمر", turnover: "انوینٹری تجزیہ — منصوبہ بندی ٹرن اوور اشاریہ" },
    columns: { item: "آئٹم", code: "کوڈ", warehouse: "گودام", category: "زمرہ", quantity: "موجودہ مقدار", unit: "یونٹ", currentValue: "موجودہ محفوظ قدر", lastOutbound: "آخری ریکارڈ شدہ اخراج", days: "دن", itemRows: "انوینٹری قطاریں", warehouses: "گودام", share: "حصہ %", cumulative: "مجموعی %", abc: "ABC کلاس", lot: "Lot Code", lotQty: "لاٹ بیلنس", lotCreated: "لاٹ بننے کی تاریخ", bucket: "عمر گروپ", expiry: "میعاد", outboundValue: "ریکارڈ شدہ اخراج قدر", valuedMovements: "قدر والی اخراج حرکات", unvaluedMovements: "بغیر قدر اخراج حرکات", turnover: "ٹرن اوور اشاریہ" },
  },
};

function languageOf(value: unknown): SupportedLanguage {
  const raw = String(value || "ar").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("ur")) return "ur";
  return "ar";
}

function warehouseLabel(row: { warehouseCode: string | null; warehouseNameAr: string | null; warehouseNameEn: string | null }, language: SupportedLanguage) {
  const name = language === "en" ? (row.warehouseNameEn || row.warehouseNameAr) : (row.warehouseNameAr || row.warehouseNameEn);
  return [row.warehouseCode, name].filter(Boolean).join(" - ") || "—";
}

function categoryLabel(category: CategoryInfo, language: SupportedLanguage, copy: any) {
  if (category.uncategorized) return copy.uncategorized;
  return language === "en" ? (category.pathEn || category.pathAr || category.nameEn || category.nameAr || category.code || "—") : (category.pathAr || category.pathEn || category.nameAr || category.nameEn || category.code || "—");
}

function filterSummary(report: InventoryAnalyticsReportResult, view: InventoryAnalyticsView, language: SupportedLanguage): ReportFilterSummaryItem[] {
  const copy = COPY[language];
  const warehouse = report.filters.warehouseId ? report.warehouses.find((row) => row.id === report.filters.warehouseId) : null;
  const category = report.filters.category !== "all" ? report.categories.find((row) => row.key === report.filters.category) : null;
  const rows: ReportFilterSummaryItem[] = [
    ...(report.filters.search ? [{ label: copy.filters.search, value: report.filters.search }] : []),
    { label: copy.filters.warehouse, value: warehouse ? [warehouse.code, language === "en" ? (warehouse.nameEn || warehouse.nameAr) : warehouse.nameAr].filter(Boolean).join(" - ") : copy.allWarehouses },
    { label: copy.filters.category, value: category ? categoryLabel(category, language, copy) : copy.allCategories },
  ];
  if (view === "slow" || view === "dead") {
    rows.push({ label: copy.filters.slowDays, value: String(report.filters.slowDays) }, { label: copy.filters.deadDays, value: String(report.filters.deadDays) });
  }
  if (view === "turnover") rows.push({ label: copy.filters.turnoverDays, value: String(report.filters.turnoverDays) });
  return rows;
}

export function buildInventoryAnalyticsExportDefinition(report: InventoryAnalyticsReportResult, view: InventoryAnalyticsView, languageValue?: unknown): ReportExportDefinition<Record<string, any>> {
  const language = languageOf(languageValue);
  const copy = COPY[language];
  const common = { title: copy.titles[view], sheetName: copy.titles[view].slice(0, 28), generatedAt: new Date(report.generatedAt), direction: copy.direction, locale: copy.locale, orientation: "landscape" as const, filters: filterSummary(report, view, language) };
  if (view === "slow" || view === "dead") {
    const rows = view === "slow" ? report.slowRows : report.deadRows;
    return { ...common, columns: [
      { key: "item", header: copy.columns.item, kind: "text", width: 30 }, { key: "code", header: copy.columns.code, kind: "text", width: 16 }, { key: "warehouse", header: copy.columns.warehouse, kind: "text", width: 25 }, { key: "category", header: copy.columns.category, kind: "text", width: 32 }, { key: "quantity", header: copy.columns.quantity, kind: "quantity", width: 14 }, { key: "unit", header: copy.columns.unit, kind: "text", width: 12 }, { key: "currentValue", header: copy.columns.currentValue, kind: "currency", width: 18 }, { key: "lastOutbound", header: copy.columns.lastOutbound, kind: "datetime", width: 19 }, { key: "days", header: copy.columns.days, kind: "number", width: 10 },
    ], rows: rows.map((row) => ({ item: row.itemName, code: row.internalCode || "—", warehouse: warehouseLabel(row, language), category: categoryLabel(row.category, language, copy), quantity: row.quantity, unit: row.unit || "—", currentValue: row.currentStoredValue, lastOutbound: row.lastOutboundAt, days: row.daysSinceLastOutbound })) };
  }
  if (view === "abc") {
    return { ...common, columns: [
      { key: "item", header: copy.columns.item, kind: "text", width: 30 }, { key: "code", header: copy.columns.code, kind: "text", width: 16 }, { key: "category", header: copy.columns.category, kind: "text", width: 32 }, { key: "itemRows", header: copy.columns.itemRows, kind: "number", width: 12 }, { key: "warehouses", header: copy.columns.warehouses, kind: "number", width: 12 }, { key: "currentValue", header: copy.columns.currentValue, kind: "currency", width: 18 }, { key: "share", header: copy.columns.share, kind: "number", decimals: 2, width: 12 }, { key: "cumulative", header: copy.columns.cumulative, kind: "number", decimals: 2, width: 12 }, { key: "abc", header: copy.columns.abc, kind: "text", width: 10 },
    ], rows: report.abcRows.map((row) => ({ item: row.itemName, code: row.internalCode || "—", category: categoryLabel(row.category, language, copy), itemRows: row.inventoryRows, warehouses: row.warehouseCount, currentValue: row.currentStoredValue, share: row.sharePercent, cumulative: row.cumulativePercent, abc: row.abcClass })) };
  }
  if (view === "aging") {
    return { ...common, columns: [
      { key: "lot", header: copy.columns.lot, kind: "text", width: 20 }, { key: "item", header: copy.columns.item, kind: "text", width: 30 }, { key: "code", header: copy.columns.code, kind: "text", width: 16 }, { key: "warehouse", header: copy.columns.warehouse, kind: "text", width: 25 }, { key: "category", header: copy.columns.category, kind: "text", width: 32 }, { key: "lotQty", header: copy.columns.lotQty, kind: "quantity", width: 14 }, { key: "unit", header: copy.columns.unit, kind: "text", width: 12 }, { key: "lotCreated", header: copy.columns.lotCreated, kind: "datetime", width: 19 }, { key: "days", header: copy.columns.days, kind: "number", width: 10 }, { key: "bucket", header: copy.columns.bucket, kind: "text", width: 14 }, { key: "expiry", header: copy.columns.expiry, kind: "date", width: 14 },
    ], rows: report.agingRows.map((row) => ({ lot: row.lotCode, item: row.itemName, code: row.internalCode || "—", warehouse: warehouseLabel(row, language), category: categoryLabel(row.category, language, copy), lotQty: row.balanceQuantity, unit: row.unit || "—", lotCreated: row.lotCreatedAt, days: row.ageDays, bucket: row.bucket, expiry: row.expiryDate })) };
  }
  return { ...common, columns: [
    { key: "item", header: copy.columns.item, kind: "text", width: 30 }, { key: "code", header: copy.columns.code, kind: "text", width: 16 }, { key: "warehouse", header: copy.columns.warehouse, kind: "text", width: 25 }, { key: "category", header: copy.columns.category, kind: "text", width: 32 }, { key: "currentValue", header: copy.columns.currentValue, kind: "currency", width: 18 }, { key: "outboundValue", header: copy.columns.outboundValue, kind: "currency", width: 18 }, { key: "valuedMovements", header: copy.columns.valuedMovements, kind: "number", width: 16 }, { key: "unvaluedMovements", header: copy.columns.unvaluedMovements, kind: "number", width: 16 }, { key: "turnover", header: copy.columns.turnover, kind: "number", decimals: 4, width: 14 },
  ], rows: report.turnoverRows.map((row) => ({ item: row.itemName, code: row.internalCode || "—", warehouse: warehouseLabel(row, language), category: categoryLabel(row.category, language, copy), currentValue: row.currentStoredValue, outboundValue: row.recordedOutboundValue, valuedMovements: row.valuedOutboundMovements, unvaluedMovements: row.unvaluedOutboundMovements, turnover: row.turnoverIndicator })) };
}

export async function buildInventoryAnalyticsExcel(filters: InventoryAnalyticsFilters, view: InventoryAnalyticsView, language?: unknown) {
  const report = await loadInventoryAnalyticsReport(filters);
  const definition = buildInventoryAnalyticsExportDefinition(report, view, language);
  const buffer = await buildReportExcel(definition);
  const filename = buildReportFilename(`inventory-analytics-${view}`, "xlsx", new Date(report.generatedAt));
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export async function buildInventoryAnalyticsPdf(filters: InventoryAnalyticsFilters, view: InventoryAnalyticsView, language?: unknown) {
  const report = await loadInventoryAnalyticsReport(filters);
  const definition = buildInventoryAnalyticsExportDefinition(report, view, language);
  const buffer = await buildReportPdf(definition);
  const filename = buildReportFilename(`inventory-analytics-${view}`, "pdf", new Date(report.generatedAt));
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export async function buildInventoryAnalyticsPrintHtml(filters: InventoryAnalyticsFilters, view: InventoryAnalyticsView, language?: unknown) {
  const report = await loadInventoryAnalyticsReport(filters);
  return buildReportHtml(buildInventoryAnalyticsExportDefinition(report, view, language));
}
