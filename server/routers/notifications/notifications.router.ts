import { z } from "zod";
import { router, protectedProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { isItTeamRole } from "@shared/roles";
import { IT_TICKET_ARRIVAL_EVENT } from "@shared/itTeamWorkflow";

export const notificationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserNotifications(ctx.user.id, isItTeamRole(ctx.user.role) ? IT_TICKET_ARRIVAL_EVENT : undefined);
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return db.getUnreadNotificationCount(ctx.user.id, isItTeamRole(ctx.user.role) ? IT_TICKET_ARRIVAL_EVENT : undefined);
  }),

  markRead: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await db.markNotificationRead(input.id, ctx.user.id);
    return { success: true };
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db.markAllNotificationsRead(ctx.user.id, isItTeamRole(ctx.user.role) ? IT_TICKET_ARRIVAL_EVENT : undefined);
    return { success: true };
  }),
});
