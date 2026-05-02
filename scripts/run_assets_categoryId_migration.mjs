import mysql from "mysql2/promise";
import { config } from "dotenv";
config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await conn.execute("ALTER TABLE `assets` ADD COLUMN `categoryId` INT NULL DEFAULT NULL");
  console.log("✅ categoryId column added to assets table");
} catch (e) {
  if (e.code === "ER_DUP_FIELDNAME") {
    console.log("ℹ️ categoryId column already exists");
  } else {
    throw e;
  }
}
await conn.end();
