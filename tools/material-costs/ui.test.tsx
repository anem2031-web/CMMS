import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({ enabled: true, error: null as any, summary: { issued: 45, returned: 15, net: 30, financialNet: 24, difference: 6, incomplete: 0 } }));
vi.mock("../../client/src/contexts/LanguageContext", () => ({ useLanguage: () => ({ language: "ar" }) }));
vi.mock("../../client/src/lib/trpc", () => ({ trpc: {
  catalog: { units: { list: { useQuery: () => ({ data: [{ id: 1, nameAr: "حبة", isActive: 1 }] }) } } },
  sites: { list: { useQuery: () => ({ data: [] }) } }, sections: { list: { useQuery: () => ({ data: [] }) } }, assets: { list: { useQuery: () => ({ data: [] }) } },
  materialCosts: {
    document: { useQuery: () => ({ data: { enabled: fixture.enabled, summary: fixture.summary, rows: [] }, error: fixture.error, refetch: vi.fn() }) },
    report: { useQuery: () => ({ data: { enabled: fixture.enabled, summary: fixture.summary, rows: [], groups: [], total: 0 }, error: fixture.error, refetch: vi.fn() }) },
  },
} }));
import { ReceiptConversionFields } from "../../client/src/components/inventory/ReceiptConversionFields";
import { MaterialCostPanel, MaterialCostTotals } from "../../client/src/components/inventory/MaterialCostPanel";
import MaterialExecutionCostReport from "../../client/src/pages/reports/MaterialExecutionCostReport";
it("conversion starts at zero with explicit error and never fabricates a stock preview", () => {
  const html = renderToStaticMarkup(<ReceiptConversionFields item={{ purchaseUnit: "كرتون", receivedQuantity: 2, conversionFactor: 0, unitCost: "300" }} onChange={() => {}} />);
  expect(html).toContain("معامل التحويل صفر"); expect(html).toContain('value="0"'); expect(html).not.toContain("سيُضاف عند الاعتماد");
});
it("confirmed receipt inputs preview both converted stock and lot price", () => {
  const html = renderToStaticMarkup(<ReceiptConversionFields item={{ purchaseUnit: "كرتون", issueUnit: "حبة", receivedQuantity: 2, conversionFactor: 20, unitCost: "300" }} onChange={() => {}} />);
  expect(html).toContain("40 حبة"); expect(html).toContain("15.0000"); expect(html).toContain("قبل الضريبة");
});
it("financial comparison is explicitly labeled separately from net lot material cost", () => {
  const html = renderToStaticMarkup(<MaterialCostTotals summary={fixture.summary} />);
  expect(html).toContain("صافي تكلفة المواد"); expect(html).toContain("30.00"); expect(html).toContain("24.00"); expect(html).toContain("فرق أساس التكلفة");
});
it("unknown financial/lot amounts are visibly incomplete, not rendered as an authoritative zero", () => {
  const html = renderToStaticMarkup(<MaterialCostTotals summary={{ ...fixture.summary, financialNet: null, difference: null, incomplete: 1 }} />);
  expect(html).toContain("غير مكتمل"); expect(html).toContain("ليس تكلفة مكتملة");
});
it("document panel hides while feature is not installed and renders a source cost view when enabled", () => {
  fixture.enabled = false; expect(renderToStaticMarkup(<MaterialCostPanel source="ticket" id={1} />)).toBe("");
  fixture.enabled = true; expect(renderToStaticMarkup(<MaterialCostPanel source="pmv2" id={1} />)).toContain("صافي تكلفة مواد التنفيذ حسب اللوت");
});
it("report exposes independent location/section/asset grouping and excludes historical migration", () => {
  const html = renderToStaticMarkup(<MaterialExecutionCostReport />);
  expect(html).toContain("الفترة حسب تاريخ كل حركة"); expect(html).toContain("السجلات القديمة مؤجلة"); expect(html).toContain("لا توجد حركات ضمن الطبقة الجديدة");
});
