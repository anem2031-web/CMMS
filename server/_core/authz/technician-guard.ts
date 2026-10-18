import { TRPCError } from "@trpc/server";
import { technicianRpcAllowed, type TechnicianIdentity } from "../../../shared/technician-policy";

export function assertTechnicianRpc(user: TechnicianIdentity | null | undefined, type: string, path: string, input?: unknown) {
  if (!technicianRpcAllowed(user, type, path)) throw denied();
  if (user?.role !== "technician") return;
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  if (path === "tickets.create" && (!Number.isSafeInteger(value.pmv2TaskItemId) || Number(value.pmv2TaskItemId) <= 0 || value.fromIdeaId != null)) throw denied();
  if ((path === "attachments.list" || path === "attachments.add") && !["ticket", "pmv2_item_action"].includes(String(value.entityType))) throw denied();
  if (path === "improvementIdeas.executionReference" && value.kind !== "ticket") throw denied();
}
const denied = () => new TRPCError({ code: "FORBIDDEN", message: "صلاحيات الفني مقتصرة على مهامه وخدمات تنفيذها" });
