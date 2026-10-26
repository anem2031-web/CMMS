/** Explicit preview-only adapter. Production registration never imports this file. */
import type {
  TeamManagementRepository,
  TeamManagementTransaction,
} from "../../../shared/maintenance-team-tickets/team-management";
import type { Store } from "../ports";
export function previewTeamRepository(store: Store): TeamManagementRepository {
  return {
    readData: async () => {
      const s = await store.read();
      return {
        teams: s.teams,
        memberships: s.memberships,
        technicians: s.users,
        warehouses: s.warehouses.map(w => ({
          ...w,
          type: w.id === 10 ? "main" : "branch",
        })),
      };
    },
    transaction: work =>
      store.transaction(async s => {
        const tx: TeamManagementTransaction = {
          findTeam: async id => s.teams.find(t => t.id === id) ?? null,
          findTeamByName: async name =>
            s.teams.find(
              t => t.name.toLocaleLowerCase() === name.toLocaleLowerCase()
            ) ?? null,
          findWarehouse: async id => {
            const w = s.warehouses.find(w => w.id === id);
            return w ? { ...w, type: w.id === 10 ? "main" : "branch" } : null;
          },
          findUser: async id => s.users.find(u => u.id === id) ?? null,
          findMembership: async (teamId, userId) =>
            s.memberships.find(
              m => m.teamId === teamId && m.userId === userId
            ) ?? null,
          membershipsForTeam: async teamId =>
            s.memberships.filter(m => m.teamId === teamId),
          remainingActiveMemberCount: async (teamId, excluded) =>
            s.memberships.filter(
              m =>
                m.teamId === teamId &&
                m.userId !== excluded &&
                m.active &&
                s.users.some(
                  u =>
                    u.id === m.userId &&
                    u.active &&
                    ["technician", "it_manager", "it_member"].includes(u.role)
                )
            ).length,
          hasOpenExecution: async teamId =>
            s.assignments.some(
              a => a.teamId === teamId && a.stage !== "closed"
            ),
          createTeam: async (name, warehouseId, actorId) => {
            const id = s.nextId++;
            s.teams.push({
              id,
              name,
              warehouseId,
              active: true,
              createdById: actorId,
              updatedById: actorId,
            });
            return id;
          },
          updateTeamProfile: async (teamId, name, warehouseId, actorId) => {
            Object.assign(s.teams.find(t => t.id === teamId)!, {
              name,
              warehouseId,
              updatedById: actorId,
            });
          },
          setTeamActive: async (teamId, active, actorId) => {
            Object.assign(s.teams.find(t => t.id === teamId)!, {
              active,
              updatedById: actorId,
            });
          },
          setMembership: async (teamId, userId, active, actorId) => {
            const m = s.memberships.find(
              m => m.teamId === teamId && m.userId === userId
            );
            if (m)
              Object.assign(m, {
                active,
                leftAt: active ? null : "preview",
                updatedById: actorId,
              });
            else
              s.memberships.push({
                teamId,
                userId,
                active,
                joinedAt: "preview",
                leftAt: null,
                updatedById: actorId,
              });
          },
          // Audit persistence is covered by injected transaction tests; this UI fixture has no audit backend.
          audit: async () => {},
        };
        return work(tx);
      }),
  };
}
