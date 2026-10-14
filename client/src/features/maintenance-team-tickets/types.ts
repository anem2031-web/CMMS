import type { MaintenanceTeamTicketService } from "../../../../server/maintenance-team-tickets/service";
import type {
  Assignment,
  Command,
  Snapshot,
} from "../../../../shared/maintenance-team-tickets/model";
/** Inject a reviewed API implementation later; no tRPC hooks in these views. */
export interface ViewProps {
  api: Pick<MaintenanceTeamTicketService, keyof MaintenanceTeamTicketService>;
  actorId: number;
  state: Snapshot;
  busy: boolean;
  run: (work: () => Promise<unknown>, quiet?: boolean) => Promise<boolean>;
  command: (assignment: Assignment, payload: unknown) => Command;
}
