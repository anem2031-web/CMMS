import { useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import GeneralTicketsList from "@/pages/tickets/GeneralTicketsList";
import { ConstructionTicketsPanel } from "@/pages/construction/ConstructionTickets";
import {
  TICKET_LIST_TAB,
  canSeeAllTicketsTab,
  canSeeConstructionTicketsTab,
  resolveTicketListTab,
  ticketListUrl,
  type TicketListTab,
} from "@/pages/tickets/ticketTabs";

export default function Tickets() {
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [, setLocation] = useLocation();
  const search = useSearch();

  const requestedTab = useMemo(
    () => new URLSearchParams(search).get("tab"),
    [search],
  );
  const activeTab = resolveTicketListTab(user?.role, requestedTab);
  const showAllTab = canSeeAllTicketsTab(user?.role);
  const showConstructionTab = canSeeConstructionTicketsTab(user?.role);

  useEffect(() => {
    const invalidRequestedTab = requestedTab && requestedTab !== activeTab;
    const constructionOnlyUserMissingTab =
      !showAllTab &&
      showConstructionTab &&
      requestedTab !== TICKET_LIST_TAB.CONSTRUCTION;

    if (invalidRequestedTab || constructionOnlyUserMissingTab) {
      setLocation(ticketListUrl(activeTab));
    }
  }, [activeTab, requestedTab, setLocation, showAllTab, showConstructionTab]);

  const handleTabChange = (value: string) => {
    const nextTab = resolveTicketListTab(user?.role, value);
    setLocation(ticketListUrl(nextTab));
  };

  return (
    <div className="space-y-5">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        dir={language === "en" ? "ltr" : "rtl"}
      >
        <TabsList className="h-auto flex-wrap">
          {showAllTab && (
            <TabsTrigger value={TICKET_LIST_TAB.ALL}>
              {t.nav.tickets}
            </TabsTrigger>
          )}
          {showConstructionTab && (
            <TabsTrigger value={TICKET_LIST_TAB.CONSTRUCTION}>
              {t.nav.construction.tickets}
            </TabsTrigger>
          )}
        </TabsList>

        {showAllTab && (
          <TabsContent value={TICKET_LIST_TAB.ALL} className="mt-5">
            <GeneralTicketsList />
          </TabsContent>
        )}

        {showConstructionTab && (
          <TabsContent value={TICKET_LIST_TAB.CONSTRUCTION} className="mt-5">
            <ConstructionTicketsPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
