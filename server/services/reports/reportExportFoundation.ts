import ExcelJS from "exceljs";
import { htmlToPdf } from "../pdf/htmlToPdfService";

export type ReportDirection = "rtl" | "ltr";
export type ReportColumnKind = "text" | "number" | "quantity" | "currency" | "date" | "datetime";
export type ReportCellValue = string | number | boolean | Date | null | undefined;

export interface ReportFilterSummaryItem {
  label: string;
  value: string;
}

export interface ReportExportColumn<Row extends Record<string, any>> {
  key: keyof Row & string;
  header: string;
  kind?: ReportColumnKind;
  width?: number;
  decimals?: number;
  align?: "start" | "center" | "end";
}

export interface ReportExportDefinition<Row extends Record<string, any>> {
  title: string;
  sheetName?: string;
  generatedAt?: Date;
  direction?: ReportDirection;
  locale?: string;
  currencyLabel?: string;
  filters?: ReportFilterSummaryItem[];
  columns: ReportExportColumn<Row>[];
  rows: Row[];
  orientation?: "portrait" | "landscape";
  emptyMessage?: string;
  generatedAtLabel?: string;
  filtersLabel?: string;
}


export function buildReportFilename(baseName: string, extension: "xlsx" | "pdf", generatedAt = new Date()) {
  const stamp = [
    generatedAt.getFullYear(),
    String(generatedAt.getMonth() + 1).padStart(2, "0"),
    String(generatedAt.getDate()).padStart(2, "0"),
  ].join("-");
  const safeBase = baseName.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim() || "report";
  return `${safeBase}-${stamp}.${extension}`;
}

/** RFC 5987-compatible attachment header so Arabic/Urdu filenames survive mixed-language browsers. */
export function buildReportContentDisposition(filename: string) {
  const asciiFallback = filename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

const HEADER_FILL = "FF1B7A4A";
const HEADER_TEXT = "FFFFFFFF";
const TITLE_TEXT = "FF153B2B";
const BORDER_COLOR = "FFD9E2DD";
const ALT_ROW_FILL = "FFF7FAF8";


function defaultReportCopy(locale: string, direction: ReportDirection) {
  const language = locale.toLowerCase().split("-")[0];
  if (language === "ur") {
    return {
      generatedAt: "رپورٹ بنانے کا وقت",
      filters: "استعمال شدہ فلٹرز",
      noFilters: "کوئی اضافی فلٹر نہیں",
      empty: "اس رپورٹ کے لیے کوئی ڈیٹا نہیں",
      footer: "CMMS - انوینٹری رپورٹ",
    };
  }
  if (language === "en" || direction === "ltr") {
    return {
      generatedAt: "Report generated at",
      filters: "Applied filters",
      noFilters: "No additional filters",
      empty: "No data matches this report",
      footer: "CMMS - Inventory Report",
    };
  }
  return {
    generatedAt: "تاريخ ووقت إنشاء التقرير",
    filters: "الفلاتر المستخدمة",
    noFilters: "بدون فلاتر إضافية",
    empty: "لا توجد بيانات مطابقة للتقرير",
    footer: "CMMS - تقرير مخزني",
  };
}

function sanitizeSheetName(value: string) {
  const sanitized = value.replace(/[\\/?*\[\]:]/g, " ").trim() || "Report";
  return sanitized.slice(0, 31);
}

function asDate(value: ReportCellValue): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeExcelValue(value: ReportCellValue, kind: ReportColumnKind): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (kind === "date" || kind === "datetime") return asDate(value) ?? String(value);
  if (kind === "number" || kind === "quantity" || kind === "currency") {
    const numberValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numberValue) ? numberValue : String(value);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value;
  return String(value);
}

function excelNumberFormat(column: ReportExportColumn<any>, currencyLabel: string) {
  const decimals = column.decimals ?? (column.kind === "quantity" ? 3 : column.kind === "currency" ? 2 : 2);
  const decimalPart = decimals > 0 ? `.${"0".repeat(decimals)}` : "";
  if (column.kind === "currency") return `#,##0${decimalPart} "${currencyLabel.replace(/"/g, "")}"`;
  if (column.kind === "number" || column.kind === "quantity") return `#,##0${decimalPart}`;
  if (column.kind === "date") return "yyyy-mm-dd";
  if (column.kind === "datetime") return "yyyy-mm-dd hh:mm";
  return undefined;
}

function horizontalAlignment(column: ReportExportColumn<any>, direction: ReportDirection): "left" | "center" | "right" {
  if (column.align === "center") return "center";
  if (column.align === "start") return direction === "rtl" ? "right" : "left";
  if (column.align === "end") return direction === "rtl" ? "left" : "right";
  if (["number", "quantity", "currency"].includes(column.kind || "")) return direction === "rtl" ? "left" : "right";
  return direction === "rtl" ? "right" : "left";
}

