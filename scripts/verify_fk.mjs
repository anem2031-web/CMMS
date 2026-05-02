import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config({ path: "/home/ubuntu/CMMS/.env" });

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [rows] = await conn.execute(`
  SELECT kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME,
         kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME,
         rc.DELETE_RULE
  FROM information_schema.KEY_COLUMN_USAGE kcu
  JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
    ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
  WHERE kcu.TABLE_NAME = 'inspection_results'
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
`);

console.table(rows);
await conn.end();
