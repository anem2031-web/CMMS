import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  installObserverControls,
  observerControlBlocked,
} from "../../client/src/components/system/observer-controls";

const viewport = vi.hoisted(() => ({ mobile: true }));
vi.mock("../../client/src/hooks/useMobile", () => ({
  useIsMobile: () => viewport.mobile,
}));
vi.mock("../../client/src/components/ui/sheet", () => ({
  // Radix Root supplies context, but does not render/pass arbitrary DOM props.
  Sheet: ({ children }: any) => <>{children}</>,
  SheetContent: ({ children, side: _side, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  SheetHeader: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  SheetTitle: ({ children }: any) => <h2>{children}</h2>,
  SheetDescription: ({ children }: any) => <p>{children}</p>,
}));
import {
  Sidebar,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "../../client/src/components/ui/sidebar";

function control(
  text: string,
  attrs: Record<string, string> = {},
  options: { tag?: string; icons?: string; navigation?: boolean } = {}
) {
  const tag = options.tag ?? "BUTTON";
  const attributes = new Map(Object.entries(attrs));
  const element: any = {
    tagName: tag,
    textContent: text,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    hasAttribute: (name: string) => attributes.has(name),
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    removeAttribute: (name: string) => attributes.delete(name),
    matches: (selector: string) => {
      if (selector === 'input[type="file"],a[download]')
        return (
          (tag === "INPUT" && attrs.type === "file") ||
          (tag === "A" && "download" in attrs)
        );
      if (selector === "button,input") return ["BUTTON", "INPUT"].includes(tag);
      return (
        tag === "BUTTON" ||
        attrs.role === "button" ||
        attrs.role === "menuitem" ||
        (tag === "INPUT" && attrs.type === "submit")
      );
    },
    closest: (selector: string) =>
      selector === '[data-observer-navigation="true"]'
        ? options.navigation
          ? element
          : null
        : element,
    querySelectorAll: () =>
      options.icons ? [{ getAttribute: () => options.icons }] : [],
  };
  return { element: element as Element, attributes };
}

describe("observer read-only navigation regression", () => {
  it.each([true, false])(
    "keeps the sidebar navigation marker on real DOM on mobile=%s",
    mobile => {
      viewport.mobile = mobile;
      const html = renderToStaticMarkup(
        <SidebarProvider>
          <Sidebar data-observer-navigation="true">
            <button>طلبات الشراء</button>
          </Sidebar>
          <SidebarTrigger />
          <SidebarRail />
        </SidebarProvider>
      );
      expect(html).toMatch(/<div[^>]*data-observer-navigation="true"[^>]*>/);
      for (const slot of ["sidebar-trigger", "sidebar-rail"])
        expect(html).toMatch(
          new RegExp(
            `<button[^>]*data-slot="${slot}"[^>]*data-observer-navigation="true"`
          )
        );
      if (mobile) expect(html).toContain('data-mobile="true"');
    }
  );

  it("allows sidebar toggles, menus, search, filters, detail views and logout", () => {
    const reads = [
      control("Toggle Sidebar", {}, { icons: "lucide lucide-panel-left" }),
      control("طلبات الشراء", {}, { navigation: true }),
      control("مراقب اختبار", {
        "aria-controls": "account-menu",
        "aria-expanded": "false",
      }),
      control("مسح الفلاتر"),
      control("إعادة المحاولة"),
      control("عرض طلب الشراء"),
      control("تفاصيل سند الصرف"),
      control("تلاش"),
      control("اگلا"),
      control("تسجيل الخروج", { "data-observer-action": "logout" }),
      control("جاهزة للصرف", { role: "tab" }),
      control("اختر الموقع", { role: "combobox" }),
    ];
    for (const { element } of reads)
      expect(observerControlBlocked(element), element.textContent ?? "").toBe(
        false
      );
  });

  it("keeps write, approval, upload, import/export and print controls blocked", () => {
    const writes = [
      control("إضافة مستخدم"),
      control("حفظ"),
      control("تعديل"),
      control("حذف"),
      control("إلغاء البلاغ"),
      control("إرسال للحسابات"),
      control("تأكيد الاستلام"),
      control("استيراد", {
        "aria-controls": "import",
        "aria-expanded": "false",
      }),
      control("تصدير", { "aria-controls": "export", "aria-expanded": "false" }),
      control("عرض التفاصيل", {}, { icons: "lucide lucide-download" }),
      control("عرض التفاصيل", {}, { icons: "lucide lucide-printer" }),
      control("", { type: "file" }, { tag: "INPUT", navigation: true }),
      control(
        "تنزيل",
        { download: "", href: "/reports" },
        { tag: "A", navigation: true }
      ),
      control(
        "ملف",
        { href: "/api/reports/cost.pdf" },
        { tag: "A", navigation: true }
      ),
      control(
        "ملف",
        { href: "blob:local-export" },
        { tag: "A", navigation: true }
      ),
    ];
    for (const { element } of writes)
      expect(observerControlBlocked(element), element.textContent ?? "").toBe(
        true
      );
  });

  it("restores a blocked control when it becomes read-only and still captures writes in portals", () => {
    const changing = control("حفظ");
    const elements = [changing.element];
    const handlers = new Map<string, EventListener>();
    let rescan!: () => void;
    let observed: MutationObserverInit | undefined;
    vi.stubGlobal(
      "MutationObserver",
      class {
        constructor(callback: () => void) {
          rescan = callback;
        }
        observe(_target: Node, options: MutationObserverInit) {
          observed = options;
        }
        disconnect() {}
      }
    );
    const doc = {
      body: {},
      querySelectorAll: () => elements,
      addEventListener: (name: string, callback: EventListener) =>
        handlers.set(name, callback),
      removeEventListener: (name: string) => handlers.delete(name),
    } as unknown as Document;
    const cleanup = installObserverControls(doc);
    try {
      expect(changing.attributes.has("disabled")).toBe(true);
      (changing.element as any).textContent = "عرض التفاصيل";
      rescan();
      expect(changing.attributes.has("disabled")).toBe(false);
      const readEvent = {
        type: "click",
        target: changing.element,
        preventDefault: vi.fn(),
        stopImmediatePropagation: vi.fn(),
      };
      handlers.get("click")!(readEvent as unknown as Event);
      expect(readEvent.preventDefault).not.toHaveBeenCalled();
      const portal = control("تصدير");
      elements.push(portal.element);
      rescan();
      expect(portal.attributes.has("disabled")).toBe(true);
      const writeEvent = {
        ...readEvent,
        target: portal.element,
        preventDefault: vi.fn(),
      };
      handlers.get("click")!(writeEvent as unknown as Event);
      expect(writeEvent.preventDefault).toHaveBeenCalledOnce();
      expect(observed?.attributeFilter).toEqual(
        expect.arrayContaining([
          "data-observer-navigation",
          "role",
          "aria-controls",
          "aria-expanded",
        ])
      );
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
    expect(handlers.size).toBe(0);
  });
});
