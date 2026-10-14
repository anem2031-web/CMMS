export const IT_TICKET_ARRIVAL_EVENT = "it_ticket_arrival" as const;
import { APP_ROLE, isItTeamRole, MAINTENANCE_RESPONSIBLE_DEPARTMENT as DEPT } from "./roles";

export function canExecuteItTicket(user: { id: number; role: string }, ticket: { maintenanceResponsibleDepartment?: string | null; assignedToId?: number | null }) {
  return isItTeamRole(user.role) && ticket.maintenanceResponsibleDepartment === DEPT.IT && ticket.assignedToId === user.id;
}
export function canManageItPurchases(user: { id: number; role: string }, ticket: { maintenanceResponsibleDepartment?: string | null; maintenanceResponsibleManagerId?: number | null }) {
  return user.role === APP_ROLE.IT_MANAGER && ticket.maintenanceResponsibleDepartment === DEPT.IT && ticket.maintenanceResponsibleManagerId === user.id;
}
export function canClaimItDepartment(user: { role: string }, parent: { status: string; workflowModel?: string | null }, department: { department: string; claimedById?: number | null }) {
  return isItTeamRole(user.role) && parent.workflowModel === "department_tasks" &&
    !["closed", "requester_confirmed"].includes(parent.status) && department.department === DEPT.IT && !department.claimedById;
}
