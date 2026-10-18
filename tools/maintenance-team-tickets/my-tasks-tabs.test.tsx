import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ar from "../../client/src/i18n/ar";
import en from "../../client/src/i18n/en";
import ur from "../../client/src/i18n/ur";

const fixture = vi.hoisted(() => ({
  search: "",
  language: "ar",
  user: { id: 60723, role: "technician", isActive: 1 },
  loading: false,
  queryCalls: [] as any[],
  executionCalls: [] as any[],
  pmv2Renders: 0,
  navigate: vi.fn(),
  changeTab: undefined as undefined | ((value: string) => void),
  renderExecution: undefined as undefined | ((ticket: any) => React.ReactNode),
}));
vi.mock("wouter", () => ({
  useSearch: () => fixture.search,
  useLocation: () => ["/scheduled-maintenance/my-tasks", fixture.navigate],
}));
vi.mock("../../client/src/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: fixture.user, loading: fixture.loading }),
}));
vi.mock("../../client/src/contexts/LanguageContext", () => ({
  useTranslation: () => ({
    language: fixture.language,
    dir: fixture.language === "en" ? "ltr" : "rtl",
    t: fixture.language === "en" ? en : fixture.language === "ur" ? ur : ar,
  }),
}));
vi.mock("../../client/src/components/ui/tabs", async importOriginal => {
  const original =
    await importOriginal<
      typeof import("../../client/src/components/ui/tabs")
    >();
  return {
    ...original,
    Tabs: (props: React.ComponentProps<typeof original.Tabs>) => {
      fixture.changeTab = props.onValueChange;
      return <original.Tabs {...props} />;
    },
  };
});
vi.mock("../../client/src/pages/pmv2/Pmv2MyTasks", () => ({
  default: () => {
    fixture.pmv2Renders++;
    return <p>existing scheduled tasks and material attention</p>;
  },
}));
vi.mock("../../client/src/pages/maintenance-teams/ExecutionPanel", () => ({
  ExecutionPanel: (props: any) => {
    fixture.executionCalls.push(props);
    return <p>existing ticket execution and materials</p>;
  },
}));
vi.mock(
  "../../client/src/pages/maintenance-teams/TicketExecutionTasksView",
  async importOriginal => {
    const original =
      await importOriginal<
        typeof import("../../client/src/pages/maintenance-teams/TicketExecutionTasksView")
      >();
    return {
      TicketExecutionTasksView: (
        props: React.ComponentProps<typeof original.TicketExecutionTasksView>
      ) => {
        fixture.renderExecution = props.renderExecution;
        return <original.TicketExecutionTasksView {...props} />;
      },
    };
  }
);
vi.mock("../../client/src/pages/maintenance-teams/TicketSequentialTasksView", async importOriginal => {
  const original = await importOriginal<typeof import("../../client/src/pages/maintenance-teams/TicketSequentialTasksView")>();
  return { TicketSequentialTasksView: (props: React.ComponentProps<typeof original.TicketSequentialTasksView>) => {
    fixture.renderExecution = props.renderExecution;
    return <original.TicketSequentialTasksView {...props} />;
  } };
});
vi.mock("../../client/src/lib/trpc", () => ({
  trpc: {
    tickets: {
      list: { useQuery: () => ({ data: [], isFetching: false, refetch: vi.fn() }) },
      listPaginated: { useQuery: () => ({ data: { tickets: [], totalPages: 1 }, isFetching: false, refetch: vi.fn() }) },
    },
    useUtils: () => ({
      ticketTeamExecution: {
        details: { invalidate: vi.fn() },
        balances: { invalidate: vi.fn() },
      },
    }),
    ticketTeamAssignments: {
      queue: {
        useQuery: (_input: any, options: any) => {
          fixture.queryCalls.push(options);
          return {
            data: [
              {
                assignmentId: 10,
                ticketId: 568,
                ticketNumber: "MT-2026-00568-01",
                title: "إصلاح التكييف",
                teamId: 21,
                teamName: "فريق التكييف",
                warehouseName: "مستودع التكييف",
                stage: "action_required",
                siteName: "الموقع",
                sectionName: "القسم",
                description: "اختبار",
              },
            ],
            isLoading: false,
            isFetching: false,
            error: null,
            refetch: vi.fn(),
          };
        },
      },
    },
  },
}));
import MyTasksPage from "../../client/src/pages/pmv2/MyTasksPage";

