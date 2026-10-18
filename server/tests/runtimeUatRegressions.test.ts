import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName } from "drizzle-orm";
import type { TrpcContext } from "../_core/context";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// All persistence, PDF, storage and translation dependencies are in memory.
const state = vi.hoisted(() => ({
  tickets: [] as any[],
  inserted: [] as { table: string; row: any }[],
  failAttachment: false,
  po: { id: 800, poNumber: "PR-UAT", status: "pending_accounting", requestedById: 10 },
  batches: [] as any[],
  pdfStarted: false,
  releasePdf: undefined as undefined | (() => void),
}));

vi.mock("../_core/db", () => ({
  withTransaction: vi.fn(async (work: (tx: any) => Promise<any>) => {
    const ticketCount = state.tickets.length;
    const insertCount = state.inserted.length;
    const tx = { insert: (table: any) => ({ values: async (row: any) => {
      const name = getTableName(table);
      if (state.failAttachment && name === "attachments") throw new Error("attachment write failed");
      state.inserted.push({ table: name, row });
      return [{ insertId: state.inserted.length }];
    } }) };
    try { return await work(tx); }
    catch (error) {
      state.tickets.length = ticketCount;
      state.inserted.length = insertCount;
      throw error;
    }
  }),
  getNextTicketNumber: vi.fn(async () => "MT-UAT-1"),
  createTicket: vi.fn(async (data: any) => {
    state.tickets.push({ id: 500, ...data });
    return 500;
  }),
  createTicketItem: vi.fn(async () => 501),
  createTicketDepartments: vi.fn(async () => undefined),
  getUsersByRole: vi.fn(async (role: string) => role === "it_manager" ? [{ id: 70, isActive: 1 }] : []),
  getTicketManagerUsers: vi.fn(async () => []),
  createAuditLog: vi.fn(async () => undefined),
  addTicketStatusHistory: vi.fn(async () => undefined),
  createNotification: vi.fn(async () => undefined),
  getPurchaseOrderById: vi.fn(async () => ({ ...state.po })),
  getPOPricingBatchById: vi.fn(async (id: number) => ({ ...state.batches.find(b => b.id === id) })),
  getPOItems: vi.fn(async () => [{ id: 901, batchId: 900, status: "estimated", itemName: "test item" }]),
  getPOPricingBatches: vi.fn(async () => state.batches.map(b => ({ ...b }))),
  updatePOPricingBatch: vi.fn(async (id: number, data: any) => Object.assign(state.batches.find(b => b.id === id), data)),
  updatePurchaseOrder: vi.fn(async (_id: number, data: any) => Object.assign(state.po, data)),
  createAttachment: vi.fn(async () => 600),
}));
vi.mock("../services/translation/translation", () => ({ detectLanguage: vi.fn(async () => "ar") }));
vi.mock("../services/translation/translationEngine", () => ({ queueTranslation: vi.fn(async () => undefined), translationCache: {} }));
vi.mock("../services/improvement-ideas/execution", () => ({
  prepareIdeaExecution: vi.fn(async () => ({ id: 40 })),
  linkCreatedExecution: vi.fn(async () => undefined),
  assertNotTrackedIdeaSource: vi.fn(),
}));
vi.mock("../pmv2/tickets/handoff-service", () => ({
  Pmv2TicketHandoffError: class extends Error {},
  pmv2TicketHandoffService: {
    prepareAtomicTicketCreation: vi.fn(async () => undefined),
    linkAtomicCreatedTicket: vi.fn(async () => undefined),
  },
}));
vi.mock("../routers/purchase/translation-queue", () => ({
  queuePurchaseTranslation: vi.fn(async () => undefined),
  createTranslatedProcurementComment: vi.fn(),
}));
vi.mock("../routers/purchase/ticket-purchase-workflow", () => ({ syncPathBTicketFromPurchaseOrder: vi.fn(async () => undefined) }));
vi.mock("../routers/_shared/router-helpers", () => ({ notifyItemRejection: vi.fn() }));
vi.mock("../services/export/exportService", () => ({
  generatePurchaseRequestPDF: vi.fn(async () => {
    state.pdfStarted = true;
    await new Promise<void>(resolve => { state.releasePdf = resolve; });
    return Buffer.from("test PDF");
  }),
}));
vi.mock("../_core/storage", () => ({ storagePut: vi.fn(async (key: string) => ({ key })) }));

import { ticketsRouter } from "../routers/tickets/tickets.router";
import { approvalsRouter } from "../routers/purchase/approvals.router";
import { isTicketReadOnlyForUser } from "../routers/tickets/tickets.access";

function context(role = "operator"): TrpcContext {
  return { user: { id: 10, role, name: "UAT", isActive: 1 }, req: {}, res: {} } as TrpcContext;
}
const files = [
  { fileName: "photo.png", fileUrl: "/api/media?key=cmms/test/photo.png", fileKey: "cmms/test/photo.png", mimeType: "image/png", fileSize: 12 },
  { fileName: "evidence.pdf", fileUrl: "/api/media?key=cmms/test/evidence.pdf", fileKey: "cmms/test/evidence.pdf", mimeType: "application/pdf", fileSize: 24 },
];

beforeEach(() => {
  vi.clearAllMocks();
  state.tickets.length = 0;
  state.inserted.length = 0;
  state.failAttachment = false;
  state.po.status = "pending_accounting";
  state.batches = [{ id: 900, purchaseOrderId: 800, batchNumber: 1, status: "pending_accounting" }];
  state.pdfStarted = false;
  state.releasePdf = undefined;
});

