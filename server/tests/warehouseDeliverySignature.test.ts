import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { router, protectedProcedure } from "../_core/trpc";
import { warehouseProcedure } from "../routers/_shared/procedures";
import { captureDocumentSignature, readDocumentSignature } from "../../shared/documentSignatureSnapshot";
import { getWarehouseSignatureForPrint } from "../services/pdf/warehouseSignature";
import { buildDeliveryReceiptHtml } from "../../client/src/lib/printDeliveryDocument";
import { buildWarehouseIssueHtml } from "../../client/src/lib/printWarehouseIssueDocument";
import { documentSignatureHtml } from "../../client/src/lib/documentSignatureHtml";
import * as schema from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const image = "data:image/png;base64,U0lHTkFUVVJF";
const spies = vi.hoisted(() => ({ image: vi.fn(), document: vi.fn(), batch: vi.fn(), create: vi.fn() }));
vi.mock("../services/pdf/signatureImage", () => ({ getSignatureDataUrl: spies.image }));
vi.mock("../_core/db", () => ({}));
const actor = { id: 9, role: "warehouse", name: "Actual warehouse user", isActive: 1, signatureUrl: "cmms/uploads/u-9/original.png" };
const context = (role = "warehouse") => ({ user: { ...actor, role }, req: {}, res: {} } as any);
function sourceExpression(file: string, name: string) {
  const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  let expression = ""; function visit(node: ts.Node) { if (ts.isPropertyAssignment(node) && node.name.getText(ast) === name) expression = node.initializer.getText(ast); ts.forEachChild(node, visit); } visit(ast);
  if (!expression) throw Error(`Missing actual procedure ${file}:${name}`);
  return expression;
}
function evaluate(code: string, scope: object) {
  return vm.runInNewContext(ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, scope);
}
const shared = { z, TRPCError, protectedProcedure, warehouseProcedure, captureDocumentSignature, getWarehouseSignatureForPrint };
const api = router({
  deliveryDocuments: router({
    generate: evaluate(sourceExpression("server/routers/purchase/delivery-documents.router.ts", "generate"), { ...shared, db: { createDeliveryDocument: spies.create }, queueDeliveryDocumentTranslation: async () => {} }),
    getForPrint: evaluate(sourceExpression("server/routers/purchase/delivery-documents.router.ts", "getForPrint"), { ...shared, db: { getDeliveryDocumentById: spies.document } }),
  }),
  warehouseIssueBatches: router({ getById: evaluate(sourceExpression("server/routers/inventory/warehouse-issue-batches.router.ts", "getById"), { ...shared, db: { getWarehouseIssueBatchById: spies.batch } }) }),
});
beforeEach(() => {
  vi.clearAllMocks(); spies.image.mockResolvedValue(image); spies.create.mockResolvedValue({ insertId: 1 });
  spies.document.mockResolvedValue({ id: 1, deliveredByName: actor.name, deliveredBySignatureSnapshot: captureDocumentSignature(actor) });
  spies.batch.mockResolvedValue({ id: 2, issuedById: actor.id, issuedByName: actor.name, issuedBySignatureSnapshot: captureDocumentSignature(actor), items: [] });
});