const render = () => renderToStaticMarkup(<MyTasksPage />);
beforeEach(() => {
  Object.assign(fixture, {
    search: "",
    language: "ar",
    loading: false,
    user: { id: 60723, role: "technician", isActive: 1 },
    queryCalls: [],
    executionCalls: [],
    pmv2Renders: 0,
    changeTab: undefined,
    renderExecution: undefined,
  });
  fixture.navigate.mockReset();
});
describe("my-tasks source tabs with isolated API boundaries", () => {
  it("shows ticket then scheduled tabs; the default loads the original ticket queue and execution", () => {
    const html = render();
    expect((html.match(/role="tab"/g) ?? []).length).toBe(2);
    expect(html.indexOf(ar.nav.maintenanceTeamTickets)).toBeLessThan(
      html.indexOf(ar.nav.scheduledMaintenance)
    );
    expect(html).toContain('data-state="active"');
    expect(html).toContain("MT-2026-00568-01");
    expect(fixture.executionCalls).toHaveLength(0);
    expect(
      renderToStaticMarkup(fixture.renderExecution!({ assignmentId: 10 }))
    ).toContain("existing ticket execution and materials");
    expect(fixture.queryCalls).toEqual([{ enabled: true, retry: false, refetchInterval: 30_000 }]);
    expect(fixture.executionCalls[0]).toMatchObject({
      assignmentId: 10,
      actorId: 60723,
      role: "technician",
    });
    expect(fixture.pmv2Renders).toBe(0);
  });
  it("switches to PMV2 and back, preserving other URL parameters and restoring the chosen tab on reload", () => {
    fixture.search = "filter=open";
    render();
    fixture.changeTab!("pmv2");
    expect(fixture.navigate).toHaveBeenLastCalledWith(
      "/scheduled-maintenance/my-tasks?filter=open&source=pmv2"
    );
    fixture.search = "filter=open&source=pmv2";
    fixture.queryCalls = [];
    expect(render()).toContain(
      "existing scheduled tasks and material attention"
    );
    expect(fixture.queryCalls).toEqual([]);
    fixture.changeTab!("tickets");
    expect(fixture.navigate).toHaveBeenLastCalledWith(
      "/scheduled-maintenance/my-tasks?filter=open&source=tickets"
    );
    fixture.search = "filter=open&source=tickets";
    fixture.executionCalls = [];
    expect(render()).toContain("MT-2026-00568-01");
    expect(fixture.queryCalls).toEqual([{ enabled: true, retry: false, refetchInterval: 30_000 }]);
  });
  it.each([
    "owner",
    "admin",
    "maintenance_manager",
    "general_maintenance_manager",
    "construction_procurement_manager",
  ])("%s retains access to both original task views", role => {
    fixture.user.role = role;
    expect(render()).toContain("MT-2026-00568-01");
    expect(
      renderToStaticMarkup(fixture.renderExecution!({ assignmentId: 10 }))
    ).toContain("existing ticket execution and materials");
    expect(fixture.executionCalls[0].role).toBe(role);
    fixture.search = "source=pmv2";
    expect(render()).toContain(
      "existing scheduled tasks and material attention"
    );
  });
  it.each(["it_manager", "it_member"])(
    "%s retains only its existing PMV2 scope and cannot load ticket execution",
    role => {
      fixture.user.role = role;
      fixture.search = "source=tickets";
      const html = render();
      expect(html).toMatch(
        /<button[^>]*disabled=""[^>]*>تذاكر الصيانة<\/button>/
      );
      expect(html).toContain("existing scheduled tasks and material attention");
      expect(fixture.queryCalls).toEqual([]);
      fixture.changeTab!("tickets");
      expect(fixture.navigate).not.toHaveBeenCalled();
    }
  );
  it("does not mount either query view before authentication finishes or for inactive/unauthorized accounts", () => {
    fixture.loading = true;
    expect(render()).toContain(ar.common.loading);
    fixture.loading = false;
    fixture.user.isActive = 0;
    expect(render()).toContain('role="alert"');
    fixture.user.isActive = 1;
    fixture.user.role = "warehouse";
    expect(render()).toContain('role="alert"');
    expect(fixture.queryCalls).toEqual([]);
    expect(fixture.pmv2Renders).toBe(0);
  });
  it.each(["ar", "en", "ur"])(
    "%s uses existing program tab labels and layout direction",
    language => {
      fixture.language = language;
      const t = language === "en" ? en : language === "ur" ? ur : ar;
      const html = render();
      expect(html).toContain(t.nav.maintenanceTeamTickets);
      expect(html).toContain(t.nav.scheduledMaintenance);
      expect(html).toContain(`dir="${language === "en" ? "ltr" : "rtl"}"`);
    }
  );
  it("an unknown source defaults to tickets and cannot trigger arbitrary navigation", () => {
    fixture.search = "source=unknown";
    expect(render()).toContain("MT-2026-00568-01");
    fixture.changeTab!("unknown");
    expect(fixture.navigate).not.toHaveBeenCalled();
  });
  it("routes the combined page without removing the original standalone ticket route", () => {
    const app = readFileSync(
      new URL("../../client/src/App.tsx", import.meta.url),
      "utf8"
    );
    expect(app).toContain(
      '<Route path="/scheduled-maintenance/my-tasks" component={MyTasksPage} />'
    );
    expect(app).toContain(
      '<Route path="/maintenance-team-tickets" component={AssignedMaintenanceTickets} />'
    );
  });
});
