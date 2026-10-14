import { TRPCError } from "@trpc/server";
import { APP_ROLE, isItTeamRole } from "@shared/roles";
import { IT_TICKET_ARRIVAL_EVENT } from "@shared/itTeamWorkflow";
import * as db from "../../_core/db";

export async function assertActiveItUser(id: number) {
  const user = await db.getUserById(id);
  if (!user || user.isActive === 0 || !isItTeamRole(user.role)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "اختر عضوًا نشطًا في فريق تقنية المعلومات" });
  }
  return user;
}

export async function getItManager() {
  const managers = (await db.getUsersByRole(APP_ROLE.IT_MANAGER)).filter((u: any) => u.isActive !== 0);
  if (managers.length !== 1) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "يجب وجود مدير تقنية معلومات نشط واحد للفريق" });
  return managers[0];
}

/**
 * The only IT-team notification opt-in: a maintenance ticket routed to IT.
 * Both the active IT manager and all active IT members receive the same arrival
 * notification. Other IT notifications remain default-denied by the notification layer.
 */
export async function notifyItTeamArrival(ticketId: number, ticketNumber: string) {
  const groups = await Promise.all([
    db.getUsersByRole(APP_ROLE.IT_MANAGER),
    db.getUsersByRole(APP_ROLE.IT_MEMBER),
  ]);
  const recipients = new Map(
    groups.flat().filter((user: any) => user.isActive !== 0).map((user: any) => [user.id, user])
  );

  for (const user of recipients.values()) {
    await db.createNotification({
      userId: user.id,
      title: "تذكرة صيانة موجهة إلى تقنية المعلومات",
      message: `تم توجيه تذكرة الصيانة ${ticketNumber} إلى تقنية المعلومات. راجع التذكرة وابدأ العمل عليها حسب التوزيع.`,
      type: "info",
      eventKey: IT_TICKET_ARRIVAL_EVENT,
      relatedTicketId: ticketId,
      allowItManager: true,
    });
  }
}
