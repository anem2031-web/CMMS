import { AsyncLocalStorage } from "node:async_hooks";
import { TRPCError } from "@trpc/server";
import { isObserver } from "../../../shared/observer-policy";

const scope = new AsyncLocalStorage<{ userId: number }>();
export const isObserverReadScope = () => !!scope.getStore();
export const runObserverRead = <T>(userId: number, work: () => T) =>
  scope.run({ userId }, work);
/** Only the authenticated observer of this approved read has admin visibility. */
export function observerReadActorRole(userId: number, role: string): string {
  return scope.getStore()?.userId === userId && isObserver(role)
    ? "admin"
    : role;
}

export function assertObserverSqlRead(query: unknown): void {
  if (!isObserverReadScope()) return;
  const raw = typeof query === "string" ? query : (query as any)?.sql;
  if (typeof raw !== "string") throw denied();
  // Remove literals/quoted identifiers; keep executable comments rejected.
  if (/\/\*!|\/\*\+/.test(raw)) throw denied();
  const clean = raw
    .replace(/'(?:''|\\.|[^'\\])*'|"(?:""|\\.|[^"\\])*"|`(?:``|[^`])*`/g, " ")
    .replace(/\/\*[\s\S]*?\*\/|--[^\r\n]*|#[^\r\n]*/g, " ")
    .trim();
  // Existing read services sometimes use a transaction for a consistent view.
  // Controls below never permit DML or a locking SELECT inside that transaction.
  if (
    /^(?:begin|commit|rollback|savepoint sp\d+|release savepoint sp\d+|rollback to savepoint sp\d+)$/i.test(
      clean
    )
  )
    return;
  if (
    !/^(select|with)\b/i.test(clean) ||
    /\b(insert|update|delete|replace|create|alter|drop|truncate|call|do|handler|outfile|dumpfile|load_file|get_lock|release_lock|sleep|benchmark|into)\b|;|:=/i.test(
      clean
    )
  )
    throw denied();
}
const denied = () =>
  new TRPCError({ code: "FORBIDDEN", message: "دور المراقب للقراءة فقط" });

/** Drizzle and raw SQL share this driver boundary; applies only in observer reads. */
export function guardObserverSqlClient<T extends object>(client: T): T {
  return new Proxy(client, {
    get(target, key) {
      const value: any = Reflect.get(target, key, target);
      if (key === "query" || key === "execute")
        return (...args: unknown[]) => {
          assertObserverSqlRead(args[0]);
          return value.apply(target, args);
        };
      if (key === "getConnection")
        return async (...args: unknown[]) =>
          guardObserverSqlClient(await value.apply(target, args));
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
