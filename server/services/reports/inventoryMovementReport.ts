import { and, asc, desc, eq, gte, like, lte, or } from "drizzle-orm";
import {
  deliveryDocuments,
  inventory,
  inventoryLots,
  inventoryTransactions,
  users,
  warehouseReceipts,
  warehouseReturns,
  warehouses,
} from "../../../drizzle/schema";
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

export type InventoryMovementType = "purchase" | "return" | "delivery" | "adjustment" | "disposal" | "transfer";
export type InventoryMovementTypeFilter = "all" | InventoryMovementType;
export type InventoryMovementDirectionFilter = "all" | "in" | "out";

export interface InventoryMovementFilters {
  search?: string;
  warehouseId?: number;
  movementType?: InventoryMovementTypeFilter;
  direction?: InventoryMovementDirectionFilter;
  dateFrom?: string;
  dateTo?: string;
  itemKey?: string;
}

export interface InventoryMovementItemOption {
  key: string;
  itemName: string;
  internalCode: string | null;
  currentQuantity: number;
  currentValue: number;
  warehouseCount: number;
  inventoryIds: number[];
}

export interface InventoryMovementMeta {
  readOnly: true;
  warehouses: Array<{
    id: number;
    code: string;
    nameAr: string;
    nameEn: string | null;
    isActive: number;
  }>;
  items: InventoryMovementItemOption[];
}

export interface InventoryMovementRow {
  transactionId: number;
  inventoryId: number;
  itemKey: string;
  itemName: string;
  internalCode: string | null;
  warehouseId: number | null;
  warehouseCode: string | null;
  warehouseNameAr: string | null;
  warehouseNameEn: string | null;
  lotId: number | null;
  lotCode: string | null;
  createdAt: string;
  direction: "in" | "out";
  transactionType: InventoryMovementType;
  quantity: number;
  unit: string | null;
  unitCost: number | null;
  totalCost: number | null;
  reference: string | null;
  invoiceNumber: string | null;
  reason: string | null;
  performerName: string | null;
}

