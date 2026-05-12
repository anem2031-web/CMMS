import { getDb } from "./db";
import { 
  tickets, purchaseOrders, purchaseOrderItems, 
  inspectionResults, pmJobs, pmWorkOrders, 
  pmExecutionResults, pmExecutionSessions,
  pushSubscriptions, twoFactorAuditLogs,
  assetMetrics, assetSpareParts,
  notifications, auditLogs,
  ticketStatusHistory,
  procurementComments
} from "../drizzle/schema";
import { sql } from "drizzle-orm";

async function main() {
  console.log("🚀 Starting database cleaning process...");
  const db = await getDb();
  if (!db) {
    console.error("❌ Could not connect to database.");
    process.exit(1);
  }

  try {
    // Disable foreign key checks
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0;`);

    const tables = [
      { name: "procurementComments", table: procurementComments },
      { name: "ticketStatusHistory", table: ticketStatusHistory },
      { name: "twoFactorAuditLogs", table: twoFactorAuditLogs },
      { name: "pushSubscriptions", table: pushSubscriptions },
      { name: "pmExecutionSessions", table: pmExecutionSessions },
      { name: "pmExecutionResults", table: pmExecutionResults },
      { name: "pmJobs", table: pmJobs },
      { name: "pmWorkOrders", table: pmWorkOrders },
      { name: "inspectionResults", table: inspectionResults },
      { name: "purchaseOrderItems", table: purchaseOrderItems },
      { name: "purchaseOrders", table: purchaseOrders },
      { name: "tickets", table: tickets },
      { name: "assetMetrics", table: assetMetrics },
      { name: "assetSpareParts", table: assetSpareParts },
      { name: "notifications", table: notifications },
      { name: "auditLogs", table: auditLogs }
    ];

    for (const item of tables) {
      try {
        console.log(`🧹 Clearing table: ${item.name}...`);
        await db.delete(item.table);
        console.log(`✅ Table ${item.name} cleared.`);
      } catch (err) {
        console.warn(`⚠️ Failed to clear ${item.name}:`, err instanceof Error ? err.message : String(err));
      }
    }

    // Re-enable foreign key checks
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1;`);
    
    console.log("\n✨ Database cleaning completed successfully.");
    console.log("🛡️ Retained Data: Users, Sites, Sections, Asset Categories, Assets.");

  } catch (error) {
    console.error("❌ Critical error during cleaning:", error);
  } finally {
    process.exit(0);
  }
}

main();
