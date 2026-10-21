import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router, protectedProcedure } from "../_core/trpc";
import { assertCanViewPurchaseOrder, assertCanPerformPOAction } from "../_core/authz/guard";
import { isDelegateOwnPurchaseDraft } from "../../shared/purchaseDraftVisibility";
import { purchaseItemNeedTimingShape } from "../routers/purchase/item-need-timing";
import { resolvePurchaseItemNeedTiming } from "../../shared/purchaseItemNeedDate";

// Real RPC middleware, parent/action guards and actual handler expressions.
// Only persistence/translation/external services are replaced; no live environment.
const f = vi.hoisted(() => ({ orders: [] as any[], items: [] as any[], comments: [] as any[],
  headers: vi.fn(), lines: vi.fn(), assigned: vi.fn(), notes: vi.fn(), failRead: false }));
vi.mock("../_core/db", () => ({ getPOItemsByDelegate: f.assigned, getUserIdsByRole: async () => [8] }));
vi.mock("../_core/authz/media-access", () => ({ assertMediaMutationAccess: async () => {} }));
function expression(file: string, name: string) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true,
    file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let result = "";
  function walk(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(ast) === name) result = node.initializer.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isCallExpression(node.initializer))
      result = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, walk);
  }
  walk(ast); if (!result) throw Error(`Missing real source ${name}`); return result;
}
function evaluate(code: string, scope: any) {
  return vm.runInNewContext(ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, scope);
}
const db = {
  getPurchaseOrderById: f.headers, getPOItems: f.lines, getProcurementComments: f.notes,
  withTransaction: async (work: any) => {
    const before = structuredClone({ orders: f.orders, items: f.items });
    const tx = { select: () => ({ from: () => ({ where: () => ({ for: async () => [{ status: f.orders[0].status }] }) }) }),
      delete: () => { throw Error("unexpected removal of saved item"); } };
    try { return await work(tx); } catch (error) { Object.assign(f, before); throw error; }
  },
  updatePurchaseOrder: async (id: number, values: any) => Object.assign(f.orders.find(p => p.id === id), values),
  updatePOItem: async (id: number, values: any) => Object.assign(f.items.find(i => i.id === id), values),
  createAuditLog: async () => {},
};
const scope = { z, TRPCError, protectedProcedure, db, isDelegateOwnPurchaseDraft,
  assertCanViewPurchaseOrder, assertCanPerformPOAction,
  localizePurchaseUserNames: async (rows: any[]) => rows,
  localizeMasterDataReferences: async (value: any) => value,
  isPurchasePdfApprover: () => false,
  purchaseItemNeedTimingShape, resolvePurchaseItemNeedTiming,
  assertTicketAllowsNewPurchaseOrder: async () => {}, assertValidCatalogItemLinks: async () => {},
  assertNoInactiveCatalogUnitUsage: async () => {}, resolveAndValidatePurchaseOrderContext: async (value: any) => value,
  validateDirectIdeaPurchaseContext: async () => {}, queuePOItemsTranslation: () => {}, queuePONotesTranslation: () => {},
  purchaseOrders: { id: "id", status: "status" }, eq: () => true,
};
const path = "server/routers/purchase/purchase-orders.router.ts";
const api = router({ purchaseOrders: router({
  getById: evaluate(expression(path, "getById"), scope),
  updateDraft: evaluate(expression(path, "updateDraft"), scope),
}) });
function caller(role = "delegate", id = 3) {
  const user = { role, id, isActive: 1, preferredLanguage: "ar" };
  return api.createCaller({ user, authenticatedUser: user, req: {}, res: {} } as any).purchaseOrders;
}
const read = (role = "delegate", id = 3, poId = 41) => caller(role, id).getById({ id: poId });
beforeEach(() => {
  vi.clearAllMocks(); f.failRead = false;
  f.orders = [{ id: 41, status: "draft", requestedById: 3, notes: "Own draft" }];
  f.items = [{ id: 101, purchaseOrderId: 41, delegateId: null, itemName: "Saved material", quantity: 1, status: "pending" }];
  f.comments = [{ id: 1, purchaseOrderItemId: 101 }, { id: 2, purchaseOrderItemId: null }];
  f.headers.mockImplementation(async (id: number) => f.orders.find(p => p.id === id));
  f.lines.mockImplementation(async (id: number) => structuredClone(f.items.filter(i => i.purchaseOrderId === id)));
  f.notes.mockImplementation(async () => f.comments);
  f.assigned.mockImplementation(async (id: number) => {
    if (f.failRead) throw Error("read dependency failed");
    return f.items.filter(i => i.delegateId === id);
  });
});

