import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";

export const ticketsPurchaseRouter = router({
  requestPurchase: protectedProcedure.input(z.object({
    id: z.number(),
    materialsNeeded: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.id);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });
    if (ticket.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "البلاغ يجب أن يكون قيد التنفيذ" });
    if (ticket.maintenancePath !== "B") throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الإجراء للمسار B فقط" });
    await db.updateTicket(input.id, { status: "needs_purchase", materialsUsed: input.materialsNeeded });
    await db.addTicketStatusHistory({ ticketId: input.id, fromStatus: "in_progress", toStatus: "needs_purchase", changedById: ctx.user.id });
    // إشعار المدراء: كانت هذه الخطوة لا تنبّه أحداً — البلاغ يدخل حالة "بانتظار الشراء"
    // بصمت وينتظر أن يتفقّده أحد المدراء يدوياً ليقدّم التقدير (submitEstimate).
    const managers = await db.getManagerUsers();
    for (const mgr of managers) {
      await db.createNotification({
        userId: mgr.id,
        title: "بلاغ بانتظار تقدير تكلفة الشراء",
        message: `البلاغ ${ticket.ticketNumber} يحتاج شراء مواد: ${input.materialsNeeded}`,
        type: "warning",
        relatedTicketId: input.id,
      });
    }
    return { success: true };
  }),
});
