import { getDb } from "../db";
import { tickets, technicians } from "../../drizzle/schema";
import { eq, and, isNotNull, isNull, lt } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

// الوقت المعياري للإنجاز: 24 ساعة (قابل للتعديل)
const SLA_HOURS = 24;

export async function runTechnicianOverdueJob() {
  try {
    const db = await getDb();
    if (!db) return;

    const cutoff = new Date(Date.now() - SLA_HOURS * 60 * 60 * 1000);

    // جلب البلاغات المُسندة لفنيين خارجيين ولم تُغلق وتجاوزت الوقت المعياري
    const overdueTickets = await db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        assignedAt: tickets.assignedAt,
        technicianName: technicians.name,
      })
      .from(tickets)
      .leftJoin(technicians, eq(tickets.assignedTechnicianId, technicians.id))
      .where(
        and(
          isNotNull(tickets.assignedTechnicianId),
          isNotNull(tickets.assignedAt),
          isNull(tickets.closedAt),
          lt(tickets.assignedAt, cutoff)
        )
      );

    if (overdueTickets.length === 0) return;

    // تجميع البلاغات حسب الفني
    const byTechnician: Record<string, { name: string; tickets: typeof overdueTickets }> = {};
    for (const t of overdueTickets) {
      const key = t.technicianName || "غير معروف";
      if (!byTechnician[key]) byTechnician[key] = { name: key, tickets: [] };
      byTechnician[key].tickets.push(t);
    }

    // إرسال إشعار واحد يجمع كل البلاغات المتأخرة
    const lines = Object.values(byTechnician).map(({ name, tickets: tks }) => {
      const list = tks.map(t => {
        const hoursAgo = Math.floor((Date.now() - new Date(t.assignedAt!).getTime()) / 3600000);
        return `  • ${t.ticketNumber} - ${t.title} (منذ ${hoursAgo} ساعة)`;
      }).join("\n");
      return `الفني: ${name}\n${list}`;
    }).join("\n\n");

    await notifyOwner({
      title: `⚠️ تنبيه: ${overdueTickets.length} بلاغ متأخر عن الوقت المعياري (${SLA_HOURS} ساعة)`,
      content: `البلاغات التالية تجاوزت الوقت المعياري للإنجاز:\n\n${lines}`,
    });

    console.log(`[TechnicianOverdue] Notified about ${overdueTickets.length} overdue tickets`);
  } catch (err) {
    console.error("[TechnicianOverdue] Job error:", err);
  }
}
