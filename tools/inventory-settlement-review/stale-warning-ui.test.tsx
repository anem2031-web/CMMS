import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ status: "pending_review", sourceChanged: true, hookIndex: 0 }));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return {
    ...actual,
    // Open the actual review panel's first selected-draft state; keep all other
    // component state initializers and production permission checks unchanged.
    useState: (initial: any) => [fixture.hookIndex++ === 0 ? 1 : typeof initial === "function" ? initial() : initial, vi.fn()],
  };
});
vi.mock("../../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ authenticatedUser: { id: 9, role: "senior_management" }, isReadOnly: false }) }));
vi.mock("../../client/src/contexts/LanguageContext", () => ({ useTranslation: () => ({ language: "ar" }) }));
vi.mock("../../client/src/components/ui/dialog", () => {
  const Box = ({ children }: any) => <div>{children}</div>;
  return { Dialog: ({ open, children }: any) => open ? <div role="dialog">{children}</div> : null, DialogContent: Box, DialogFooter: Box, DialogHeader: Box, DialogTitle: Box,
    useDialogComposition: () => ({ justEndedComposing: () => false, isComposing: () => false, setComposing: vi.fn(), markCompositionEnd: vi.fn() }) };
});
vi.mock("../../client/src/lib/trpc", () => {
  const proxy = (path = ""): any => new Proxy(() => {}, { get(_target, key) {
    if (key === "useUtils") return () => proxy("utils");
    if (key === "useMutation") return () => ({ isPending: false, mutate: vi.fn() });
    if (key === "useQuery") return () => ({ isLoading: false, isFetching: false, isError: false, refetch: vi.fn(), data: path === "inventoryCount.settlementDraftDetails" ? {
      draft: { id: 1, sourceCountOperationId: 30, preparedById: 7, lastSubmittedById: 7, reason: "Count variance", version: 6, status: fixture.status, sourceChanged: fixture.sourceChanged },
      sourceCount: { id: 30, operationNumber: "CNT-UAT-30", countType: "opening_balance" },
      items: [{ countItemId: 1, inventoryId: 20, itemName: "UAT material", systemQuantity: 0, countedQuantity: 2, diffQuantity: 2, averageCostSnapshot: 10, diffValue: 20 }],
      history: [], corrections: [], pendingCorrection: null,
    } : [] });
    return proxy(path ? `${path}.${String(key)}` : String(key));
  } });
  return { trpc: proxy() };
});
import SettlementReviewPanel from "../../client/src/components/inventory/SettlementReviewPanel";

const staleText = "تغير الجرد عن آخر نسخة أُرسلت للمراجعة";
const render = () => { fixture.hookIndex = 0; return renderToStaticMarkup(<SettlementReviewPanel />); };
beforeEach(() => { fixture.status = "pending_review"; fixture.sourceChanged = true; fixture.hookIndex = 0; });

describe("Settlement review stale-source warning lifecycle", () => {
  it.each(["applied", "no_adjustment"])("does not tell the user to resubmit finalized %s even when posting changed the count fingerprint", status => {
    fixture.status = status;
    const html = render();
    expect(html).toContain("CNT-UAT-30");
    expect(html).not.toContain(staleText);
    expect(html).not.toContain("أعد إرسال التسوية");
    expect(html).toContain(status === "applied" ? "تم تطبيق التسوية" : "اعتُمدت المراجعة دون فروقات");
  });
  it.each(["draft", "pending_review", "returned"])("still warns on changed source in the unposted %s stage", status => {
    fixture.status = status;
    const html = render();
    expect(html).toContain(staleText);
    expect(html).toContain("أعد إرسال التسوية");
  });
  it("does not show a stale warning for an unchanged pending review", () => {
    fixture.sourceChanged = false;
    const html = render();
    expect(html).not.toContain(staleText);
    const approval = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes("اعتماد رسمي وتطبيق"));
    expect(approval).toBeDefined();
    expect(approval).not.toContain('disabled=""');
  });
  it("keeps approval disabled while an unposted review has a changed source", () => {
    const html = render();
    const approval = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(button => button.includes("اعتماد رسمي وتطبيق"));
    expect(approval).toBeDefined();
    expect(approval).toContain('disabled=""');
  });
});
