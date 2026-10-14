import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const schema = read("drizzle/schema.ts");
const migration = read("drizzle/2026_10_05_it_notification_event_key.sql");
const notificationsDb = read("server/_core/db/notifications.ts");
const notificationsRouter = read("server/routers/notifications/notifications.router.ts");
const itService = read("server/routers/tickets/it-team.service.ts");
const notificationsPage = read("client/src/pages/admin/Notifications.tsx");
const itPanel = read("client/src/pages/tickets/ItTeamPanel.tsx");
const ticketDetail = read("client/src/pages/tickets/TicketDetail.tsx");
const ar = read("client/src/i18n/ar.ts");
const en = read("client/src/i18n/en.ts");
const ur = read("client/src/i18n/ur.ts");
const translationEngine = read("server/services/translation/translationEngine.ts");
const localizedMaster = read("server/services/translation/localizedMasterData.ts");
const languageContext = read("client/src/contexts/LanguageContext.tsx");
const categoriesRouter = read("server/routers/purchase/purchase-categories.router.ts");
const assetCategoriesRouter = read("server/routers/assets/asset-categories.router.ts");
const assetsRouter = read("server/routers/assets/assets.router.ts");
const usersRouter = read("server/routers/users/users.router.ts");
const sitesRouter = read("server/routers/sites/sites.router.ts");
const sectionsRouter = read("server/routers/sections/sections.router.ts");
const roles = read("shared/roles.ts");

const requiredItUiKeys = [
  "itAssigneeLabel", "notAssigned", "itTaskAssigneeAria", "chooseTaskAssignee",
  "saveAssignment", "startTaskCreateSubTicket", "routeToItTitle", "routeToItReasonAria",
  "routeToItReasonPlaceholder", "routeToItAction", "routeToItHint", "itTeamLabel",
  "claimedBy", "waitingForClaim", "claimTicket", "handoverAria", "returnToTeamQueue",
  "handoverReasonPlaceholder", "handoverAction", "handoverHint",
];

test("notification schema change is additive and migration does not rewrite historical rows", () => {
  assert.match(schema, /eventKey: varchar\(\{ length: 80 \}\)/);
  assert.match(schema, /idx_notifications_user_event_created/);
  assert.match(migration, /ADD COLUMN `eventKey` varchar\(80\) NULL/);
  assert.match(migration, /CREATE INDEX `idx_notifications_user_event_created`/);
  assert.doesNotMatch(migration, /UPDATE\s+`?notifications`?/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+`?notifications`?/i);
});

test("IT manager and member notification inboxes are isolated to IT ticket arrival events", () => {
  assert.match(notificationsRouter, /isItTeamRole\(ctx\.user\.role\) \? IT_TICKET_ARRIVAL_EVENT : undefined/);
  assert.match(notificationsDb, /isItTeamRole\(recipient\?\.role\)/);
  assert.match(notificationsDb, /data\.eventKey !== IT_TICKET_ARRIVAL_EVENT/);
});

test("IT notification center is reachable and arrival cards target the specific ticket", () => {
  assert.match(itService, /eventKey: IT_TICKET_ARRIVAL_EVENT/);
  assert.match(itService, /relatedTicketId: ticketId/);
  assert.match(itService, /allowItManager: true/);
  assert.match(roles, /normalizedPath === "\/notifications"/);
  assert.match(notificationsPage, /setLocation\(`\/tickets\/\$\{n\.relatedTicketId\}`\)/);
});

test("IT task, assignment and handover UI contains no hard-coded Arabic and uses translation keys", () => {
  assert.doesNotMatch(itPanel, /[\u0600-\u06ff]/u);
  for (const key of requiredItUiKeys) {
    assert.match(itPanel, new RegExp(`t\\.workflow\\.ticket\\.${key}`));
    assert.match(ar, new RegExp(`${key}:`));
    assert.match(en, new RegExp(`${key}:`));
    assert.match(ur, new RegExp(`${key}:`));
  }
  assert.match(ticketDetail, /t\.workflow\.ticket\.task/);
});

test("master-data translation engine covers all shared name masters and persists missing translations", () => {
  assert.match(translationEngine, /SITE: \["name"\]/);
  assert.match(translationEngine, /SECTION: \["name"\]/);
  assert.match(translationEngine, /ASSET: \["name", "description", "notes"\]/);
  assert.match(translationEngine, /ASSET_CATEGORY: \["name"\]/);
  assert.match(translationEngine, /CENTER_CATEGORY: \["name"\]/);
  assert.match(translationEngine, /USER: \["name"\]/);
  assert.match(translationEngine, /ensureStoredNameTranslations/);
  assert.match(translationEngine, /storeCompletedEntityTranslation/);
  assert.match(translationEngine, /Transliterate each name naturally/);
  assert.match(translationEngine, /translationCache\.invalidate\(request\.entityType, request\.entityId, field\.fieldName\)/);
  assert.match(translationEngine, /entityTranslations/);
});

test("master list APIs return localized display names while preserving canonical sourceName", () => {
  assert.match(localizedMaster, /sourceName/);
  assert.match(sitesRouter, /localizeNamedRecords\("SITE"/);
  assert.match(sectionsRouter, /localizeNamedRecords\("SECTION"/);
  assert.match(assetsRouter, /localizeNamedRecords\("ASSET"/);
  assert.match(assetCategoriesRouter, /localizeNamedRecords\("ASSET_CATEGORY"/);
  assert.match(categoriesRouter, /localizeNamedRecords\("CENTER_CATEGORY"/);
  assert.match(usersRouter, /localizeNamedRecords\("USER"/);
});

test("language switch refetches localized master and embedded domain responses", () => {
  assert.match(languageContext, /utils\.sites\.list\.invalidate/);
  assert.match(languageContext, /utils\.sections\.list\.invalidate/);
  assert.match(languageContext, /utils\.assets\.list\.invalidate/);
  assert.match(languageContext, /utils\.assetCategories\.list\.invalidate/);
  assert.match(languageContext, /utils\.centerCategories\.list\.invalidate/);
  assert.match(languageContext, /utils\.users\.list\.invalidate/);
  assert.match(languageContext, /queryClient\.invalidateQueries/);
});
