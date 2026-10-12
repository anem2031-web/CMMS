import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const schema = read("drizzle/schema.ts");
const migration = read("drizzle/2026_10_04_center_categories_ticket_transition.sql");
const ticketRouter = read("server/routers/tickets/tickets.router.ts");
const ticketDb = read("server/_core/db/tickets.ts");
const categoriesRouter = read("server/routers/purchase/purchase-categories.router.ts");
const createTicket = read("client/src/pages/tickets/CreateTicket.tsx");
const ticketDetail = read("client/src/pages/tickets/TicketDetail.tsx");
const purchaseCreate = read("client/src/pages/purchase/CreatePurchaseOrder.tsx");
const sidebar = read("client/src/components/layout/DashboardLayout.tsx");

// Contract: Center Categories is now the shared master, while legacy ticket.category remains in place.
test("shared center categories schema preserves legacy ticket category", () => {
  assert.match(schema, /export const centerCategories = mysqlTable\("center_categories"/);
  assert.match(schema, /systemKey: varchar\(\{ length: 50 \}\)/);
  assert.match(schema, /category: mysqlEnum\(\['electrical'[\s\S]*?'it'\]\)\.default\('general'\)\.notNull\(\),[\s\S]*?categoryId: int\(\)\.references\(\(\) => centerCategories\.id/);
  assert.match(schema, /purchaseOrders = mysqlTable[\s\S]*?categoryId: int\(\)\.references\(\(\) => centerCategories\.id/);
});

test("migration does not rewrite historical ticket rows", () => {
  assert.match(migration, /RENAME TABLE `purchase_categories` TO `center_categories`/);
  assert.match(migration, /ADD COLUMN `categoryId` int NULL AFTER `category`/);
  assert.match(migration, /fk_tickets_center_category/);
  assert.doesNotMatch(migration, /UPDATE `tickets`/i);
  assert.doesNotMatch(migration, /DELETE FROM `tickets`/i);
});

test("IT behavior is resolved by systemKey for new tickets with legacy fallback", () => {
  assert.match(ticketRouter, /centerCategory\.systemKey === "it"/);
  assert.match(ticketRouter, /rawTicketInput\.category === "it"/);
  assert.match(ticketRouter, /legacyCategoryForCenterCategory/);
  assert.match(ticketRouter, /return category\?\.systemKey === "it" \? "it" : "general"/);
  assert.match(ticketRouter, /resolveSingleActiveItManager\(\)/);
  assert.match(ticketRouter, /createDirectItPlanningTicket/);
});

test("new maintenance ticket UI uses Center Categories", () => {
  assert.match(createTicket, /trpc\.centerCategories\.list\.useQuery\(\{ activeOnly: true \}\)/);
  assert.match(createTicket, /categoryId: ""/);
  assert.match(createTicket, /categoryId: form\.categoryId \? parseInt\(form\.categoryId\) : undefined/);
  assert.doesNotMatch(createTicket, /Object\.keys\(t\.category\)/);
});

test("ticket reads prefer center category name and fall back for historical rows", () => {
  assert.match(ticketDb, /centerCategoryName: centerCategories\.name/);
  assert.match(ticketDetail, /ticket\.centerCategoryName \|\| getCategoryLabel\(ticket\.category\)/);
});

test("purchases now use the same Center Categories source", () => {
  assert.match(purchaseCreate, /trpc\.centerCategories\.list\.useQuery/);
  assert.match(sidebar, /labelKey: "nav\.purchaseCategories", path: "\/center-categories"/);
});

test("system categories are protected from delete and IT from disable", () => {
  assert.match(categoriesRouter, /if \(current\.systemKey\)/);
  assert.match(categoriesRouter, /current\.systemKey === "it" && input\.isActive === false/);
  assert.match(categoriesRouter, /getCenterCategoryUsageCount/);
});
