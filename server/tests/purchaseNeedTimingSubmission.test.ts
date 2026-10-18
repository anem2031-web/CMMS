import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { purchaseItemNeedTimingShape, validatePurchaseItemNeedTiming } from "../routers/purchase/item-need-timing";
import { resolvePurchaseItemNeedTiming } from "../../shared/purchaseItemNeedDate";

// Execute the actual router input and submission callback with an in-memory DB.
// No router module import: importing the application graph can start live jobs.
const source = readFileSync("server/routers/purchase/purchase-orders.router.ts", "utf8");
const ast = ts.createSourceFile("purchase-orders.router.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const snippets = new Map<string, { input: string; mutation: string }>();
function walk(node: ts.Node) {
  if (ts.isPropertyAssignment(node) && ["saveDraft", "updateDraft", "submitDraft", "create"].includes(node.name.getText(ast))) {
    let input = "", mutation = "";
    function calls(n: ts.Node) {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        if (n.expression.name.text === "input") input = n.arguments[0].getText(ast);
        if (n.expression.name.text === "mutation") mutation = n.arguments[0].getText(ast);
      }
      ts.forEachChild(n, calls);
    }
    calls(node.initializer);
    snippets.set(node.name.getText(ast), { input, mutation });
  }
  ts.forEachChild(node, walk);
}
walk(ast);
function evaluate(code: string, context: Record<string, unknown> = {}) {
  return vm.runInNewContext(ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
    { z, purchaseItemNeedTimingShape, validatePurchaseItemNeedTiming, MAX_TICKET_PURCHASE_QUANTITY: 1_000_000, Date, ...context });
}
function fixture(items: any[]) {
  let state = { header: { id: 41, status: "draft", requestedById: 7 }, items: structuredClone(items) };
  const db = {
    getPurchaseOrderById: vi.fn(async () => state.header),
    getPOItems: vi.fn(async () => structuredClone(state.items)),
    withTransaction: vi.fn(async (work: any) => {
      const before = structuredClone(state);
      const tx = { select: () => ({ from: () => ({ where: () => ({ for: async () => [{ status: state.header.status }] }) }) }) };
      try { return await work(tx); } catch (error) { state = before; throw error; }
    }),
    getNextPONumber: vi.fn(async () => "PR-2026-TEST"),
    updatePOItem: vi.fn(async (id: number, values: object) => { Object.assign(state.items.find((i: any) => i.id === id), values); }),
    updatePurchaseOrder: vi.fn(async (_id: number, values: object) => { Object.assign(state.header, values); }),
    getPurchaseManagerUsers: vi.fn(async () => []), createAuditLog: vi.fn(),
  };
  const run = evaluate(snippets.get("submitDraft")!.mutation, {
    db, TRPCError, resolvePurchaseItemNeedTiming, purchaseOrders: { id: "id", status: "status" }, eq: () => true,
    assertCanPerformPOAction: () => {}, assertTicketAllowsNewPurchaseOrder: async () => {},
    resolveAndValidatePurchaseOrderContext: async () => ({}), syncPathBTicketFromPurchaseOrder: async () => {},
    queuePOItemsTranslation: () => {}, queuePONotesTranslation: () => {},
  });
  return { db, state: () => state, submit: () => run({ input: { id: 41 }, ctx: { user: { id: 7, name: "Creator" } } }) };
}
describe("Actual purchase draft and send boundaries", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-19T09:00:00Z")); });
  afterEach(() => vi.useRealTimers());
  it.each(["saveDraft", "updateDraft"])("%s accepts blank timing without bypassing other item validation", name => {
    const schema = evaluate(snippets.get(name)!.input);
    const body = { id: 41, items: [{ itemName: "Lamp", quantity: 1, requiredDate: null, deliveryLeadDays: null }] };
    expect(schema.safeParse(body).success).toBe(true);
    expect(schema.safeParse({ ...body, items: [{ ...body.items[0], quantity: 0 }] }).success).toBe(false);
  });
  it("direct creation rejects missing timing, accepts either entry, and rejects past dates", () => {
    const schema = evaluate(snippets.get("create")!.input);
    const item = { itemName: "Lamp", quantity: 1 };
    expect(schema.safeParse({ items: [item] }).success).toBe(false);
    expect(schema.safeParse({ items: [{ ...item, requiredDate: "2026-10-21" }] }).success).toBe(true);
    expect(schema.safeParse({ items: [{ ...item, deliveryLeadDays: 2 }] }).success).toBe(true);
    expect(schema.safeParse({ items: [{ ...item, requiredDate: "2026-10-18" }] }).success).toBe(false);
  });
  it("commits the fixed date, recalculated days and submission header together", async () => {
    const test = fixture([{ id: 1, itemName: "Lamp", requiredDate: "2026-10-21", deliveryLeadDays: 3, itemNameEn: "Lamp" }]);
    await test.submit();
    expect(test.state().items[0]).toMatchObject({ requiredDate: "2026-10-21", deliveryLeadDays: 2 });
    expect(test.state().header).toMatchObject({ status: "pending_review", submittedAt: new Date() });
    await expect(test.submit()).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(test.db.updatePOItem).toHaveBeenCalledTimes(1);
  });
  it("does not submit or partially date other items when one lacks timing", async () => {
    const test = fixture([{ id: 1, itemName: "Lamp", requiredDate: "2026-10-21", deliveryLeadDays: 3 }, { id: 2, itemName: "Cable", requiredDate: null, deliveryLeadDays: null }]);
    await expect(test.submit()).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(test.state().header.status).toBe("draft");
    expect(test.state().items[0].deliveryLeadDays).toBe(3);
    expect(test.db.updatePOItem).not.toHaveBeenCalled();
    expect(test.db.getNextPONumber).not.toHaveBeenCalled();
  });
  it("rolls the date and header back together if the header update fails", async () => {
    const test = fixture([{ id: 1, itemName: "Lamp", requiredDate: "2026-10-21", deliveryLeadDays: 3 }]);
    test.db.updatePurchaseOrder.mockRejectedValueOnce(new Error("injected failure"));
    await expect(test.submit()).rejects.toThrow("injected failure");
    expect(test.state().header.status).toBe("draft");
    expect(test.state().items[0].deliveryLeadDays).toBe(3);
  });
});
