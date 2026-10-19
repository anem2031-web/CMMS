import { TRPCError } from "@trpc/server";
import { delegateDirectoryRpcAllowed } from "../../../shared/delegate-directory-policy";

export function assertDelegateDirectoryRpc(user: { role: string } | null | undefined, path: string, raw?: unknown): void {
  if (!delegateDirectoryRpcAllowed(user?.role, path, raw)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية للاطلاع على دليل المستخدمين" });
  }
}
