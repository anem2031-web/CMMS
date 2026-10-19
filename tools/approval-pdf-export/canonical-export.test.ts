import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../../server/_core/trpc";
import { canonicalInventoryDocument, resolveDocumentPdfInput, type InventoryDocumentCaller } from "../../server/services/pdf/canonicalDocumentExport";
import { authorizePurchaseDocument, wholeOrderPdfApproved } from "../../server/_core/authz/purchase-document";

const user = (role = "senior_management") => ({ id: 71, role, isActive: 1, preferredLanguage: "ar" });
const types = ["receipt", "delivery", "warehouse_issue", "return", "disposal", "count", "settlement"] as const;
function fixtures() {
  const data = { id: 5, receiptNumber: "RCV-5", deliveryNumber: "DLV-5", issueNumber: "WIS-5", returnNumber: "RTN-5", operationNumber: "CNT-5",
    operation: { id: 5, operationNumber: "CNT-5" }, settlement: { id: 5, settlementNumber: "ADJ-5" }, items: [], quantity: 1,
    deliveredByName: "Warehouse", deliveredToName: "Technician", itemName: "Fixture only", createdAt: "2026-10-19T08:00:00Z" };
  const read = vi.fn(async () => data);
  const caller: InventoryDocumentCaller = { warehouseReceipts: { getForPrint: read }, deliveryDocuments: { getForPrint: read },
    warehouseIssueBatches: { getById: read }, returnDocuments: { list: vi.fn(async () => [data]) }, disposal: { getById: read },
    inventoryCount: { operationDetails: read, settlementDetails: read } };
  const template = vi.fn((_data: any, _language?: string) => "<html>CANONICAL INVENTORY DOCUMENT</html>");
  const templates: any = Object.fromEntries(["receipt", "delivery", "warehouseIssue", "return", "disposal", "count", "settlement"].map(name => [name, template]));
  return { data, caller, read, template, templates };
}

