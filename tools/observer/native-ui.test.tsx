import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import ts from "typescript";
import { observerViewUser } from "../../shared/observer-view";
import {
  observerControlBlocked,
  installObserverControls,
} from "../../client/src/components/system/observer-controls";
import { observerReadOnlyLink } from "../../client/src/lib/observer-link";
import { observable } from "@trpc/server/observable";
const fixture = vi.hoisted(() => ({
  path: "/users",
  role: "observer",
  calls: [] as string[],
  writes: 0,
  data: new Map<string, any>(),
  raw: { id: 99, role: "observer", isActive: 1, name: "مراقب اختبار" },
}));
vi.mock("../../client/src/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user:
      fixture.role === "observer"
        ? { ...fixture.raw, role: "admin" }
        : { ...fixture.raw, role: fixture.role },
    authenticatedUser: { ...fixture.raw, role: fixture.role },
    isReadOnly: fixture.role === "observer",
    loading: false,
    logout: vi.fn(),
  }),
}));
vi.mock("../../client/src/contexts/LanguageContext", async () => {
  const { default: ar } = await import("../../client/src/i18n/ar");
  return {
    useTranslation: () => ({ t: ar, language: "ar", dir: "rtl" }),
    useLanguage: () => ({
      t: ar,
      language: "ar",
      dir: "rtl",
      setLanguage: vi.fn(),
    }),
  };
});
vi.mock("../../client/src/hooks/useContentTranslation", () => ({
  useStaticLabels: () => ({
    getRoleLabel: (r: string) => r,
    getStatusLabel: (r: string) => r,
    getPriorityLabel: (r: string) => r,
  }),
  useContentTranslation: () => ({ translate: (x: any) => x }),
}));
vi.mock("wouter", () => ({
  useLocation: () => [fixture.path, vi.fn()],
  Link: ({ children, ...p }: any) => <a {...p}>{children}</a>,
}));
vi.mock("recharts", () =>
  Object.fromEntries(
    [
      "ResponsiveContainer",
      "BarChart",
      "Bar",
      "XAxis",
      "YAxis",
      "CartesianGrid",
      "Tooltip",
      "Legend",
      "PieChart",
      "Pie",
      "Cell",
      "LineChart",
      "Line",
    ].map(name => [
      name,
      ({ children }: any) => <div data-chart={name}>{children}</div>,
    ])
  )
);
vi.mock("../../client/src/lib/trpc", () => {
  const build = (prefix = ""): any =>
    new Proxy(() => {}, {
      get: (_t, key) => {
        if (key === "useQuery")
          return () => {
            fixture.calls.push(prefix);
            return { data: fixture.data.get(prefix) ?? [], isLoading: false };
          };
        if (key === "useMutation")
          return () => ({ mutate: () => fixture.writes++, isPending: false });
        if (key === "useUtils") return () => build("utils");
        if (key === "invalidate") return vi.fn();
        return build(prefix ? prefix + "." + String(key) : String(key));
      },
    });
  return { trpc: build() };
});
import UsersPage from "../../client/src/pages/admin/Users";
import Sites from "../../client/src/pages/admin/Sites";
import Reports from "../../client/src/pages/reports/Reports";
import { ObserverReadOnlyBoundary } from "../../client/src/components/system/ObserverReadOnlyBoundary";

beforeEach(() => {
  fixture.role = "observer";
  fixture.calls = [];
  fixture.writes = 0;
  fixture.data.clear();
  fixture.data.set("users.list", [
    {
      id: 1,
      name: "المالك الأصلي",
      username: "owner",
      role: "owner",
      isActive: 1,
    },
    {
      id: 99,
      name: "مراقب اختبار",
      username: "observer",
      role: "observer",
      isActive: 1,
    },
  ]);
  fixture.data.set("sites.list", [
    { id: 1, name: "الموقع الأصلي", address: "الرياض" },
  ]);
  fixture.data.set("reports.ticketsByStatus", [
    { status: "new", count: 9 },
    { status: "closed", count: 2 },
  ]);
  fixture.data.set("reports.ticketsByPriority", [
    { priority: "critical", count: 3 },
  ]);
  fixture.data.set("reports.monthlySummary", [
    { month: "2026-10", created: 11, closed: 2 },
  ]);
});

