import { z } from "zod";
import { router, protectedProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";

export const auditRouter = router({

  recordPwaUpdateDecision: protectedProcedure
    .input(z.object({
      action: z.enum(["pwa_update_now", "pwa_update_deferred", "pwa_update_forced"]),
      fromBuildId: z.string().min(1).max(200),
      toBuildId: z.string().min(1).max(200),
      deferredUntil: z.string().datetime().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const forwardedFor = ctx.req.headers["x-forwarded-for"];
      const ipAddress = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor?.split(",")[0]?.trim() || ctx.req.ip;

      await db.createAuditLog({
        userId: ctx.user.id,
        action: input.action,
        entityType: "application_update",
        newValues: {
          fromBuildId: input.fromBuildId,
          toBuildId: input.toBuildId,
          deferredUntil: input.deferredUntil ?? null,
          source: "pwa_update_banner",
        },
        ipAddress,
        userAgent: ctx.req.headers["user-agent"],
      });

      return { success: true };
    }),
  list: protectedProcedure.input(z.object({
    entityType: z.string().optional(),
    entityId: z.number().optional(),
    userId: z.number().optional(),
    action: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    limit: z.number().optional(),
  }).optional()).query(async ({ input }) => {
    const filters: any = {};
    if (input?.entityType) filters.entityType = input.entityType;
    if (input?.entityId) filters.entityId = input.entityId;
    if (input?.userId) filters.userId = input.userId;
    if (input?.action) filters.action = input.action;
    if (input?.dateFrom) filters.dateFrom = new Date(input.dateFrom);
    if (input?.dateTo) { const d = new Date(input.dateTo); d.setHours(23, 59, 59, 999); filters.dateTo = d; }
    if (input?.limit) filters.limit = input.limit;
    return db.getAuditLogsEnhanced(filters);
  }),
});