/**
 * Shared .xlsx foundation for Main Phase 6 reports.
 * Report-specific code supplies already-authorized rows and the exact active filter context.
 */
export async function buildReportExcel<Row extends Record<string, any>>(
  definition: ReportExportDefinition<Row>,
): Promise<Buffer> {
  const direction = definition.direction ?? "rtl";
  const generatedAt = definition.generatedAt ?? new Date();
  const locale = definition.locale ?? (direction === "rtl" ? "ar-SA" : "en-US");
  const currencyLabel = definition.currencyLabel ?? "SAR";
  const copy = defaultReportCopy(locale, direction);
  const filters = (definition.filters || []).filter((item) => item.value.trim().length > 0);
  const columns = definition.columns;
  if (!columns.length) throw new Error("Report export requires at least one column");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CMMS";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  const worksheet = workbook.addWorksheet(sanitizeSheetName(definition.sheetName || definition.title), {
    views: [{ rightToLeft: direction === "rtl" }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: definition.orientation || (columns.length > 7 ? "landscape" : "portrait"),
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });

  const lastColumn = Math.max(columns.length, 1);
  worksheet.mergeCells(1, 1, 1, lastColumn);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = definition.title;
  titleCell.font = { bold: true, size: 16, color: { argb: TITLE_TEXT } };
  titleCell.alignment = { horizontal: direction === "rtl" ? "right" : "left", vertical: "middle" };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(2, 1, 2, lastColumn);
  const generatedCell = worksheet.getCell(2, 1);
  const generatedLabel = definition.generatedAtLabel || copy.generatedAt;
  generatedCell.value = `${generatedLabel}: ${new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(generatedAt)}`;
  generatedCell.font = { size: 10, color: { argb: "FF64748B" } };
  generatedCell.alignment = { horizontal: direction === "rtl" ? "right" : "left", vertical: "middle" };

  worksheet.mergeCells(3, 1, 3, lastColumn);
  const filterCell = worksheet.getCell(3, 1);
  const filterLabel = definition.filtersLabel || copy.filters;
  const filterSummary = filters.length
    ? filters.map((item) => `${item.label}: ${item.value}`).join(" | ")
    : copy.noFilters;
  filterCell.value = `${filterLabel}: ${filterSummary}`;
  filterCell.font = { size: 10, color: { argb: "FF64748B" } };
  filterCell.alignment = { horizontal: direction === "rtl" ? "right" : "left", vertical: "middle", wrapText: true };
  worksheet.getRow(3).height = filters.length > 3 ? 32 : 20;

  const headerRowNumber = 5;
  const headerRow = worksheet.getRow(headerRowNumber);
  headerRow.values = columns.map((column) => column.header);
  headerRow.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  headerRow.height = 30;

  columns.forEach((column, index) => {
    const worksheetColumn = worksheet.getColumn(index + 1);
    worksheetColumn.width = Math.min(Math.max(column.width ?? 16, 10), 42);
  });

  for (const [rowIndex, row] of definition.rows.entries()) {
    const excelRow = worksheet.addRow(
      columns.map((column) => normalizeExcelValue(row[column.key], column.kind ?? "text")),
    );
    excelRow.height = 22;
    if (rowIndex % 2 === 1) {
      excelRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT_ROW_FILL } };
    }
    columns.forEach((column, index) => {
      const cell = excelRow.getCell(index + 1);
      const numFmt = excelNumberFormat(column, currencyLabel);
      if (numFmt) cell.numFmt = numFmt;
      cell.alignment = {
        horizontal: horizontalAlignment(column, direction),
        vertical: "middle",
        wrapText: column.kind === "text",
      };
      cell.border = {
        bottom: { style: "hair", color: { argb: BORDER_COLOR } },
      };
    });
  }

  const lastDataRow = Math.max(headerRowNumber, worksheet.rowCount);
  worksheet.autoFilter = {
    from: { row: headerRowNumber, column: 1 },
    to: { row: lastDataRow, column: lastColumn },
  };
  worksheet.views = [{
    state: "frozen",
    ySplit: headerRowNumber,
    activeCell: `A${headerRowNumber + 1}`,
    rightToLeft: direction === "rtl",
  }];

  worksheet.headerFooter.oddFooter = copy.footer;

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function htmlCellValue(value: ReportCellValue, column: ReportExportColumn<any>, locale: string, currencyLabel: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (column.kind === "date" || column.kind === "datetime") {
    const date = asDate(value);
    if (!date) return escapeHtml(value);
    return escapeHtml(new Intl.DateTimeFormat(locale, column.kind === "date"
      ? { dateStyle: "medium" }
      : { dateStyle: "medium", timeStyle: "short" }).format(date));
  }
  if (["number", "quantity", "currency"].includes(column.kind || "")) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return escapeHtml(value);
    const decimals = column.decimals ?? (column.kind === "quantity" ? 3 : column.kind === "currency" ? 2 : 2);
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: column.kind === "currency" ? 2 : 0,
      maximumFractionDigits: decimals,
    }).format(numeric);
    return escapeHtml(column.kind === "currency" ? `${formatted} ${currencyLabel}` : formatted);
  }
  return escapeHtml(value);
}

