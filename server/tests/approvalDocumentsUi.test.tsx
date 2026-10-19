import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { canOpenApprovalPdf } from "../../client/src/lib/approvalPdfAccess";

const state = vi.hoisted(() => ({ role: "accountant", approved: false, calls: [] as { path: string; enabled: boolean }[] }));
vi.mock("../../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 44, role: state.role, isActive: 1 } }) }));
vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));
vi.mock("@shared/delegate-pricing-bundles", () => ({ canReadPricingBundles: (user: any) => ["accountant", "senior_management", "owner", "admin", "observer", "delegate"].includes(user.role) }));
vi.mock("../../client/src/lib/printReceiptDocument", () => ({ buildReceiptHtml: vi.fn() }));
vi.mock("../../client/src/lib/printDeliveryDocument", () => ({ buildDeliveryReceiptHtml: vi.fn() }));
vi.mock("../../client/src/lib/printWarehouseIssueDocument", () => ({ buildWarehouseIssueHtml: vi.fn() }));
vi.mock("../../client/src/lib/printReturnDocument", () => ({ buildReturnDocumentHtml: vi.fn() }));
vi.mock("../../client/src/lib/printInventoryOperationDocuments", () => ({ buildDisposalHtml: vi.fn(), buildCountHtml: vi.fn(), buildSettlementHtml: vi.fn() }));
vi.mock("../../client/src/lib/exportHtmlToPdf", () => ({ viewDocumentAsPdf: vi.fn(), downloadDocumentAsPdf: vi.fn() }));
vi.mock("../../client/src/lib/downloadPricingBundlePdf", () => ({ downloadPricingBundlePdf: vi.fn() }));
vi.mock("../../client/src/lib/trpc", () => {
  const proxy = (path = ""): any => new Proxy(() => {}, { get(_target, key) {
    if (key === "useUtils") return () => proxy("utils");
    if (key === "useMutation") return () => ({ isPending: false, mutate: vi.fn() });
    if (key === "useQuery") return (input: any, options: any = {}) => {
      state.calls.push({ path, enabled: options.enabled !== false });
      const permission = { pdfAllowed: state.approved, pdfBlockedReason: state.approved ? null : "approval required" };
      const financial = { id: 10, fileName: "FINANCIAL.pdf", createdAt: "2026-10-19T07:00:00Z", delegateId: 9, delegateName: "Test delegate", totalEstimatedCost: "50", reviewUrl: "/purchase-orders/101", ...permission, ...(state.approved ? { fileUrl: "/api/media?key=financial" } : {}) };
      const pricing = { ...financial, id: 11, fileName: "PRICING.pdf" };
      const data = path === "delegatePricingBundles.status" ? { enabled: true }
        : path === "delegatePricingBundles.list" ? [{ id: 3, bundleNumber: "DPB-SENT-003", status: "archived", delegateId: 9, delegateName: "Test delegate", itemCount: 1, total: 50, createdAt: "2026-10-19T07:00:00Z", purchaseOrders: [{ id: 101, poNumber: "PR-101" }], ...permission }]
        : path === "attachments.listByType" ? input.entityType === "po_financial_batch" ? [financial] : [pricing]
        : path === "purchaseOrders.list" ? [{ id: 101, poNumber: "PR-101", createdAt: "2026-10-19T07:00:00Z", requestedByName: "Creator", ...permission }]
        : path === "inventoryCount.listOperations" ? [{ id: 23, operationNumber: "CNT-TEST-23", createdAt: "2026-10-19T07:00:00Z" }]
        : [];
      return { data: options.enabled === false ? undefined : data, isLoading: false, refetch: vi.fn(), error: null };
    };
    return proxy(path ? `${path}.${String(key)}` : String(key));
  } });
  return { trpc: proxy() };
});
import DocumentsCenter from "../../client/src/pages/DocumentsCenter";

describe("Approval document UI boundaries", () => {
  beforeEach(() => { state.role = "accountant"; state.approved = false; state.calls = []; });

  it("shows the accountant's three financial tabs and structured review while hiding all PDF actions before approval", () => {
    const html = renderToStaticMarkup(<DocumentsCenter />);
    for (const text of ["وثائق التسعير الصادرة من المندوبين", "الوثائق المالية المعتمدة", "حزم التسعير", "FINANCIAL.pdf", "PRICING.pdf", "DPB-SENT-003", "بيانات المعاملة"]) expect(html).toContain(text);
    expect(html).toContain('href="/purchase-orders/101"');
    expect(html).not.toContain('title="عرض PDF"');
    expect(html).not.toContain('title="تنزيل PDF"');
    expect(html).not.toContain(">طباعة<");
    expect(state.calls.filter(call => ["purchaseOrders.list", "warehouseReceipts.list", "inventoryCount.listOperations"].includes(call.path)).every(call => !call.enabled)).toBe(true);
    expect(state.calls.find(call => call.path === "delegatePricingBundles.list")?.enabled).toBe(true);
  });

  it("allows the accountant's archived PDF controls only after exact server permission", () => {
    state.approved = true;
    const html = renderToStaticMarkup(<DocumentsCenter />);
    expect(html).toContain('title="عرض PDF"');
    expect(html).toContain('title="تنزيل PDF"');
    expect(html).toContain(">طباعة<");
  });

  it("keeps senior-management inventory documents usable while financial PDFs await its approval", () => {
    state.role = "senior_management";
    const html = renderToStaticMarkup(<DocumentsCenter />);
    expect(html).toContain("CNT-TEST-23");
    expect((html.match(/title="عرض PDF"/g) || [])).toHaveLength(1);
    expect((html.match(/title="تنزيل PDF"/g) || [])).toHaveLength(1);
    expect(html).toContain("PDF متاح بعد اعتمادك");
  });

  it("keeps observer data review without export controls", () => {
    state.role = "observer"; state.approved = true;
    const html = renderToStaticMarkup(<DocumentsCenter />);
    expect(html).toContain("CNT-TEST-23");
    expect(html).not.toContain('title="عرض PDF"');
    expect(html).not.toContain('title="تنزيل PDF"');
    expect(html).not.toContain(">طباعة<");
  });

  it.each(["accountant", "senior_management"])("fails closed for %s on missing or explicitly blocked document permission", role => {
    expect(canOpenApprovalPdf(role)).toBe(false);
    expect(canOpenApprovalPdf(role, { pdfAllowed: false })).toBe(false);
    expect(canOpenApprovalPdf(role, { pdfAllowed: true })).toBe(true);
  });
  it.each(["delegate", "warehouse", "admin", "owner"])("preserves existing %s permissions and respects an explicit denial", role => {
    expect(canOpenApprovalPdf(role)).toBe(true);
    expect(canOpenApprovalPdf(role, { pdfAllowed: false })).toBe(false);
  });
  it("never opens a PDF for an observer even with an unexpected true flag", () => {
    expect(canOpenApprovalPdf("observer", { pdfAllowed: true })).toBe(false);
  });
});