describe("Ticket initial evidence is saved with creation, not with later edit permission", () => {
  it.each([
    { category: "it" },
    { category: "general" },
    { category: "it", pmv2TaskItemId: 25 },
    { category: "it", fromIdeaId: 40 },
  ])("saves every uploaded file and audit entry on the new ticket: %o", async source => {
    const result = await ticketsRouter.createCaller(context()).create({
      title: "UAT", siteId: 1, sectionId: 2, beforePhotoUrl: files[0].fileUrl,
      ...source, attachments: files,
    });
    expect(result.id).toBe(500);
    const stored = state.inserted.filter(x => x.table === "attachments").map(x => x.row);
    expect(stored).toHaveLength(2);
    expect(stored.map(x => [x.entityType, x.entityId, x.uploadedById])).toEqual([["ticket", 500, 10], ["ticket", 500, 10]]);
    expect(stored.map(x => x.fileKey)).toEqual(files.map(x => x.fileKey));
    expect(state.inserted.filter(x => x.table === "audit_logs")).toHaveLength(2);
    expect(state.tickets[0]).not.toHaveProperty("attachments");
  });

  it("rolls back creation if registering evidence fails instead of reporting success", async () => {
    state.failAttachment = true;
    await expect(ticketsRouter.createCaller(context()).create({
      title: "UAT", category: "it", siteId: 1, sectionId: 2,
      beforePhotoUrl: files[0].fileUrl, attachments: files,
    })).rejects.toThrow("attachment write failed");
    expect(state.tickets).toHaveLength(0);
    expect(state.inserted).toHaveLength(0);
  });

  it("keeps legacy clients without attachment metadata compatible", async () => {
    await expect(ticketsRouter.createCaller(context()).create({
      title: "UAT", category: "it", siteId: 1, sectionId: 2, beforePhotoUrl: files[0].fileUrl,
    })).resolves.toMatchObject({ id: 500 });
    expect(state.inserted).toHaveLength(0);
  });

  it("does not grant the reporter edit rights on the routed IT ticket", async () => {
    await ticketsRouter.createCaller(context()).create({
      title: "UAT", category: "it", siteId: 1, sectionId: 2,
      beforePhotoUrl: files[0].fileUrl, attachments: files,
    });
    expect(isTicketReadOnlyForUser({ id: 10, role: "operator" }, state.tickets[0])).toBe(true);
    await expect(ticketsRouter.createCaller(context("observer")).create({
      title: "UAT", category: "it", siteId: 1, sectionId: 2, beforePhotoUrl: files[0].fileUrl,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Accounting approval header is current even while PDF generation is slow", () => {
  it.each([false, true])("preserves the status rules for other pending batches: %s", async otherPending => {
    if (otherPending) state.batches.push({ id: 902, purchaseOrderId: 800, status: "pending_accounting" });
    const approval = approvalsRouter.createCaller(context("accountant")).approveAccountingBatch({ batchId: 900, custodyAmount: "40" });
    await vi.waitFor(() => expect(state.pdfStarted).toBe(true));
    try {
      expect(state.batches[0].status).toBe("pending_management");
      expect(state.po.status).toBe(otherPending ? "pending_accounting" : "pending_management");
    } finally { state.releasePdf?.(); }
    await expect(approval).resolves.toMatchObject({ success: true, financialDocumentArchived: true });
  });

  it("still rejects accounting approval by a non-accountant", async () => {
    await expect(approvalsRouter.createCaller(context("operator")).approveAccountingBatch({ batchId: 900, custodyAmount: "40" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.batches[0].status).toBe("pending_accounting");
  });
});

describe("Accounting approval UI refresh", () => {
  it("cancels stale reads and waits for fresh header and batch data before completing", async () => {
    const source = fs.readFileSync("client/src/pages/purchase/PurchaseOrderDetail.tsx", "utf8");
    const ast = ts.createSourceFile("detail.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let callback: ts.Node | undefined;
    function visit(node: ts.Node) {
      if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "approveAccountingBatchMut" && node.initializer && ts.isCallExpression(node.initializer)) {
        const config = node.initializer.arguments[0] as ts.ObjectLiteralExpression;
        callback = (config.properties.find(p => p.name?.getText(ast) === "onSuccess") as ts.PropertyAssignment).initializer;
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    expect(callback).toBeDefined();
    const events: string[] = [];
    let releaseRead!: () => void;
    const reading = new Promise<void>(resolve => { releaseRead = resolve; });
    const detail = { cancel: vi.fn(async () => { events.push("cancel-detail"); }), invalidate: vi.fn(async () => { events.push("read-detail"); await reading; }) };
    const batches = { cancel: vi.fn(async () => { events.push("cancel-batches"); }), invalidate: vi.fn(async () => { events.push("read-batches"); await reading; }) };
    const print = vi.fn();
    const code = ts.transpileModule(`(${callback!.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const complete = vm.runInNewContext(code, {
      toast: { success: vi.fn(), warning: vi.fn() }, t: { workflow: { purchase: {} } }, poId: 800,
      utils: { attachments: { listByType: { invalidate: vi.fn() } }, purchaseOrders: {
        getById: detail, listPricingBatches: batches,
        list: { invalidate: vi.fn() }, actionableForMe: { invalidate: vi.fn() },
      } }, printPurchasePdf: print, refetch: vi.fn(), refetchBatches: vi.fn(),
    });
    const pending = complete({ financialDocumentArchived: true }, { batchId: 900 });
    await vi.waitFor(() => expect(events).toContain("read-batches"));
    try {
      expect(events.slice(0, 2)).toEqual(["cancel-detail", "cancel-batches"]);
      expect(detail.invalidate).toHaveBeenCalledWith({ id: 800 });
      expect(batches.invalidate).toHaveBeenCalledWith({ purchaseOrderId: 800 });
      expect(print).not.toHaveBeenCalled();
    } finally { releaseRead(); }
    await pending;
    expect(print).toHaveBeenCalledWith(900);
  });
});