/** Shared print/PDF HTML template for Phase 6 reports. */
export function buildReportHtml<Row extends Record<string, any>>(
  definition: ReportExportDefinition<Row>,
): string {
  const direction = definition.direction ?? "rtl";
  const generatedAt = definition.generatedAt ?? new Date();
  const locale = definition.locale ?? (direction === "rtl" ? "ar-SA" : "en-US");
  const currencyLabel = definition.currencyLabel ?? "SAR";
  const copy = defaultReportCopy(locale, direction);
  const filters = (definition.filters || []).filter((item) => item.value.trim().length > 0);
  const generatedLabel = definition.generatedAtLabel || copy.generatedAt;
  const filterLabel = definition.filtersLabel || copy.filters;
  const noFilters = copy.noFilters;
  const emptyMessage = definition.emptyMessage || copy.empty;
  const orientation = definition.orientation || (definition.columns.length > 7 ? "landscape" : "portrait");

  const filterHtml = filters.length
    ? filters.map((filter) => `<span class="filter"><strong>${escapeHtml(filter.label)}:</strong> <bdi>${escapeHtml(filter.value)}</bdi></span>`).join("")
    : `<span class="filter">${escapeHtml(noFilters)}</span>`;

  const rowsHtml = definition.rows.length
    ? definition.rows.map((row) => `<tr>${definition.columns.map((column) => {
        const numeric = ["number", "quantity", "currency"].includes(column.kind || "");
        const align = column.align || (numeric ? "end" : "start");
        return `<td class="align-${align}${numeric ? " numeric" : ""}" dir="auto"><bdi>${htmlCellValue(row[column.key], column, locale, currencyLabel)}</bdi></td>`;
      }).join("")}</tr>`).join("")
    : `<tr><td class="empty" colspan="${Math.max(definition.columns.length, 1)}">${escapeHtml(emptyMessage)}</td></tr>`;

  return `<!doctype html>
<html lang="${escapeHtml(locale.split("-")[0])}" dir="${direction}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(definition.title)}</title>
<style>
  @page { size: A4 ${orientation}; margin: 15mm 12mm 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #17211b; }
  body { font-family: "IBM Plex Sans Arabic", "Noto Sans Arabic", "Noto Sans", Arial, sans-serif; font-size: 10.5px; line-height: 1.55; direction: ${direction}; }
  .report-header { border-bottom: 2px solid #1b7a4a; padding-bottom: 10px; margin-bottom: 12px; }
  h1 { margin: 0 0 6px; font-size: 20px; color: #153b2b; }
  .meta { color: #64748b; font-size: 9.5px; }
  .filters { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 8px; padding: 7px 9px; background: #f7faf8; border: 1px solid #d9e2dd; border-radius: 6px; }
  .filter { unicode-bidi: plaintext; }
  .table-wrap { width: 100%; }
  table { border-collapse: collapse; width: 100%; table-layout: auto; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { background: #1b7a4a; color: #fff; font-weight: 700; padding: 7px 6px; border: 1px solid #17663f; text-align: center; vertical-align: middle; }
  td { padding: 6px; border-bottom: 1px solid #d9e2dd; vertical-align: top; unicode-bidi: plaintext; }
  tbody tr:nth-child(even) td { background: #f7faf8; }
  .align-start { text-align: ${direction === "rtl" ? "right" : "left"}; }
  .align-end { text-align: ${direction === "rtl" ? "left" : "right"}; }
  .align-center { text-align: center; }
  .numeric { white-space: nowrap; font-variant-numeric: tabular-nums; direction: ltr; }
  .empty { text-align: center; padding: 24px; color: #64748b; }
  bdi { unicode-bidi: isolate; }
  .report-footer { margin-top: 10px; color: #94a3b8; font-size: 8.5px; text-align: center; }
</style>
</head>
<body>
  <header class="report-header">
    <h1>${escapeHtml(definition.title)}</h1>
    <div class="meta">${escapeHtml(generatedLabel)}: <bdi>${escapeHtml(new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(generatedAt))}</bdi></div>
    <div class="filters"><strong>${escapeHtml(filterLabel)}:</strong>${filterHtml}</div>
  </header>
  <main class="table-wrap">
    <table>
      <thead><tr>${definition.columns.map((column) => `<th>${escapeHtml(column.header)}</th>`).join("")}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </main>
  <footer class="report-footer">CMMS</footer>
</body>
</html>`;
}

/** Uses the existing shared Chromium renderer; no separate PDF stack is introduced. */
export async function buildReportPdf<Row extends Record<string, any>>(
  definition: ReportExportDefinition<Row>,
): Promise<Buffer> {
  return htmlToPdf(buildReportHtml(definition));
}
