import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { assertTicketReadable } from "../tickets/tickets.access";

export const inspectionResultsRouter = router({
  /**
   * Direct creation is intentionally disabled. Ticket inspections must pass
   * through tickets.inspectTicket so assignment, review and audit rules apply.
   */
  create: protectedProcedure.input(z.object({
    ticketId: z.number(),
    assetId: z.number().optional(),
    inspectorId: z.number(),
    inspectionType: z.enum(["triage", "detailed"]),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    rootCause: z.string().optional(),
    findings: z.string().optional(),
    recommendedAction: z.string().optional(),
  })).mutation(async () => {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "استخدم إجراء تسجيل نتيجة الفحص داخل البلاغ",
    });
  }),

  listByTicket: protectedProcedure.input(z.object({
    ticketId: z.number(),
  })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    await assertTicketReadable(ctx.user, ticket as any);
    return db.getInspectionResultsByTicket(input.ticketId);
  }),

  listByAsset: protectedProcedure.input(z.object({
    assetId: z.number(),
  })).query(async ({ input }) => {
    return db.getInspectionResultsByAsset(input.assetId);
  }),

  dashboardStats: protectedProcedure.query(async () => {
    return db.getInspectionDashboardStats();
  }),
});
