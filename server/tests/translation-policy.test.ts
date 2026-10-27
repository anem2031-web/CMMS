import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { canProcessTranslationJob, isAutomaticTranslationEnabled } from "../services/translation/translationPolicy";
import { loadNotificationRecipientRole, automaticTranslationScope } from "../services/translation/notificationTranslationScope";
import { APP_ROLE } from "../../shared/roles";
import { translationJobs } from "../../drizzle/schema";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), llm: vi.fn(), predicates: [] as any[], limits: [] as number[] }));
vi.mock("../_core/db", () => ({ getDb: mocks.getDb }));
vi.mock("../_core/llm", () => ({ invokeLLM: mocks.llm }));
vi.mock("../_core/authz/observer-read-scope", () => ({ isObserverReadScope: () => false }));
import { queueTranslation, retryFailedJobs, recoverPendingTranslations, getTranslationJobsList } from "../services/translation/translationEngine";

beforeEach(() => {
  vi.clearAllMocks(); mocks.predicates.length = 0; mocks.limits.length = 0;
  const chain: any = {
    from: () => chain,
    innerJoin: () => chain,
    where: (p: any) => { mocks.predicates.push(p); return chain; },
    orderBy: () => chain,
    limit: async (n: number) => { mocks.limits.push(n); return []; },
  };
  mocks.getDb.mockResolvedValue({ select: () => chain });
});

