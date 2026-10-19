/** Gate accounts use the external-asset workspace, not the general ticket module. */
export const GATE_SECURITY_ROLE = "gate_security";
export const GATE_SECURITY_WORKSPACE_PATH = "/gate-security";
export type GateSecurityIdentity = { id: number; role: string; isActive?: number };

export const GATE_SECURITY_QUERY_PATHS = [
  "auth.me", "notifications.list", "notifications.unreadCount", "push.getStatus", "push.getVapidPublicKey",
  "externalMaintenance.listForGate", "translation.getEntityTranslations", "translation.getBatchTranslations",
] as const;
export const GATE_SECURITY_MUTATION_PATHS = [
  "auth.login", "auth.logout", "auth.changePassword", "translation.setLanguage",
  "notifications.markRead", "notifications.markAllRead", "push.subscribe", "push.unsubscribe", "audit.recordPwaUpdateDecision",
  "externalMaintenance.approveGateExit", "externalMaintenance.approveGateEntry",
] as const;
export const GATE_SECURITY_JOB_STATUSES = [
  "waiting_gate_exit", "purchase_cycle", "waiting_gate_entry", "waiting_warehouse_receipt",
  "waiting_technician_handover", "delivered_for_reinstall", "reinstall_in_progress", "ready_for_closure", "closed",
] as const;
export const GATE_SECURITY_TRANSLATION_FIELDS = [
  "assetName", "assetBeforeCondition", "warehouseNotes", "gateExitNotes", "gateEntryNotes",
  "returnCondition", "warehouseReturnNotes", "handoverNotes",
] as const;

export function gateSecurityPageAllowed(path: string): boolean {
  const page = path.split(/[?#]/, 1)[0];
  return page === GATE_SECURITY_WORKSPACE_PATH || page === "/notifications";
}
export function gateSecurityRpcAllowed(user: GateSecurityIdentity | null | undefined, type: string, path: string): boolean {
  if (user?.role !== GATE_SECURITY_ROLE) return true;
  if (type === "mutation" && path === "auth.logout") return true;
  if (user.isActive !== 1) return false;
  return type === "query" ? (GATE_SECURITY_QUERY_PATHS as readonly string[]).includes(path)
    : type === "mutation" && (GATE_SECURITY_MUTATION_PATHS as readonly string[]).includes(path);
}
/** Media additionally requires the persisted external-job check; local printing needs no export API. */
export function gateSecurityHttpAllowed(user: GateSecurityIdentity | null | undefined, method: string, path: string): boolean {
  if (user?.role !== GATE_SECURITY_ROLE) return true;
  return user.isActive === 1 && method === "GET" && path === "/api/media";
}
