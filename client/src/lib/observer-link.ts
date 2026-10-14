import type { TRPCLink } from "@trpc/client";
import { TRPCClientError } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import type { AppRouter } from "../../../server/routers";
import { observerRpcAllowed } from "@shared/observer-policy";
export const observerReadOnlyLink =
  (role: () => string | undefined): TRPCLink<AppRouter> =>
  () =>
  ({ op, next }) =>
    observable(observer => {
      if (!observerRpcAllowed(role(), op.type, op.path)) {
        observer.error(
          new TRPCClientError(
            "دور المراقب للاستعراض فقط؛ هذا الإجراء غير مسموح"
          )
        );
        return;
      }
      return next(op).subscribe(observer);
    });
