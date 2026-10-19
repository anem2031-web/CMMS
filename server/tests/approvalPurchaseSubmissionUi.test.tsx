import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ar from "../../client/src/i18n/ar";

const state = vi.hoisted(() => ({ role: "accountant", approved: false, status: "pending_accounting" }));
vi.mock("../../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 44, role: state.role, isActive: 1 } }) }));
vi.mock("../../client/src/contexts/LanguageContext", () => ({ useTranslation: () => ({ t: ar, language: "ar", dir: "rtl" }) }));
vi.mock("../../client/src/hooks/useContentTranslation", () => ({
  useStaticLabels: () => ({}), useBatchTranslation: () => ({ translationsMap: {} }), useEntityTranslation: () => ({ translations: {} }),
  getLocalizedItemField: (item: any, field: string) => item[field],
}));
vi.mock("wouter", () => ({ useLocation: () => ["", vi.fn()], useRoute: () => [true, { id: "1" }] }));
vi.mock("../../client/src/lib/trpc", () => {
  const proxy = (path = ""): any => new Proxy(() => {}, { get(_target, key) {
    if (key === "useUtils") return () => proxy("utils");
    if (key === "useMutation") return () => ({ isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() });
    if (key === "useQuery") return () => ({ isLoading: false, data: path === "purchasePackages.submissions" ? [{
      id: 8, subNumber: 1, status: state.status, pdfAllowed: !["accountant", "senior_management"].includes(state.role) || state.approved,
      batches: [{ id: 10, purchaseOrderId: 101, poNumber: "PR-TEST-101", itemCount: 1, status: state.status, totalEstimatedCost: "50",
        items: [{ id: 12, itemName: "Structured review material", quantity: "2", unit: "قطعة", estimatedTotalCost: "50", status: "estimated" }] }],
    }] : [] });
    return proxy(path ? `${path}.${String(key)}` : String(key));
  } });
  return { trpc: proxy() };
});
import { PackageSubmissions } from "../../client/src/pages/purchase/PurchaseBatchDetail";

describe("Actual package submission PDF controls", () => {
  beforeEach(() => { state.role = "accountant"; state.approved = false; state.status = "pending_accounting"; });
  it.each(["accountant", "senior_management"])("allows %s structured review but withholds the official PDF before own approval", role => {
    state.role = role; state.status = role === "accountant" ? "pending_accounting" : "pending_management";
    const html = renderToStaticMarkup(<PackageSubmissions packageId={2} packageNumber="PB-TEST" />);
    expect(html).toContain("Structured review material");
    expect(html).toContain("PR-TEST-101");
    expect(html).not.toContain(ar.workflow.purchase.exportBatchPdf);
    expect(html).toContain(role === "accountant" ? ar.workflow.purchase.approveSendManagement : ar.workflow.purchase.approveBatch);
  });
  it.each(["accountant", "senior_management"])("shows the official PDF after server confirms %s own approval", role => {
    state.role = role; state.status = "approved"; state.approved = true;
    expect(renderToStaticMarkup(<PackageSubmissions packageId={2} packageNumber="PB-TEST" />)).toContain(ar.workflow.purchase.exportBatchPdf);
  });
  it.each(["delegate", "admin", "owner"])("preserves %s official submission export", role => {
    state.role = role;
    expect(renderToStaticMarkup(<PackageSubmissions packageId={2} packageNumber="PB-TEST" />)).toContain(ar.workflow.purchase.exportBatchPdf);
  });
  it("keeps observer review without a PDF export", () => {
    state.role = "observer"; state.approved = true;
    expect(renderToStaticMarkup(<PackageSubmissions packageId={2} packageNumber="PB-TEST" />)).not.toContain(ar.workflow.purchase.exportBatchPdf);
  });
});