export interface InventoryMovementReportResult {
  generatedAt: string;
  readOnly: true;
  filters: Required<Pick<InventoryMovementFilters, "movementType" | "direction">> & Omit<InventoryMovementFilters, "movementType" | "direction">;
  selectedWarehouse: InventoryMovementMeta["warehouses"][number] | null;
  selectedItem: InventoryMovementItemOption | null;
  summary: {
    rows: number;
    inMovements: number;
    outMovements: number;
    inQuantity: number;
    outQuantity: number;
    distinctItems: number;
    currentQuantity: number | null;
    currentValue: number | null;
  };
  rows: InventoryMovementRow[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ITEM_KEY_RE = /^(linked|code|inventory):(.+)$/;

function asNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function cleanDate(value: unknown): string | undefined {
  const raw = String(value || "").trim();
  if (!DATE_RE.test(raw)) return undefined;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : raw;
}

export function inventoryMovementItemKey(row: { linkedItemId?: unknown; internalCode?: unknown; inventoryId?: unknown; id?: unknown }) {
  const linkedItemId = Number(row.linkedItemId || 0);
  if (linkedItemId > 0) return `linked:${linkedItemId}`;
  const internalCode = String(row.internalCode || "").trim();
  if (internalCode) return `code:${internalCode}`;
  const inventoryId = Number(row.inventoryId || row.id || 0);
  return `inventory:${inventoryId}`;
}

export function normalizeInventoryMovementFilters(filters: InventoryMovementFilters = {}) {
  const movementTypes = new Set<InventoryMovementTypeFilter>(["all", "purchase", "return", "delivery", "adjustment", "disposal", "transfer"]);
  const directions = new Set<InventoryMovementDirectionFilter>(["all", "in", "out"]);
  const movementType = movementTypes.has(filters.movementType || "all") ? (filters.movementType || "all") : "all";
  const direction = directions.has(filters.direction || "all") ? (filters.direction || "all") : "all";
  const search = String(filters.search || "").trim().slice(0, 200);
  const warehouseId = Number(filters.warehouseId || 0) > 0 ? Number(filters.warehouseId) : undefined;
  const itemKey = String(filters.itemKey || "").trim().slice(0, 120) || undefined;
  let dateFrom = cleanDate(filters.dateFrom);
  let dateTo = cleanDate(filters.dateTo);
  if (dateFrom && dateTo && dateFrom > dateTo) [dateFrom, dateTo] = [dateTo, dateFrom];
  return { search, warehouseId, movementType, direction, dateFrom, dateTo, itemKey } as const;
}

function itemKeyCondition(itemKey: string | undefined) {
  if (!itemKey) return undefined;
  const match = itemKey.match(ITEM_KEY_RE);
  if (!match) return undefined;
  const [, kind, raw] = match;
  if (kind === "linked") {
    const id = Number(raw);
    return id > 0 ? eq(inventory.linkedItemId, id) : undefined;
  }
  if (kind === "code") return raw ? eq(inventory.internalCode, raw) : undefined;
  const id = Number(raw);
  return id > 0 ? eq(inventory.id, id) : undefined;
}

function resolveReference(row: any): string | null {
  if (row.transactionType === "purchase") return row.receiptNumber || row.documentUrl || row.invoiceNumber || null;
  if (row.transactionType === "return") return row.returnNumber || row.documentUrl || null;
  if (row.transactionType === "delivery") return row.documentUrl || row.deliveryNumber || null;
  return row.documentUrl || null;
}

export function summarizeInventoryMovementRows(rows: InventoryMovementRow[], selectedItem?: InventoryMovementItemOption | null) {
  const summary = {
    rows: rows.length,
    inMovements: 0,
    outMovements: 0,
    inQuantity: 0,
    outQuantity: 0,
    distinctItems: new Set<string>(),
    currentQuantity: selectedItem?.currentQuantity ?? null,
    currentValue: selectedItem?.currentValue ?? null,
  };
  for (const row of rows) {
    summary.distinctItems.add(row.itemKey);
    if (row.direction === "in") {
      summary.inMovements += 1;
      summary.inQuantity += row.quantity;
    } else {
      summary.outMovements += 1;
      summary.outQuantity += row.quantity;
    }
  }
  return {
    rows: summary.rows,
    inMovements: summary.inMovements,
    outMovements: summary.outMovements,
    inQuantity: summary.inQuantity,
    outQuantity: summary.outQuantity,
    distinctItems: summary.distinctItems.size,
    currentQuantity: summary.currentQuantity,
    currentValue: summary.currentValue,
  };
}

export async function loadInventoryMovementMeta(): Promise<InventoryMovementMeta> {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");

  const [inventoryRows, warehouseRows] = await Promise.all([
    db.select({
      inventoryId: inventory.id,
      itemName: inventory.itemName,
      internalCode: inventory.internalCode,
      linkedItemId: inventory.linkedItemId,
      quantity: inventory.quantity,
      totalCostValue: inventory.totalCostValue,
      warehouseId: inventory.warehouseId,
    }).from(inventory).orderBy(asc(inventory.itemName), asc(inventory.id)),
    db.select({
      id: warehouses.id,
      code: warehouses.code,
      nameAr: warehouses.nameAr,
      nameEn: warehouses.nameEn,
      isActive: warehouses.isActive,
    }).from(warehouses).orderBy(asc(warehouses.type), asc(warehouses.nameAr)),
  ]);

  const grouped = new Map<string, InventoryMovementItemOption & { warehouseIds: Set<number> }>();
  for (const row of inventoryRows as any[]) {
    const key = inventoryMovementItemKey(row);
    const existing = grouped.get(key);
    if (existing) {
      existing.currentQuantity += asNumber(row.quantity);
      existing.currentValue += asNumber(row.totalCostValue);
      existing.inventoryIds.push(Number(row.inventoryId));
      if (Number(row.warehouseId || 0) > 0) existing.warehouseIds.add(Number(row.warehouseId));
      continue;
    }
    const warehouseIds = new Set<number>();
    if (Number(row.warehouseId || 0) > 0) warehouseIds.add(Number(row.warehouseId));
    grouped.set(key, {
      key,
      itemName: String(row.itemName || ""),
      internalCode: row.internalCode == null ? null : String(row.internalCode),
      currentQuantity: asNumber(row.quantity),
      currentValue: asNumber(row.totalCostValue),
      warehouseCount: 0,
      inventoryIds: [Number(row.inventoryId)],
      warehouseIds,
    });
  }

  const items = Array.from(grouped.values()).map(({ warehouseIds, ...item }) => ({
    ...item,
    currentQuantity: Number(item.currentQuantity.toFixed(3)),
    currentValue: Number(item.currentValue.toFixed(2)),
    warehouseCount: warehouseIds.size,
  }));

  return {
    readOnly: true,
    warehouses: (warehouseRows as any[]).map((row) => ({
      id: Number(row.id),
      code: String(row.code),
      nameAr: String(row.nameAr),
      nameEn: row.nameEn == null ? null : String(row.nameEn),
      isActive: Number(row.isActive || 0),
    })),
    items,
  };
}

export async function loadInventoryMovementReport(filtersInput: InventoryMovementFilters = {}): Promise<InventoryMovementReportResult> {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");

  const filters = normalizeInventoryMovementFilters(filtersInput);
  const conditions: any[] = [];
  if (filters.warehouseId) conditions.push(eq(inventory.warehouseId, filters.warehouseId));
  if (filters.movementType !== "all") conditions.push(eq(inventoryTransactions.transactionType, filters.movementType));
  if (filters.direction !== "all") conditions.push(eq(inventoryTransactions.type, filters.direction));
  if (filters.dateFrom) conditions.push(gte(inventoryTransactions.createdAt, `${filters.dateFrom} 00:00:00`));
  if (filters.dateTo) conditions.push(lte(inventoryTransactions.createdAt, `${filters.dateTo} 23:59:59`));
  const selectedItemCondition = itemKeyCondition(filters.itemKey);
  if (selectedItemCondition) conditions.push(selectedItemCondition);
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(or(
      like(inventory.itemName, pattern),
      like(inventory.internalCode, pattern),
      like(inventoryLots.lotCode, pattern),
      like(inventoryTransactions.documentUrl, pattern),
      like(inventoryTransactions.invoiceNumber, pattern),
      like(inventoryTransactions.reason, pattern),
      like(warehouseReceipts.receiptNumber, pattern),
      like(warehouseReturns.returnNumber, pattern),
      like(deliveryDocuments.deliveryNumber, pattern),
    ));
  }

  const rowsRaw = await db
    .select({
      transactionId: inventoryTransactions.id,
      inventoryId: inventoryTransactions.inventoryId,
      itemName: inventory.itemName,
      internalCode: inventory.internalCode,
      linkedItemId: inventory.linkedItemId,
      warehouseId: inventory.warehouseId,
      warehouseCode: warehouses.code,
      warehouseNameAr: warehouses.nameAr,
      warehouseNameEn: warehouses.nameEn,
      lotId: inventoryTransactions.lotId,
      lotCode: inventoryLots.lotCode,
      createdAt: inventoryTransactions.createdAt,
      direction: inventoryTransactions.type,
      transactionType: inventoryTransactions.transactionType,
      quantity: inventoryTransactions.quantity,
      unit: inventory.unit,
      unitCost: inventoryTransactions.unitCost,
      totalCost: inventoryTransactions.totalCost,
      documentUrl: inventoryTransactions.documentUrl,
      invoiceNumber: inventoryTransactions.invoiceNumber,
      reason: inventoryTransactions.reason,
      performerName: users.name,
      receiptNumber: warehouseReceipts.receiptNumber,
      returnNumber: warehouseReturns.returnNumber,
      deliveryNumber: deliveryDocuments.deliveryNumber,
    })
    .from(inventoryTransactions)
    .innerJoin(inventory, eq(inventory.id, inventoryTransactions.inventoryId))
    .leftJoin(warehouses, eq(warehouses.id, inventory.warehouseId))
    .leftJoin(inventoryLots, eq(inventoryLots.id, inventoryTransactions.lotId))
    .leftJoin(users, eq(users.id, inventoryTransactions.performedById))
    .leftJoin(warehouseReceipts, eq(warehouseReceipts.id, inventoryTransactions.receiptId))
    .leftJoin(warehouseReturns, eq(warehouseReturns.id, inventoryTransactions.returnId))
    .leftJoin(deliveryDocuments, eq(deliveryDocuments.inventoryTransactionId, inventoryTransactions.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(inventoryTransactions.createdAt), desc(inventoryTransactions.id));

  const rows: InventoryMovementRow[] = (rowsRaw as any[]).map((row) => ({
    transactionId: Number(row.transactionId),
    inventoryId: Number(row.inventoryId),
    itemKey: inventoryMovementItemKey(row),
    itemName: String(row.itemName || ""),
    internalCode: row.internalCode == null ? null : String(row.internalCode),
    warehouseId: row.warehouseId == null ? null : Number(row.warehouseId),
    warehouseCode: row.warehouseCode == null ? null : String(row.warehouseCode),
    warehouseNameAr: row.warehouseNameAr == null ? null : String(row.warehouseNameAr),
    warehouseNameEn: row.warehouseNameEn == null ? null : String(row.warehouseNameEn),
    lotId: row.lotId == null ? null : Number(row.lotId),
    lotCode: row.lotCode == null ? null : String(row.lotCode),
    createdAt: String(row.createdAt),
    direction: row.direction as "in" | "out",
    transactionType: row.transactionType as InventoryMovementType,
    quantity: asNumber(row.quantity),
    unit: row.unit == null ? null : String(row.unit),
    unitCost: asNullableNumber(row.unitCost),
    totalCost: asNullableNumber(row.totalCost),
    reference: resolveReference(row),
    invoiceNumber: row.invoiceNumber == null ? null : String(row.invoiceNumber),
    reason: row.reason == null ? null : String(row.reason),
    performerName: row.performerName == null ? null : String(row.performerName),
  }));

  const meta = await loadInventoryMovementMeta();
  const selectedItem = filters.itemKey ? (meta.items.find((item) => item.key === filters.itemKey) || null) : null;

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    filters,
    selectedWarehouse: filters.warehouseId
      ? (meta.warehouses.find((warehouse) => warehouse.id === filters.warehouseId) || null)
      : null,
    selectedItem,
    summary: summarizeInventoryMovementRows(rows, selectedItem),
    rows,
  };
}

type SupportedLanguage = "ar" | "en" | "ur";

const COPY: Record<SupportedLanguage, any> = {
  ar: {
    locale: "ar-SA-u-nu-latn", direction: "rtl", movementsTitle: "تقرير حركات المخزون", cardTitle: "بطاقة الصنف", sheetMovements: "حركات المخزون", sheetCard: "بطاقة الصنف",
    filters: { search: "البحث", warehouse: "المخزن", movementType: "نوع الحركة", direction: "الاتجاه", dateFrom: "من تاريخ", dateTo: "إلى تاريخ", item: "الصنف", currentQuantity: "الرصيد الحالي" },
    allWarehouses: "كل المخازن", allTypes: "كل الحركات", allDirections: "وارد وصادر",
    types: { purchase: "استلام", delivery: "صرف / تسليم", return: "مرتجع", transfer: "تحويل", disposal: "استبعاد", adjustment: "تسوية / تعديل" },
    directions: { in: "وارد", out: "صادر" },
    columns: { date: "التاريخ والوقت", item: "الصنف", code: "الكود", warehouse: "المخزن", type: "نوع الحركة", direction: "الاتجاه", lot: "Lot Code", quantity: "الكمية", unit: "الوحدة", unitCost: "تكلفة الوحدة", totalCost: "قيمة الحركة", reference: "المستند / المرجع", performer: "منفذ بواسطة", reason: "السبب / الملاحظات" },
  },
  en: {
    locale: "en-US", direction: "ltr", movementsTitle: "Inventory Movement Report", cardTitle: "Stock Card", sheetMovements: "Inventory Movements", sheetCard: "Stock Card",
    filters: { search: "Search", warehouse: "Warehouse", movementType: "Movement type", direction: "Direction", dateFrom: "From date", dateTo: "To date", item: "Item", currentQuantity: "Current balance" },
    allWarehouses: "All warehouses", allTypes: "All movements", allDirections: "In and out",
    types: { purchase: "Receipt", delivery: "Issue / Delivery", return: "Return", transfer: "Transfer", disposal: "Disposal", adjustment: "Adjustment / Settlement" },
    directions: { in: "In", out: "Out" },
    columns: { date: "Date & time", item: "Item", code: "Code", warehouse: "Warehouse", type: "Movement type", direction: "Direction", lot: "Lot Code", quantity: "Quantity", unit: "Unit", unitCost: "Unit cost", totalCost: "Movement value", reference: "Document / Reference", performer: "Performed by", reason: "Reason / Notes" },
  },
  ur: {
    locale: "ur-PK-u-nu-latn", direction: "rtl", movementsTitle: "انوینٹری موومنٹ رپورٹ", cardTitle: "اسٹاک کارڈ", sheetMovements: "انوینٹری موومنٹس", sheetCard: "اسٹاک کارڈ",
    filters: { search: "تلاش", warehouse: "گودام", movementType: "حرکت کی قسم", direction: "سمت", dateFrom: "تاریخ سے", dateTo: "تاریخ تک", item: "آئٹم", currentQuantity: "موجودہ بیلنس" },
    allWarehouses: "تمام گودام", allTypes: "تمام حرکات", allDirections: "ان اور آؤٹ",
    types: { purchase: "وصولی", delivery: "اجراء / حوالگی", return: "واپسی", transfer: "منتقلی", disposal: "اخراج", adjustment: "ایڈجسٹمنٹ / سیٹلمنٹ" },
    directions: { in: "ان", out: "آؤٹ" },
    columns: { date: "تاریخ اور وقت", item: "آئٹم", code: "کوڈ", warehouse: "گودام", type: "حرکت کی قسم", direction: "سمت", lot: "Lot Code", quantity: "مقدار", unit: "یونٹ", unitCost: "یونٹ لاگت", totalCost: "حرکت کی قدر", reference: "دستاویز / حوالہ", performer: "عمل کرنے والا", reason: "وجہ / نوٹس" },
  },
};

function resolveLanguage(value: unknown): SupportedLanguage {
  const raw = String(value || "ar").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("ur")) return "ur";
  return "ar";
}

