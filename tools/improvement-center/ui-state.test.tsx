import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  IMPROVEMENT_QUERY_OPTIONS,
  IMPROVEMENT_UI_LABELS,
  improvementDocumentStatus,
  newImprovementSaveSession,
  refreshImprovementViews,
  saveIdeaWithAttachments,
} from "../../client/src/components/improvement/improvement-ui";
import ar from "../../client/src/i18n/ar";
import en from "../../client/src/i18n/en";
import ur from "../../client/src/i18n/ur";

describe("improvement save and cache recovery", () => {
  it("retains a committed idea after partial attachment failure and retries only failed images", async () => {
    const session = newImprovementSaveSession<string>();
    const create = vi.fn(async () => ({ id: 42, requestNumber: "IMP-42" }));
    let failing = true;
    const attach = vi.fn(async (_ideaId: number, image: string) => {
      if (image === "second" && failing) throw new Error("Attachment rejected");
    });
    expect(
      await saveIdeaWithAttachments(
        session,
        { title: "Idea" },
        ["first", "second"],
        { create, attach }
      )
    ).toBe("partial");
    expect(session.created?.id).toBe(42);
    expect(session.remaining).toEqual(["second"]);
    failing = false;
    expect(
      await saveIdeaWithAttachments(
        session,
        { title: "Idea" },
        ["first", "second"],
        { create, attach }
      )
    ).toBe("complete");
    expect(create).toHaveBeenCalledTimes(1);
    expect(attach.mock.calls).toEqual([
      [42, "first"],
      [42, "second"],
      [42, "second"],
    ]);
    expect(session.remaining).toEqual([]);
  });

  it("blocks a second save before the first create request returns", async () => {
    const session = newImprovementSaveSession<string>();
    let finish!: (value: { id: number; requestNumber: string }) => void;
    const create = vi.fn(
      () =>
        new Promise<{ id: number; requestNumber: string }>(resolve => {
          finish = resolve;
        })
    );
    const ports = { create, attach: vi.fn(async () => {}) };
    const first = saveIdeaWithAttachments(
      session,
      { title: "Idea" },
      [],
      ports
    );
    expect(
      await saveIdeaWithAttachments(session, { title: "Idea" }, [], ports)
    ).toBe("busy");
    expect(create).toHaveBeenCalledTimes(1);
    finish({ id: 42, requestNumber: "IMP-42" });
    expect(await first).toBe("complete");
    expect(session.saving).toBe(false);
  });

  it("permits retry after a creation failure without pretending an idea was saved", async () => {
    const session = newImprovementSaveSession<string>();
    const attach = vi.fn(async () => {});
    const create = vi.fn(async () => {
      throw new Error("Creation failed");
    });
    await expect(
      saveIdeaWithAttachments(session, {}, ["image"], { create, attach })
    ).rejects.toThrow("Creation failed");
    expect(session.created).toBeNull();
    expect(session.saving).toBe(false);
    expect(attach).not.toHaveBeenCalled();
    expect(
      await saveIdeaWithAttachments(session, {}, [], {
        create: async () => ({ id: 5, requestNumber: "IMP-5" }),
        attach,
      })
    ).toBe("complete");
  });

  it("invalidates all list/detail/follow-up keys, including populated caches with an infinite stale time", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const names = [
      "listPaginated",
      "getGroupedClassifiedCounts",
      "getClassifiedByGroup",
      "getApproved",
      "getById",
      "executionSummary",
    ];
    const reads = names.map(name => ({ name, count: 0 }));
    const subscriptions = reads.map(read => {
      const queryKey = ["improvementIdeas", read.name];
      client.setQueryData(queryKey, { version: 0 });
      const observer = new QueryObserver(client, {
        queryKey,
        staleTime: Infinity,
        queryFn: async () => ({ version: ++read.count }),
      });
      const unsubscribe = observer.subscribe(() => {});
      return { observer, unsubscribe };
    });
    const linkedAttachments = vi.fn(async () => {});
    try {
      const ok = await refreshImprovementViews(
        {
          improvementIdeas: {
            invalidate: () =>
              client.invalidateQueries({ queryKey: ["improvementIdeas"] }),
          },
          attachments: { list: { invalidate: linkedAttachments } },
        },
        42
      );
      expect(ok).toBe(true);
      expect(reads.map(read => read.count)).toEqual([1, 1, 1, 1, 1, 1]);
      expect(linkedAttachments).toHaveBeenCalledWith({
        entityType: "improvement_idea",
        entityId: 42,
      });
    } finally {
      subscriptions.forEach(({ observer, unsubscribe }) => {
        unsubscribe();
        observer.destroy();
      });
      client.clear();
    }
  });

  it("handles cache/network failure without turning committed saving into another create attempt", async () => {
    const attachments = vi.fn(async () => {});
    const utils = {
      improvementIdeas: {
        invalidate: async () => {
          throw new Error("Offline");
        },
      },
      attachments: { list: { invalidate: attachments } },
    };
    await expect(refreshImprovementViews(utils, 42)).resolves.toBe(false);
    expect(attachments).toHaveBeenCalledTimes(1);
  });

  it("refetches already fresh cache on return from a linked document without polling", async () => {
    const client = new QueryClient();
    const key = ["improvementIdeas", "getApproved"];
    client.setQueryData(key, [{ linkedTicketStatus: "in_progress" }]);
    const read = vi.fn(async () => [{ linkedTicketStatus: "closed" }]);
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: read,
      staleTime: Infinity,
      ...IMPROVEMENT_QUERY_OPTIONS,
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() =>
      expect(client.getQueryData(key)).toEqual([
        { linkedTicketStatus: "closed" },
      ])
    );
    expect(read).toHaveBeenCalledOnce();
    expect(client.getQueryData(key)).toEqual([
      { linkedTicketStatus: "closed" },
    ]);
    expect("refetchInterval" in IMPROVEMENT_QUERY_OPTIONS).toBe(false);
    unsubscribe();
    observer.destroy();
    client.clear();
  });
});

