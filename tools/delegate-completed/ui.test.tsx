import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi } from "vitest";
const ui = vi.hoisted(() => ({ language: "ar", data: null as any, loading: false, error: null as any, query: vi.fn() }));
vi.mock("../../client/src/contexts/LanguageContext", () => ({ useTranslation: () => ({ language: ui.language }) }));
vi.mock("../../client/src/lib/trpc", () => ({ trpc: { purchaseOrders: { completedItems: { useQuery: (...args: any[]) => { ui.query(...args); return { data: ui.data, isLoading: ui.loading, error: ui.error, refetch: vi.fn() }; } } } } }));
vi.mock("wouter", () => ({ Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a> }));
import { DelegateCompletedItems, completedLabels } from "../../client/src/components/purchase/DelegateCompletedItems";
describe("completed items read-only UI", () => {
  it.each(["ar","en","ur"] as const)("shows receipt and scoped detail link in %s", language => {
    ui.language = language; ui.loading = false; ui.error = null;
    ui.data = { total: 21, items: [{ id: 1, purchaseOrderId: 7, poNumber: "PR7", itemName: "Completed item", quantity: 2, unit: "piece", receivedAt: "2026-10-27" }] };
    const html = renderToStaticMarkup(<DelegateCompletedItems />);
    expect(html).toContain(completedLabels[language].received); expect(html).toContain("Completed item");
    expect(html).toContain("/purchase-orders/7?itemId=1&amp;source=supply");
    expect(ui.query).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, search: "" }, expect.any(Object));
    expect(html).not.toContain("confirmItemPurchase");
  });
  it("shows failures instead of reporting an empty successful list", () => {
    ui.language = "en"; ui.error = { message: "Unavailable" }; ui.data = null;
    const html = renderToStaticMarkup(<DelegateCompletedItems />);
    expect(html).toContain('role="alert"'); expect(html).toContain("Unavailable"); expect(html).not.toContain("No matching");
  });
  it("shows the empty state with navigation disabled", () => {
    ui.error = null; ui.data = { items: [], total: 0 }; ui.language = "en";
    const html = renderToStaticMarkup(<DelegateCompletedItems />);
    expect(html).toContain("No matching completed items"); expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
