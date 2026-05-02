import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/CMMS/.env" });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  await conn.execute(`
    ALTER TABLE \`inspection_results\`
      ADD CONSTRAINT \`fk_ir_ticketId\`
        FOREIGN KEY (\`ticketId\`) REFERENCES \`tickets\`(\`id\`) ON DELETE CASCADE,
      ADD CONSTRAINT \`fk_ir_assetId\`
        FOREIGN KEY (\`assetId\`) REFERENCES \`assets\`(\`id\`) ON DELETE SET NULL,
      ADD CONSTRAINT \`fk_ir_inspectorId\`
        FOREIGN KEY (\`inspectorId\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT
  `);
  console.log("FK constraints added successfully.");
} catch (err) {
  console.error("Error:", err.message);
} finally {
  await conn.end();
}
