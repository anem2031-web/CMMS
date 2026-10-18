import { TRPCError } from "@trpc/server";
import { isBusinessGuardedRole, type BusinessIdentity } from "../../../shared/business-role-policy";

const tables = {
  projects: "constructionProjects", phases: "constructionPhases", activities: "constructionActivities",
  tasks: "constructionTasks", taskComments: "constructionTaskComments", taskDependencies: "constructionTaskDependencies",
  members: "constructionProjectMembers", timeLogs: "constructionTimeLogs", customFields: "constructionCustomFields",
  automations: "constructionAutomations", goals: "constructionGoals", dailyReports: "constructionDailyReports",
  quantityTracking: "constructionQuantityTracking", changeOrders: "constructionChangeOrders", safetyLogs: "constructionSafetyLogs",
} as const;
type Resource = keyof typeof tables;
type Membership = { projectId: number; role: string; canEdit: number; canDelete: number; canApprove: number };
export interface BusinessProjectPort {
  memberships(userId: number): Promise<Membership[]>;
  record(resource: Resource, id: number): Promise<any>;
}
const port: BusinessProjectPort = {
  async memberships(userId) {
    const { getDb } = await import("../db");
    const { constructionProjectMembers: members } = await import("../../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const db = await getDb(); if (!db) throw denied();
    return db.select().from(members).where(eq(members.userId, userId));
  },
  async record(resource, id) {
    const { getDb } = await import("../db");
    const schema = await import("../../../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const table = schema[tables[resource]];
    const db = await getDb(); if (!db) throw denied();
    return (await db.select().from(table).where(eq(table.id, id)).limit(1))[0];
  },
};
const denied = () => new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لهذا المشروع أو الإجراء" });

/** Preserve explicit project memberships without granting global construction access.
 * Returned IDs scope the three aggregate/list queries; every child ID is resolved
 * independently, so a permitted projectId cannot disguise a foreign task/phase.
 */
export async function assertBusinessProjectAccess(user: BusinessIdentity, type: string, path: string, raw: unknown, source = port): Promise<number[] | undefined> {
  if (!isBusinessGuardedRole(user.role) || user.role === "senior_management" || !path.startsWith("construction.")) return;
  const [, group, action] = path.split(".");
  // Existing project creation auto-enrols its creator with manager rights.
  if (group === "projects" && action === "create") return;
  const members = await source.memberships(user.id);
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const projects = new Set<number>();
  const checked = new Set<string>();
  const positive = (id: unknown): number => { if (!Number.isSafeInteger(id) || Number(id) <= 0) throw denied(); return Number(id); };
  async function record(resource: Resource, value: unknown) {
    const id = positive(value), key = `${resource}:${id}`;
    if (checked.has(key)) return;
    checked.add(key);
    const row = await source.record(resource, id); if (!row) throw denied();
    if (resource === "taskDependencies") {
      await record("tasks", row.taskId); await record("tasks", row.dependsOnTaskId);
    } else projects.add(positive(resource === "projects" ? row.id : row.projectId));
  }
  if (input.projectId !== undefined) await record("projects", input.projectId);
  for (const [field, resource] of [["phaseId", "phases"], ["activityId", "activities"], ["taskId", "tasks"], ["dependsOnTaskId", "tasks"], ["fieldId", "customFields"]] as const) {
    if (input[field] !== undefined && input[field] !== null) await record(resource, input[field]);
  }
  if (input.id !== undefined) {
    if (!Object.hasOwn(tables, group)) throw denied();
    await record(group as Resource, input.id);
  }
  for (const field of ["ids", "orderedIds"]) if (input[field] !== undefined) {
    if (!Array.isArray(input[field]) || input[field].length > 500 || !Object.hasOwn(tables, group)) throw denied();
    for (const id of input[field]) await record(group as Resource, id);
  }
  if (projects.size > 1) throw denied();
  const aggregate = (group === "projects" && ["list", "portfolioStats"].includes(action)) || (group === "tasks" && action === "list");
  if (!projects.size && !aggregate) throw denied();
  for (const id of Array.from(projects)) {
    const member = members.find(row => row.projectId === id); if (!member) throw denied();
    if (type === "mutation") {
      const permission = ["approve", "reject"].includes(action) ? member.canApprove
        : ["delete", "remove"].includes(action) ? member.canDelete : member.canEdit;
      if (!permission || (group === "members" && member.role !== "manager")) throw denied();
    }
  }
  return members.map(row => row.projectId);
}
