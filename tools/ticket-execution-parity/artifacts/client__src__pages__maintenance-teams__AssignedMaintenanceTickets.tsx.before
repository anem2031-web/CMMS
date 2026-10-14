import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { canReadTicketTeamExecution } from "@shared/maintenance-team-tickets/execution-permissions";
import { AssignedTicketsView } from "@/features/maintenance-team-tickets/AssignedTicketsView";
import { ExecutionPanel } from "./ExecutionPanel";

export default function AssignedMaintenanceTickets() {
  const { user, loading } = useAuth();
  const { language, dir, t } = useTranslation();
  const utils = trpc.useUtils();
  const allowed = user?.isActive === 1 && canReadTicketTeamExecution(user.role);
  const queue = trpc.ticketTeamAssignments.queue.useQuery(undefined, { enabled: !!allowed, retry: false });
  if (loading || (allowed && queue.isLoading)) return <div className="p-6">{t.common.loading}</div>;
  if (!allowed) return <div role="alert" className="p-6">{language === "ar" ? "ليس لديك صلاحية لعرض تذاكر الفريق" : language === "ur" ? "آپ کو ٹیم کے ٹکٹ دیکھنے کی اجازت نہیں ہے۔" : "You cannot view team tickets."}</div>;
  return <div className="space-y-4 p-6" dir={dir}>
    <button className="text-sm underline" disabled={queue.isFetching} onClick={() => void Promise.all([queue.refetch(), utils.ticketTeamExecution.details.invalidate(), utils.ticketTeamExecution.balances.invalidate()])}>{language === "ar" ? "تحديث" : language === "ur" ? "تازہ کریں" : "Refresh"}</button>
    {queue.error && <p role="alert" className="text-destructive">{queue.error.message}</p>}
    {queue.data && <AssignedTicketsView tickets={queue.data} language={language} renderExecution={ticket => <ExecutionPanel assignmentId={ticket.assignmentId} actorId={user!.id} role={user!.role} language={language} onChanged={()=>void queue.refetch()} />} />}
  </div>;
}