const view = vi.hoisted(() => ({
  language: "ar",
  query: {} as any,
  listQuery: {} as any,
}));
vi.mock("../../client/src/lib/trpc", () => {
  const api = (path = ""): any =>
    new Proxy(() => {}, {
      get: (_target, property) => {
        if (property === "useQuery")
          return () =>
            path === "improvementIdeas.executionSummary"
              ? view.query
              : path === "improvementIdeas.listPaginated"
                ? view.listQuery
                : {
                    data: [],
                    isLoading: false,
                    isFetching: false,
                    refetch: vi.fn(),
                  };
        if (property === "useUtils") return () => api("utils");
        if (property === "useMutation")
          return () => ({
            mutate: vi.fn(),
            mutateAsync: vi.fn(),
            isPending: false,
          });
        return api(path ? `${path}.${String(property)}` : String(property));
      },
    });
  return { trpc: api() };
});
vi.mock("../../client/src/contexts/LanguageContext", async () => {
  const dictionaries = {
    ar: (await import("../../client/src/i18n/ar")).default,
    en: (await import("../../client/src/i18n/en")).default,
    ur: (await import("../../client/src/i18n/ur")).default,
  };
  return {
    useTranslation: () => ({
      language: view.language,
      t: dictionaries[view.language as keyof typeof dictionaries],
    }),
  };
});
vi.mock("../../client/src/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 7, role: "admin" } }),
}));
vi.mock("../../client/src/hooks/useContentTranslation", async () => {
  const dictionaries = {
    ar: (await import("../../client/src/i18n/ar")).default,
    en: (await import("../../client/src/i18n/en")).default,
    ur: (await import("../../client/src/i18n/ur")).default,
  };
  return {
    useStaticLabels: () => ({
      getPriorityLabel: (priority: string) =>
        (
          dictionaries[view.language as keyof typeof dictionaries]
            .priority as Record<string, string>
        )[priority],
    }),
  };
});
vi.mock("wouter", () => ({
  useLocation: () => ["/improvement-ideas", vi.fn()],
  useSearch: () => "",
}));
import { ImprovementFinancialPanel } from "../../client/src/components/improvement/ImprovementFinancialPanel";
import ImprovementIdeas from "../../client/src/pages/improvement/ImprovementIdeas";

