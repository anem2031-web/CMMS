import mysql from "mysql2/promise";
import { readFileSync } from "fs";
import { config } from "dotenv";
config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const sql = readFileSync("/home/ubuntu/CMMS/drizzle/migrations/asset_categories.sql", "utf8");
await conn.execute(sql);
console.log("✅ asset_categories table created");
await conn.end();
