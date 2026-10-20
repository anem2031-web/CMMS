import { createRequire } from "node:module";
import { getTableName, sql } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/** Execute the real predicates/joins against disposable data, never application DBs. */
export function readScopeDatabase() {
  const memory = new DatabaseSync(":memory:");
  memory.exec(`
    CREATE TABLE purchase_orders (id INTEGER,poNumber TEXT,packageId INTEGER,status TEXT,requestedById INTEGER,ticketId INTEGER);
    CREATE TABLE purchase_order_items (id INTEGER,purchaseOrderId INTEGER,batchId INTEGER,delegateId INTEGER,itemName TEXT,status TEXT,quantity TEXT,estimatedUnitCost TEXT);
    CREATE TABLE purchase_package_submissions (id INTEGER,purchasePackageId INTEGER,subNumber INTEGER,status TEXT,accountingApprovedById INTEGER,accountingApprovedAt TEXT,managementApprovedById INTEGER,managementApprovedAt TEXT);
    CREATE TABLE po_pricing_batches (id INTEGER,purchaseOrderId INTEGER,purchasePackageSubmissionId INTEGER,submittedById INTEGER,batchNumber INTEGER,status TEXT,accountingApprovedById INTEGER,accountingApprovedAt TEXT,managementApprovedById INTEGER,managementApprovedAt TEXT);
    CREATE TABLE tickets (id INTEGER,reportedById INTEGER,assignedToId INTEGER,assignedTechnicianId INTEGER,sourceTaskId INTEGER,maintenanceResponsibleDepartment TEXT,maintenanceResponsibleManagerId INTEGER);
    CREATE TABLE ticket_items (id INTEGER,ticketId INTEGER,responsibleDepartment TEXT,responsibleManagerId INTEGER,assignedToId INTEGER,assignedTechnicianId INTEGER);
    CREATE TABLE ticket_departments (id INTEGER,ticketId INTEGER,department TEXT,responsibleManagerId INTEGER);
    CREATE TABLE ticket_tasks (id INTEGER,ticketId INTEGER);
    CREATE TABLE ticket_task_assignees (id INTEGER,taskId INTEGER,userId INTEGER);
  `);
  const dialect = new MySqlDialect();
  const queries: Array<{ sql: string; params: any[] }> = [];
  const execute = (statement: any) => {
    const query = dialect.sqlToQuery(statement); queries.push(query);
    return memory.prepare(query.sql).all(...query.params as any[]) as any[];
  };
  return {
    memory, queries,
    select(selection?: Record<string, any>) {
      let table: any, predicate: any, join: any, joinPredicate: any, ordering: any[] = [];
      const run = () => execute(sql`SELECT ${selection
        ? sql.join(Object.entries(selection).map(([key, column]) => sql`${column} AS ${sql.raw('`' + key + '`')}`), sql`, `)
        : sql.raw('`' + getTableName(table) + '`.*')} FROM ${table}
        ${join ? sql`INNER JOIN ${join} ON ${joinPredicate}` : sql``}
        ${predicate ? sql`WHERE ${predicate}` : sql``}
        ${ordering.length ? sql`ORDER BY ${sql.join(ordering, sql`, `)}` : sql``}`);
      const chain: any = {
        from(value: any) { table = value; return chain; },
        where(value: any) { predicate = value; return chain; },
        innerJoin(value: any, on: any) { join = value; joinPredicate = on; return chain; },
        orderBy(...value: any[]) { ordering = value; return chain; },
        then(resolve: any, reject: any) { return Promise.resolve().then(run).then(resolve, reject); },
      };
      return chain;
    },
    insert(table: string, record: Record<string, unknown>) {
      const fields = Object.keys(record);
      memory.prepare(`INSERT INTO ${table} (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`).run(...Object.values(record) as any[]);
    },
  };
}
