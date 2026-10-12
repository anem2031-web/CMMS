import type { Team, Membership, UserRef, WarehouseRef } from "./model";

export const TICKET_TEAM_MANAGEMENT_ROLES = [
  "owner",
  "admin",
  "maintenance_manager",
  "general_maintenance_manager",
] as const;
export function canManageTicketTeams(role?: string | null): boolean {
  return (
    !!role && (TICKET_TEAM_MANAGEMENT_ROLES as readonly string[]).includes(role)
  );
}
export interface TeamWarehouse extends WarehouseRef {
  type: string;
  nameEn?: string | null;
}
export interface TeamManagementData {
  teams: Team[];
  memberships: Membership[];
  technicians: UserRef[];
  warehouses: TeamWarehouse[];
}
export interface TeamManagementActor {
  id: number;
  role: string;
  active: boolean;
  ipAddress?: string;
  userAgent?: string;
}
export interface TeamDraft {
  name: string;
  warehouseId: number;
  memberIds: number[];
}
export interface TeamManagementSnapshot extends TeamDraft {
  active: boolean;
}
export interface SaveTeamInput extends TeamDraft {
  teamId: number;
  expected: TeamManagementSnapshot;
}
export function teamManagementSnapshot(
  data: TeamManagementData,
  teamId: number
): TeamManagementSnapshot {
  const team = data.teams.find(t => t.id === teamId);
  if (!team) throw new Error("الفريق غير موجود");
  return {
    name: team.name,
    warehouseId: team.warehouseId,
    active: team.active,
    memberIds: data.memberships
      .filter(m => m.teamId === teamId && m.active)
      .map(m => m.userId)
      .sort((a, b) => a - b),
  };
}
export interface TeamManagementAudit {
  action: string;
  entityId: number;
  oldValues: unknown;
  newValues: unknown;
}
/** The production implementation is injected; this module has no DB dependency. */
export interface TeamManagementRepository {
  readData(): Promise<TeamManagementData>;
  transaction<T>(
    work: (tx: TeamManagementTransaction) => Promise<T>
  ): Promise<T>;
}
export interface TeamManagementTransaction {
  findTeam(id: number): Promise<Team | null>;
  findTeamByName(name: string): Promise<Team | null>;
  findWarehouse(id: number): Promise<TeamWarehouse | null>;
  findUser(id: number): Promise<UserRef | null>;
  findMembership(teamId: number, userId: number): Promise<Membership | null>;
  membershipsForTeam(teamId: number): Promise<Membership[]>;
  updateTeamProfile(
    teamId: number,
    name: string,
    warehouseId: number,
    actorId: number
  ): Promise<void>;
  remainingActiveMemberCount(
    teamId: number,
    excludedUserId: number
  ): Promise<number>;
  hasOpenExecution(teamId: number): Promise<boolean>;
  createTeam(
    name: string,
    warehouseId: number,
    actorId: number
  ): Promise<number>;
  setTeamActive(
    teamId: number,
    active: boolean,
    actorId: number
  ): Promise<void>;
  setMembership(
    teamId: number,
    userId: number,
    active: boolean,
    actorId: number
  ): Promise<void>;
  audit(actor: TeamManagementActor, entry: TeamManagementAudit): Promise<void>;
}
