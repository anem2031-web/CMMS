import {
  buildReportExcel,
  buildReportFilename,
  buildReportHtml,
  buildReportPdf,
  buildReportContentDisposition,
  type ReportExportDefinition,
} from "./reportExportFoundation";

type SupportedLanguage = "ar" | "en" | "ur";

type PreviewRow = {
  section: string;
  phase: string;
  status: string;
  purpose: string;
};

const COPY: Record<SupportedLanguage, {
  locale: string;
  direction: "rtl" | "ltr";
  title: string;
  sheetName: string;
  columns: { section: string; phase: string; status: string; purpose: string };
  rows: PreviewRow[];
}> = {
  ar: {
    locale: "ar-SA",
    direction: "rtl",
    title: "مركز التقارير المخزنية - معاينة أساس التقارير",
    sheetName: "مركز التقارير",
    columns: { section: "القسم", phase: "المرحلة", status: "الحالة", purpose: "الغرض" },
    rows: [
      { section: "الرصيد والحالة", phase: "6.2", status: "مغلق رسميًا", purpose: "عرض الرصيد الحالي والحالة والحدود التي تحتاج متابعة." },
      { section: "الحركات والتتبع", phase: "6.2", status: "مغلق رسميًا", purpose: "عرض الاستلام والصرف والمرتجعات والتحويلات والتسويات من مكان واحد." },
      { section: "القيمة والمحاسبة", phase: "6.3", status: "مغلق رسميًا", purpose: "عرض قيمة المخزون وتوزيعها دون تغيير آلية التقييم أو الترحيل." },
      { section: "التحليل والتخطيط", phase: "6.4", status: "مغلق رسميًا", purpose: "الحركة البطيئة والراكد وABC والأعمار ومعدل الدوران." },
    ],
  },
  en: {
    locale: "en-US",
    direction: "ltr",
    title: "Inventory Reports Center - Reporting Foundation Preview",
    sheetName: "Reports Center",
    columns: { section: "Section", phase: "Phase", status: "Status", purpose: "Purpose" },
    rows: [
      { section: "Balance & Status", phase: "6.2", status: "Officially closed", purpose: "Current stock balance, status, and thresholds that need attention." },
      { section: "Movements & Tracking", phase: "6.2", status: "Officially closed", purpose: "Receipts, issues, returns, transfers, and adjustments in one reporting area." },
      { section: "Valuation & Accounting", phase: "6.3", status: "Officially closed", purpose: "Inventory value and distribution without changing valuation or posting behavior." },
      { section: "Analytics & Planning", phase: "6.4", status: "Officially closed", purpose: "Slow moving, dead stock, ABC, aging, and turnover." },
    ],
  },
  ur: {
    locale: "ur-PK",
    direction: "rtl",
    title: "انوینٹری رپورٹس مرکز - رپورٹنگ بنیاد پیش منظر",
    sheetName: "رپورٹس مرکز",
    columns: { section: "حصہ", phase: "مرحلہ", status: "حالت", purpose: "مقصد" },
    rows: [
      { section: "بیلنس اور حالت", phase: "6.2", status: "باضابطہ بند", purpose: "موجودہ اسٹاک بیلنس، حالت اور توجہ طلب حدود دکھانا۔" },
      { section: "حرکات اور ٹریکنگ", phase: "6.2", status: "باضابطہ بند", purpose: "وصولی، اجرا، واپسی، منتقلی اور ایڈجسٹمنٹ ایک جگہ دکھانا۔" },
      { section: "قدر اور اکاؤنٹنگ", phase: "6.3", status: "باضابطہ بند", purpose: "ویلیوایشن یا پوسٹنگ طریقہ بدلے بغیر انوینٹری قدر دکھانا۔" },
      { section: "تجزیہ اور منصوبہ بندی", phase: "6.4", status: "باضابطہ بند", purpose: "سست حرکت، ڈیڈ اسٹاک، ABC، عمر اور ٹرن اوور۔" },
    ],
  },
};

function resolveLanguage(value: unknown): SupportedLanguage {
  const raw = String(value || "ar").toLowerCase();
  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("ur")) return "ur";
  return "ar";
}

export function buildReportsCenterPreviewDefinition(languageValue?: unknown): ReportExportDefinition<PreviewRow> {
  const language = resolveLanguage(languageValue);
  const copy = COPY[language];
  return {
    title: copy.title,
    sheetName: copy.sheetName,
    locale: copy.locale,
    direction: copy.direction,
    orientation: "landscape",
    filters: [],
    columns: [
      { key: "section", header: copy.columns.section, kind: "text", width: 24 },
      { key: "phase", header: copy.columns.phase, kind: "text", width: 12, align: "center" },
      { key: "status", header: copy.columns.status, kind: "text", width: 24 },
      { key: "purpose", header: copy.columns.purpose, kind: "text", width: 54 },
    ],
    rows: copy.rows,
  };
}

export async function buildReportsCenterPreviewExcel(language?: unknown) {
  const definition = buildReportsCenterPreviewDefinition(language);
  const generatedAt = new Date();
  const buffer = await buildReportExcel({ ...definition, generatedAt });
  const filename = buildReportFilename(definition.sheetName || "inventory-reports", "xlsx", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export async function buildReportsCenterPreviewPdf(language?: unknown) {
  const definition = buildReportsCenterPreviewDefinition(language);
  const generatedAt = new Date();
  const buffer = await buildReportPdf({ ...definition, generatedAt });
  const filename = buildReportFilename(definition.sheetName || "inventory-reports", "pdf", generatedAt);
  return { buffer, filename, contentDisposition: buildReportContentDisposition(filename) };
}

export function buildReportsCenterPreviewPrintHtml(language?: unknown) {
  const definition = buildReportsCenterPreviewDefinition(language);
  return buildReportHtml({ ...definition, generatedAt: new Date() });
}
