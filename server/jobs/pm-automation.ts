import { getDb } from "../db";
import { preventivePlans, pmJobs, tickets } from "../../drizzle/schema";
import { eq, and, lte } from "drizzle-orm";
import { notifyOwner } from "../_core/notification";

export async function runPMAutomationJob() {
  try {
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const now = new Date();
    console.log(`[PM Automation] Job started at ${now.toISOString()}`);

    const activePlans = await db
      .select()
      .from(preventivePlans)
      .where(eq(preventivePlans.isActive, true));

    let createdCount = 0;
    const errors: string[] = [];

    for (const plan of activePlans) {
      try {
        if (!plan.assetId) continue;

        const lastDate: Date = plan.nextDueDate ? new Date(plan.nextDueDate) : new Date(plan.createdAt);
        const nextDate = addFrequency(lastDate, plan.frequency, plan.frequencyValue);

        if (nextDate <= now) {
          const ticketNum = `TKT-PM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          const ticketRes = await db.insert(tickets).values({
            ticketNumber: ticketNum,
            title: `PM: ${plan.title}`,
            description: plan.description || plan.title,
            status: "new",
            priority: "medium",
            category: "general",
            assetId: plan.assetId,
            siteId: plan.siteId,
            reportedById: 1,
          } as any);

          const ticketId = (ticketRes as any)[0]?.insertId;
          if (ticketId) {
            await db.insert(pmJobs).values({
              planId: plan.id,
              assetId: plan.assetId,
              ticketId,
              dueDate: nextDate,
              status: "executed",
              autoCreatedTicket: true,
            } as any);

            createdCount++;
          }
        }
      } catch (err) {
        errors.push(`Plan ${plan.planNumber}: ${String(err)}`);
      }
    }

    if (createdCount > 0) {
      await notifyOwner({
        title: "PM Automation Complete",
        content: `Created ${createdCount} preventive maintenance tickets`,
      });
    }

    console.log(`[PM Automation] Completed: ${createdCount} tickets created`);
    return { success: true, createdCount, errors };
  } catch (error) {
    console.error("[PM Automation] Error:", error);
    return { success: false, error: String(error) };
  }
}

function addFrequency(date: Date, freq: string, val: number): Date {
  const d = new Date(date.getTime());
  switch (freq) {
    case "daily":
      d.setDate(d.getDate() + val);
      break;
    case "weekly":
      d.setDate(d.getDate() + 7 * val);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + val);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3 * val);
      break;
    case "biannual":
      d.setMonth(d.getMonth() + 6 * val);
      break;
    case "annual":
      d.setFullYear(d.getFullYear() + val);
      break;
  }
  return d;
}
