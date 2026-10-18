import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";
import { drizzle as proxyDrizzle } from "drizzle-orm/mysql-proxy";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { purchaseOrderItems, purchaseOrders, users } from "../../drizzle/schema";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// The actual router runs with in-memory persistence. No live DB, configuration,
// translation provider, PDF storage or network module is loaded by this test.
const state = vi.hoisted(() => ({
  orders: [] as any[], items: [] as any[], writes: [] as any[], nextId: 1,
  failCreate: false, failItemId: 0, lockStatus: "", lastDelegate: 0,
}));
const store = vi.hoisted(() => ({ tx: {} as any }));
vi.mock("../_core/db", () => ({
  withTransaction: vi.fn(async (work: (tx: any) => Promise<any>) => {
    const snapshot = structuredClone({ orders: state.orders, items: state.items, writes: state.writes });
    store.tx = {
      select: () => ({ from: () => ({ where: () => ({ for: async () => [{ status: state.lockStatus || state.orders[0]?.status }] }) }) }),
      delete: () => ({ where: async () => undefined }),
    };
    try { return await work(store.tx); }
    catch (error) { Object.assign(state, snapshot); throw error; }
  }),
  createPurchaseOrder: vi.fn(async (row: any, tx: any) => {
    if (tx !== store.tx) throw new Error("header outside transaction");
    const id = state.nextId++; state.orders.push({ id, ...row }); return id;
  }),
  createPOItems: vi.fn(async (rows: any[], tx: any) => {
    if (tx !== store.tx) throw new Error("items outside transaction");
    state.items.push(...rows.map((row, index) => ({ id: state.items.length + index + 1, ...row })));
    if (state.failCreate) throw new Error("item insert failed");
  }),
  updatePOItem: vi.fn(async (id: number, values: any, tx: any) => {
    if (tx !== store.tx) throw new Error("deadline outside transaction");
    if (id === state.failItemId) throw new Error("deadline write failed");
    state.writes.push({ id, ...values });
    Object.assign(state.items.find(item => item.id === id), values);
  }),
  updatePurchaseOrder: vi.fn(async (id: number, values: any, tx: any) => {
    if (tx !== store.tx) throw new Error("header update outside transaction");
    Object.assign(state.orders.find(order => order.id === id), values);
  }),
  getPurchaseOrderById: vi.fn(async (id: number) => {
    const order = state.orders.find(order => order.id === id); return order ? { ...order } : null;
  }),
  getPOItems: vi.fn(async (id: number) => state.items.filter(item => item.purchaseOrderId === id).map(item => ({ ...item }))),
  getNextDraftNumber: vi.fn(async () => "DFT-TEST"),
  getNextPONumber: vi.fn(async () => "PR-TEST"),
  getExistingCatalogItemIds: vi.fn(async (ids: number[]) => ids),
  getActiveCatalogItemIds: vi.fn(async (ids: number[]) => ids),
  getSiteById: vi.fn(async () => ({ id: 1 })),
  getSections: vi.fn(async () => [{ id: 2, siteId: 1 }]),
  getPurchaseManagerUsers: vi.fn(async () => []),
  createAuditLog: vi.fn(async () => undefined),
  createNotification: vi.fn(async () => undefined),
  getPOItemsByDelegate: vi.fn(async (id: number) => {
    state.lastDelegate = id;
    return state.items.filter(item => item.delegateId === id);
  }),
  getPurchaseOrderTicketContextBatch: vi.fn(async () => new Map(state.orders.map(po => [po.id, { po, ticket: null, externalJob: null }]))),
}));
vi.mock("../_core/notification", () => ({ notifyOwner: vi.fn() }));
vi.mock("../services/translation/translation", () => ({ detectLanguage: vi.fn(async () => "ar") }));
vi.mock("../services/translation/translationEngine", () => ({ queueTranslation: vi.fn(async () => undefined) }));
vi.mock("../services/translation/localizedMasterData", () => ({ localizeNamedRecords: vi.fn(async (_type: string, rows: any[]) => rows) }));
vi.mock("../routers/_shared/router-helpers", () => ({ notifyItemRejection: vi.fn() }));
vi.mock("../services/export/exportService", () => ({ generatePurchaseRequestPDF: vi.fn() }));
vi.mock("../_core/storage", () => ({ storagePut: vi.fn() }));
vi.mock("../services/improvement-ideas/execution", () => ({
  prepareIdeaExecution: vi.fn(), linkCreatedExecution: vi.fn(), validateDirectIdeaPurchaseContext: vi.fn(), assertNotTrackedIdeaSource: vi.fn(),
}));
vi.mock("../_core/catalog-unit-governance", () => ({ findKnownInactiveCatalogUnitNames: vi.fn(async () => []) }));
vi.mock("../routers/purchase/ticket-purchase-workflow", () => ({
  assertCanCreateTicketLinkedPurchaseOrder: vi.fn(), syncPathBTicketFromPurchaseOrder: vi.fn(), syncPathBTicketFromTicketId: vi.fn(),
}));
vi.mock("../routers/maintenance-teams/execution.guard", () => ({ assertLegacyTeamExecutionAllowed: vi.fn() }));
vi.mock("../routers/maintenance-teams/purchase-form", () => ({
  createTicketMaterialPurchase: vi.fn(async (_tx: any, _actor: any, _input: any, create: (handoff: any) => Promise<any>) => ({
    ...await create({ purchaseTotalQuantity: 4, unit: "حبة", technicianQuantity: 2, ticketPurchaseQuantity: 2, warehouseExtraQuantity: 2 }), created: true,
  })),
}));
vi.mock("../pmv2/materials/warehouse-purchase-handoff-service", () => ({
  Pmv2WarehousePurchaseHandoffError: class extends Error {},
  pmv2WarehousePurchaseHandoffService: {
    prepareAtomicPurchaseCreation: vi.fn(async () => ({ requestItemId: 70, linkedQuantity: 4, handoff: { remainingQuantity: 4, availableMainQuantity: 0 } })),
    linkAtomicCreatedPurchase: vi.fn(async () => undefined),
  },
}));
vi.mock("../_core/inventory-lots", () => ({ resolveInventoryLotForIssue: vi.fn(), isInventoryLotsEnabled: vi.fn() }));
vi.mock("../routers/purchase/translation-queue", () => ({ createTranslatedProcurementComment: vi.fn(), queuePurchaseTranslation: vi.fn() }));

