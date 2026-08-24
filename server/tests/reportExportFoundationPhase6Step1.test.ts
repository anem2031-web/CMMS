import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  buildReportContentDisposition,
  buildReportExcel,
  buildReportFilename,
  buildReportHtml,
} from "../services/reports/reportExportFoundation";

const definition = {
  title: "تقرير مخزون تجريبي",
  sheetName: "مخزون",
  generatedAt: new Date("2026-08-23T10:00:00.000Z"),
  direction: "rtl" as const,
  locale: "ar-SA",
  currencyLabel: "ر.س",
  filters: [
    { label: "المخزن", value: "المخزن الرئيسي" },
    { label: "الفترة", value: "2026-08-01 — 2026-08-23" },
  ],
  columns: [
    { key: "item", header: "الصنف", kind: "text" as const, width: 28 },
    { key: "code", header: "الكود", kind: "text" as const, width: 18 },
    { key: "quantity", header: "الكمية", kind: "quantity" as const, decimals: 3 },
    { key: "value", header: "القيمة", kind: "currency" as const, decimals: 2 },
    { key: "createdAt", header: "التاريخ", kind: "datetime" as const, width: 20 },
  ],
  rows: [
    {
      item: "دهان Test 20L",
      code: "LOT-2026-ABC123",
      quantity: 5.25,
      value: 125.5,
      createdAt: new Date("2026-08-23T09:30:00.000Z"),
    },
  ],
};

describe("Main Phase 6.1 report export foundation", () => {
  it("creates a structured RTL XLSX with typed numeric/date cells", async () => {
    const buffer = await buildReportExcel(definition);
    expect(buffer.length).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet("مخزون");
    expect(sheet).toBeTruthy();
    expect(sheet!.views[0]?.rightToLeft).toBe(true);
    expect(sheet!.getCell("A1").value).toBe("تقرير مخزون تجريبي");
    expect(String(sheet!.getCell("A3").value)).toContain("المخزن الرئيسي");
    expect(sheet!.getCell("C6").value).toBe(5.25);
    expect(sheet!.getCell("D6").value).toBe(125.5);
    expect(sheet!.getCell("E6").value).toBeInstanceOf(Date);
    expect(sheet!.autoFilter).toBeTruthy();
  });

  it("renders print/PDF HTML as RTL while preserving mixed Arabic/Latin source values", () => {
    const html = buildReportHtml(definition);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("LOT-2026-ABC123");
    expect(html).toContain("دهان Test 20L");
    expect(html).toContain("المخزن الرئيسي");
    expect(html).toContain("thead { display: table-header-group; }");
  });

  it("keeps Unicode report filenames safe for HTTP downloads", () => {
    const filename = buildReportFilename("تقرير رصيد المخزون", "xlsx", new Date("2026-08-23T10:00:00Z"));
    expect(filename).toContain("تقرير رصيد المخزون-2026-08-23.xlsx");
    const disposition = buildReportContentDisposition(filename);
    expect(disposition).toContain("filename*=UTF-8''");
    expect(disposition).toContain(encodeURIComponent(filename));
  });

  it("escapes source text instead of injecting it into the PDF/print template", () => {
    const html = buildReportHtml({
      ...definition,
      rows: [{ ...definition.rows[0], item: '<script>alert("x")</script>' }],
    });
    expect(html).not.toContain('<script>alert("x")</script>');
    expect(html).toContain("&lt;script&gt;");
  });
});
