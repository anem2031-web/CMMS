import { getDb } from "../db";
import { tickets, technicians } from "../../drizzle/schema";
import { eq, and, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

// وقت SLA حسب الأولوية (بالساعات)
const SLA_BY_PRIORITY: Record<string, number> = {
  critical: 4,
  high: 8,
  medium: 24,
  low: 72,
};
const DEFAULT_SLA_HOURS = 24;

export async function runTechnicianOverdueJob() {
  try {
    const db = await getDb();
    if (!db) return;

    const now = Date.now();

    // جلب البلاغات المُسندة لفنيين خارجيين ولم تُغلق بعد
    const assignedTickets = await db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        priority: tickets.priority,
        assignedAt: tickets.assignedAt,
        technicianName: technicians.name,
      })
      .from(tickets)
      .leftJoin(technicians, eq(tickets.assignedTechnicianId, technicians.id))
      .where(
        and(
          isNotNull(tickets.assignedTechnicianId),
          isNotNull(tickets.assignedAt),
          isNull(tickets.closedAt)
        )
      );

    if (assignedTickets.length === 0) return;

    // تصفية البلاغات التي تجاوزت SLA حسب أولويتها
    const overdueTickets = assignedTickets.filter(t => {
      if (!t.assignedAt) return false;
      const slaHours = SLA_BY_PRIORITY[t.priority] ?? DEFAULT_SLA_HOURS;
      const cutoff = new Date(now - slaHours * 60 * 60 * 1000);
      return new Date(t.assignedAt) < cutoff;
    });

    if (overdueTickets.length === 0) return;

    // تجميع البلاغات حسب الفني
    const byTechnician: Record<string, { name: string; items: typeof overdueTickets }> = {};
    for (const t of overdueTickets) {
      const key = t.technicianName || "غير معروف";
      if (!byTechnician[key]) byTechnician[key] = { name: key, items: [] };
      byTechnician[key].items.push(t);
    }

    // بناء نص الإشعار
    const lines = Object.values(byTechnician).map(({ name, items }) => {
      const list = items.map(t => {
        const slaHours = SLA_BY_PRIORITY[t.priority] ?? DEFAULT_SLA_HOURS;
        const hoursAgo = Math.floor((now - new Date(t.assignedAt!).getTime()) / 3600000);
        const priorityLabel = t.priority === "critical" ? "حرج" : t.priority === "high" ? "مرتفع" : t.priority === "medium" ? "متوسط" : "منخفض";
        return `  • ${t.ticketNumber} [${priorityLabel} - SLA: ${slaHours}h] - ${t.title} (منذ ${hoursAgo} ساعة)`;
      }).join("\n");
      return `الفني: ${name}\n${list}`;
    }).join("\n\n");

    await notifyOwner({
      title: `⚠️ تنبيه SLA: ${overdueTickets.length} بلاغ تجاوز الوقت المعياري`,
      content: `البلاغات التالية تجاوزت وقت SLA المحدد حسب الأولوية:\n\n${lines}\n\n---\nمعايير SLA: عاجل=4h | مرتفع=8h | متوسط=24h | منخفض=72h`,
    });

    console.log(`[TechnicianOverdue] Notified about ${overdueTickets.length} overdue tickets (SLA-based)`);
  } catch (err) {
    console.error("[TechnicianOverdue] Job error:", err);
  }
}
