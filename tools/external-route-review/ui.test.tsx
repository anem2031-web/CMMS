import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const f = vi.hoisted(() => ({ role: "maintenance_manager", language: "ar", query: vi.fn(), rows: [{ ticketId: 10, ticketItemId: 11, itemNumber: 1, returnId: 7, reason: "لا يحتاج ورشة خارجية", reviewerId: 3 }] }));
vi.mock("../../client/src/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 3, role: f.role } }) }));
vi.mock("../../client/src/contexts/LanguageContext", () => ({ useTranslation: () => ({ language: f.language }) }));
vi.mock("../../client/src/lib/trpc", () => ({ trpc: {
  useUtils: () => ({}), externalMaintenance: {
    routeReviews: { useQuery: (input: unknown) => { f.query(input); return { data: f.rows }; } },
    decideRouteReview: { useMutation: () => ({ isPending: false, error: null, mutate: vi.fn() }) },
  },
} }));
import { ExternalRouteReviewPanel } from "../../client/src/pages/tickets/ExternalRouteReviewPanel";
describe("same route decision form in ticket and execution windows", () => {
  it.each([undefined, 11])("renders same choices and required reason for item=%s", ticketItemId => {
    f.role = "maintenance_manager"; f.language = "ar";
    const html = renderToStaticMarkup(<ExternalRouteReviewPanel ticketId={10} ticketItemId={ticketItemId} onChanged={() => {}} />);
    expect(html).toContain("لا يحتاج ورشة خارجية");
    for (const route of ["A", "B", "C"]) expect(html).toContain(`value="${route}"`);
    expect(html).toContain("سبب القرار (مطلوب)");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain("إلغاء الطلب");
  });
  it("does not render another item's decision in an execution window", () => {
    f.role = "maintenance_manager";
    expect(renderToStaticMarkup(<ExternalRouteReviewPanel ticketId={10} ticketItemId={99} onChanged={() => {}} />)).toBe("");
  });
  it.each(["warehouse", "technician", "it_member", "accountant", "senior_management"])("does not query review data for %s", role => {
    f.role = role; f.query.mockClear();
    expect(renderToStaticMarkup(<ExternalRouteReviewPanel ticketId={10} onChanged={() => {}} />)).toBe("");
    expect(f.query).not.toHaveBeenCalled();
  });
  it("shows the same choices in English for an IT manager", () => {
    f.role = "it_manager"; f.language = "en";
    const html = renderToStaticMarkup(<ExternalRouteReviewPanel ticketId={10} onChanged={() => {}} />);
    expect(html).toContain("Internal repair"); expect(html).toContain("Materials needed"); expect(html).toContain("Confirm external repair");
  });
});
