import { sql } from "drizzle-orm";

/** Same item-level eligibility as the warehouse's waiting-preparation list. */
export async function isWaitingExternalWarehousePreparation(ticketId: number): Promise<boolean> {
  const { getDb } = await import("../db/client");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable while checking external preparation photo");
  const [rows]: any = await db.execute(sql`
    SELECT item.id FROM ticket_items item
    INNER JOIN tickets ticket ON ticket.id = item.ticketId
    LEFT JOIN external_maintenance_jobs job ON job.ticketItemId = item.id
    WHERE item.ticketId = ${ticketId}
      AND item.maintenancePath = 'C' AND item.status = 'work_approved'
      AND job.id IS NULL
    LIMIT 1
  `);
  if (!Array.isArray(rows)) throw new Error("Invalid external preparation photo scope response");
  return rows.length > 0;
}