describe("automatic translation scope and retry boundaries (no live environment)", () => {
  it.each(["NOTIFICATION", "notification", " Notification "])("blocks missing recipients for %s without calling the translation API", async entityType => {
    expect(await queueTranslation({ entityType, entityId: 1, sourceLanguage: "ar", fields: [{ fieldName: "title", text: "test" }] })).toEqual([]);
    expect(await retryFailedJobs(entityType)).toBe(0);
    expect(mocks.llm).not.toHaveBeenCalled();
  });
  it.each(["TICKET", "PO", "PO_ITEM", "ASSET", "USER", "SITE"])("keeps %s enabled", entityType => {
    expect(isAutomaticTranslationEnabled(entityType)).toBe(true);
  });
  it("targets only the selected failed job and excludes non-IT notifications and stale/manual translations", async () => {
    await retryFailedJobs(undefined, 2473021);
    const query = new MySqlDialect().sqlToQuery(mocks.predicates[0]);
    expect(query.params).toContain(2473021); expect(query.sql).toContain("NOTIFICATION");
    expect(query.params).toEqual(expect.arrayContaining(["it_manager", "it_member"]));
    expect(query.sql).toContain("EXISTS"); expect(query.sql).toContain("et.translationJobId");
    expect(query.sql).toContain("et.translationStatus IN ('failed', 'pending')");
    expect(mocks.limits).toEqual([1]);
  });
  it("bounds bulk retries to twenty without inheriting the previous request's job filter", async () => {
    await retryFailedJobs(undefined, 123); await retryFailedJobs("TICKET");
    const query = new MySqlDialect().sqlToQuery(mocks.predicates[1]);
    expect(query.params).not.toContain(123); expect(query.params).toContain("TICKET");
    expect(mocks.limits).toEqual([1, 20]);
  });
  it("recovery restricts notifications to IT and does not steal active processing jobs", async () => {
    await recoverPendingTranslations();
    const query = new MySqlDialect().sqlToQuery(mocks.predicates[0]);
    expect(query.sql).toContain("NOTIFICATION");
    expect(query.params).toEqual(expect.arrayContaining(["it_manager", "it_member"])); expect(query.sql).toContain("INTERVAL 30 MINUTE");
    expect(query.sql).toContain("et.translationJobId"); expect(mocks.limits).toEqual([50]);
    expect(mocks.llm).not.toHaveBeenCalled();
  });
  it("filters the entity before fetching the bounded monitor list", async () => {
    await getTranslationJobsList({ entityId: 2040052, limit: 50 });
    expect(new MySqlDialect().sqlToQuery(mocks.predicates[0]).params).toContain(2040052);
    expect(mocks.limits).toEqual([50]);
  });
  it.each([
    ["NOTIFICATION", "pending", 1, "pending", false],
    ["TICKET", "pending", 1, "pending", true],
    ["TICKET", "processing", 1, "pending", false],
    ["TICKET", "pending", 2, "pending", false],
    ["TICKET", "pending", 1, "approved", false],
    ["TICKET", "pending", 1, "completed", false],
  ])("worker policy %s/%s/%s/%s", (entityType, status, translationJobId, translationStatus, expected) => {
    expect(canProcessTranslationJob({ id: 1, entityType, status }, { translationJobId, translationStatus })).toBe(expected);
  });
  it("denies missing translation parents", () => {
    expect(canProcessTranslationJob({ id: 1, entityType: "TICKET", status: "pending" }, null)).toBe(false);
  });
  it("does not enqueue a duplicate for unchanged pending/processing/completed text", async () => {
    let reads = 0;
    const chain: any = { from: () => chain, where: (p: any) => { mocks.predicates.push(p); return chain; },
      limit: async () => ++reads === 1
        ? [{ id: 4, translationStatus: "pending", translationJobId: 5 }]
        : [{ id: 5, status: "pending" }] };
    const insert = vi.fn();
    mocks.getDb.mockResolvedValue({ select: () => chain, insert });
    expect(await queueTranslation({ entityType: "TICKET", entityId: 10, sourceLanguage: "ur",
      targetLanguages: ["en"], fields: [{ fieldName: "title", text: "test" }] })).toEqual([]);
    const query = new MySqlDialect().sqlToQuery(mocks.predicates[1]);
    expect(query.params).toEqual(expect.arrayContaining(["pending", "processing", "completed"]));
    expect(insert).not.toHaveBeenCalled(); expect(mocks.llm).not.toHaveBeenCalled();
  });
  it("never queues over an approved manual translation", async () => {
    const chain: any = { from: () => chain, where: () => chain,
      limit: async () => [{ id: 4, translationStatus: "approved" }] };
    const insert = vi.fn(); mocks.getDb.mockResolvedValue({ select: () => chain, insert });
    expect(await queueTranslation({ entityType: "TICKET", entityId: 10, sourceLanguage: "ur",
      targetLanguages: ["en"], fields: [{ fieldName: "title", text: "changed" }] })).toEqual([]);
    expect(insert).not.toHaveBeenCalled(); expect(mocks.llm).not.toHaveBeenCalled();
  });
  it("queues only the changed field, not the unchanged completed title", async () => {
    const results = [
      [{ id: 11, translationStatus: "completed", translationJobId: 21 }], [{ id: 21 }],
      [{ id: 12, translationStatus: "completed", translationJobId: 22 }], [],
    ];
    const chain: any = { from: () => chain, where: (p: any) => { mocks.predicates.push(p); return chain; },
      limit: async () => results.shift() ?? [] };
    const values = vi.fn(async (_values: any) => [{ insertId: 101 }]);
    mocks.getDb.mockResolvedValue({ select: () => chain, insert: () => ({ values }),
      update: () => ({ set: () => ({ where: async () => [{ affectedRows: 1 }] }) }) });
    expect(await queueTranslation({ entityType: "TICKET", entityId: 10, sourceLanguage: "ar", targetLanguages: ["en"],
      fields: [{ fieldName: "title", text: "same title" }, { fieldName: "description", text: "changed description" }] })).toEqual([101]);
    expect(values).toHaveBeenCalledTimes(1);
    expect(values.mock.calls[0][0]).toMatchObject({ fieldName: "description", sourceText: "changed description" });
    expect(new MySqlDialect().sqlToQuery(mocks.predicates[1]).params).toContain(21);
  });
});


