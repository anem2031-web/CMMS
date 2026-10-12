import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_shared/procedures";
import { TeamTicketError } from "../../../shared/maintenance-team-tickets/model";
import {
  canManageTicketTeams,
  type TeamManagementActor,
} from "../../../shared/maintenance-team-tickets/team-management";
import type { TicketTeamManagementService } from "../../maintenance-team-tickets/team-management/service";

const procedure = protectedProcedure.use(({ ctx, next }) => {
  if (!canManageTicketTeams(ctx.user.role) || ctx.user.isActive !== 1)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "إدارة فرق تذاكر الصيانة للمسؤول المخوّل فقط",
    });
  return next({ ctx });
});
function actor(ctx: any): TeamManagementActor {
  return {
    id: ctx.user.id,
    role: ctx.user.role,
    active: ctx.user.isActive === 1,
    ipAddress: ctx.req?.ip,
    userAgent: ctx.req?.get?.("user-agent"),
  };
}
async function result<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (e) {
    if (e instanceof TeamTicketError) {
      const code = {
        INVALID: "BAD_REQUEST",
        CONFLICT: "CONFLICT",
        NOT_FOUND: "NOT_FOUND",
        FORBIDDEN: "FORBIDDEN",
        UNAVAILABLE: "INTERNAL_SERVER_ERROR",
      } as const;
      throw new TRPCError({ code: code[e.code], message: e.message });
    }
    throw e;
  }
}
/** Injectable factory permits API tests without importing appRouter/PMV2 or a DB client. */
export function createMaintenanceTeamsRouter(
  service: TicketTeamManagementService
) {
  return router({
    list: procedure.query(({ ctx }) => result(() => service.list(actor(ctx)))),
    create: procedure
      .input(
        z
          .object({
            name: z.string().trim().min(1).max(100),
            warehouseId: z.number().int().positive(),
            memberIds: z.array(z.number().int().positive()).optional(),
          })
          .strict()
      )
      .mutation(({ ctx, input }) =>
        result(() => service.create(actor(ctx), input))
      ),
    save: procedure
      .input(
        z
          .object({
            teamId: z.number().int().positive(),
            name: z.string().trim().min(1).max(100),
            warehouseId: z.number().int().positive(),
            memberIds: z.array(z.number().int().positive()),
            expected: z
              .object({
                name: z.string(),
                warehouseId: z.number().int().positive(),
                active: z.boolean(),
                memberIds: z.array(z.number().int().positive()),
              })
              .strict(),
          })
          .strict()
      )
      .mutation(({ ctx, input }) =>
        result(() => service.save(actor(ctx), input))
      ),
    setActive: procedure
      .input(
        z
          .object({ teamId: z.number().int().positive(), active: z.boolean() })
          .strict()
      )
      .mutation(({ ctx, input }) =>
        result(() => service.setActive(actor(ctx), input))
      ),
    setMembership: procedure
      .input(
        z
          .object({
            teamId: z.number().int().positive(),
            userId: z.number().int().positive(),
            active: z.boolean(),
          })
          .strict()
      )
      .mutation(({ ctx, input }) =>
        result(() => service.setMembership(actor(ctx), input))
      ),
  });
}