describe("observer uses the original pages and read queries", () => {
  it("renders the actual Users page with the same markup as admin", () => {
    const observer = renderToStaticMarkup(<UsersPage />);
    fixture.role = "admin";
    const admin = renderToStaticMarkup(<UsersPage />);
    expect(observer).toBe(admin);
    expect(observer).toContain("المالك الأصلي");
    expect(fixture.calls).toContain("users.list");
    expect(fixture.writes).toBe(0);
  });
  it("renders the actual Sites page and its original records", () => {
    const observer = renderToStaticMarkup(<Sites />);
    fixture.role = "admin";
    expect(observer).toBe(renderToStaticMarkup(<Sites />));
    expect(observer).toContain("الموقع الأصلي");
    expect(fixture.calls).toContain("sites.list");
  });
  it("keeps actual Reports calculations and chart components", () => {
    const observer = renderToStaticMarkup(<Reports />);
    fixture.role = "admin";
    expect(observer).toBe(renderToStaticMarkup(<Reports />));
    expect(observer).toContain("data-chart");
    expect(fixture.calls).toContain("reports.ticketsByStatus");
    expect(fixture.calls).toContain("reports.monthlySummary");
    expect(fixture.calls).not.toContain("observer.readPage");
  });
  it("adds only a read-only indicator around the original content", () => {
    const native = <p>original page</p>;
    expect(
      renderToStaticMarkup(
        <ObserverReadOnlyBoundary active={false}>
          {native}
        </ObserverReadOnlyBoundary>
      )
    ).toBe(renderToStaticMarkup(native));
    expect(
      renderToStaticMarkup(
        <ObserverReadOnlyBoundary active>{native}</ObserverReadOnlyBoundary>
      )
    ).toContain("المراقب — استعراض فقط");
  });
  it("direct create/edit links keep the original form visible with disabled fields only for observer", () => {
    for (const path of [
      "/tickets/new",
      "/purchase-orders/edit-draft/1",
      "/construction/projects/1/edit",
    ]) {
      fixture.path = path;
      const original = (
        <form>
          <input name="title" />
          <button>حفظ</button>
        </form>
      );
      expect(
        renderToStaticMarkup(
          <ObserverReadOnlyBoundary active>{original}</ObserverReadOnlyBoundary>
        )
      ).toContain('<fieldset disabled=""');
      expect(
        renderToStaticMarkup(
          <ObserverReadOnlyBoundary active={false}>
            {original}
          </ObserverReadOnlyBoundary>
        )
      ).toBe(renderToStaticMarkup(original));
    }
    fixture.path = "/users";
  });
  it("the actual useAuth projects only presentation and keeps the actual identity/cache", () => {
    const user = { id: 99, role: "observer" };
    expect(observerViewUser(user)).toEqual({ id: 99, role: "admin" });
    expect(user.role).toBe("observer");
    const source = fs.readFileSync("client/src/_core/hooks/useAuth.ts", "utf8");
    expect(source).toContain("user: observerViewUser(meQuery.data)");
    expect(source).toContain("authenticatedUser: meQuery.data ?? null");
    expect(source).toContain("JSON.stringify(meQuery.data)");
  });
  it("the App router is the original router; no generic page or read service remains registered", () => {
    const file = "client/src/App.tsx";
    const node = (source: string) => {
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      return ast.statements
        .find(s => ts.isFunctionDeclaration(s) && s.name?.text === "Router")!
        .getText(ast)
        .replace(/\s+/g, " ");
    };
    expect(node(fs.readFileSync(file, "utf8"))).toBe(
      node(
        fs.readFileSync(
          "tools/observer/artifacts/before/client__src__App.tsx.before",
          "utf8"
        )
      )
    );
    for (const f of [
      "client/src/pages/observer/ObserverPage.tsx",
      "server/routers/observer/index.ts",
      "server/services/observer/read-service.ts",
      "shared/observer-pages.ts",
    ])
      expect(fs.existsSync(f)).toBe(false);
    expect(fs.readFileSync("server/routers/index.ts", "utf8")).not.toContain(
      "observerRouter"
    );
  });
});

