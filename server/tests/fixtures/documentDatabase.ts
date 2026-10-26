import { createRequire } from "node:module";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/** Disposable, in-memory fixtures only; no application environment or remote DB. */
export function documentDatabase() {
  const memory = new DatabaseSync(":memory:");
  memory.exec(`
    CREATE TABLE attachments (id INTEGER,entityType TEXT,entityId INTEGER,fileName TEXT,fileUrl TEXT,fileKey TEXT,mimeType TEXT,fileSize INTEGER,uploadedById INTEGER,createdAt TEXT);
    CREATE TABLE po_pricing_batches (id INTEGER,purchaseOrderId INTEGER,purchasePackageSubmissionId INTEGER,submittedById INTEGER,totalEstimatedCost TEXT,custodyAmount TEXT,accountingApprovedById INTEGER,accountingApprovedAt TEXT,managementApprovedById INTEGER,managementApprovedAt TEXT);
    CREATE TABLE purchase_package_submissions (id INTEGER,purchasePackageId INTEGER,totalEstimatedCost TEXT,custodyBalance TEXT,accountingApprovedById INTEGER,accountingApprovedAt TEXT,managementApprovedById INTEGER,managementApprovedAt TEXT);
    CREATE TABLE users (id INTEGER,name TEXT);
  `);
  const dialect = new MySqlDialect();
  const queries: { sql: string; params: any[] }[] = [];
  return {
    memory, queries,
    async execute(statement: any) {
      const query = dialect.sqlToQuery(statement); queries.push(query);
      return [memory.prepare(query.sql).all(...query.params as any[]), []];
    },
    insert(table: string, record: Record<string, unknown>) {
      const keys = Object.keys(record);
      memory.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...Object.values(record) as any[]);
    },
  };
}