describe("improvement feedback and localization", () => {
  it.each(["ar", "en", "ur"] as const)(
    "distinguishes the real new-ideas list loading/error/empty states in %s",
    language => {
      view.language = language;
      const t = { ar, en, ur }[language];
      view.listQuery = { isLoading: true, isFetching: true, refetch: vi.fn() };
      let html = renderToStaticMarkup(<ImprovementIdeas />);
      expect(html).toContain('role="status"');
      expect(html).toContain(IMPROVEMENT_UI_LABELS[language].loading);
      expect(html).not.toContain(t.improvementIdeas.noIdeas);
      view.listQuery = {
        isLoading: false,
        isFetching: false,
        error: new Error("SELECT"),
        refetch: vi.fn(),
      };
      html = renderToStaticMarkup(<ImprovementIdeas />);
      expect(html).toContain(IMPROVEMENT_UI_LABELS[language].loadError);
      expect(html).toContain(IMPROVEMENT_UI_LABELS[language].retry);
      expect(html).not.toContain(t.improvementIdeas.noIdeas);
      view.listQuery = {
        isLoading: false,
        isFetching: false,
        data: { ideas: [] },
        refetch: vi.fn(),
      };
      html = renderToStaticMarkup(<ImprovementIdeas />);
      expect(html).toContain(t.improvementIdeas.noIdeas);
      view.listQuery = { ...view.listQuery, isFetching: true };
      html = renderToStaticMarkup(<ImprovementIdeas />);
      expect(html).toContain(IMPROVEMENT_UI_LABELS[language].loading);
      expect(html).not.toContain(t.improvementIdeas.noIdeas);
    }
  );

  it.each(["ar", "en", "ur"] as const)(
    "shows a clear retry on loading failures in %s",
    language => {
      view.language = language;
      view.query = {
        isLoading: false,
        error: new Error("SELECT private implementation detail"),
        isFetching: false,
        refetch: vi.fn(),
      };
      const html = renderToStaticMarkup(
        <ImprovementFinancialPanel ideaId={42} />
      );
      expect(html).toContain(IMPROVEMENT_UI_LABELS[language].loadError);
      expect(html).toContain(IMPROVEMENT_UI_LABELS[language].retry);
      expect(html).not.toContain("SELECT");
    }
  );

  it.each(["ar", "en", "ur"] as const)(
    "uses localized priority and linked-document status labels in %s",
    language => {
      const t = { ar, en, ur }[language];
      expect(t.priority.medium).not.toBe("medium");
      expect(
        improvementDocumentStatus(t.ticketStatus, "in_progress", "unknown")
      ).toBe(t.ticketStatus.in_progress);
      expect(
        improvementDocumentStatus(t.poStatus, "partial_purchase", "unknown")
      ).toBe(t.poStatus.partial_purchase);
      expect(
        improvementDocumentStatus(t.ticketStatus, "not-a-state", "unknown")
      ).toBe("unknown");
      view.language = language;
      view.query = {
        isLoading: false,
        isFetching: true,
        refetch: vi.fn(),
        data: {
          estimatedTotal: 0,
          total: 0,
          budgetRemaining: 0,
          complete: true,
          executionDone: false,
          executionProgress: { percent: 33 },
          issues: [],
          lines: [],
          tickets: [{ id: 1, ticketNumber: "MT-1", status: "in_progress" }],
          orders: [{ id: 2, poNumber: "PR-2", status: "partial_purchase" }],
        },
      };
      const html = renderToStaticMarkup(
        <ImprovementFinancialPanel ideaId={42} />
      );
      expect(html).toContain(t.ticketStatus.in_progress);
      expect(html).toContain(t.poStatus.partial_purchase);
      expect(html).not.toContain("in_progress");
      expect(html).not.toContain("partial_purchase");
      expect(html).toContain(IMPROVEMENT_UI_LABELS[language].automaticProgress);
      expect(html).toContain("33%");
      expect(html).toContain('role="status"');
    }
  );
});
