import { isItTeamRole, MAINTENANCE_RESPONSIBLE_DEPARTMENT as DEPT } from "./roles";

export const IT_EXECUTION_OUTCOMES = ["ok", "fixed", "needs_material", "blocked", "external"] as const;
export type ItExecutionOutcome = typeof IT_EXECUTION_OUTCOMES[number];

type Actor = { id: number; role: string; isActive?: number | null };
type Ticket = {
  assignedToId?: number | null;
  maintenanceResponsibleDepartment?: string | null;
  workflowModel?: string | null;
  status?: string | null;
  maintenancePath?: string | null;
  sourceTaskId?: number | null;
};

/** IT execution is limited to the active named executor of an IT sub-ticket. */
export function canExecuteItSubTicket(actor: Actor | null | undefined, ticket: Ticket | null | undefined): boolean {
  return !!actor && actor.isActive !== 0 && isItTeamRole(actor.role) &&
    ticket?.maintenanceResponsibleDepartment === DEPT.IT &&
    ticket.workflowModel === "sub_ticket" && !!ticket.sourceTaskId &&
    ticket.assignedToId === actor.id;
}

/** Existing tickets enter here; newly promoted IT tasks start in progress atomically. */
export function canStartItSubTicket(actor: Actor | null | undefined, ticket: Ticket | null | undefined): boolean {
  return canExecuteItSubTicket(actor, ticket) &&
    ticket?.maintenancePath == null &&
    ["under_inspection", "assigned"].includes(String(ticket?.status));
}

export function canRecordItExecutionOutcome(actor: Actor | null | undefined, ticket: Ticket | null | undefined): boolean {
  return canExecuteItSubTicket(actor, ticket) && ticket?.status === "in_progress";
}

export function itExecutionOutcomeRequiresNote(outcome: ItExecutionOutcome): boolean {
  return outcome === "fixed" || outcome === "blocked" || outcome === "external";
}

export function itExecutionOutcomeTransition(outcome: ItExecutionOutcome, existingPath?: string | null) {
  if (outcome === "needs_material") return { status: "work_approved" as const, maintenancePath: "B" as const };
  if (outcome === "external") return { status: "work_approved" as const, maintenancePath: "C" as const };
  if (outcome === "blocked") return { status: "in_progress" as const, maintenancePath: existingPath ?? null };
  return { status: "closed" as const, maintenancePath: (existingPath === "B" || existingPath === "C" ? existingPath : "A") as "A" | "B" | "C" };
}
