import {
  AUTH_TEMPORARILY_UNAVAILABLE_ERR_MSG,
  NOT_ADMIN_ERR_MSG,
  UNAUTHED_ERR_MSG,
} from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { assertObserverRpc } from "./authz/observer-guard";
import { isObserver, redactObserverValue } from "../../shared/observer-policy";
import { runObserverRead } from "./authz/observer-read-scope";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
const observerGuard = t.middleware(async opts => {
  const originalUser = opts.ctx.authenticatedUser ?? opts.ctx.user;
  assertObserverRpc(originalUser, opts.type, opts.path);
  if (!isObserver(originalUser?.role)) return opts.next();
  const authenticatedUser = originalUser!;
  const work = () => opts.next({ ctx: {
    ...opts.ctx,
    authenticatedUser,
    // Existing read guards/UI scopes get admin visibility only after the
    // actual role, active status, type and explicit path pass the outer gate.
    user: opts.path === "auth.me" || opts.path === "auth.logout"
      ? authenticatedUser : { ...authenticatedUser, role: "admin" as const },
  } });
  const result = await runObserverRead(authenticatedUser.id, work);
  if (result.ok) return { ...result, data: redactObserverValue(result.data, 0, opts.path === "backups.list") };
  return result;
});
const baseProcedure = t.procedure.use(observerGuard);
export const publicProcedure = baseProcedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    if (ctx.authFailure === "dependency") {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: AUTH_TEMPORARILY_UNAVAILABLE_ERR_MSG,
      });
    }
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = baseProcedure.use(requireUser);

export const adminProcedure = baseProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      if (ctx.authFailure === "dependency") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: AUTH_TEMPORARILY_UNAVAILABLE_ERR_MSG,
        });
      }
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    if (ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);