import { purchaseOrdersRouter } from "../routers/purchase/purchase-orders.router";
function caller(role = "purchase_requester", id = 10) {
  return purchaseOrdersRouter.createCaller({
    user: { id, role, name: "Test creator", isActive: 1, preferredLanguage: "ar" }, req: { headers: {} }, res: {},
  } as TrpcContext);
}
const item = (deliveryLeadDays = 3) => ({ itemName: "Test material", catalogItemId: 5, quantity: 4, unit: "حبة", deliveryLeadDays });
const body = (items = [item()]) => ({ siteId: 1, sectionId: 2, items });
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, { orders: [], items: [], writes: [], nextId: 1, failCreate: false, failItemId: 0, lockStatus: "", lastDelegate: 0 });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T09:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Actual purchase create/draft/update/submit routes", () => {
  it("saves only durations in the draft and anchors each item to the later submission", async () => {
    const saved = await caller().saveDraft(body([item(2), item(3), item(5)]));
    expect(state.orders[0].status).toBe("draft");
    expect(state.items.map(i => i.requiredDate)).toEqual([null, null, null]);
    vi.setSystemTime(new Date("2026-10-15T09:00:00Z"));
    await caller().submitDraft({ id: saved.id! });
    expect(state.items.map(i => i.requiredDate)).toEqual(["2026-10-17", "2026-10-18", "2026-10-20"]);
    expect(state.orders[0]).toMatchObject({ status: "pending_review", poNumber: "PR-TEST", submittedAt: new Date("2026-10-15T09:00:00Z") });
  });
  it("calculates direct submission on the server and ignores forged preview dates", async () => {
    await caller().create(body([{ ...item(2), requiredDate: "2030-01-01" } as any]));
    expect(state.items[0]).toMatchObject({ quantity: 4, catalogItemId: 5, deliveryLeadDays: 2, requiredDate: "2026-10-12" });
    expect(state.orders[0].status).toBe("pending_review");
  });
  it("editing a draft changes only the duration until it is submitted", async () => {
    const saved = await caller().saveDraft(body());
    await caller().updateDraft({ id: saved.id!, ...body([{ ...item(5), id: 1 } as any]) });
    expect(state.items[0]).toMatchObject({ deliveryLeadDays: 5, requiredDate: null });
    vi.setSystemTime(new Date("2026-10-15T21:01:00Z"));
    await caller().submitDraft({ id: saved.id! });
    expect(state.items[0].requiredDate).toBe("2026-10-21");
  });
  it("keeps historical draft dates unchanged", async () => {
    const saved = await caller().saveDraft(body([{ ...item(), deliveryLeadDays: undefined, requiredDate: "2026-10-09" } as any]));
    await caller().submitDraft({ id: saved.id! });
    expect(state.items[0]).toMatchObject({ deliveryLeadDays: null, requiredDate: "2026-10-09" });
    expect(state.writes).toHaveLength(0);
  });
  it("rolls back the header and items if item creation fails", async () => {
    state.failCreate = true;
    await expect(caller().create(body())).rejects.toThrow("item insert failed");
    expect(state.orders).toEqual([]); expect(state.items).toEqual([]);
  });
  it("rolls back every deadline and keeps the draft if a later item write fails", async () => {
    const saved = await caller().saveDraft(body([item(2), item(5)]));
    state.failItemId = 2;
    await expect(caller().submitDraft({ id: saved.id! })).rejects.toThrow("deadline write failed");
    expect(state.orders[0].status).toBe("draft");
    expect(state.items.map(i => i.requiredDate)).toEqual([null, null]);
    expect(state.writes).toEqual([]);
  });
  it("cannot resubmit an order or restart its deadlines", async () => {
    const saved = await caller().saveDraft(body());
    await caller().submitDraft({ id: saved.id! });
    vi.setSystemTime(new Date("2026-10-20T09:00:00Z"));
    await expect(caller().submitDraft({ id: saved.id! })).rejects.toThrow("الطلب ليس مسودة");
    expect(state.items[0].requiredDate).toBe("2026-10-13");
  });
  it.each(["submitDraft", "updateDraft"] as const)("rechecks draft status inside the lock for %s", async route => {
    const saved = await caller().saveDraft(body()); state.lockStatus = "pending_review";
    const input = route === "submitDraft" ? { id: saved.id! } : { id: saved.id!, ...body() };
    await expect((caller()[route] as any)(input)).rejects.toThrow("الطلب لم يعد مسودة");
    expect(state.items[0].requiredDate).toBeNull(); expect(state.writes).toEqual([]);
  });
  it("retains creator authorization and blocks observer writes", async () => {
    const saved = await caller().saveDraft(body());
    await expect(caller("purchase_requester", 12).submitDraft({ id: saved.id! })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("observer").create(body())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.orders).toHaveLength(1); expect(state.orders[0].status).toBe("draft");
  });
  it("rejects empty draft updates and IDs from another order", async () => {
    const saved = await caller().saveDraft(body());
    await expect(caller().updateDraft({ id: saved.id!, ...body([]) })).rejects.toThrow("صنف واحد");
    await expect(caller().updateDraft({ id: saved.id!, ...body([{ ...item(), id: 900 } as any]) })).rejects.toThrow("لا ينتمي");
    expect(state.items).toHaveLength(1); expect(state.writes).toEqual([]);
  });
  it.each([-2, 1.5, 4000])("rejects invalid lead days before writes: %s", async days => {
    await expect(caller().create(body([item(days)]))).rejects.toThrow();
    expect(state.orders).toEqual([]);
  });
  it("keeps PMV2 purchase linking intact while dating its item", async () => {
    await caller("warehouse").create({ ...body(), pmv2RequestItemId: 70 });
    expect(state.items[0]).toMatchObject({ requiredDate: "2026-10-13", deliveryLeadDays: 3, catalogItemId: 5, quantity: 4 });
  });
  it("dates the ticket-team purchase without changing its item/quantity reference", async () => {
    await caller("warehouse").create({ ...body(), ticketTeam: { assignmentId: 20, needId: 21, expectedRevision: 1, operationKey: "test-1" } });
    expect(state.items[0]).toMatchObject({ requiredDate: "2026-10-13", deliveryLeadDays: 3, catalogItemId: 5, quantity: 4 });
  });
});