describe("Actual warehouse issuer signature", () => {
  it("captures the authenticated warehouse user's signature rather than a client-supplied name/snapshot", async () => {
    await api.createCaller(context()).deliveryDocuments.generate({ deliveryNumber: "DLV-test", poItemId: 1, itemName: "Fixture", deliveredByName: "Different person", deliveredToName: "Technician", quantity: 1, deliveredAt: "2026-10-18", deliveredBySignatureSnapshot: "client-forgery" } as any);
    const saved = spies.create.mock.calls[0][0];
    expect(saved.deliveredByName).toBe(actor.name);
    expect(readDocumentSignature(saved.deliveredBySignatureSnapshot)).toMatchObject({ actorId: actor.id, name: actor.name, signatureUrl: actor.signatureUrl });
  });
  it("embeds the original signature for a DLV without a live-profile fallback", async () => {
    const doc = await api.createCaller(context()).deliveryDocuments.getForPrint({ id: 1 });
    expect(doc.deliveredBySignature).toBe(image); expect(doc.deliveredByName).toBe(actor.name);
    expect(doc).not.toHaveProperty("deliveredBySignatureSnapshot"); expect(spies.image).toHaveBeenCalledWith(actor.signatureUrl);
  });
  it.each([null, "bad JSON", captureDocumentSignature({ ...actor, signatureUrl: null })])("keeps unsigned, historical or invalid DLV snapshots blank: %s", async snapshot => {
    spies.document.mockResolvedValue({ id: 1, deliveredByName: actor.name, deliveredBySignatureSnapshot: snapshot });
    const doc = await api.createCaller(context()).deliveryDocuments.getForPrint({ id: 1 });
    expect(doc.deliveredBySignature).toBe(""); expect(doc.deliveredByName).toBe(actor.name); expect(spies.image).not.toHaveBeenCalled();
  });
  it("uses the same frozen DLV snapshot in WIS, validating its actual issuer", async () => {
    const doc = await api.createCaller(context()).warehouseIssueBatches.getById({ id: 2 });
    expect(doc.issuedBySignature).toBe(image); expect(doc.issuedByName).toBe(actor.name);
    spies.batch.mockResolvedValue({ id: 2, issuedById: 99, issuedBySignatureSnapshot: captureDocumentSignature(actor), items: [] });
    expect((await api.createCaller(context()).warehouseIssueBatches.getById({ id: 2 })).issuedBySignature).toBe("");
  });
  it("the production WIS reader takes the snapshot from its own linked DLV without changing stock", async () => {
    const file = "server/_core/db/warehouse-issues.ts";
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "getWarehouseIssueBatchById")!;
    const conditions: any[] = [], snapshot = captureDocumentSignature(actor);
    const database = { select: () => {
      let table: any;
      const rows = () => table === schema.warehouseIssueBatches ? [{ id: 2, issuedById: 9 }]
        : table === schema.warehouseIssueBatchItems ? [{ deliveryDocumentId: 44, inventoryTransactionId: 1 }]
        : table === schema.deliveryDocuments ? [{ signature: snapshot }] : [];
      const query: any = { from: (value: any) => { table = value; return query; }, where: (value: any) => { conditions.push(value); return query; }, limit: async () => rows(), orderBy: async () => rows() };
      return query;
    } };
    const read = evaluate(fn.getText(ast).replace(/^export /, ""), { ...schema, eq, getDb: async () => database,
      getWarehouseIssueCostTargetsForBatchIds: async () => [], summarizeWarehouseIssueCostTargets: () => ({}),
    });
    const row = await read(2);
    expect(row.issuedBySignatureSnapshot).toBe(snapshot);
    expect(new MySqlDialect().sqlToQuery(conditions[2]).params).toEqual([44]);
    expect(row.items[0].deliveryDocumentId).toBe(44);
  });
  it.each(["warehouse", "senior_management", "executive_director", "food_warehouse_assistant", "admin", "owner", "delegate"])("retains %s's existing delivery-document reading through the central guard", async role => {
    await expect(api.createCaller(context(role)).deliveryDocuments.getForPrint({ id: 1 })).resolves.toMatchObject({ id: 1 });
  });
  it.each(["accountant", "technician"])("does not grant %s a new delivery-document API", async role => {
    await expect(api.createCaller(context(role)).deliveryDocuments.getForPrint({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(spies.document).not.toHaveBeenCalled();
  });
  it("rejects anonymous, disabled and missing-document reads before opening a signature", async () => {
    await expect(api.createCaller({ user: null } as any).deliveryDocuments.getForPrint({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(api.createCaller({ user: { ...actor, isActive: 0 } } as any).deliveryDocuments.getForPrint({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    spies.document.mockResolvedValue(null);
    await expect(api.createCaller(context()).deliveryDocuments.getForPrint({ id: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(spies.image).not.toHaveBeenCalled();
  });
});

describe("Print/PDF layouts", () => {
  const delivery = { itemName: "Fixture lamp", quantity: 2, unit: "piece", deliveredByName: actor.name, deliveredToName: "Technician", deliveredAt: "2026-10-18", itemId: 1 };
  const batch = { id: 2, issueNumber: "WIS-test", warehouseName: "Warehouse", issuedByName: actor.name, deliveredToName: "Technician", createdAt: "2026-10-18", items: [{ itemName: "Fixture lamp", quantity: 2 }] };
  it.each(["ar", "en", "ur"] as const)("keeps the issuer's name and shows an uploaded signature in %s", language => {
    const html = buildDeliveryReceiptHtml({ ...delivery, deliveredBySignature: image }, language);
    expect(html).toContain(actor.name); expect(html).toContain(`src="${image}"`); expect(html).toContain("Fixture lamp");
    expect(buildDeliveryReceiptHtml(delivery, language)).not.toContain('class="document-signature"');
  });
  it("shows or omits a signature in WIS without replacing either party name", () => {
    const html = buildWarehouseIssueHtml({ ...batch, issuedBySignature: image });
    expect(html).toContain(actor.name); expect(html).toContain("Technician"); expect(html).toContain(`src="${image}"`);
    expect(buildWarehouseIssueHtml(batch)).not.toContain('class="document-signature"');
  });
  it.each([null, "", "https://fixture/signature.png", 'data:image/png;base64,abc\" onerror=\"bad'])('rejects missing or unsafe signature markup: %s', input => {
    expect(documentSignatureHtml(input)).toBe("");
  });
  it("all delivery printing entry points load the committed document rather than a current user's signature", () => {
    const cycle = readFileSync("client/src/pages/purchase/PurchaseCycle.tsx", "utf8");
    const center = readFileSync("client/src/pages/DocumentsCenter.tsx", "utf8");
    expect(cycle).toContain("doc = { ...doc, deliveredByName: saved.deliveredByName, deliveredBySignature: saved.deliveredBySignature }");
    expect(cycle.match(/void printCompletedDelivery\(data\)/g)).toHaveLength(2);
    expect(center).toContain("deliveredBySignature: full.deliveredBySignature");
    expect(center).toContain("buildDeliveryReceiptHtml(await buildDeliveryData(row))");
  });
});
