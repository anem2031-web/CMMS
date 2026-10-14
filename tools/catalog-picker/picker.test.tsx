import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createDemo } from "../../server/maintenance-team-tickets/testing/fixture";
import ar from "../../client/src/i18n/ar";
import en from "../../client/src/i18n/en";
import ur from "../../client/src/i18n/ur";
const fixture = vi.hoisted(() => ({
  hooks: [] as any[], index: 0, effects: [] as any[],
  buttons: new Map<string, any>(), inputs: new Map<string, any>(), nodes: new Map<string, any>(),
  queries: [] as any[], pickerProps: null as any, realPicker: true,
  language: "ar", state: null as any, detailsError: null as any,
  refetch: vi.fn(), resolve: vi.fn(), selected: vi.fn(), closed: vi.fn(),
  nodesData: [{ id: 1, code: "N-1", nameAr: "أدوات", nameEn: "Tools", parentId: null, level: 1 }, { id: 2, code: "N-2", nameAr: "كهرباء", nameEn: "Electrical", parentId: 1, level: 2 }],
  items: [
    { id: 101, code: "CAT-101", nameAr: "قاطع أصلي", nameEn: "Circuit breaker", unit: "قطعة", descriptionAr: "وصف القاطع", descriptionEn: "Breaker description", primaryImageUrl: "" },
    { id: 102, code: "CAT-102", nameAr: "زيت", nameEn: "Oil", unit: "لتر", primaryImageUrl: "" },
  ],
}));
vi.mock("../../client/src/pages/maintenance-teams/TicketMaterialIdentityResolver", () => ({
  TicketMaterialIdentityResolver: (props: any) => { fixture.pickerProps = props; return <div data-testid="ticket-identity-resolver">{props.assignment.ticketNumber} — {props.need.originalName}</div>; },
}));
const text = (node: any): string => node == null || typeof node === "boolean" ? "" : Array.isArray(node) ? node.map(text).join("") : typeof node === "object" ? text(node.props?.children) : String(node);
const capture = (kind: any, props: any) => {
  if (kind === "button") fixture.buttons.set(props["aria-label"] || text(props.children), props);
  if (kind === "input" || kind === "textarea") fixture.inputs.set(props.id || props["aria-label"] || props.placeholder, props);
  if (kind === "div" && props.onClick) fixture.nodes.set(text(props.children), props);
};
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: (initial: any) => {
    const index = fixture.index++;
    if (!(index in fixture.hooks)) fixture.hooks[index] = typeof initial === "function" ? initial() : initial;
    return [fixture.hooks[index], (next: any) => { fixture.hooks[index] = typeof next === "function" ? next(fixture.hooks[index]) : next; }];
  }, useEffect: (effect: any) => { fixture.effects.push(effect); } };
});
vi.mock("react/jsx-runtime", async original => {
  const actual = await original<typeof import("react/jsx-runtime")>();
  return { ...actual, jsx: (kind: any, props: any, key: any) => { capture(kind, props); return actual.jsx(kind, props, key); }, jsxs: (kind: any, props: any, key: any) => { capture(kind, props); return actual.jsxs(kind, props, key); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const actual = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...actual, jsxDEV: (...args: any[]) => { capture(args[0], args[1]); return (actual.jsxDEV as any)(...args); } };
});
vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ open, children }: any) => open ? <div>{children}</div> : null,
  Portal: ({ children }: any) => <>{children}</>,
  Content: ({ onEscapeKeyDown, children, ...props }: any) => <div role="dialog" data-state="open" {...props}>{children}</div>,
  Overlay: (props: any) => <div data-state="open" {...props} />,
  Title: (props: any) => <h2 {...props} />, Description: (props: any) => <p {...props} />,
  Close: (props: any) => <button {...props} />, Trigger: (props: any) => <button {...props} />,
}));
vi.mock("../../client/src/contexts/LanguageContext", () => ({ useTranslation: () => ({
  language: fixture.language, dir: fixture.language === "en" ? "ltr" : "rtl", isRTL: fixture.language !== "en",
  t: fixture.language === "en" ? en : fixture.language === "ur" ? ur : ar,
}) }));
vi.mock("../../client/src/lib/trpc", () => ({ trpc: {
  catalog: {
    nodes: { list: { useQuery: (input: any, options: any) => { fixture.queries.push({ path: "nodes", input, options }); return { data: fixture.nodesData }; } } },
    units: { list: { useQuery: (input: any, options: any) => { fixture.queries.push({ path: "units", input, options }); return { data: [{ id: 1, nameAr: "قطعة", nameEn: "Piece" }, { id: 2, nameAr: "لتر", nameEn: "Litre" }] }; } } },
    items: { list: { useQuery: (input: any, options: any) => { fixture.queries.push({ path: "items", input, options }); return { data: fixture.items, isFetching: false }; } } },
  },
  useUtils: () => ({ client: { ticketTeamExecution: { resolve: { mutate: fixture.resolve } } }, ticketTeamExecution: { balances: { invalidate: vi.fn() } }, ticketTeamAssignments: { queue: { invalidate: vi.fn() }, warehouseRequests: { invalidate: vi.fn() } } }),
  ticketTeamExecution: {
    details: { useQuery: () => ({ data: fixture.state, error: fixture.detailsError, isLoading: false, refetch: fixture.refetch }) },
    balances: { useQuery: () => ({ data: [] }) }, preview: { useQuery: () => ({ data: null, isFetching: false }) },
  },
} }));
vi.mock("../../client/src/components/catalog/CatalogPickerDialog", async original => {
  const actual = await original<typeof import("../../client/src/components/catalog/CatalogPickerDialog")>();
  return { ...actual, CatalogPickerDialog: (props: any) => {
    fixture.pickerProps = props;
    return fixture.realPicker ? <actual.CatalogPickerDialog {...props} /> : <div data-picker-open={props.open} />;
  } };
});
import { CatalogPickerDialog } from "../../client/src/components/catalog/CatalogPickerDialog";
import { ExecutionPanel } from "../../client/src/pages/maintenance-teams/ExecutionPanel";
const begin = () => { fixture.index = 0; fixture.effects = []; fixture.buttons.clear(); fixture.inputs.clear(); fixture.nodes.clear(); fixture.queries = []; fixture.pickerProps = null; };
const picker = (requiredUnit?: string, open = true) => { begin(); return renderToStaticMarkup(<CatalogPickerDialog open={open} onClose={fixture.closed} onSelect={fixture.selected} requiredUnit={requiredUnit} />); };
const panel = (needId = 12, role = "warehouse") => { begin(); return renderToStaticMarkup(<ExecutionPanel assignmentId={fixture.state.assignments[0].id} actorId={2} role={role} language={fixture.language} mode="warehouse" warehouseNeedId={needId} onChanged={() => {}} />); };
async function initPanel() {
  fixture.realPicker = false;
  const demo = createDemo();
  await demo.service.assign(1, { ...(await demo.store.read()).tickets[0], teamId: 21 });
  fixture.state = await demo.store.read(); fixture.state.assignments[0].stage = "waiting_material";
  fixture.state.needs.push({ id: 12, assignmentId: fixture.state.assignments[0].id, catalogItemId: null, name: "صنف غير مطابق", originalName: "صنف غير مطابق", unit: "قطعة", requested: 5, requestedById: 3, used: null, round: 1, warehouseId: 20 });
}
beforeEach(() => {
  fixture.hooks = []; fixture.language = "ar"; fixture.realPicker = true; fixture.state = null; fixture.detailsError = null;
  for (const fn of [fixture.refetch, fixture.resolve, fixture.selected, fixture.closed]) fn.mockReset();
  fixture.resolve.mockResolvedValue({ revision: 2 });
});
afterEach(() => { vi.useRealTimers(); });