describe("Actual delegate queue scope, creator and urgency", () => {
  it("reads the actual creator through the order and still scopes SQL to the assigned delegate", async () => {
    const calls: Array<{ query: string; params: unknown[] }> = [];
    const database = proxyDrizzle(async (query, params) => { calls.push({ query, params }); return { rows: [] }; });
    const source = readFileSync("server/_core/db/purchase.ts", "utf8");
    const ast = ts.createSourceFile("purchase.ts", source, ts.ScriptTarget.Latest, true);
    const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "getPOItemsByDelegate");
    if (!fn) throw new Error("Actual delegate query not found");
    const code = ts.transpileModule(`(${fn.getText(ast).replace(/^export /, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const query = vm.runInNewContext(code, { getDb: async () => database, purchaseOrderItems, purchaseOrders, users, desc, eq, getTableColumns });
    await query(10);
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual([10]);
    expect(calls[0].query).toContain('left join `users` on `purchase_orders`.`requestedById` = `users`.`id`');
    expect(calls[0].query).toContain('where `purchase_order_items`.`delegateId` = ?');
    expect(calls[0].query).toContain('`users`.`name`');
    expect(calls[0].query).not.toContain('`passwordHash`');
  });
  it("returns only actionable assigned items with creator names, earliest deadlines first", async () => {
    state.orders = [{ id: 1, poNumber: "PR-1", status: "partial_purchase" }];
    state.items = [
      { id: 1, purchaseOrderId: 1, delegateId: 10, status: "approved", requiredDate: "2026-10-20", requestedByName: "Creator A" },
      { id: 2, purchaseOrderId: 1, delegateId: 10, status: "funded", requiredDate: "2026-10-12", requestedByName: "Creator A" },
      { id: 3, purchaseOrderId: 1, delegateId: 11, status: "approved", requiredDate: "2026-10-11", requestedByName: "Other" },
      { id: 4, purchaseOrderId: 1, delegateId: 10, status: "purchased", requiredDate: "2026-10-11", requestedByName: "Creator A" },
    ];
    const result = await caller("delegate").actionableItemsForMe();
    expect(state.lastDelegate).toBe(10);
    expect(result.items.map(i => i.id)).toEqual([2, 1]); expect(result.total).toBe(2);
    expect(result.items.every(i => i.requestedByName === "Creator A")).toBe(true);
  });
  it("does not expose the delegate queue to another role", async () => {
    expect(await caller("warehouse").actionableItemsForMe()).toEqual({ items: [], total: 0 });
    expect(state.lastDelegate).toBe(0);
  });
});
