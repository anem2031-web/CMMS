import { TRPCError } from "@trpc/server";
import { APP_ROLE } from "@shared/roles";

export const ADMIN_ROLES = [APP_ROLE.OWNER, APP_ROLE.ADMIN] as const;
export const MANAGER_ROLES = [
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.PURCHASE_MANAGER,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
] as const;
export const SUPERVISOR_ROLES = [
  APP_ROLE.SUPERVISOR,
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.OWNER,
  APP_ROLE.ADMIN,
] as const;

export function requireAdminRole(role: string, message = "فقط المالك يمكنه تنفيذ هذا الإجراء") {
  if (!ADMIN_ROLES.includes(role as any)) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}

export function requireManagerRole(role: string, message = "ليس لديك صلاحية لهذا الإجراء") {
  if (!MANAGER_ROLES.includes(role as any)) {
    throw new TRPCError({ code: "FORBIDDEN", message });
  }
}

export function isAdmin(role: string): boolean {
  return ADMIN_ROLES.includes(role as any);
}

export function isManager(role: string): boolean {
  return MANAGER_ROLES.includes(role as any);
}

export function isSupervisor(role: string): boolean {
  return SUPERVISOR_ROLES.includes(role as any);
}
