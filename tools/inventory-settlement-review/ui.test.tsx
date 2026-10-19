import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: "warehouse",
  userId: 7,
  readOnly: false,
  language: "ar",
  rows: [] as any[],
  error: false,
  loading: false,
  detail: undefined as unknown,
}));
vi.mock("../../client/src/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    authenticatedUser: { role: state.role, id: state.userId },
    isReadOnly: state.readOnly,
  }),
}));
vi.mock("../../client/src/contexts/LanguageContext", () => ({
  useTranslation: () => ({ language: state.language }),
}));
vi.mock("../../client/src/lib/trpc", () => {
  const mutation = {
    useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  };
  const query = {
    useQuery: () => ({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    }),
  };
  return {
    trpc: {
      useUtils: () => ({
        inventoryCount: { invalidate: vi.fn() },
        inventory: { list: { invalidate: vi.fn() } },
      }),
      inventoryCount: {
        settlementDrafts: {
          useQuery: () => ({
            data: state.rows,
            isFetching: state.loading,
            isError: state.error,
            refetch: vi.fn(),
          }),
        },
        settlementDraftDetails: {
          useQuery: () => ({
            data: state.detail,
            isLoading: false,
            isFetching: false,
            isError: false,
            refetch: vi.fn(),
          }),
        },
        listOperations: query,
        listSettlements: query,
        saveSettlementDraft: mutation,
        submitSettlementDraft: mutation,
        returnSettlementDraft: mutation,
        requestCountCorrection: mutation,
        correctCount: mutation,
        approveSettlementDraft: mutation,
      },
    },
  };
});

import SettlementReviewPanel, {
  settlementReviewPermissions,
} from "../../client/src/components/inventory/SettlementReviewPanel";
import { buildCountHtml } from "../../client/src/lib/printInventoryOperationDocuments";

const draft = (
  status: "draft" | "pending_review" | "returned" | "applied" = "draft"
) => ({
  id: 1,
  status,
  version: 2,
  sourceCountOperationId: 30,
  preparedById: 7,
  sourceCountNumber: "CNT-30",
  preparedByName: "Warehouse maker",
  reason: "Recorded count variance",
  lastSubmittedById: 7,
});

beforeEach(() => {
  state.role = "warehouse";
  state.userId = 7;
  state.readOnly = false;
  state.language = "ar";
  state.rows = [];
  state.error = false;
  state.loading = false;
  state.detail = undefined;
});

