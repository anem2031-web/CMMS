/** A delegate may read names on authorized documents, never the global user directory. */
export function delegateDirectoryPageAllowed(role: string | null | undefined, rawPath: string): boolean {
  if (role !== "delegate") return true;
  const path = rawPath.split(/[?#]/, 1)[0];
  return !["/users", "/audit-log", "/translation-monitor", "/reports/technicians", "/ai-assistant"].some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

export function delegateDirectoryRpcAllowed(role: string | null | undefined, path: string, raw?: unknown): boolean {
  if (role !== "delegate") return true;
  if (path === "users" || path.startsWith("users.") || [
    "audit.list", "translation.getJobs", "reports.technicianMonthlyReport",
    "maintenanceReports.technicianMonthlyReport", "ai.analyze",
    "reports.technicianPerformance", "maintenanceReports.technicianPerformance",
  ].includes(path)) return false;
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  return !path.startsWith("translation.") || String(input.entityType).trim().toUpperCase() !== "USER";
}