describe("notification translation follows the persisted recipient", () => {
  it.each(["it_manager", "it_member", "warehouse", "admin"])("enqueue uses stored recipient %s, not the caller", async role => {
    let reads = 0;
    const chain: any = { from: () => chain, innerJoin: () => chain, where: () => chain,
      limit: async () => ++reads === 1 ? [{ role }] : [{ translationStatus: "approved" }] };
    const insert = vi.fn();
    mocks.getDb.mockResolvedValue({ select: () => chain, insert });
    await queueTranslation({ entityType: "NOTIFICATION", entityId: 77, userId: 999,
      sourceLanguage: "ar", targetLanguages: ["en"], fields: [{ fieldName: "title", text: "test" }] });
    expect(reads).toBe(role.startsWith("it_") ? 2 : 1);
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.llm).not.toHaveBeenCalled();
  });
  it.each([1, 100])("monitor loads %s rows with repeated parents in one SQL query", async size => {
    const rows = Array.from({ length: size }, (_, id) => ({ id, entityId: 77, entityType: "NOTIFICATION" }));
    const chain: any = { from: () => chain, where: () => chain, orderBy: () => chain, limit: async () => rows };
    const select = vi.fn(() => chain);
    mocks.getDb.mockResolvedValue({ select });
    expect(await getTranslationJobsList({ limit: size })).toEqual(rows);
    expect(select).toHaveBeenCalledTimes(1);
    const projection = select.mock.calls[0] as unknown as [Record<string, any>];
    expect(new MySqlDialect().sqlToQuery(projection[0].automaticTranslationEnabled).params).toEqual(["it_manager", "it_member"]);
  });
  it.each(Object.values(APP_ROLE))("role %s", role => {
    expect(isAutomaticTranslationEnabled("NOTIFICATION", role)).toBe(role === "it_manager" || role === "it_member");
    expect(isAutomaticTranslationEnabled("TICKET", role)).toBe(true);
  });
  it.each([undefined, null, "", "unknown"])("missing/unknown recipient role %s denies", role => {
    expect(isAutomaticTranslationEnabled("NOTIFICATION", role)).toBe(false);
  });
  it("loads the recipient fresh for consecutive operations, not the actor or a cached role", async () => {
    let reads = 0;
    const chain: any = { from: () => chain, innerJoin: () => chain, where: () => chain,
      limit: async () => [{ role: ++reads === 1 ? "it_member" : "warehouse" }] };
    const db = { select: vi.fn(() => chain) };
    const first = await loadNotificationRecipientRole(db, "NOTIFICATION", 77);
    const second = await loadNotificationRecipientRole(db, "NOTIFICATION", 77);
    expect(isAutomaticTranslationEnabled("NOTIFICATION", first)).toBe(true);
    expect(isAutomaticTranslationEnabled("NOTIFICATION", second)).toBe(false);
    expect(db.select).toHaveBeenCalledTimes(2);
    await loadNotificationRecipientRole(db, "TICKET", 77);
    expect(db.select).toHaveBeenCalledTimes(2);
  });
  it("SQL list/retry policy joins the notification recipient with exactly the two IT roles", () => {
    const query = new MySqlDialect().sqlToQuery(automaticTranslationScope(translationJobs.entityType, translationJobs.entityId));
    expect(query.params).toEqual(["it_manager", "it_member"]);
    expect(query.sql).toContain("translation_recipient_notification.userId");
    expect(query.sql).toContain("translation_recipient_notification.id");
    expect(query.sql).not.toContain("LEFT JOIN");
  });
  it.each(["it_manager", "it_member"])("worker accepts %s but preserves manual/completed translations", role => {
    const job = { id: 11, entityType: "NOTIFICATION", status: "pending" };
    expect(canProcessTranslationJob(job, { translationJobId: 11, translationStatus: "pending" }, role)).toBe(true);
    for (const status of ["approved", "completed"]) {
      expect(canProcessTranslationJob(job, { translationJobId: 11, translationStatus: status }, role)).toBe(false);
    }
  });
  it("does not mask recipient lookup infrastructure failures as denied translations", async () => {
    const chain: any = { from: () => chain, innerJoin: () => chain, where: () => chain,
      limit: async () => { throw Error("database unavailable"); } };
    await expect(loadNotificationRecipientRole({ select: () => chain }, "NOTIFICATION", 77)).rejects.toThrow("database unavailable");
  });
});
