import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildDashboard, dashboardSummary, dashboardDetails } from "../../shared/dashboard-overview";
import { fixture as dataset, ticket, FILTERS, NOW } from "./fixture";
import { dashboardCopy } from "../../client/src/pages/dashboard/copy";
const state = vi.hoisted(() => ({
  role: "owner", language: "ar", hooks: [] as any[], index: 0,
  buttons: new Map<string, any>(), selects: new Map<string, any>(), calls: [] as any[],
  links: new Map<string, any>(), error: null as any, fetching: false, redirect: vi.fn(),
  snapshotId: "11111111-1111-4111-8111-111111111111", detailsLoading: false,
  data: null as any, refreshOverview: vi.fn(), refreshDetails: vi.fn(),
}));
function text(node: any): string {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(text).join("");
  return typeof node === "object" ? text(node.props?.children) : String(node);
}
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: (initial: any) => {
    const index = state.index++;
    if (!(index in state.hooks)) state.hooks[index] = typeof initial === "function" ? initial() : initial;
    return [state.hooks[index], (next: any) => { state.hooks[index] = typeof next === "function" ? next(state.hooks[index]) : next; }];
  } };
});
vi.mock("react/jsx-runtime", async original => {
  const actual = await original<typeof import("react/jsx-runtime")>();
  const capture = (factory: any) => (kind: any, props: any, key: any) => {
    if (kind === "button") state.buttons.set(props["aria-label"] || text(props.children).trim(), props);
    if (kind === "select") state.selects.set(props["aria-label"], props);
    if (kind === "a") state.links.set(text(props.children), props);
    return factory(kind, props, key);
  };
  return { ...actual, jsx: capture(actual.jsx), jsxs: capture(actual.jsxs) };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const actual = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...actual, jsxDEV: (...args: any[]) => {
    const [kind, props] = args;
    if (kind === "button") state.buttons.set(props["aria-label"] || text(props.children).trim(), props);
    if (kind === "select") state.selects.set(props["aria-label"], props);
    if (kind === "a") state.links.set(text(props.children), props);
    return (actual.jsxDEV as any)(...args);
  } };
});
vi.mock("../../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({
  user: { id: 42, name: "حساب الاختبار", role: state.role === "observer" ? "admin" : state.role },
  authenticatedUser: { id: 42, role: state.role }, loading: false,
}) }));
vi.mock("wouter", () => ({ useLocation: () => ["/", state.redirect] }));
vi.mock("../../client/src/contexts/LanguageContext", async () => {
  const ar = (await import("../../client/src/i18n/ar")).default;
  const en = (await import("../../client/src/i18n/en")).default;
  const ur = (await import("../../client/src/i18n/ur")).default;
  return { useTranslation: () => ({ t: state.language === "en" ? en : state.language === "ur" ? ur : ar, language: state.language }) };
});
vi.mock("../../client/src/lib/trpc", () => ({ trpc: { dashboard: {
  overview: { useQuery: (filters: any, options: any) => {
    state.calls.push({ path: "overview", filters, options });
    return { data: state.error || !options.enabled ? undefined : { ...dashboardSummary(buildDashboard(state.data ?? dataset(), filters, NOW)), snapshotId: state.snapshotId }, error: state.error, isLoading: false, isPlaceholderData: false, isFetching: state.fetching, refetch: state.refreshOverview };
  } },
  details: { useQuery: (input: any, options: any) => {
    state.calls.push({ path: "details", input, options });
    return { data: options.enabled && !state.detailsLoading ? dashboardDetails(buildDashboard(state.data ?? dataset(), input, NOW), input.metric, input.page, input.managerKey, input.managerBucket) : undefined, error: null, isLoading: state.detailsLoading, isPlaceholderData: false, refetch: state.refreshDetails };
  } },
} } }));
vi.mock("../../client/src/components/ui/button", async original => {
  const actual = await original<typeof import("../../client/src/components/ui/button")>();
  return { ...actual, Button: (props: any) => {
    state.buttons.set(props["aria-label"] || text(props.children).trim(), props);
    return <actual.Button {...props} />;
  } };
});
// Retain the actual program DialogContent and its class merging. Only browser
// portal/focus primitives are replaced for this static, database-free renderer.
vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ open, children }: any) => open ? <div>{children}</div> : null,
  Portal: ({ children }: any) => <>{children}</>,
  Content: ({ children, onEscapeKeyDown, ...props }: any) => <div role="dialog" data-state="open" {...props}>{children}</div>,
  Overlay: (props: any) => <div data-state="open" {...props} />,
  Title: (props: any) => <h2 {...props} />,
  Description: (props: any) => <p {...props} />,
  Close: (props: any) => <button {...props} />,
  Trigger: (props: any) => <button {...props} />,
}));
import Home from "../../client/src/pages/dashboard/Home";
function render() { state.index = 0; state.buttons.clear(); state.selects.clear(); state.links.clear(); return renderToStaticMarkup(<Home />); }
beforeEach(() => { state.role = "owner"; state.language = "ar"; state.hooks = []; state.calls = []; state.error = null; state.fetching = false; state.detailsLoading = false; state.data = null; state.snapshotId = "11111111-1111-4111-8111-111111111111"; state.redirect.mockReset(); state.refreshOverview.mockClear(); state.refreshDetails.mockClear(); vi.spyOn(Date, "now").mockReturnValue(NOW); });
afterEach(() => vi.restoreAllMocks());
describe("actual dashboard page with fake read-only data", () => {
  it("saves an isolated render of the actual page for visual inspection", () => {
    const output = render();
    writeFileSync(resolve(process.cwd(), "tools/dashboard-development/artifacts/preview.html"), `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>معاينة لوحة المتابعة المعزولة</title></head><body class="bg-background text-foreground"><div class="border-b bg-amber-50 text-amber-900 p-3 text-sm font-semibold">معاينة ثابتة من الواجهة الفعلية — جميع الأرقام بيانات اختبار ولا اتصال بقاعدة البيانات</div><main class="max-w-7xl mx-auto p-4 md:p-6">${output}</main></body></html>`, "utf8");
    expect(output).toContain("قيمة المشتريات المستلمة");
  });
  it.each(["owner", "admin", "observer"])("renders the follow-up board for %s without PM or owner-decision actions", role => {
    state.role = role;
    const output = render();
    expect(output).toContain("قيمة المشتريات المستلمة");
    expect(output).toContain("مدير الصيانة"); expect(output).toContain("مدير الإنشاءات");
    expect(output).not.toContain("ملخص الصيانة الوقائية");
    expect(output).not.toContain("PMV2"); expect(output).not.toContain("تحتاج تدخلك");
    expect(state.calls.some(call => call.path === "pmMonthlySummary")).toBe(false);
  });
  it.each(["warehouse", "technician", "maintenance_manager", "construction_procurement_manager", "senior_management"])("does not request dashboard data for %s", role => {
    state.role = role;
    expect(render()).toBe("");
    expect(state.calls.every(call => call.options.enabled === false)).toBe(true);
  });
  it("opens the received-value detail query instead of the mixed cost report", () => {
    render();
    const button = state.buttons.get("تفاصيل قيمة المشتريات المستلمة");
    expect(button["data-observer-navigation"]).toBe("true");
    button.onClick();
    const output = render();
    expect(state.calls.at(-1).input).toMatchObject({ ...FILTERS, metric: "received_value", page: 1 });
    expect(output).toContain("PR-2026-00100");
    expect(output).toContain("غير مسجل");
    expect(state.redirect).not.toHaveBeenCalled();
    expect(output).not.toContain("/reports/cost");
  });
  it("opens a wide actual dialog with all headers, linked document numbers and a close button", () => {
    render(); state.buttons.get("تفاصيل تذاكر التنفيذ المفتوحة").onClick();
    const output = render();
    for (const header of ["رقم المستند", "الوصف", "الموقع", "الحالة", "جهة الإجراء الحالية", "تاريخ السجل", "تفاصيل"]) expect(output).toContain(header);
    expect(output).toContain('role="dialog"');
    expect(output).toContain("sm:max-w-[calc(100vw-2rem)]");
    expect(output).not.toContain("sm:max-w-lg");
    const document = state.links.get("MT-2026-00005");
    expect(document.href).toBe("/tickets/5");
    document.onClick({ button: 0, preventDefault: vi.fn() });
    expect(state.redirect).toHaveBeenCalledWith("/tickets/5");
    expect(render()).not.toContain('role="dialog"');
  });
  it("leaves browser modified-click navigation intact for document links", () => {
    render(); state.buttons.get("تفاصيل قيمة المشتريات المستلمة").onClick(); render();
    const document = state.links.get("PR-2026-00100");
    expect(document.href).toBe("/purchase-orders/100");
    const event = { button: 0, ctrlKey: true, preventDefault: vi.fn() };
    document.onClick(event);
    expect(event.preventDefault).not.toHaveBeenCalled(); expect(state.redirect).not.toHaveBeenCalled();
  });
  it("keeps the close control available during detail loading for the observer", () => {
    state.role = "observer"; state.detailsLoading = true;
    render(); state.buttons.get("تفاصيل تذاكر التنفيذ المفتوحة").onClick();
    expect(render()).toContain("جاري تحميل البيانات");
    const close = state.buttons.get("إغلاق");
    expect(close["data-observer-navigation"]).toBe("true");
    close.onClick(); expect(render()).not.toContain('role="dialog"');
  });
  it("sends the overview snapshot and updates it after a new overview read", () => {
    render(); state.buttons.get("تفاصيل تذاكر التنفيذ المفتوحة").onClick(); render();
    expect(state.calls.at(-1).input.snapshotId).toBe(state.snapshotId);
    expect(state.calls.at(-1).options.staleTime).toBe(60_000);
    state.snapshotId = "22222222-2222-4222-8222-222222222222"; render();
    expect(state.calls.at(-1).input.snapshotId).toBe(state.snapshotId);
  });
  it("refreshes the overview and its open detail window explicitly", () => {
    render(); state.buttons.get("تفاصيل تذاكر التنفيذ المفتوحة").onClick(); render();
    state.buttons.get("تحديث").onClick();
    expect(state.refreshOverview).toHaveBeenCalledTimes(1);
    expect(state.refreshDetails).toHaveBeenCalledTimes(1);
  });
  it("saves a detail-window preview including a legacy report's recorded location", () => {
    state.data = dataset();
    state.data.tickets.push(ticket(78, { title: "tissue paper machine", siteId: null, locationDetail: "منطقة الآلات المسجلة" }));
    render(); state.buttons.get("تفاصيل تذاكر التنفيذ المفتوحة").onClick();
    const output = render();
    expect(output).toContain("منطقة الآلات المسجلة");
    writeFileSync(resolve(process.cwd(), "tools/dashboard-development/artifacts/details-fix/preview-details.html"), `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"><title>معاينة تفاصيل اللوحة — بيانات اختبار</title></head><body class="bg-background text-foreground"><div class="border-b bg-amber-50 text-amber-900 p-3 text-sm font-semibold">معاينة ثابتة — جميع الأرقام بيانات اختبار ولا اتصال بقاعدة البيانات</div><main class="max-w-7xl mx-auto p-4 md:p-6">${output}</main></body></html>`, "utf8");
  });
  it("uses the selected site and department in both summary and details", () => {
    render();
    state.selects.get("الموقع").onChange({ target: { value: "2" } });
    render();
    state.selects.get("الجهة").onChange({ target: { value: "construction" } });
    render();
    state.buttons.get("تفاصيل تذاكر التنفيذ المفتوحة").onClick();
    render();
    expect(state.calls.at(-1).input).toMatchObject({ siteId: 2, department: "construction", metric: "open_execution" });
  });
  it.each(["ar", "en", "ur"])("renders the new value caption in %s", language => {
    state.language = language;
    expect(render()).toContain(dashboardCopy(language).received_value);
  });
  it("does not replace a query failure with zero-filled cards", () => {
    state.error = new Error("simulated failure");
    const output = render();
    expect(output).toContain("تعذر تحميل لوحة المتابعة");
    expect(state.buttons.has("تفاصيل قيمة المشتريات المستلمة")).toBe(false);
  });
  it("gives manager counts their exact detail bucket", () => {
    render();
    const positiveButtons = [...state.buttons.values()].filter(button => button["aria-label"]?.startsWith("تفاصيل تذاكر التنفيذ المفتوحة "));
    expect(positiveButtons.length).toBeGreaterThan(0);
    positiveButtons.at(-1).onClick(); render();
    expect(state.calls.at(-1).input.managerKey).toBeDefined();
  });
  it("requires valid custom dates before executing a read", () => {
    render(); state.selects.get("الفترة").onChange({ target: { value: "custom" } });
    const output = render();
    expect(output).toContain("حدد تاريخي بداية ونهاية صحيحين");
    expect(state.calls.slice(-2).every(call => call.options.enabled === false)).toBe(true);
  });
});
