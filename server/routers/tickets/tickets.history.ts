import { z } from "zod";
import { router, protectedProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { TRPCError } from "@trpc/server";
import { assertTicketReadable } from "./tickets.access";

export const ticketsHistoryRouter = router({
  history: protectedProcedure.input(z.object({ ticketId: z.number() })).query(async ({ input, ctx }) => {
    const ticket = await db.getTicketById(input.ticketId);
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
    await assertTicketReadable(ctx.user, ticket as any);
    return db.getTicketHistory(input.ticketId);
  }),
});