describe("settlement maker and reviewer actions", () => {
  it("lets warehouse prepare and edit its own unposted draft but never approve", () => {
    expect(
      settlementReviewPermissions("warehouse", 7, false, draft())
    ).toMatchObject({
      prepare: true,
      edit: true,
      review: false,
      approve: false,
    });
    expect(
      settlementReviewPermissions("warehouse", 7, false, draft("returned")).edit
    ).toBe(true);
    expect(
      settlementReviewPermissions("warehouse", 8, false, draft()).edit
    ).toBe(false);
    expect(
      settlementReviewPermissions(
        "warehouse",
        7,
        false,
        draft("pending_review")
      ).edit
    ).toBe(false);
  });
  it("allows senior management to review other makers without preparing or editing", () => {
    expect(
      settlementReviewPermissions(
        "senior_management",
        9,
        false,
        draft("pending_review")
      )
    ).toEqual({ prepare: false, edit: false, review: true, approve: true });
    expect(
      settlementReviewPermissions("senior_management", 9, false, draft())
        .approve
    ).toBe(false);
  });
  it("preserves admin/owner preparation but prevents approving their own work", () => {
    for (const role of ["admin", "owner"]) {
      expect(
        settlementReviewPermissions(role, 9, false, draft("pending_review"))
          .approve
      ).toBe(true);
      expect(
        settlementReviewPermissions(role, 7, false, draft("pending_review"))
          .approve
      ).toBe(false);
      expect(
        settlementReviewPermissions(role, 9, false, {
          ...draft("pending_review"),
          lastSubmittedById: 9,
        }).approve
      ).toBe(false);
      expect(settlementReviewPermissions(role, 9, false, draft()).edit).toBe(
        true
      );
    }
  });
  it("blocks any contributor from approving while keeping an independent correction requester eligible", () => {
    for (const action of [
      "created",
      "edited",
      "submitted",
      "count_corrected",
    ]) {
      expect(
        settlementReviewPermissions(
          "admin",
          9,
          false,
          draft("pending_review"),
          [{ actorId: 9, action }]
        ).approve
      ).toBe(false);
    }
    expect(
      settlementReviewPermissions(
        "senior_management",
        9,
        false,
        draft("pending_review"),
        [{ actorId: 9, action: "correction_requested" }]
      ).approve
    ).toBe(true);
  });
  it("offers no mutations to an observer even if an observer view is represented as admin", () => {
    for (const role of [
      "observer",
      "admin",
      "owner",
      "warehouse",
      "senior_management",
    ]) {
      expect(
        settlementReviewPermissions(role, 9, true, draft("pending_review"))
      ).toEqual({ prepare: false, edit: false, review: false, approve: false });
    }
  });
  it("locks applied records against edit, resubmission and approval", () => {
    for (const role of ["warehouse", "admin", "owner", "senior_management"]) {
      expect(
        settlementReviewPermissions(role, 9, false, draft("applied"))
      ).toMatchObject({ edit: false, approve: false });
    }
  });
});

describe("review panel disclosure and loading", () => {
  it("renders safely before any details are loaded, including an empty cached result", () => {
    for (const detail of [undefined, {}, []]) {
      state.detail = detail;
      expect(() =>
        renderToStaticMarkup(<SettlementReviewPanel />)
      ).not.toThrow();
    }
  });
  it("states explicitly that drafts do not change stock and exposes creator entry to warehouse", () => {
    const html = renderToStaticMarkup(<SettlementReviewPanel />);
    expect(html).toContain("الحفظ والإرسال والتصحيح لا تغير المخزون");
    expect(html).toContain("مسودة تسوية من جرد");
  });
  it("hides preparation from senior management and observer", () => {
    for (const role of ["senior_management", "observer"]) {
      state.role = role;
      expect(renderToStaticMarkup(<SettlementReviewPanel />)).not.toContain(
        "مسودة تسوية من جرد"
      );
    }
  });
  it("shows source count, preparer and localized lifecycle rows", () => {
    state.rows = [
      draft(),
      draft("pending_review"),
      draft("returned"),
      draft("applied"),
    ].map((row, index) => ({ ...row, id: index + 1 }));
    state.rows[0].warehouseName = "مخزن الاختبار";
    const html = renderToStaticMarkup(<SettlementReviewPanel />);
    expect(html).toContain("CNT-30");
    expect(html).toContain("Warehouse maker");
    expect(html).toContain("مخزن الاختبار");
    expect(html).toContain("بانتظار اعتماد الإدارة");
    expect(html).toContain("معادة للتعديل");
    expect(html).toContain("معتمدة ومطبقة");
    expect(html).not.toContain(">pending_review<");
  });
  it("does not misrepresent loading as a definitive empty result", () => {
    state.loading = true;
    const html = renderToStaticMarkup(<SettlementReviewPanel />);
    expect(html).toContain("جارٍ تحميل التسويات");
    expect(html).not.toContain("لا توجد تسويات بهذه الحالة");
  });
  it("shows retry without disclosing an internal SQL failure", () => {
    state.error = true;
    const html = renderToStaticMarkup(<SettlementReviewPanel />);
    expect(html).toContain("تعذر تحميل التسويات");
    expect(html).toContain("إعادة المحاولة");
    expect(html).not.toContain("Failed query");
  });
  it.each(["en", "ur"])("renders translated labels for %s", language => {
    state.language = language;
    const html = renderToStaticMarkup(<SettlementReviewPanel />);
    expect(html).not.toContain("مسودات التسوية واعتمادها");
    expect(html).toContain(
      language === "en"
        ? "Settlement drafts and approval"
        : "تسویے کے مسودے اور منظوری"
    );
  });
});