describe("Delegate creator draft through the actual API", () => {
  it("returns the saved unassigned item and its comments without directory data", async () => {
    const result = await read();
    expect(result.items).toMatchObject([{ id: 101, itemName: "Saved material", delegateName: null }]);
    expect(result.comments).toHaveLength(2); expect(result).not.toHaveProperty("users");
  });
  it("reads, edits, saves and reads the same item without replacing its ID", async () => {
    const original = await read();
    await caller().updateDraft({ id: 41, items: original.items.map((i: any) => ({
      id: i.id, itemName: i.itemName, quantity: 2, requiredDate: null, deliveryLeadDays: null,
    })) });
    expect((await read()).items).toMatchObject([{ id: 101, quantity: 2, requiredDate: null }]);
    expect(f.items).toHaveLength(1); expect(f.orders[0].status).toBe("draft");
  });
  it("denies another delegate's draft before fetching items/comments", async () => {
    await expect(read("delegate", 4)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.lines).not.toHaveBeenCalled(); expect(f.notes).not.toHaveBeenCalled();
  });
  it("rejects a missing parent, infrastructure errors and an anonymous request", async () => {
    await expect(read("delegate", 3, 999)).rejects.toMatchObject({ code: "NOT_FOUND" });
    f.failRead = true;
    await expect(read()).rejects.toThrow("read dependency failed");
    const anonymous = api.createCaller({ user: null, req: {}, res: {} } as any);
    await expect(anonymous.purchaseOrders.getById({ id: 41 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(f.lines).not.toHaveBeenCalled();
  });
  it.each(["pending_review", "pending_estimate", "pending_accounting", "pending_management", "approved", "partial_purchase", "purchased", "received", "closed", "revision_needed"])("retains assigned-only scope in submitted stage %s", async status => {
    f.orders[0].status = status;
    f.items.push({ id: 102, purchaseOrderId: 41, delegateId: 3 }, { id: 103, purchaseOrderId: 41, delegateId: 4 });
    expect((await read()).items.map((i: any) => i.id)).toEqual([102]);
    expect((await read()).comments).toEqual([{ id: 2, purchaseOrderItemId: null }]);
  });
  it("keeps another creator's assigned draft scoped and never grants edit access", async () => {
    f.orders[0].requestedById = 9; f.items.push({ id: 102, purchaseOrderId: 41, delegateId: 3 });
    expect((await read()).items.map((i: any) => i.id)).toEqual([102]);
    await expect(caller().updateDraft({ id: 41, items: [{ id: 102, itemName: "Change", quantity: 1 }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects foreign item IDs and a subsequent write after submission", async () => {
    await read();
    await expect(caller().updateDraft({ id: 41, items: [{ id: 999, itemName: "Foreign", quantity: 1 }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    f.orders[0].status = "pending_review";
    await expect(caller().updateDraft({ id: 41, items: [{ id: 101, itemName: "Stale", quantity: 1 }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(f.items[0].itemName).toBe("Saved material");
  });
  it("does not cache ownership or assignment across consecutive actors/requests", async () => {
    expect((await read()).items).toHaveLength(1);
    await expect(read("delegate", 4)).rejects.toMatchObject({ code: "FORBIDDEN" });
    f.orders[0].status = "pending_review";
    expect((await read()).items).toHaveLength(0);
    f.items[0].delegateId = 3;
    expect((await read()).items).toHaveLength(1);
    f.items[0].delegateId = 4;
    expect((await read()).items).toHaveLength(0);
  });
  it.each(["admin", "owner", "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "purchase_manager"])("preserves %s's draft view", async role => {
    expect((await read(role, 9)).items).toHaveLength(1);
  });
  it.each(["accountant", "senior_management", "executive_director", "warehouse", "food_warehouse_assistant", "it_manager", "purchase_requester"])("preserves %s's own versus foreign draft scope", async role => {
    expect((await read(role)).items).toHaveLength(1);
    await expect(read(role, 9)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("keeps item reads constant for a large single-parent response", async () => {
    f.items = Array.from({ length: 1501 }, (_, id) => ({ id, purchaseOrderId: 41, delegateId: null }));
    expect((await read()).items).toHaveLength(1501);
    expect(f.headers).toHaveBeenCalledOnce(); expect(f.assigned).toHaveBeenCalledOnce();
    expect(f.lines).toHaveBeenCalledOnce(); expect(f.notes).toHaveBeenCalledOnce();
  });
});

describe("Real detail-page visibleItems selector", () => {
  function visible(po: any, role = "delegate", userId = 3, delegateActionView = "all") {
    return evaluate(expression("client/src/pages/purchase/PurchaseOrderDetail.tsx", "visibleItems"), {
      po, role, userId, delegateActionView, isDelegateOwnPurchaseDraft,
      isAdminOrOwner: ["admin", "owner"].includes(role), isMaintenanceManagerVariant: false, pricingBatches: [],
    })();
  }
  it.each(["all", "estimate", "purchase", "mixed"])("shows own draft even with a stale action filter %s", mode => {
    expect(visible({ ...f.orders[0], items: f.items }, "delegate", 3, mode)).toEqual(f.items);
  });
  it("keeps normal assignment and action filters outside the creator draft", () => {
    const items = [{ id: 1, delegateId: 3, status: "pending" }, { id: 2, delegateId: 3, status: "approved" }, { id: 3, delegateId: 4, status: "approved" }];
    expect(visible({ ...f.orders[0], status: "pending_estimate", items }, "delegate", 3, "purchase").map((i: any) => i.id)).toEqual([2]);
  });
});
