import { TicketTeamManagementService } from "../../maintenance-team-tickets/team-management/service";
import { SqlTeamManagementRepository } from "./repository";
import { createMaintenanceTeamsRouter } from "./router";
import { TicketTeamAssignmentService } from "../../maintenance-team-tickets/assignment/service";
import { SqlTicketTeamAssignmentRepository } from "./assignment.repository";
import { createTicketTeamAssignmentRouter } from "./assignment.router";
import { createTicketTeamExecutionRouter } from "./execution.router";

// Registration only: no DB request, scheduler, mock fallback or write at import time.
export const maintenanceTeamsRouter = createMaintenanceTeamsRouter(
  new TicketTeamManagementService(new SqlTeamManagementRepository())
);
export const ticketTeamAssignmentsRouter = createTicketTeamAssignmentRouter(
  new TicketTeamAssignmentService(new SqlTicketTeamAssignmentRepository())
);
export const ticketTeamExecutionRouter = createTicketTeamExecutionRouter();