function element(
  text: string,
  attrs: Record<string, string> = {},
  icons = "",
  tag = "BUTTON",
  nav = false
): Element {
  const matches = (selector: string) =>
    selector === "button,input"
      ? tag === "BUTTON" || tag === "INPUT"
      : selector.includes('input[type="file"]')
        ? attrs.type === "file" || (tag === "A" && "download" in attrs)
        : tag === "BUTTON" ||
          attrs.role === "button" ||
          attrs.role === "menuitem";
  return {
    tagName: tag,
    textContent: text,
    getAttribute: (key: string) => attrs[key] ?? null,
    hasAttribute: (key: string) => key in attrs,
    matches,
    closest: () => (nav ? {} : null),
    querySelectorAll: () => (icons ? [{ getAttribute: () => icons }] : []),
  } as any;
}
describe("observer action controls", () => {
  it("keeps the explicitly marked native logout item enabled in every application language", () => {
    for (const label of ["تسجيل الخروج", "Sign Out", "سائن آؤٹ"]) {
      expect(
        observerControlBlocked(
          element(
            label,
            { role: "menuitem", "data-observer-action": "logout" },
            "lucide-log-out",
            "DIV"
          )
        )
      ).toBe(false);
    }
    const file = "client/src/components/layout/DashboardLayout.tsx";
    const source = fs.readFileSync(file, "utf8"),
      ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
    let marked = false;
    function visit(n: ts.Node) {
      if (
        ts.isJsxOpeningElement(n) &&
        n.tagName.getText(ast) === "DropdownMenuItem"
      ) {
        const p = n.attributes.properties;
        if (
          p.some(
            a =>
              ts.isJsxAttribute(a) &&
              a.name.getText(ast) === "onClick" &&
              a.initializer?.getText(ast) === "{logout}"
          )
        )
          marked = p.some(
            a =>
              ts.isJsxAttribute(a) &&
              a.name.getText(ast) === "data-observer-action" &&
              a.initializer?.getText(ast) === '"logout"'
          );
      }
      ts.forEachChild(n, visit);
    }
    visit(ast);
    expect(marked).toBe(true);
  });
  it("blocks create/edit/delete/import/export/approval controls and icon-only actions", () => {
    for (const word of [
      "إضافة مستخدم",
      "حفظ",
      "تعديل",
      "حذف",
      "استيراد",
      "تصدير Excel",
      "تحميل PDF",
      "طباعة",
      "اعتماد",
      "إرسال",
      "صرف المادة",
      "إلغاء التذكرة",
      "View and approve",
    ])
      expect(observerControlBlocked(element(word))).toBe(true);
    for (const icon of [
      "lucide-plus",
      "lucide-pencil",
      "lucide-trash-2",
      "lucide-download",
      "lucide-upload",
      "lucide-printer",
    ])
      expect(observerControlBlocked(element("", {}, icon))).toBe(true);
  });
  it("retains search/filter/paging/details/refresh and navigation", () => {
    for (const word of [
      "بحث",
      "تحديث",
      "عرض التفاصيل",
      "التالي",
      "السابق",
      "إخفاء التفاصيل",
      "عودة",
      "تحميل المزيد",
      "عرض طلب الشراء",
      "تفاصيل سند الصرف",
    ])
      expect(observerControlBlocked(element(word))).toBe(false);
    expect(
      observerControlBlocked(element("طلبات الشراء", {}, "", "BUTTON", true))
    ).toBe(false);
    expect(
      observerControlBlocked(element("جاهزة للصرف", { role: "tab" }))
    ).toBe(false);
    expect(
      observerControlBlocked(element("الفريق", { role: "combobox" }))
    ).toBe(false);
  });
  it("blocks local download links and direct exports while document navigation stays enabled", () => {
    for (const href of [
      "/api/export/tickets",
      "/api/reports/valuation.pdf",
      "blob:generated-export",
      "data:text/csv,a,b",
    ])
      expect(observerControlBlocked(element("", { href }, "", "A"))).toBe(true);
    expect(
      observerControlBlocked(
        element("تفاصيل التذكرة", { href: "/tickets/1" }, "", "A")
      )
    ).toBe(false);
    expect(
      observerControlBlocked(element("ملف", { type: "file" }, "", "INPUT"))
    ).toBe(true);
  });
  it("installs capture protection, covers new portal actions and restores original controls on cleanup", () => {
    const attrs = new Map<string, string>();
    const action: any = element("حذف");
    action.getAttribute = (k: string) => attrs.get(k) ?? null;
    action.hasAttribute = (k: string) => attrs.has(k);
    action.setAttribute = (k: string, v: string) => attrs.set(k, v);
    action.removeAttribute = (k: string) => attrs.delete(k);
    action.closest = (q: string) =>
      q.startsWith("[data-observer") ? null : action;
    const handlers = new Map<string, Function>();
    const elements = [action];
    let rescan!: () => void;
    let disconnected = false;
    vi.stubGlobal(
      "MutationObserver",
      class {
        constructor(callback: () => void) {
          rescan = callback;
        }
        observe() {}
        disconnect() {
          disconnected = true;
        }
      }
    );
    const doc: any = {
      body: {},
      querySelectorAll: () => elements,
      addEventListener: (n: string, cb: Function) => handlers.set(n, cb),
      removeEventListener: (n: string) => handlers.delete(n),
    };
    const cleanup = installObserverControls(doc);
    expect(attrs.has("disabled")).toBe(true);
    const event = {
      target: action,
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
      type: "click",
    };
    handlers.get("click")!(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopImmediatePropagation).toHaveBeenCalled();
    const readFormEvent = {
      type: "submit",
      target: { querySelector: () => ({}) },
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
    };
    handlers.get("submit")!(readFormEvent);
    expect(readFormEvent.preventDefault).not.toHaveBeenCalled();
    const writeFormEvent = {
      ...readFormEvent,
      target: { querySelector: () => null },
      preventDefault: vi.fn(),
    };
    handlers.get("submit")!(writeFormEvent);
    expect(writeFormEvent.preventDefault).toHaveBeenCalled();
    attrs.delete("disabled");
    rescan();
    expect(attrs.has("disabled")).toBe(true);
    const portalAttrs = new Map<string, string>();
    const portal: any = element("استيراد");
    portal.getAttribute = (k: string) => portalAttrs.get(k) ?? null;
    portal.hasAttribute = (k: string) => portalAttrs.has(k);
    portal.setAttribute = (k: string, v: string) => portalAttrs.set(k, v);
    portal.removeAttribute = (k: string) => portalAttrs.delete(k);
    elements.push(portal);
    rescan();
    expect(portalAttrs.has("disabled")).toBe(true);
    cleanup();
    expect(disconnected).toBe(true);
    expect(handlers.size).toBe(0);
    expect(attrs.has("disabled")).toBe(false);
    expect(portalAttrs.has("disabled")).toBe(false);
    vi.unstubAllGlobals();
  });
  it("the actual client link blocks writes/exports before transport and leaves old roles unchanged", () => {
    let calls = 0,
      error: any;
    let role = "observer";
    const link = observerReadOnlyLink(() => role)({} as any);
    const next = () => {
      calls++;
      return observable(o => {
        o.next({ result: { data: [] } } as any);
        o.complete();
      });
    };
    for (const path of ["users.create", "catalog.importExport.exportExcel"])
      link({
        op: { path, type: "mutation" } as any,
        next: next as any,
      }).subscribe({ error: e => (error = e) });
    expect(calls).toBe(0);
    expect(error.message).toContain("استعراض");
    link({
      op: { path: "auth.logout", type: "mutation" } as any,
      next: next as any,
    }).subscribe({});
    expect(calls).toBe(1);
    link({
      op: { path: "users.list", type: "query" } as any,
      next: next as any,
    }).subscribe({});
    expect(calls).toBe(2);
    role = "admin";
    link({
      op: { path: "users.create", type: "mutation" } as any,
      next: next as any,
    }).subscribe({});
    expect(calls).toBe(3);
  });
});
