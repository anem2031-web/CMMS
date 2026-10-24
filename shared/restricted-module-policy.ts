/**
 * Owner/admin-only legacy modules.
 *
 * This policy intentionally does not include PM V2 (/scheduled-maintenance or
 * pmv2.*). It protects only the standalone Construction module and the legacy
 * Preventive Maintenance module requested by the product owner.
 */
export function isOwnerOrAdminRole(role?: string | null): boolean {
  return role === "owner" || role === "admin";
}

export function isOwnerAdminOnlyPage(rawPath: string): boolean {
  const path = rawPath.split(/[?#]/, 1)[0] || "/";
  return path === "/construction" || path.startsWith("/construction/")
    || path === "/preventive" || path.startsWith("/preventive/")
    || path === "/predictive" || path.startsWith("/predictive/")
    || path === "/reports/preventive" || path.startsWith("/reports/preventive/");
}

export function isOwnerAdminOnlyRpc(path: string): boolean {
  return path === "construction" || path.startsWith("construction.")
    || path === "preventive" || path.startsWith("preventive.");
}

export function isOwnerAdminOnlyHttpPath(rawPath: string): boolean {
  const path = rawPath.split(/[?#]/, 1)[0] || "/";
  return path === "/api/export/preventive-plans"
    || path === "/api/export/pm-work-orders"
    || /^\/api\/export\/pm-work-order\/[1-9]\d*$/.test(path);
}
