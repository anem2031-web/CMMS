import { TRPCError } from "@trpc/server";
import { businessRpcAllowed, canCreateUserRole, type BusinessIdentity } from "../../../shared/business-role-policy";

export function assertBusinessRpc(user: BusinessIdentity | null | undefined, type: string, path: string, input?: unknown) {
  if (!businessRpcAllowed(user, type, path)) throw denied();
  if (user?.role === "warehouse" && path === "users.create") {
    const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
    if (!canCreateUserRole(user.role, String(value.role))) throw denied();
  }
}
const denied = () => new TRPCError({ code: "FORBIDDEN", message: "هذا الإجراء خارج صلاحيات حسابك" });