describe("purchase catalog picker and independent ticket material resolver", () => {
  it("extracts only the existing picker and leaves the rest of purchase creation byte-for-byte intact", () => {
    const before = fs.readFileSync("tools/catalog-picker/artifacts/CreatePurchaseOrder.tsx.before", "utf8");
    const start = before.indexOf("// ── Catalog Item Picker Dialog"), end = before.indexOf("// ── Add Item Choice Dialog", start);
    const expected = (before.slice(0, start) + before.slice(end)).replace('import { trpc } from "@/lib/trpc";', 'import { trpc } from "@/lib/trpc";\nimport { CatalogPickerDialog } from "@/components/catalog/CatalogPickerDialog";').replace("FilePlus, Search, ChevronDown, ChevronRight, FolderOpen, Save", "FilePlus, Save");
    expect(fs.readFileSync("client/src/pages/purchase/CreatePurchaseOrder.tsx", "utf8")).toBe(expected);
  });
  it("keeps original active catalog queries, classification tree and result codes", () => {
    const html = picker();
    expect(html).toContain("أدوات"); expect(html).toContain("CAT-101"); expect(html).toContain("وصف القاطع");
    expect(fixture.queries.find(q => q.path === "items").input).toMatchObject({ isActive: true, limit: 80 });
    expect(fixture.queries.every(q => q.options.enabled === true)).toBe(true);
  });
  it("keeps queries disabled while the purchase picker is closed", () => {
    expect(picker(undefined, false)).toBe("");
    expect(fixture.queries.every(q => q.options.enabled === false)).toBe(true);
  });
  it("keeps server-search debounce at 350ms", () => {
    vi.useFakeTimers(); picker();
    fixture.inputs.get(ar.common.searchPlaceholder).onChange({ target: { value: "  CAT-101  " } });
    picker(); const cleanup = fixture.effects[0]();
    vi.advanceTimersByTime(349); picker();
    expect(fixture.queries.find(q => q.path === "items").input.search).toBeUndefined();
    vi.advanceTimersByTime(1); picker();
    expect(fixture.queries.find(q => q.path === "items").input.search).toBe("CAT-101");
    cleanup();
  });
  it("filters a parent classification together with its descendants", () => {
    picker(); fixture.nodes.get("N-1أدوات").onClick(); picker();
    expect(fixture.queries.find(q => q.path === "items").input.nodeIds).toEqual([1, 2]);
  });
  it("keeps all original purchase results while material matching shows exact-unit candidates", () => {
    expect(picker()).toContain("زيت");
    const html = picker("قطعة"); expect(html).toContain("قاطع أصلي"); expect(html).not.toContain("زيت");
  });
  it.each(["ar", "en", "ur"])("retains catalog localization for %s", language => {
    fixture.language = language;
    expect(picker()).toContain(language === "ar" ? "قاطع أصلي" : "Circuit breaker");
  });
  it("returns the original catalog identity, name, unit and description and then closes", () => {
    picker(); fixture.buttons.get("قاطع أصليوصف القاطعCAT-101").onClick();
    expect(fixture.selected).toHaveBeenCalledWith(expect.objectContaining({ id: 101, nameAr: "قاطع أصلي", unit: "قطعة", descriptionAr: "وصف القاطع" }));
    expect(fixture.closed).toHaveBeenCalledTimes(1);
  });
  it("opens only the resolver for the selected need and picking cannot create a purchase or stock movement", async () => {
    await initPanel(); panel(); expect(fixture.queries).toHaveLength(0);
    fixture.buttons.get("تحديد المادة من الدليل").onClick(); panel();
    expect(fixture.pickerProps.need.id).toBe(12); expect(fixture.pickerProps.need.unit).toBe("قطعة");
    expect(fixture.resolve).not.toHaveBeenCalled(); expect(fixture.buttons.has("تأكيد المطابقة")).toBe(false);
  });
  it("preserves extra-storage quantities and submits the original scoped resolve command from the modal", async () => {
    await initPanel(); panel(); const assignmentId = fixture.state.assignments[0].id;
    const extraId = `need-${assignmentId}-12-warehouse`, totalId = `need-${assignmentId}-12-total`;
    fixture.inputs.get(extraId).onChange({ target: { value: "3" } }); panel();
    fixture.buttons.get("تحديد المادة من الدليل").onClick(); panel();
    expect(fixture.inputs.get(extraId).value).toBe("3"); expect(fixture.inputs.get(totalId).value).toBe(8);
    await fixture.pickerProps.onConfirm(101, "مطابقة وصف الفني بالصنف الصحيح");
    expect(fixture.resolve).toHaveBeenCalledWith(expect.objectContaining({ assignmentId, needId: 12, catalogItemId: 101, expectedRevision: fixture.state.assignments[0].revision, note: "مطابقة وصف الفني بالصنف الصحيح" }));
  });
  it("does not carry the original need's modal into another material card", async () => {
    await initPanel(); panel(); fixture.buttons.get("تحديد المادة من الدليل").onClick(); panel();
    expect(fixture.pickerProps.need.id).toBe(12);
    fixture.state.needs.push({ ...fixture.state.needs[0], id: 13, name: "احتياج ثان" });
    fixture.pickerProps = null; panel(13); expect(fixture.pickerProps).toBeNull();
  });
  it("keeps the original closed-ticket and warehouse role barriers", async () => {
    await initPanel(); fixture.detailsError = { message: "أُغلق البلاغ الأصلي؛ لا يمكن متابعة التنفيذ" };
    expect(panel()).toContain("أُغلق البلاغ الأصلي"); expect(fixture.buttons.has("تحديد المادة من الدليل")).toBe(false);
    fixture.detailsError = null; panel(12, "technician"); expect(fixture.buttons.has("تحديد المادة من الدليل")).toBe(false);
  });
  it("ticket cards use the dedicated PMV2 identity dialog controller, while the purchase picker remains independent", () => {
    const source = fs.readFileSync("client/src/pages/maintenance-teams/ExecutionPanel.tsx", "utf8");
    expect(source).toContain("TicketMaterialIdentityResolver"); expect(source).not.toContain("CatalogPickerDialog");
    expect(source).toContain("WarehousePurchaseQuantities");
  });
});
