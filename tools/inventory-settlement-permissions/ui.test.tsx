import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  role: "warehouse",
  isReadOnly: false,
  lotsEnabled: false,
  states: [] as any[],
  index: 0,
  buttons: new Map<string, any>(),
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  selectCount: null as null | (() => void),
}));

vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: any) => {
      const index = fixture.index++;
      if (!(index in fixture.states)) {
        fixture.states[index] = typeof initial === "function" ? initial() : initial;
      }
      return [fixture.states[index], (value: any) => {
        fixture.states[index] = typeof value === "function" ? value(fixture.states[index]) : value;
      }];
    },
  };
});
vi.mock("../../client/src/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: 42, role: fixture.role },
    isReadOnly: fixture.isReadOnly,
  }),
}));
vi.mock("../../client/src/contexts/LanguageContext", async () => {
  const { default: ar } = await import("../../client/src/i18n/ar");
  return { useTranslation: () => ({ t: ar, language: "ar" }) };
});
vi.mock("../../client/src/lib/trpc", () => {
  const build = (path = ""): any => new Proxy({}, {
    get: (_target, key) => {
      if (key === "useQuery") return (_input: any, options: any) => {
        const data: Record<string, any> = {
          "inventoryCount.lotTrackingStatus": { enabled: fixture.lotsEnabled },
          "inventoryCount.listOperations": [{ id: 12, status: "in_progress", operationNumber: "CNT-TEST", scope: "full" }],
          "inventoryCount.operationDetails": { operation: { id: 12, status: "completed", operationNumber: "CNT-TEST", scope: "full" }, items: [] },
          "inventoryCount.listSettlements": [{ id: 1, settlementNumber: "ADJ-TEST", sourceType: "from_count", reason: "Test read access" }],
        };
        return { data: options?.enabled === false ? undefined : (data[path] ?? []), isLoading: false, refetch: vi.fn() };
      };
      if (key === "useMutation") return () => {
        if (!fixture.mutations.has(path)) fixture.mutations.set(path, vi.fn());
        return { mutate: fixture.mutations.get(path), isPending: false };
      };
      return build(path ? `${path}.${String(key)}` : String(key));
    },
  });
  return { trpc: build() };
});

function label(node: any): string {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(label).join("");
  if (typeof node === "object") return label(node.props?.children);
  return String(node);
}
vi.mock("../../client/src/components/ui/button", () => ({
  Button: (props: any) => {
    fixture.buttons.set(label(props.children).trim(), props);
    return <button disabled={props.disabled}>{props.children}</button>;
  },
}));
vi.mock("../../client/src/components/ui/card", () => ({
  Card: ({ children, onClick }: any) => {
    if (onClick) fixture.selectCount = onClick;
    return <div>{children}</div>;
  },
  CardContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../../client/src/components/ui/tabs", () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children }: any) => <div>{children}</div>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../../client/src/components/ui/dialog", () => ({
  useDialogComposition: () => ({
    justEndedComposing: () => false,
    setComposing: vi.fn(),
    markCompositionEnd: vi.fn(),
  }),
  Dialog: ({ open, children }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));
vi.mock("../../client/src/components/common/BarcodeScanner", () => ({ default: () => null }));
vi.mock("../../client/src/components/inventory/LotLabelsPrintScreen", () => ({ default: () => null }));
vi.mock("../../client/src/components/inventory/OpeningBalanceBulkExcel", () => ({ default: () => null }));
// The new review panel has its own permission/interaction fixtures. This suite
// verifies that the original direct-posting UI remains restricted to owner/admin.
vi.mock("../../client/src/components/inventory/SettlementReviewPanel", () => ({ default: () => null }));

import InventoryOperations from "../../client/src/pages/inventory/InventoryOperations";

function render() {
  fixture.index = 0;
  fixture.buttons.clear();
  return renderToStaticMarkup(<InventoryOperations />);
}
function openCompletedCount() {
  render();
  expect(fixture.selectCount).not.toBeNull();
  fixture.selectCount!();
  return render();
}

beforeEach(() => {
  fixture.role = "warehouse";
  fixture.isReadOnly = false;
  fixture.lotsEnabled = false;
  fixture.states = [];
  fixture.selectCount = null;
  fixture.buttons.clear();
  fixture.mutations.clear();
});

describe("settlement controls in the actual inventory page with fake data", () => {
  it("keeps warehouse count/read access while hiding both settlement entry points", () => {
    const initial = render();
    expect(initial).toContain("ADJ-TEST");
    expect(fixture.buttons.has("بدء جرد جديد")).toBe(true);
    expect(fixture.buttons.has("تسوية مستقلة (بدون جرد)")).toBe(false);
    openCompletedCount();
    expect(fixture.buttons.has("فتح تسوية من هذا الجرد")).toBe(false);
    expect(fixture.buttons.has("تطبيق التسوية")).toBe(false);
  });

  it.each(["owner", "admin"])("keeps count-based and manual entry points for %s", role => {
    fixture.role = role;
    openCompletedCount();
    expect(fixture.buttons.get("تسوية مستقلة (بدون جرد)")?.disabled).toBe(false);
    expect(fixture.buttons.has("فتح تسوية من هذا الجرد")).toBe(true);
    fixture.buttons.get("فتح تسوية من هذا الجرد").onClick();
    render();
    expect(fixture.buttons.has("تطبيق التسوية")).toBe(true);
  });

  it("keeps manual settlement disabled when Lot tracking is enabled", () => {
    fixture.role = "admin";
    fixture.lotsEnabled = true;
    render();
    expect(fixture.buttons.get("تسوية مستقلة (بدون جرد)")?.disabled).toBe(true);
  });

  it("does not expose posting to the observer admin presentation", () => {
    fixture.role = "admin";
    fixture.isReadOnly = true;
    const output = openCompletedCount();
    expect(output).toContain("ADJ-TEST");
    expect(fixture.buttons.has("تسوية مستقلة (بدون جرد)")).toBe(false);
    expect(fixture.buttons.has("فتح تسوية من هذا الجرد")).toBe(false);
  });

  it("closes an already-open posting dialog after the role changes", () => {
    fixture.role = "admin";
    openCompletedCount();
    fixture.buttons.get("فتح تسوية من هذا الجرد").onClick();
    render();
    expect(fixture.buttons.has("تطبيق التسوية")).toBe(true);
    fixture.role = "warehouse";
    render();
    expect(fixture.buttons.has("تطبيق التسوية")).toBe(false);
    expect(fixture.mutations.get("inventoryCount.applySettlement")).not.toHaveBeenCalled();
  });
});
