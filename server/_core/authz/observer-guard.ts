import { TRPCError } from "@trpc/server";
import {
  isObserver,
  observerRpcAllowed,
} from "../../../shared/observer-policy";

export function assertObserverRpc(
  user: { role: string; isActive?: number } | null,
  type: string,
  path: string
) {
  if (!user || !isObserver(user.role)) return;
  if (type === "mutation" && path === "auth.logout") return;
  if (user.isActive !== 1 || !observerRpcAllowed(user.role, type, path))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "دور المراقب للقراءة فقط؛ هذا الإجراء غير مسموح",
    });
}
