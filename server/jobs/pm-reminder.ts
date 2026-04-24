/**
 * PM Work Order Reminder Job
 * يُرسل إشعار تذكيري للفني إذا لم يُحدَّث أمر العمل خلال 24 ساعة من موعده
 * يُشغَّل كل ساعتين
 */
import { getDb } from "../db";
import { pmWorkOrders, preventivePlans } from "../../drizzle/schema";
import { eq, and, inArray } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { sendPushToUser } from "../webPush";

const REMINDER_THRESHOLD_HOURS = 24;

export async function runPMWorkOrderReminderJob() {
  try {
    const db = await getDb();
    if (!db) return;

    const now = new Date();
    const cutoff = new Date(now.getTime() - REMINDER_THRESHOLD_HOURS * 60 * 60 * 1000);

    // جلب أوامر العمل المجدولة أو الجارية التي لم تُحدَّث منذ أكثر من 24 ساعة
    const staleOrders = await db
      .select()
      .from(pmWorkOrders)
      .where(
        and(
          inArray(pmWorkOrders.status, ["scheduled", "in_progress"]),
        )
      );

    // فلترة الأوامر التي scheduledDate مضى عليها أكثر من 24 ساعة ولم تُحدَّث
    const overdueOrders = staleOrders.filter((wo) => {
      if (!wo.scheduledDate) return false;
      const scheduled = new Date(wo.scheduledDate);
      // الأمر يُعتبر متأخراً إذا مضى على موعده أكثر من 24 ساعة
      return scheduled <= cutoff;
    });

    if (overdueOrders.length === 0) {
      console.log("[PM Reminder] No stale work orders found");
      return;
    }

    let notifiedCount = 0;
    const ownerLines: string[] = [];

    for (const wo of overdueOrders) {
      const hoursOverdue = Math.floor(
        (now.getTime() - new Date(wo.scheduledDate!).getTime()) / (1000 * 60 * 60)
      );

      // إرسال push للفني المعيّن
      if (wo.assignedToId) {
        try {
          const result = await sendPushToUser(wo.assignedToId, {
            title: "⏰ تذكير: أمر عمل بحاجة للتحديث",
            body: `أمر العمل ${wo.workOrderNumber} - ${wo.title} لم يُحدَّث منذ ${hoursOverdue} ساعة`,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
            tag: `pm-reminder-${wo.workOrderNumber}`,
            url: "/preventive",
            type: "pm_reminder",
          });
          if (result.sent > 0) {
            notifiedCount++;
            console.log(`[PM Reminder] Reminder sent to technician (userId=${wo.assignedToId}) for WO ${wo.workOrderNumber} (${hoursOverdue}h overdue)`);
          }
        } catch (err) {
          console.warn(`[PM Reminder] Push failed for WO ${wo.workOrderNumber}:`, err);
        }
      }

      ownerLines.push(`• ${wo.workOrderNumber} - ${wo.title} (منذ ${hoursOverdue} ساعة)`);
    }

    // إشعار المالك بملخص
    if (overdueOrders.length > 0) {
      await notifyOwner({
        title: `⏰ تذكير صيانة وقائية: ${overdueOrders.length} أمر عمل بدون تحديث`,
        content: `الأوامر التالية تجاوزت ${REMINDER_THRESHOLD_HOURS} ساعة بدون تحديث من الفني:\n\n${ownerLines.join("\n")}\n\nتم إشعار ${notifiedCount} فني`,
      });
    }

    console.log(`[PM Reminder] Completed: ${overdueOrders.length} stale orders, ${notifiedCount} technicians notified`);
  } catch (err) {
    console.error("[PM Reminder] Job error:", err);
  }
}
