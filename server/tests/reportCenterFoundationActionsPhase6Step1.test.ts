import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  buildReportsCenterPreviewDefinition,
  buildReportsCenterPreviewExcel,
  buildReportsCenterPreviewPrintHtml,
} from "../services/reports/reportsCenterFoundationPreview";

describe("Main Phase 6.1 reports-center functional actions", () => {
  it("builds the Arabic preview using the four approved report groups", () => {
    const definition = buildReportsCenterPreviewDefinition("ar");
    expect(definition.direction).toBe("rtl");
    expect(definition.rows).toHaveLength(4);
    expect(definition.rows.map((row) => row.phase)).toEqual(["6.2", "6.2", "6.3", "6.4"]);
    expect(definition.rows[3].status).toContain("مؤجل");
  });

  it("generates a real structured XLSX for the foundation runtime preview", async () => {
    const { buffer, filename, contentDisposition } = await buildReportsCenterPreviewExcel("ar");
    expect(filename.endsWith(".xlsx")).toBe(true);
    expect(contentDisposition).toContain("filename*=UTF-8''");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];
    expect(worksheet.views[0]?.rightToLeft).toBe(true);
    expect(worksheet.getRow(5).getCell(1).value).toBe("القسم");
    expect(worksheet.rowCount).toBeGreaterThanOrEqual(9);
  });

  it("builds printable RTL HTML without translating mixed phase codes", () => {
    const html = buildReportsCenterPreviewPrintHtml("ar");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("الرصيد والحالة");
    expect(html).toContain("6.2");
    expect(html).toContain("6.4");
  });
});
