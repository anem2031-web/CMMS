import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { AssignedTicketsView } from "@/features/maintenance-team-tickets/AssignedTicketsView";
import { ExecutionPanel } from "./ExecutionPanel";
import { useState, useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { WarehouseSection } from "@shared/maintenance-team-tickets/warehouse-materials";

export default function TicketWarehouseRequests({
  ticketId,
}: {
  ticketId?: number;
}) {
  const { user, loading } = useAuth();
  const { language, dir, t } = useTranslation();
  const utils = trpc.useUtils();
  const [section, setSection] = useState<WarehouseSection>("waiting");
  const focused = useRef<number | null>(null);
  const sections: WarehouseSection[] = ["waiting", "ready", "returns"];
  const labels =
    language === "ar"
      ? ["تحتاج معالجة", "جاهزة للصرف", "المرتجعات"]
      : language === "ur"
        ? ["کارروائی درکار", "اجرا کے لیے تیار", "واپسی"]
        : ["Needs processing", "Ready to issue", "Returns"];
  const allowed =
    user?.isActive === 1 && ["warehouse", "owner", "admin"].includes(user.role);
  const requests = trpc.ticketTeamAssignments.warehouseRequests.useQuery(
    undefined,
    {
      enabled: !!allowed,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  useEffect(() => {
    if (!ticketId || focused.current === ticketId) return;
    const ticket = requests.data?.find(t => t.ticketId === ticketId);
    if (!ticket) return;
    focused.current = ticketId;
    setSection(ticket.materialSections?.[0] ?? "waiting");
  }, [ticketId, requests.data]);
  if (loading || (allowed && requests.isLoading))
    return <p className="p-6">{t.common.loading}</p>;
  if (!allowed)
    return (
      <p role="alert" className="p-6">
        {language === "ar"
          ? "طلبات مواد التذاكر للمستودع فقط"
          : language === "ur"
            ? "ٹکٹ کے مواد کی درخواستیں صرف گودام کے لیے ہیں۔"
            : "Ticket material requests are for the warehouse only."}
      </p>
    );
  return (
    <div className="space-y-4" dir={dir}>
      <Button
        variant="outline"
        disabled={requests.isFetching}
        onClick={() =>
          void Promise.all([
            requests.refetch(),
            utils.ticketTeamExecution.details.invalidate(),
            utils.ticketTeamExecution.balances.invalidate(),
          ])
        }
      >
        {t.common.refresh}
      </Button>
      {requests.error && (
        <p role="alert" className="text-destructive">
          {requests.error.message}
        </p>
      )}
      <Tabs
        value={section}
        onValueChange={value => setSection(value as WarehouseSection)}
      >
        <TabsList className="grid w-full grid-cols-3">
          {sections.map((value, index) => (
            <TabsTrigger key={value} value={value}>
              {labels[index]} (
              {requests.data?.filter(t =>
                (t.materialSections ?? ["waiting"]).includes(value)
              ).length ?? 0}
              )
            </TabsTrigger>
          ))}
        </TabsList>
        {sections.map(value => (
          <TabsContent key={value} value={value}>
            {requests.data && (
              <AssignedTicketsView
                key={`${value}:${ticketId ?? "all"}`}
                tickets={requests.data.filter(t =>
                  (t.materialSections ?? ["waiting"]).includes(value)
                )}
                language={language}
                audience="warehouse"
                focusTicketId={ticketId}
                renderExecution={ticket => (
                  <ExecutionPanel
                    assignmentId={ticket.assignmentId}
                    actorId={user!.id}
                    role={user!.role}
                    language={language}
                    mode="warehouse"
                    warehouseSection={value}
                    onChanged={() => void requests.refetch()}
                  />
                )}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