function warehouseDisplay(row: InventoryMovementRow, language: SupportedLanguage) {
  const name = language === "en" ? (row.warehouseNameEn || row.warehouseNameAr) : (row.warehouseNameAr || row.warehouseNameEn);
  return [row.warehouseCode, name].filter(Boolean).join(" - ") || "—";
}

export function buildInventoryMovementExportDefinition(report: InventoryMovementReportResult, languageValue?: unknown): ReportExportDefinition<Record<string, any>> {
  const language = resolveLanguage(languageValue);
  const copy = COPY[language];
  const metaItem = report.selectedItem;
  const title = metaItem ? `${copy.cardTitle} — ${metaItem.itemName}` : copy.movementsTitle;
  const selectedWarehouse = report.selectedWarehouse;
  const selectedWarehouseLabel = selectedWarehouse
    ? [
        selectedWarehouse.code,
        language === "en"
          ? (selectedWarehouse.nameEn || selectedWarehouse.nameAr)
          : (selectedWarehouse.nameAr || selectedWarehouse.nameEn),
      ].filter(Boolean).join(" - ")
    : null;
  const filters: ReportFilterSummaryItem[] = [
    ...(metaItem ? [{ label: copy.filters.item, value: [metaItem.internalCode, metaItem.itemName].filter(Boolean).join(" - ") }] : []),
    ...(report.filters.search ? [{ label: copy.filters.search, value: report.filters.search }] : []),
    ...(report.filters.warehouseId
      ? [{ label: copy.filters.warehouse, value: selectedWarehouseLabel || String(report.filters.warehouseId) }]
      : [{ label: copy.filters.warehouse, value: copy.allWarehouses }]),
    { label: copy.filters.movementType, value: report.filters.movementType === "all" ? copy.allTypes : copy.types[report.filters.movementType] },
    { label: copy.filters.direction, value: report.filters.direction === "all" ? copy.allDirections : copy.directions[report.filters.direction] },
    ...(report.filters.dateFrom ? [{ label: copy.filters.dateFrom, value: report.filters.dateFrom }] : []),
    ...(report.filters.dateTo ? [{ label: copy.filters.dateTo, value: report.filters.dateTo }] : []),
    ...(metaItem ? [{ label: copy.filters.currentQuantity, value: String(metaItem.currentQuantity) }] : []),
  ];

  return {
    title,
    sheetName: metaItem ? copy.sheetCard : copy.sheetMovements,
    generatedAt: new Date(report.generatedAt),
    direction: copy.direction,
    locale: copy.locale,
    orientation: "landscape",
    filters,
    columns: [
      { key: "date", header: copy.columns.date, kind: "datetime", width: 19 },
      { key: "item", header: copy.columns.item, kind: "text", width: 31 },
      { key: "code", header: copy.columns.code, kind: "text", width: 16 },
      { key: "warehouse", header: copy.columns.warehouse, kind: "text", width: 25 },
      { key: "type", header: copy.columns.type, kind: "text", width: 18 },
      { key: "direction", header: copy.columns.direction, kind: "text", width: 12 },
      { key: "lot", header: copy.columns.lot, kind: "text", width: 20 },
      { key: "quantity", header: copy.columns.quantity, kind: "quantity", decimals: 3, width: 13 },
      { key: "unit", header: copy.columns.unit, kind: "text", width: 11 },
      { key: "unitCost", header: copy.columns.unitCost, kind: "currency", decimals: 4, width: 16 },
      { key: "totalCost", header: copy.columns.totalCost, kind: "currency", decimals: 2, width: 16 },
      { key: "reference", header: copy.columns.reference, kind: "text", width: 21 },
      { key: "performer", header: copy.columns.performer, kind: "text", width: 20 },
      { key: "reason", header: copy.columns.reason, kind: "text", width: 34 },
    ],
    rows: report.rows.map((row) => ({
      date: row.createdAt,
      item: row.itemName,
      code: row.internalCode || "—",
      warehouse: warehouseDisplay(row, language),
      type: copy.types[row.transactionType],
      direction: copy.directions[row.direction],
      lot: row.lotCode || "—",
      quantity: row.quantity,
      unit: row.unit || "—",
      unitCost: row.unitCost,
      totalCost: row.totalCost,
      reference: row.reference || "—",
      performer: row.performerName || "—",
      reason: row.reason || "—",
    })),
  };
}

export async function buildInventoryMovementExcel(filters: InventoryMovementFilters, language?: unknown) {
  const report = await loadInventoryMovementReport(filters);
  const definition = buildInventoryMovementExportDefinition(report, language);
  const generatedAt = new Date(report.generatedAt);
  const buffer = await buildReportExcel(definition);
  const filename = buildReportFilename(definition.sheetName || "inventory-movements", "xlsx", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export async function buildInventoryMovementPdf(filters: InventoryMovementFilters, language?: unknown) {
  const report = await loadInventoryMovementReport(filters);
  const definition = buildInventoryMovementExportDefinition(report, language);
  const generatedAt = new Date(report.generatedAt);
  const buffer = await buildReportPdf(definition);
  const filename = buildReportFilename(definition.sheetName || "inventory-movements", "pdf", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export async function buildInventoryMovementPrintHtml(filters: InventoryMovementFilters, language?: unknown) {
  const report = await loadInventoryMovementReport(filters);
  return buildReportHtml(buildInventoryMovementExportDefinition(report, language));
}
