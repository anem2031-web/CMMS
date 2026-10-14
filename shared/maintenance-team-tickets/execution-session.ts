import type { Action, Assignment, Snapshot } from "./model";

/** Visits are durable events in the existing ticket action ledger, never PMV2 records. */
export const TICKET_EXECUTION_PROTOCOL = "execution_protocol";
export const sessionKinds = new Set(["execution_started", "execution_resumed", "execution_joined", "visit_ended"]);
export interface TicketVisit {
  key: string;
  startedAt: string;
  endedAt: string | null;
  leaderId: number;
  memberIds: number[];
}
export function ticketExecutionSession(s: Pick<Snapshot, "actions">, a: Pick<Assignment, "id" | "stage">) {
  const visits: TicketVisit[] = [];
  let working = false;
  const actions = s.actions.filter(x => x.assignmentId === a.id).sort((x, y) => x.revision - y.revision);
  for (const action of actions) {
    if (sessionKinds.has(action.kind)) {
      let event: { version?: number; visitKey?: string };
      try { event = JSON.parse(action.note); } catch { continue; }
      if (!event || typeof event !== "object" || event.version !== 1 || typeof event.visitKey !== "string" || !event.visitKey) continue;
      if (action.kind === "execution_started") {
        visits.push({ key: event.visitKey, startedAt: action.at, endedAt: null, leaderId: action.actorId, memberIds: [action.actorId] });
        working = true;
      } else {
        const visit = visits.find(v => v.key === event.visitKey && !v.endedAt);
        if (!visit) continue;
        if (action.kind === "visit_ended") { visit.endedAt = action.at; working = false; }
        else {
          if (!visit.memberIds.includes(action.actorId)) visit.memberIds.push(action.actorId);
          if (action.kind === "execution_resumed") working = true;
        }
      }
    } else if (["ok", "fixed", "blocked", "external", "materials_started", "needs_material", "return_to_team", "external_handover", "approve_result"].includes(action.kind)) working = false;
  }
  const openVisits = visits.filter(v => !v.endedAt);
  return {
    enabled: actions.some(x => x.kind === TICKET_EXECUTION_PROTOCOL || x.kind === "execution_started"),
    visits,
    openVisit: openVisits.length === 1 ? openVisits[0] : null,
    conflict: openVisits.length > 1,
    working: working && ["action_required", "ready_to_repair", "reinstall_required"].includes(a.stage),
  };
}
export function ticketSessionActionText(action: Action, language: string): string | undefined {
  const labels: Record<string, [string, string, string]> = {
    execution_protocol: ["إسناد الفريق — تنفيذ بآلية PMV2", "Team assigned — PMV2 execution experience", "ٹیم تفویض — PMV2 طرز عمل"],
    execution_started: ["بدء التنفيذ وفتح الزيارة", "Execution started; visit opened", "کام شروع، دورہ کھولا گیا"],
    execution_resumed: ["استكمال العمل", "Work resumed", "کام دوبارہ شروع"],
    execution_joined: ["انضمام إلى الزيارة", "Joined the visit", "دورے میں شمولیت"],
    visit_ended: ["إنهاء الزيارة", "Visit ended", "دورہ ختم"],
  };
  return labels[action.kind]?.[language === "ar" ? 0 : language === "ur" ? 2 : 1];
}