describe("count printing preserves correction evidence", () => {
  const count = () => ({
    operation: {
      operationNumber: "CNT-TEST-1",
      operationDate: new Date("2026-10-19T06:00:00Z"),
      status: "completed",
      scope: "full",
    },
    items: [
      {
        countItemId: 1,
        itemName: "Bulbs",
        unit: "piece",
        systemQuantity: "100",
        countedQuantity: "95",
        diffQuantity: "-5",
        averageCostSnapshot: "10",
        diffValue: "-50",
      },
    ],
  });
  const correction = () => ({
    id: 8,
    requestedByName: "Reviewer",
    correctedByName: "Counter",
    requestedReason: "Correct original transcription",
    correctionReason: "Actual original observation was 95",
    correctedAt: new Date("2026-10-19T09:00:00Z"),
    changes: [
      {
        countItemId: 1,
        itemName: "Bulbs",
        previousQuantity: 90,
        correctedQuantity: 95,
      },
    ],
  });
  it("preserves the original print format for an uncorrected count", () => {
    const original = count();
    expect(buildCountHtml(original)).toBe(
      buildCountHtml({
        ...original,
        operation: { ...original.operation, correctionVersion: 0 },
        countCorrections: [],
      })
    );
    expect(buildCountHtml(original)).not.toContain("نسخة مصححة");
  });
  it("labels the corrected copy and prints original/new quantities, reasons and actors", () => {
    const original = count();
    const html = buildCountHtml({
      ...original,
      operation: { ...original.operation, correctionVersion: 1 },
      countCorrections: [correction()],
    });
    expect(html).toContain("نسخة مصححة — التصحيح رقم 1");
    expect(html).toContain("CNT-TEST-1");
    expect(html).toContain("<td>90</td><td>95</td>");
    expect(html).toContain("Reviewer");
    expect(html).toContain("Counter");
    expect(html).toContain("Correct original transcription");
    expect(html).toContain("Actual original observation was 95");
    expect(html).toContain("بتوقيت الرياض");
  });
  it("escapes added correction text rather than injecting markup into the print document", () => {
    const original = count(),
      proof = correction();
    proof.requestedByName = '<img src="bad" onerror="x">';
    proof.correctionReason = "<script>bad()</script> & proof";
    proof.changes[0].itemName = "<b>Bulbs</b>";
    const html = buildCountHtml({
      ...original,
      operation: { ...original.operation, correctionVersion: 1 },
      countCorrections: [proof],
    });
    expect(html).not.toContain('<img src="bad"');
    expect(html).not.toContain("<script>bad()");
    expect(html).not.toContain("<b>Bulbs</b>");
    expect(html).toContain("&lt;img src=&quot;bad&quot;");
    expect(html).toContain("&lt;script&gt;bad()&lt;/script&gt; &amp; proof");
  });
  it("retains the complete sequence of separately documented corrections", () => {
    const original = count(),
      first = correction(),
      second = {
        ...correction(),
        id: 9,
        changes: [
          {
            countItemId: 1,
            itemName: "Bulbs",
            previousQuantity: 95,
            correctedQuantity: 97,
          },
        ],
      };
    const html = buildCountHtml({
      ...original,
      operation: { ...original.operation, correctionVersion: 2 },
      countCorrections: [first, second],
    });
    expect(html).toContain("التصحيح رقم 2");
    expect(html).toContain("طلب التصحيح #8");
    expect(html).toContain("طلب التصحيح #9");
    expect(html).toContain("<td>90</td><td>95</td>");
    expect(html).toContain("<td>95</td><td>97</td>");
  });
});
