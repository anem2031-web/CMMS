// Run with the application stopped: node scripts/migrate-it-team.mjs
// Uses the deployment's DATABASE_URL. No credentials are included in this patch.
import "dotenv/config";
import mysql from "mysql2/promise";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const cx = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await cx.query("CREATE TABLE IF NOT EXISTS it_team_patch_migrations (id varchar(80) PRIMARY KEY, appliedAt timestamp DEFAULT CURRENT_TIMESTAMP)");
  const [done] = await cx.query("SELECT id FROM it_team_patch_migrations WHERE id='it-team-v1'");
  if (done.length) { console.log("IT team migration already applied"); }
  else {
    const [cols] = await cx.query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='role'");
    const current = cols[0]?.COLUMN_TYPE;
    if (!current?.startsWith("enum(")) throw new Error("Unexpected users.role definition");
    if (!current.includes("'it_member'")) await cx.query(`ALTER TABLE users MODIFY COLUMN role ${current.slice(0,-1)},'it_member') NOT NULL DEFAULT 'user'`);
    for (const [name, type] of [["claimedById", "int NULL"], ["claimedAt", "timestamp NULL"]]) {
      const [found] = await cx.query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='ticket_departments' AND COLUMN_NAME=?", [name]);
      if (!found.length) await cx.query(`ALTER TABLE ticket_departments ADD COLUMN ${name} ${type}`);
    }
    await cx.query(`CREATE TABLE IF NOT EXISTS it_purchase_needs (
      id int NOT NULL AUTO_INCREMENT PRIMARY KEY, ticketId int NOT NULL, ticketItemId int NOT NULL,
      requestedById int NOT NULL, managerId int NOT NULL, items json NOT NULL, reason text NOT NULL,
      status enum('pending','returned','ordered') NOT NULL DEFAULT 'pending', reviewNote text NULL,
      purchaseOrderId int NULL, createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_it_need_manager_status (managerId,status), INDEX idx_it_need_ticket (ticketId),
      CONSTRAINT fk_it_need_ticket FOREIGN KEY(ticketId) REFERENCES tickets(id) ON DELETE RESTRICT,
      CONSTRAINT fk_it_need_item FOREIGN KEY(ticketItemId) REFERENCES ticket_items(id) ON DELETE RESTRICT
    )`);
    await cx.beginTransaction();
    try {
      // Preserve historical ownership. New arrivals after deployment start unclaimed.
      await cx.query("UPDATE ticket_departments SET claimedById=responsibleManagerId, claimedAt=COALESCE(routedAt,CURRENT_TIMESTAMP) WHERE department='maintenance_report_department_it' AND claimedById IS NULL");
      await cx.query("UPDATE tickets SET assignedToId=maintenanceResponsibleManagerId WHERE maintenanceResponsibleDepartment='maintenance_report_department_it' AND assignedToId IS NULL AND workflowModel='department_tasks'");
      await cx.query("UPDATE ticket_items i JOIN tickets t ON t.id=i.ticketId SET i.assignedToId=t.assignedToId WHERE i.responsibleDepartment='maintenance_report_department_it' AND i.assignedToId IS NULL AND t.workflowModel='department_tasks'");
      await cx.query("INSERT INTO it_team_patch_migrations(id) VALUES ('it-team-v1')");
      await cx.commit();
    } catch(e) { await cx.rollback(); throw e; }
    console.log("IT team migration applied; existing ownership preserved");
  }
} finally { await cx.end(); }