describe("Canonical nonfinancial PDF export protects the generic renderer", () => {
  it.each(["accountant", "senior_management"])("rejects arbitrary HTML for %s before any document read", async role => {
    const canonical = vi.fn();
    for (const body of [null, { html: "<h1>unapproved financial statement</h1>" }, { html: "pdf", source: { type: "purchase_order", id: 5 } },
      { source: { type: "count", id: "5" } }, { source: { type: "count", id: 0 } }, { source: { type: "count", id: -1 } },
      { source: { type: "count", id: 1.5 } }, { source: { type: "count", id: Infinity } }, { source: { type: "count", id: Number.MAX_SAFE_INTEGER + 1 } }]) {
      await expect(resolveDocumentPdfInput(user(role), body, canonical)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(canonical).not.toHaveBeenCalled();
  });
  it.each(types)("rebuilds %s from authorized canonical data, ignoring HTML and filename", async type => {
    const { caller, templates, template } = fixtures();
    const result = await resolveDocumentPdfInput(user(), { html: "FORGED FINANCIAL PDF", filename: "FORGED", source: { type, id: 5 }, role: "admin" },
      source => canonicalInventoryDocument(source, caller, user(), templates));
    expect(result.html).toContain("CANONICAL INVENTORY DOCUMENT"); expect(result.filename).not.toBe("FORGED");
    expect(template.mock.calls[0][0]).not.toBe("FORGED FINANCIAL PDF"); expect(template).toHaveBeenCalledOnce();
  });
  it.each(types)("does not render %s if its original resource read is denied", async type => {
    const { caller, templates, read, template } = fixtures();
    read.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    vi.mocked(caller.returnDocuments.list).mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    await expect(canonicalInventoryDocument({ type, id: 5 }, caller, user(), templates)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(template).not.toHaveBeenCalled();
  });
  it.each(types)("rejects a missing %s without entering its template", async type => {
    const { caller, templates, read, template } = fixtures();
    read.mockResolvedValue(null as any); vi.mocked(caller.returnDocuments.list).mockResolvedValue([]);
    await expect(canonicalInventoryDocument({ type, id: 5 }, caller, user(), templates)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(template).not.toHaveBeenCalled();
  });
  it.each(["owner", "admin", "warehouse", "executive_director", "delegate"])("retains legacy generic HTML behavior for %s behind the original HTTP gate", async role => {
    const canonical = vi.fn();
    await expect(resolveDocumentPdfInput(user(role), { html: "<html>existing template</html>", filename: "original" }, canonical))
      .resolves.toEqual({ html: "<html>existing template</html>", filename: "original" });
    expect(canonical).not.toHaveBeenCalled();
  });
  it("reuses actual central query middleware so a source marker grants no accountant inventory rights", async () => {
    const read = vi.fn(async () => ({ operation: { operationNumber: "CNT-5" }, items: [] }));
    const api = router({ inventoryCount: router({ operationDetails: protectedProcedure.input(z.object({ operationId: z.number() })).query(read) }) });
    const actualCaller = api.createCaller({ user: user("accountant"), authenticatedUser: user("accountant") } as any);
    const { templates, template } = fixtures();
    await expect(canonicalInventoryDocument({ type: "count", id: 5 }, actualCaller as any, user("accountant"), templates)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(read).not.toHaveBeenCalled(); expect(template).not.toHaveBeenCalled();
    const seniorCaller = api.createCaller({ user: user(), authenticatedUser: user() } as any);
    await expect(canonicalInventoryDocument({ type: "count", id: 5 }, seniorCaller as any, user(), templates)).resolves.toMatchObject({ filename: "CNT-5" });
    expect(read).toHaveBeenCalledOnce();
  });
  it.each(types)("the existing %s template can render server-side without browser globals", async type => {
    const { caller } = fixtures();
    const result = await canonicalInventoryDocument({ type, id: 5 }, caller, user());
    expect(result.html).toContain("<html"); expect(result.filename).toBeTruthy();
  });
  it("actual HTTP callback rejects forged HTML before calling the PDF engine, and retains typed inventory output", async () => {
    const source = ts.createSourceFile("index.ts", readFileSync("server/_core/index.ts", "utf8"), ts.ScriptTarget.Latest, true);
    let text = "";
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "post"
        && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "/api/export/html-to-pdf") text = node.arguments[2].getText(source);
      ts.forEachChild(node, visit);
    }
    visit(source); expect(text).toBeTruthy();
    const pdf = vi.fn(async () => Buffer.from("%PDF-fixture"));
    const { caller } = fixtures();
    const createCaller = vi.fn((_context: unknown) => caller);
    const canonical = vi.fn(async () => ({ html: "<html>canonical</html>", filename: "CNT-5" }));
    const callback = vm.runInNewContext(ts.transpileModule(`(${text})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
      { resolveDocumentPdfInput, canonicalInventoryDocument: canonical, appRouter: { createCaller }, htmlToPdf: pdf, console });
    const res: any = { status: vi.fn(() => res), json: vi.fn(), setHeader: vi.fn(), send: vi.fn() };
    await callback({ authenticatedUser: user(), body: { html: "<h1>forged</h1>" }, query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(403); expect(pdf).not.toHaveBeenCalled(); expect(res.send).not.toHaveBeenCalled();
    await callback({ authenticatedUser: user(), body: { html: "<h1>forged</h1>", source: { type: "count", id: 5 } }, query: { download: "1" } }, res);
    expect(createCaller.mock.calls[0][0]).toMatchObject({ user: user(), authenticatedUser: user() });
    expect(pdf).toHaveBeenCalledWith("<html>canonical</html>"); expect(res.send).toHaveBeenCalledWith(Buffer.from("%PDF-fixture"));
  });
  it.each(["accountant", "senior_management"])("actual purchase HTTP PDF route blocks %s before rendering or reading stored bytes", async role => {
    const source = ts.createSourceFile("index.ts", readFileSync("server/_core/index.ts", "utf8"), ts.ScriptTarget.Latest, true);
    let text = "";
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "get"
        && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === "/api/export/po/:id/pdf") text = node.arguments[2].getText(source);
      ts.forEachChild(node, visit);
    }
    visit(source); expect(text).toBeTruthy();
    const pdf = vi.fn(), scope: any = { order: async () => ({ id: 1, status: "pending_accounting" }),
      batch: async () => ({ id: 10, purchaseOrderId: 1 }), submission: vi.fn(), batches: vi.fn(), authorize: vi.fn() };
    const callback = vm.runInNewContext(ts.transpileModule(`(${text})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
      { authorizePurchaseDocument: (identity: any, ...ids: any[]) => authorizePurchaseDocument(identity, ids[0], ids[1], ids[2], scope), generatePurchaseRequestPDF: pdf, console });
    const res: any = { status: vi.fn(() => res), json: vi.fn(), setHeader: vi.fn(), send: vi.fn() };
    await callback({ authenticatedUser: user(role), params: { id: "1" }, query: { batchId: "10" } }, res);
    expect(res.status).toHaveBeenCalledWith(403); expect(pdf).not.toHaveBeenCalled(); expect(res.send).not.toHaveBeenCalled();
    expect(scope.authorize).not.toHaveBeenCalled();
  });
  it.each([
    ["priced unbatched", { batchId: null, status: "estimated", estimatedUnitCost: "20" }, false],
    ["actual-priced unbatched", { batchId: null, status: "purchased", actualUnitCost: "3" }, false],
    ["explicit zero-priced unbatched", { batchId: null, status: "estimated", estimatedUnitCost: "0.00" }, false],
    ["unpriced", { batchId: null, status: "pending_estimate", estimatedUnitCost: null }, true],
    ["rejected", { batchId: null, status: "rejected", estimatedUnitCost: "20" }, true],
    ["cancelled", { batchId: null, status: "cancelled", estimatedUnitCost: "20" }, true],
    ["purchase cancelled", { batchId: null, status: "purchase_cancelled", estimatedUnitCost: "20" }, true],
  ] as const)("whole-order approval covers the real PDF renderer's visible items: %s", (_label, extra, expected) => {
    const source = ts.createSourceFile("exportService.ts", readFileSync("server/services/export/exportService.ts", "utf8"), ts.ScriptTarget.Latest, true);
    const generator = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "generatePurchaseRequestPDF") as ts.FunctionDeclaration;
    const statements = generator.body!.statements.filter(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration =>
      ["CANCELLED_ITEM_STATUSES", "visibleItems"].includes(declaration.name.getText(source)))).map(node => node.getText(source)).join("\n");
    const items = [{ id: 1, batchId: 10, status: "approved", estimatedUnitCost: "10" }, { id: 2, ...extra }];
    const rendered = vm.runInNewContext(ts.transpileModule(`(() => {${statements}; return visibleItems;})()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText,
      { allItems: items });
    const batch = { id: 10, purchaseOrderId: 1, accountingApprovedById: 71, accountingApprovedAt: "2026-10-19T08:00:00Z" };
    expect(wholeOrderPdfApproved(user("accountant"), { id: 1 }, [batch], items)).toBe(expected);
    expect(rendered.some((item: any) => item.id === 2)).toBe(!expected);
  });
});
