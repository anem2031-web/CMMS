import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/CMMS/.env" });

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(conn);

// Orphan: ticketId not in tickets
const [orphanTicket] = await conn.execute(`
  SELECT COUNT(*) AS cnt FROM inspection_results ir
  WHERE NOT EXISTS (SELECT 1 FROM tickets t WHERE t.id = ir.ticketId)
`);

// Orphan: assetId not in assets (only non-null assetId)
const [orphanAsset] = await conn.execute(`
  SELECT COUNT(*) AS cnt FROM inspection_results ir
  WHERE ir.assetId IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM assets a WHERE a.id = ir.assetId)
`);

// Orphan: inspectorId not in users
const [orphanUser] = await conn.execute(`
  SELECT COUNT(*) AS cnt FROM inspection_results ir
  WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ir.inspectorId)
`);

console.log("Orphan ticketId:", orphanTicket[0].cnt);
console.log("Orphan assetId:", orphanAsset[0].cnt);
console.log("Orphan inspectorId:", orphanUser[0].cnt);

await conn.end();
