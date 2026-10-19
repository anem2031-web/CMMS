import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ar from "../../client/src/i18n/ar";
import en from "../../client/src/i18n/en";
import ur from "../../client/src/i18n/ur";

const fixture = vi.hoisted(() => ({
  language: "ar",
  queries: {} as Record<string, any>,
  options: {} as Record<string, any>,
  retry: null as any,
}));

vi.mock("../../client/src/lib/trpc", () => ({
  trpc: { catalog: Object.fromEntries(["nodes", "items", "units"].map(name => [name, {
    list: { useQuery: (_input: any, options: any) => {
      fixture.options[name] = options;
      return fixture.queries[name];
    } },
  }])) },
}));
vi.mock("../../client/src/contexts/LanguageContext", () => ({
  useTranslation: () => ({ language: fixture.language, t: { ar, en, ur }[fixture.language as "ar" | "en" | "ur"], dir: "rtl", isRTL: true }),
}));
vi.mock("../../client/src/components/ui/dialog", () => ({
  useDialogComposition: () => ({ justEndedComposing: () => false, setComposing: () => {}, markCompositionEnd: () => {} }),
  Dialog: ({ children }: any) => React.createElement("div", null, children),
  DialogContent: ({ children }: any) => React.createElement("div", null, children),
  DialogHeader: ({ children }: any) => React.createElement("div", null, children),
  DialogTitle: ({ children }: any) => React.createElement("h2", null, children),
}));
vi.mock("../../client/src/components/ui/button", () => ({
  Button: ({ children, onClick, disabled }: any) => {
    fixture.retry = { onClick, disabled };
    return React.createElement("button", { disabled }, children);
  },
}));
import { CatalogPickerDialog } from "../../client/src/components/catalog/CatalogPickerDialog";

const item = { id: 1, nameAr: "مصباح اختبار", nameEn: "Test lamp", unit: "قطعة" };
const render = () => renderToStaticMarkup(React.createElement(CatalogPickerDialog, { open: true, onClose: vi.fn(), onSelect: vi.fn() }));
beforeEach(() => {
  fixture.language = "ar";
  fixture.options = {};
  fixture.retry = null;
  fixture.queries = Object.fromEntries(["nodes", "items", "units"].map(name => [name, {
    data: [], error: null, isFetching: false, refetch: vi.fn(async () => ({})),
  }]));
});

describe("Catalog picker loading failures", () => {
  it.each(["ar", "en", "ur"] as const)("shows a clear permission failure in %s rather than an empty catalog", language => {
    fixture.language = language;
    fixture.queries.items.error = { data: { code: "FORBIDDEN" }, message: "internal error details" };
    const html = render();
    const labels = { ar, en, ur }[language];
    expect(html).toContain('role="alert"');
    expect(html).toContain(labels.workflow.purchase.catalogAccessDenied);
    expect(html).not.toContain(labels.common.noData);
    expect(html).not.toContain("internal error details");
    expect(fixture.options.items.retry).toBe(false);
    expect(fixture.options.nodes.retry).toBe(false);
    expect(fixture.options.units.retry).toBe(false);
  });
  it("retries failed queries and displays returned items when the retry succeeds", async () => {
    fixture.queries.items.error = { data: { code: "INTERNAL_SERVER_ERROR" }, message: "Failed query: private SQL" };
    fixture.queries.items.refetch.mockImplementation(async () => {
      fixture.queries.items.data = [item];
      fixture.queries.items.error = null;
    });
    const html = render();
    expect(html).toContain(ar.workflow.purchase.catalogLoadFailed);
    expect(html).not.toContain("private SQL");
    fixture.retry.onClick();
    await Promise.resolve();
    expect(fixture.queries.items.refetch).toHaveBeenCalledOnce();
    expect(fixture.queries.nodes.refetch).not.toHaveBeenCalled();
    expect(fixture.queries.units.refetch).not.toHaveBeenCalled();
    const recovered = render();
    expect(recovered).toContain(item.nameAr);
    expect(recovered).not.toContain('role="alert"');
  });
  it("keeps available items visible when only categories or unit labels fail", () => {
    fixture.queries.items.data = [item];
    fixture.queries.nodes.error = new Error("offline");
    fixture.queries.units.error = new Error("offline");
    const html = render();
    expect(html).toContain(item.nameAr);
    expect(html).toContain(ar.workflow.purchase.catalogLoadFailed);
    fixture.retry.onClick();
    expect(fixture.queries.nodes.refetch).toHaveBeenCalledOnce();
    expect(fixture.queries.units.refetch).toHaveBeenCalledOnce();
    expect(fixture.queries.items.refetch).not.toHaveBeenCalled();
  });
  it("disables repeated retry clicks while a query is loading", () => {
    fixture.queries.items.error = new Error("offline");
    fixture.queries.items.isFetching = true;
    render();
    expect(fixture.retry.disabled).toBe(true);
  });
  it("still distinguishes a successful empty search from a loading failure", () => {
    const html = render();
    expect(html).toContain(ar.common.noData);
    expect(html).not.toContain('role="alert"');
  });
});
