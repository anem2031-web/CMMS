/**
 * PM Automation Job
 * ينشئ أوامر عمل تلقائياً للخطط المستحقة — بدون أي ربط بالبلاغات
 * يُرسل push notification للفني المعيّن عند إنشاء كل أمر عمل
 */
import { getDb } from "../db";
import { preventivePlans, pmWorkOrders } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";
import { calcNextDueDate, generateWorkOrderNumber } from "../db";
import { sendPushToUser } from "../webPush";

export async function runPMAutomationJob() {
  try {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const now = new Date();
    console.log(`[PM Automation] Job started at ${now.toISOString()}`);

    // جلب الخطط النشطة فقط
    const activePlans = await db
      .select()
      .from(preventivePlans)
      .where(eq(preventivePlans.isActive, true));

    let createdCount = 0;
    let notifiedCount = 0;
    const errors: string[] = [];

    for (const plan of activePlans) {
      try {
        // تجاهل الخطط التي ليس لها موعد تنفيذ
        if (!plan.nextDueDate) continue;

        const dueDate = new Date(plan.nextDueDate);

        // إذا الموعد حلّ أو تجاوز — أنشئ أمر عمل
        if (dueDate <= now) {
          const woNumber = await generateWorkOrderNumber();

          await db.insert(pmWorkOrders).values({
            workOrderNumber: woNumber,
            planId: plan.id,
            assetId: plan.assetId ?? undefined,
            siteId: plan.siteId ?? undefined,
            title: plan.title,
            scheduledDate: dueDate,
            status: "scheduled",
            assignedToId: plan.assignedToId ?? undefined,
            checklistResults: plan.checklist
              ? (plan.checklist as any[]).map((item: any) => ({
                  id: item.id,
                  text: item.text,
                  done: false,
                  notes: "",
                }))
              : [],
            originalLanguage: "ar",
          } as any);

          // تحديث nextDueDate في الخطة
          const nextDue = calcNextDueDate(dueDate, plan.frequency, plan.frequencyValue ?? 1);
          await db
            .update(preventivePlans)
            .set({ nextDueDate: nextDue, updatedAt: new Date() })
            .where(eq(preventivePlans.id, plan.id));

          createdCount++;
          console.log(`[PM Automation] Created WO ${woNumber} for plan ${plan.planNumber}`);

          // ── إرسال push notification للفني المعيّن ──────────────────────────
          if (plan.assignedToId) {
            try {
              const result = await sendPushToUser(plan.assignedToId, {
                title: "مهمة صيانة وقائية جديدة",
                body: `تم تعيينك على أمر عمل: ${plan.title} (${woNumber})`,
                icon: "/icons/icon-192x192.png",
                badge: "/icons/icon-192x192.png",
                tag: `pm-wo-${woNumber}`,
                url: "/preventive",
                type: "pm_work_order",
              });
              if (result.sent > 0) {
                notifiedCount++;
                console.log(`[PM Automation] Push sent to technician (userId=${plan.assignedToId}) for WO ${woNumber}`);
              } else {
                console.log(`[PM Automation] No active push subscriptions for technician (userId=${plan.assignedToId})`);
              }
            } catch (pushErr) {
              // لا نوقف العملية إذا فشل الإشعار
              console.warn(`[PM Automation] Push notification failed for WO ${woNumber}:`, pushErr);
            }
          }
        }
      } catch (err) {
        errors.push(`Plan ${plan.planNumber}: ${String(err)}`);
        console.error(`[PM Automation] Error for plan ${plan.planNumber}:`, err);
      }
    }

    if (createdCount > 0) {
      await notifyOwner({
        title: "الصيانة الوقائية التلقائية",
        content: `تم إنشاء ${createdCount} أمر عمل تلقائياً للخطط المستحقة، وتم إشعار ${notifiedCount} فني`,
      });
    }

    console.log(`[PM Automation] Completed: ${createdCount} work orders created, ${notifiedCount} technicians notified, ${errors.length} errors`);
    return { success: true, createdCount, notifiedCount, errors };
  } catch (error) {
    console.error("[PM Automation] Fatal error:", error);
    return { success: false, error: String(error) };
  }
}
