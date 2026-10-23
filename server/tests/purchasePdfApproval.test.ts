import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { authorizePurchaseDocument, authorizePurchaseAttachment, hasOwnPurchaseDocumentApproval, purchaseAttachmentPermission, purchaseDocumentPermission, type PurchaseDocumentPort } from "../_core/authz/purchase-document";
import { assertMediaAccess, mediaAccessPort } from "../_core/authz/media-access";
import { PricingBundleService } from "../services/delegate-pricing-bundles/service";
import { createPricingBundlesRouter } from "../routers/delegate-pricing-bundles/router";
import { router } from "../routers/_shared/procedures";
import { businessRpcAllowed } from "../../shared/business-role-policy";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { APP_ROLE } from "../../shared/roles";
import { mediaKeyFromValue } from "../_core/authz/media-access";
import { purchaseDocumentPort } from "../_core/authz/purchase-document";
import { protectedProcedure } from "../routers/_shared/procedures";
import { decorateDocumentRows } from "../_core/authz/document-list";
import { documentListPageInput } from "../../shared/document-list";

const live = vi.hoisted(() => ({ order: vi.fn(), batch: vi.fn(), submission: vi.fn(), batches: vi.fn(), orderBatches: vi.fn() }));
vi.mock("../_core/db", () => ({ getPurchaseOrderById: live.order, getPOPricingBatchById: live.batch, getPurchasePackageSubmissionById: live.submission, getPricingBatchesBySubmission: live.batches, getPOPricingBatches: live.orderBatches }));
const actor = (role = "accountant", id = 3) => ({ id, role, isActive: 1 });
const approval = (role: string, id = 3) => role === "accountant" ? { accountingApprovedById: id, accountingApprovedAt: "2026-10-19 10:00:00" } : { managementApprovedById: id, managementApprovedAt: "2026-10-19 11:00:00" };
function source(role = "accountant"): PurchaseDocumentPort {
  return { order: vi.fn(async id => ({ id, status: "closed", ...approval(role) })), batch: vi.fn(async id => ({ id, purchaseOrderId: 1, submittedById: 11, ...approval(role) })),
    submission: vi.fn(async id => ({ id, ...approval(role) })), batches: vi.fn(async () => [{ id: 10, purchaseOrderId: 1, submittedById: 11, ...approval(role) }, { id: 11, purchaseOrderId: 2, submittedById: 11, ...approval(role) }]),
    orderBatches: vi.fn(async () => []), orderItems: vi.fn(async () => [{ id: 1, batchId: 10, status: "estimated", estimatedUnitCost: "10" }]), authorize: vi.fn(async () => {}) };
}
describe("Financial PDF exact-scope approval, no live database", () => {
  it.each(["accountant", "senior_management"])("keeps %s structured reads separate from PDF before their own approval", async role => {
    const port = source(role); vi.mocked(port.batch).mockResolvedValue({ id: 10, purchaseOrderId: 1 });
    await expect(authorizePurchaseDocument(actor(role), 1, 10, undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await purchaseDocumentPermission(actor(role), 1, 10, undefined, port)).toMatchObject({ pdfAllowed: false });
    expect(port.authorize).not.toHaveBeenCalled(); // A readable header cannot substitute for the missing approval.
  });
  it.each(["accountant", "senior_management"])("requires %s's actor ID AND a valid timestamp", async role => {
    const port = source(role); await expect(authorizePurchaseDocument(actor(role), 1, 10, undefined, port)).resolves.toMatchObject({ id: 1 });
    await expect(authorizePurchaseDocument(actor(role, 4), 1, 10, undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    const prefix = role === "accountant" ? "accounting" : "management";
    for (const time of [null, "", "garbage", "0000-00-00 00:00:00"]) expect(hasOwnPurchaseDocumentApproval(actor(role), { ...approval(role), [`${prefix}ApprovedAt`]: time })).toBe(false);
    expect(hasOwnPurchaseDocumentApproval(actor(role), approval(role === "accountant" ? "senior_management" : "accountant"))).toBe(false);
  });
  it.each(["accountant", "senior_management"])("does not let %s use a stale approved header to download a newly pending batch", async role => {
    const port = source(role);
    vi.mocked(port.orderBatches!).mockResolvedValue([{ id: 10, purchaseOrderId: 1, ...approval(role) }, { id: 11, purchaseOrderId: 1 }]);
    vi.mocked(port.orderItems!).mockResolvedValue([{ batchId: 10, status: "approved", estimatedUnitCost: "10" }, { batchId: 11, status: "pending_accounting", estimatedUnitCost: "20" }]);
    await expect(authorizePurchaseDocument(actor(role), 1, undefined, undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    // The exact old approved document remains downloadable.
    await expect(authorizePurchaseDocument(actor(role), 1, 10, undefined, port)).resolves.toMatchObject({ id: 1 });
  });
  it.each(["accountant", "senior_management"])("requires ALL %s submission member batches, not an empty list or partial approval", async role => {
    const port = source(role);
    await expect(authorizePurchaseDocument(actor(role), 1, undefined, 20, port)).resolves.toMatchObject({ id: 1 });
    vi.mocked(port.batches).mockResolvedValue([{ purchaseOrderId: 1, ...approval(role) }, { purchaseOrderId: 2 }]);
    await expect(authorizePurchaseDocument(actor(role), 1, undefined, 20, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(port.batches).mockResolvedValue([]);
    await expect(authorizePurchaseDocument(actor(role), 1, undefined, 20, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("retains regular owner/admin checks and the delegate's existing PO visibility boundary", async () => {
    const port = source();
    for (const role of ["owner", "admin", "warehouse"]) await authorizePurchaseDocument(actor(role), 1, 10, undefined, port);
    expect(port.authorize).toHaveBeenCalledTimes(3);
    vi.mocked(port.authorize).mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    await expect(authorizePurchaseDocument(actor("delegate", 11), 1, 10, undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(authorizePurchaseDocument(actor("delegate", 12), 1, 10, undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it.each(["accountant", "senior_management"])("blocks %s's whole-order PDF when a new priced item has not entered their approved batch", async role => {
    const port = source(role);
    vi.mocked(port.orderBatches!).mockResolvedValue([{ id: 10, purchaseOrderId: 1, ...approval(role) }]);
    await expect(authorizePurchaseDocument(actor(role), 1, undefined, undefined, port)).resolves.toHaveProperty("id", 1);
    vi.mocked(port.orderItems!).mockResolvedValue([{ batchId: 10, status: "approved", estimatedUnitCost: "10" }, { batchId: null, status: "estimated", estimatedUnitCost: "20" }]);
    await expect(authorizePurchaseDocument(actor(role), 1, undefined, undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(authorizePurchaseDocument(actor(role), 1, 10, undefined, port)).resolves.toHaveProperty("id", 1);
  });
  it("rejects batch/submission injection, missing linked PO and malformed IDs", async () => {
    const port = source(); vi.mocked(port.batch).mockResolvedValue({ id: 10, purchaseOrderId: 2, ...approval("accountant") });
    await expect(authorizePurchaseDocument(actor(), 1, 10, undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const ids of [[0], [1.5], [1, 10, 20], [1, -3]]) await expect(authorizePurchaseDocument(actor(), ids[0], ids[1], ids[2], port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(port.order).mockImplementation(async id => id === 1 ? { id } : null);
    await expect(authorizePurchaseDocument(actor(), 1, undefined, 20, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it.each(["po_financial_batch", "delegate_pricing_batch", "purchase_package_submission_financial", "delegate_package_submission_pricing"])("applies the same exact gate to stored %s PDFs", async type => {
    for (const role of ["accountant", "senior_management"]) {
      const port = source(role);
      await expect(authorizePurchaseAttachment(actor(role), type, type.endsWith("batch") ? 10 : 20, port)).resolves.toMatchObject({ id: 1 });
      expect(await purchaseAttachmentPermission(actor(role, 4), type, type.endsWith("batch") ? 10 : 20, port)).toMatchObject({ pdfAllowed: false });
    }
    await expect(authorizePurchaseAttachment(actor("warehouse"), type, 10, source())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("does not hide storage outages as a normal blocked approval", async () => {
    const port = source(); vi.mocked(port.batch).mockRejectedValue(new Error("fixture database outage"));
    await expect(purchaseDocumentPermission(actor(), 1, 10, undefined, port)).rejects.toThrow("outage");
  });
});

describe("Known /api/media financial PDF keys", () => {
  const key = "cmms/financial-documents/po-1/batch-10.pdf";
  it.each(["accountant", "senior_management"])("enforces actual document approval for %s before storage regardless of another public reference", async role => {
    live.order.mockResolvedValue({ id: 1, status: "pending_management" }); live.batch.mockResolvedValue({ id: 10, purchaseOrderId: 1 });
    const port = { references: async () => [{ kind: "reference", id: 2 }, { kind: "attachment", id: 7, parentId: 10, entityType: "po_financial_batch", ownerId: 99 }], authorize: mediaAccessPort.authorize };
    await expect(assertMediaAccess(actor(role), key, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    live.batch.mockResolvedValue({ id: 10, purchaseOrderId: 1, ...approval(role) });
    await expect(assertMediaAccess(actor(role), key, port)).resolves.toBe(key);
    await expect(assertMediaAccess(actor(role, 4), key, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("retains ordinary images and denies logged-out users before any read", async () => {
    const port = { references: vi.fn(async () => [{ kind: "reference", id: 1 }]), authorize: mediaAccessPort.authorize };
    await expect(assertMediaAccess(actor(), "cmms/catalog/image.png", port)).resolves.toContain("image.png");
    await expect(assertMediaAccess(null, key, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Actual document-center list route, without exposing preapproval file keys", () => {
  const sourceFile = ts.createSourceFile("attachments.router.ts", readFileSync("server/routers/uploads/attachments.router.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const compile = (text: string, scope: any) => vm.runInNewContext(ts.transpileModule(`(${text.replace(/^export /, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, scope);
  const helper = sourceFile.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "documentRows")!;
  const documentRows = compile(helper.getText(sourceFile), { decorateDocumentRows, loadDocumentListPort: async () => purchaseDocumentPort });
  let listCode = "";
  function visit(node: ts.Node) { if (ts.isPropertyAssignment(node) && node.name.getText(sourceFile) === "listByType") listCode = node.initializer.getText(sourceFile); ts.forEachChild(node, visit); } visit(sourceFile);
  function listCaller(role: string, rows: any[], id = 3) {
    const procedure = compile(listCode, { z, documentListPageInput, protectedProcedure, TRPCError, APP_ROLE, documentRows,
      db: { getDelegatePricingAttachmentsWithDelegate: async () => rows, getFinancialBatchAttachmentsWithDelegate: async () => rows } });
    return router({ attachments: router({ listByType: procedure }) }).createCaller({ user: actor(role, id) } as any).attachments.listByType;
  }
  it.each(["accountant", "senior_management"])("shows %s pricing metadata for review while withholding direct file URLs until own approval", async role => {
    const key = "cmms/delegate-pricing-documents/po-1/batch-10.pdf";
    const rows = [{ id: 5, entityType: "delegate_pricing_batch", entityId: 10, delegateId: 11, fileName: "Test pricing.pdf", fileKey: key, fileUrl: "https://old-public.invalid/private.pdf" }];
    live.batch.mockResolvedValue({ id: 10, purchaseOrderId: 1, submittedById: 11 }); live.order.mockResolvedValue({ id: 1 });
    const query = listCaller(role, rows);
    expect(await query({ entityType: "delegate_pricing_documents" })).toEqual([expect.objectContaining({ fileName: "Test pricing.pdf", pdfAllowed: false, fileKey: null, fileUrl: null, reviewUrl: "/purchase-orders/1" })]);
    live.batch.mockResolvedValue({ id: 10, purchaseOrderId: 1, submittedById: 11, ...approval(role) });
    const allowed = await query({ entityType: "delegate_pricing_documents" });
    expect(allowed[0]).toMatchObject({ pdfAllowed: true, fileUrl: `/api/media?key=${encodeURIComponent(key)}`, reviewUrl: null });
    expect(JSON.stringify(allowed)).not.toContain("old-public.invalid");
  });
  it("keeps financial approval documents blocked for management until management's own approval", async () => {
    live.batch.mockResolvedValue({ id: 10, purchaseOrderId: 1, ...approval("accountant") }); live.order.mockResolvedValue({ id: 1 });
    const rows = [{ id: 6, entityType: "po_financial_batch", entityId: 10, fileKey: "cmms/financial-documents/a.pdf", fileUrl: "/api/media?key=cmms%2Ffinancial-documents%2Fa.pdf" }];
    expect((await listCaller("accountant", rows)({ entityType: "po_financial_batch" }))[0].pdfAllowed).toBe(true);
    expect((await listCaller("senior_management", rows)({ entityType: "po_financial_batch" }))[0]).toMatchObject({ pdfAllowed: false, fileKey: null, fileUrl: null });
  });
  it("does not grant a nonfinancial role the aggregated pricing directory", async () => {
    await expect(listCaller("warehouse", [])({ entityType: "delegate_pricing_documents" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

function bundleFixture(role = "accountant") {
  const bundle = { id: 1, bundleNumber: "DPB-2026-TEST", delegateId: 11, status: "archived", revision: 2 };
  const snapshot = { number: bundle.bundleNumber, delegate: { id: 11, signature: "" }, signatures: [], rows: [{ id: 1, purchaseOrderId: 101, poNumber: "PR-101", estimatedTotalCost: "10" }, { id: 2, purchaseOrderId: 102, poNumber: "PR-102", estimatedTotalCost: "20" }] };
  const scopes: any[] = [101, 102].map((poId, index) => ({ bundleId: 1, purchaseOrderId: poId, pricingBatchId: index + 10, actualBatchId: index + 10, actualPurchaseOrderId: poId, actualOrderId: poId, purchasePackageSubmissionId: null, actualSubmissionId: null, ...approval(role) }));
  const queries: string[] = [];
  const database = { execute: vi.fn(async (statement: any) => {
    const { sql: q } = new MySqlDialect().sqlToQuery(statement); queries.push(q);
    if (q.includes("FROM delegate_pricing_bundle_batches l")) return [scopes, []];
    if (q.startsWith("SELECT id,bundleNumber")) return [[bundle], []];
    if (q.startsWith("SELECT snapshotJson")) return [[{ snapshotJson: JSON.stringify(snapshot) }], []];
    if (q.startsWith("SELECT pdfContent")) return [[{ pdfContent: Buffer.from("%PDF-frozen"), snapshotJson: JSON.stringify(snapshot) }], []];
    if (q.startsWith("SELECT name FROM users")) return [[{ name: "Test delegate" }], []];
    if (q.startsWith("SELECT b.id")) return [[{ ...bundle, delegateName: "Test delegate", itemCount: 2, sentTotals: ["10", "20"], sentOrderIds: [101, 102], sentOrderNumbers: ["PR-101", "PR-102"] }], []];
    throw Error(`Unexpected isolated query: ${q}`);
  }) };
  const ports: any = { database: async () => database, render: vi.fn(), signature: vi.fn(), sync: vi.fn(), submitPO: vi.fn(), createPackageSubmission: vi.fn() };
  return { bundle, snapshot, scopes, queries, ports, service: new PricingBundleService(ports) };
}
describe("Sent pricing bundle approval scope and central guard", () => {
  it.each(["accountant", "senior_management"])("keeps %s metadata readable, denies bytes until all linked batches approved by them", async role => {
    const f = bundleFixture(role); delete f.scopes[1][role === "accountant" ? "accountingApprovedAt" : "managementApprovedAt"];
    expect((await f.service.list(actor(role)))[0]).toMatchObject({ pdfAllowed: false, purchaseOrders: [{ id: 101, poNumber: "PR-101" }, { id: 102, poNumber: "PR-102" }] });
    const detail = await f.service.detail(actor(role), 1); expect(detail.items).toHaveLength(2); expect(detail.pdfAllowed).toBe(false); expect(JSON.stringify(detail)).not.toMatch(/pdfContent|snapshotJson|signature/);
    await expect(f.service.pdf(actor(role), 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.queries.some(q => q.startsWith("SELECT pdfContent"))).toBe(false);
    Object.assign(f.scopes[1], approval(role));
    const doc = await f.service.pdf(actor(role), 1); expect(Buffer.from(doc.content, "base64").toString()).toBe("%PDF-frozen"); expect(f.ports.render).not.toHaveBeenCalled();
    await expect(f.service.pdf(actor(role, 4), 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it.each(["empty", "missing batch", "foreign PO", "duplicate scope", "missing submission", "partial submission"])("denies incomplete bundle scope: %s", async issue => {
    const f = bundleFixture();
    if (issue === "empty") f.scopes.length = 0;
    if (issue === "missing batch") f.scopes[0].actualBatchId = null;
    if (issue === "foreign PO") f.scopes[0].actualPurchaseOrderId = 999;
    if (issue === "duplicate scope") f.scopes[1].purchaseOrderId = 101;
    if (issue === "missing submission") Object.assign(f.scopes[0], { purchasePackageSubmissionId: 20, actualSubmissionId: 20, actualPackageSubmissionId: null });
    if (issue === "partial submission") Object.assign(f.scopes[0], { purchasePackageSubmissionId: 20, actualSubmissionId: 20, actualPackageSubmissionId: 20, submissionAccountingApprovedById: 3, submissionAccountingApprovedAt: null });
    await expect(f.service.pdf(actor(), 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.queries.some(q => q.startsWith("SELECT pdfContent"))).toBe(false);
  });
  it("retains the delegate's frozen document and owner/admin access without requiring approver IDs", async () => {
    const f = bundleFixture(); f.scopes.length = 0;
    for (const role of ["delegate", "owner", "admin"]) await expect(f.service.pdf(actor(role, role === "delegate" ? 11 : 3), 1)).resolves.toHaveProperty("content");
    await expect(f.service.pdf(actor("delegate", 12), 1)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it.each(["accountant", "senior_management"])("routes %s's approved bundle PDF through the central guard but grants no bundle writes", async role => {
    const f = bundleFixture(role);
    const api = router({ delegatePricingBundles: createPricingBundlesRouter(f.ports, () => true) });
    const caller = api.createCaller({ user: actor(role) } as any);
    await expect(caller.delegatePricingBundles.pdf({ id: 1 })).resolves.toHaveProperty("content");
    expect(businessRpcAllowed(actor(role), "query", "purchaseOrders.documentPermission")).toBe(true);
    for (const method of ["add", "remove", "send", "archive", "retrySync"]) expect(businessRpcAllowed(actor(role), "mutation", `delegatePricingBundles.${method}`)).toBe(false);
    await expect(caller.delegatePricingBundles.send({ id: 1, revision: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
