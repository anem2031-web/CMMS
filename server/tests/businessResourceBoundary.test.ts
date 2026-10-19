import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import { authorizePurchaseDocument, type PurchaseDocumentPort } from "../_core/authz/purchase-document";
import { assertBusinessProjectAccess } from "../_core/authz/business-projects";
import { assertBusinessTranslationAccess } from "../_core/authz/business-resources";
import { assertMediaAccess, assertMediaInputAccess, assertMediaMutationAccess, mediaAccessPort } from "../_core/authz/media-access";
import { router, protectedProcedure } from "../_core/trpc";
import { BUSINESS_GUARDED_ROLES, businessRpcAllowed } from "../../shared/business-role-policy";
import * as schema from "../../drizzle/schema";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { Readable } from "node:stream";

const spies = vi.hoisted(() => ({ db: vi.fn(), visible: vi.fn() }));
vi.mock("../_core/db", () => ({ getDb: spies.db }));
const user = (role = "accountant", id = 3) => ({ id, role, isActive: 1 });
const forbidden = () => { throw new TRPCError({ code: "FORBIDDEN" }); };
const approved = { accountingApprovedById: 3, accountingApprovedAt: "2026-10-18 10:00:00" };

describe("Exact purchase PDF document scope", () => {
  function source(): PurchaseDocumentPort {
    return { order: vi.fn(async id => ({ id, status: "pending_management", ...approved })),
      batch: vi.fn(async id => ({ id, purchaseOrderId: 1, ...approved })),
      submission: vi.fn(async id => ({ id, ...approved })),
      batches: vi.fn(async () => [{ purchaseOrderId: 1, ...approved }, { purchaseOrderId: 2, ...approved }]), authorize: vi.fn(async () => forbidden()) };
  }
  it.each(["order", "batch", "submission"])("retains the actual accountant's post-approval %s PDF", async scope => {
    const port = source();
    await expect(authorizePurchaseDocument(user(), 1, scope === "batch" ? 10 : undefined, scope === "submission" ? 20 : undefined, port)).resolves.toMatchObject({ id: 1 });
    expect(port.authorize).not.toHaveBeenCalled();
  });
  it.each(["order", "batch", "submission"])("rejects a different accountant's post-approval %s PDF", async scope => {
    const port = source();
    await expect(authorizePurchaseDocument(user("accountant", 4), 1, scope === "batch" ? 10 : undefined, scope === "submission" ? 20 : undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("denies PDF before approval even when ordinary structured-data visibility allows reading the PO", async () => {
    const port = source();
    vi.mocked(port.order).mockResolvedValue({ id: 1, status: "draft" });
    await expect(authorizePurchaseDocument(user(), 1, undefined, undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(port.authorize).mockResolvedValue(undefined);
    await expect(authorizePurchaseDocument(user(), 1, undefined, undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("does not substitute a header approval for an unapproved batch", async () => {
    const port = source(); vi.mocked(port.batch).mockResolvedValue({ id: 10, purchaseOrderId: 1 });
    await expect(authorizePurchaseDocument(user(), 1, 10, undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("rejects batch/submission spoofing, missing parents and malformed scope IDs", async () => {
    const port = source(); vi.mocked(port.batch).mockResolvedValue({ purchaseOrderId: 2, ...approved });
    await expect(authorizePurchaseDocument(user(), 1, 10, undefined, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    vi.mocked(port.batches).mockResolvedValue([{ purchaseOrderId: 2 }]);
    await expect(authorizePurchaseDocument(user(), 1, undefined, 20, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const args of [[0], [1.5], [1, 2, 3], [1, -2]]) await expect(authorizePurchaseDocument(user(), args[0], args[1], args[2], port)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("Project membership retained behind the central resource gate", () => {
  const member = { projectId: 1, role: "viewer", canEdit: 0, canDelete: 0, canApprove: 0 };
  const port = (membership = member) => ({ memberships: vi.fn(async () => [membership]), record: vi.fn(async (resource: string, id: number) => resource === "projects" ? { id } : { id, projectId: id === 99 ? 2 : 1, taskId: 1, dependsOnTaskId: 2 }) });
  it.each(BUSINESS_GUARDED_ROLES.filter(role => role !== "senior_management"))("retains %s's explicit member read, with no foreign-project access", async role => {
    expect(businessRpcAllowed(user(role), "query", "construction.tasks.getById")).toBe(true);
    await expect(assertBusinessProjectAccess(user(role), "query", "construction.tasks.getById", { id: 5 }, port())).resolves.toEqual([1]);
    await expect(assertBusinessProjectAccess(user(role), "query", "construction.tasks.getById", { id: 99 }, port())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("resolves children independently of a forged allowed projectId", async () => {
    await expect(assertBusinessProjectAccess(user(), "mutation", "construction.tasks.create", { projectId: 1, phaseId: 99, activityId: 5 }, port({ ...member, canEdit: 1 }))).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertBusinessProjectAccess(user(), "mutation", "construction.tasks.bulkChangeStatus", { ids: [5, 99] }, port({ ...member, canEdit: 1 }))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("retains separate edit/delete/approval/member-management rights", async () => {
    await expect(assertBusinessProjectAccess(user(), "mutation", "construction.tasks.update", { id: 5 }, port())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertBusinessProjectAccess(user(), "mutation", "construction.tasks.update", { id: 5 }, port({ ...member, canEdit: 1 }))).resolves.toEqual([1]);
    for (const path of ["construction.tasks.delete", "construction.changeOrders.approve", "construction.members.add"]) await expect(assertBusinessProjectAccess(user(), "mutation", path, { id: 5, projectId: 1 }, port({ ...member, canEdit: 1 }))).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("scopes aggregate/list results to explicit memberships, including no memberships", async () => {
    for (const path of ["construction.projects.list", "construction.projects.portfolioStats", "construction.tasks.list"]) {
      await expect(assertBusinessProjectAccess(user(), "query", path, {}, port())).resolves.toEqual([1]);
      await expect(assertBusinessProjectAccess(user(), "query", path, {}, { ...port(), memberships: async () => [] })).resolves.toEqual([]);
    }
  });
  it("keeps senior-management global access and other roles neutral", async () => {
    const source = port();
    for (const role of ["senior_management", "owner", "admin", "maintenance_manager"]) await expect(assertBusinessProjectAccess(user(role), "query", "construction.projects.list", {}, source)).resolves.toBeUndefined();
    expect(source.memberships).not.toHaveBeenCalled();
  });
  it("enforces memberships in the actual tRPC middleware before the resolver, including guessed child IDs", async () => {
    const dialect = new MySqlDialect();
    spies.db.mockResolvedValue({ select: () => {
      let table: any, id: number;
      const rows = () => table === schema.constructionProjectMembers ? [member] : [{ id, projectId: id === 99 ? 2 : 1 }];
      const query: any = { from: (value: any) => { table = value; return query; }, where: (sql: any) => { id = Number(dialect.sqlToQuery(sql).params[0]); return query; }, limit: async () => rows(), then: (resolve: any, reject: any) => Promise.resolve(rows()).then(resolve, reject) };
      return query;
    } });
    const resolver = vi.fn(({ ctx }: any) => ctx.businessProjectIds);
    const api = router({ construction: router({ tasks: router({ getById: protectedProcedure.input(z.object({ id: z.number() })).query(resolver) }) }) });
    const caller = api.createCaller({ user: user() } as any);
    await expect(caller.construction.tasks.getById({ id: 5 })).resolves.toEqual([1]);
    await expect(caller.construction.tasks.getById({ id: 99 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(resolver).toHaveBeenCalledOnce();
  });
});

describe("Actual media reference lookup against an isolated metadata fixture", () => {
  it("includes inline/JSON references and ignores LIKE false positives without requiring absent optional tables", async () => {
    const tables = [schema.purchaseOrderItems, schema.ticketConfirmations, schema.constructionDailyReports];
    const metadata = tables.flatMap(table => Object.values(table).filter((value: any) => value?.name && value?.table === table).map((column: any) => ({ tableName: getTableName(table), columnName: column.name })));
    const key = "cmms/uploads/fixture.pdf";
    const execute = vi.fn().mockResolvedValueOnce([metadata]).mockResolvedValueOnce([[
      { kind: "po", id: 5, parentId: 1, payload: JSON.stringify([JSON.stringify([`/api/media?key=${encodeURIComponent(key)}`])]) },
      { kind: "ticket", id: 6, parentId: 2, payload: JSON.stringify([`/api/media?key=${encodeURIComponent(key)}.different`]) },
      { kind: "construction", id: 7, parentId: 3, payload: [[key]] },
    ]]);
    spies.db.mockResolvedValue({ execute });
    expect(await mediaAccessPort.references(key)).toEqual([{ kind: "po", id: 5, parentId: 1 }, { kind: "construction", id: 7, parentId: 3 }]);
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it("does not grant perpetual uploader access after a file is attached to a forbidden parent", async () => {
    await expect(assertMediaAccess(user(), "cmms/uploads/u-3/linked.pdf", { references: async () => [{ kind: "po", id: 1 }], authorize: async () => forbidden() })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("checks serialized JSON attachment grafts", async () => {
    const check = vi.fn(async () => forbidden());
    await expect(assertMediaInputAccess(user(), { attachments: JSON.stringify([{ url: "/api/media?key=cmms%2Fuploads%2Fprivate.pdf" }]) }, check)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(check).toHaveBeenCalledOnce();
  });
  it("authorizes rename sources while validating a new destination rather than treating it as an existing file", async () => {
    const check = vi.fn(async (_u, key) => String(key));
    await assertMediaMutationAccess(user("maintenance_manager"), "assetDocuments.renamePhoto", { oldKey: "cmms/uploads/old.png", newKey: "cmms/uploads/new.png" }, check);
    expect(check).toHaveBeenCalledOnce();
    expect(check).toHaveBeenCalledWith(user("maintenance_manager"), "cmms/uploads/old.png");
    await expect(assertMediaMutationAccess(user(), "assetDocuments.renamePhoto", { oldKey: "cmms/a", newKey: "cmms/../private" }, check)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertMediaMutationAccess(user(), "assetDocuments.renamePhoto", { oldKey: "cmms/a", newKey: "cmms/b" }, async () => forbidden())).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("retains warehouse external-maintenance files without granting unrelated ticket access", async () => {
    await expect(mediaAccessPort.authorize(user("warehouse"), { kind: "external", id: 4, parentId: 1 })).resolves.toBeUndefined();
  });
});

describe("Private storage commands, without a storage connection", () => {
  const source = ts.createSourceFile("storage.ts", readFileSync("server/_core/storage.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const command = class { constructor(public input: any) {} };
  function handler(name: string, scope: any) {
    const node = source.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name)!;
    return vm.runInNewContext(ts.transpileModule(`(${node.getText(source).replace(/^export\s+/, "")})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
      Buffer, encodeURIComponent, normalizeKey: (key: string) => key, S3_BUCKET: "fixture", PutObjectCommand: command,
      HeadObjectCommand: command, CopyObjectCommand: command, DeleteObjectCommand: command, ...scope,
    });
  }
  it("uses private ACLs and an authenticated proxy for ordinary and presigned uploads", async () => {
    const send = vi.fn(async (_command: any) => {}), sign = vi.fn(async (_client: any, _command: any, _options: any) => "fixture-signed-PUT");
    const file = await handler("storagePut", { s3: { send } })("cmms/uploads/u-3/a.png", Buffer.from("fixture"), "image/png");
    expect(send.mock.calls[0][0].input.ACL).toBe("private"); expect(file.url).toBe("/api/media?key=cmms%2Fuploads%2Fu-3%2Fa.png");
    const upload = await handler("storagePresignedPut", { s3: {}, getSignedUrl: sign })("cmms/uploads/u-3/a.png", "image/png");
    expect(sign.mock.calls[0][1].input.ACL).toBe("private"); expect(upload.proxyUrl).toBe(file.url);
  });
  it("rejects an existing rename destination before copying or deleting objects", async () => {
    const send = vi.fn(async () => ({}));
    await expect(handler("storageRename", { s3: { send } })("cmms/old", "cmms/existing")).rejects.toThrow("مستخدم بالفعل");
    expect(send).toHaveBeenCalledOnce();
  });
  it("copies to a missing rename destination with private ACL, then removes only its authorized source", async () => {
    const send = vi.fn().mockRejectedValueOnce({ name: "NotFound", $metadata: { httpStatusCode: 404 } }).mockResolvedValue({});
    const result = await handler("storageRename", { s3: { send } })("cmms/old", "cmms/new");
    expect(send.mock.calls[1][0].input).toMatchObject({ ACL: "private", Key: "cmms/new" });
    expect(send.mock.calls[2][0].input.Key).toBe("cmms/old"); expect(result.url).toContain("/api/media?");
  });
  it("restores an authorized backup using the private storage reader rather than a public URL", async () => {
    const source = ts.createSourceFile("backups.ts", readFileSync("server/routers/system/backups.router.ts", "utf8"), ts.ScriptTarget.Latest, true);
    let expression = ""; function walk(node: ts.Node) { if (ts.isPropertyAssignment(node) && node.name.getText(source) === "restore") expression = node.initializer.getText(source); ts.forEachChild(node, walk); } walk(source);
    const restore = vi.fn(async () => {}), getStream = vi.fn(async () => ({ stream: Readable.from([Buffer.from('{"fixture":true}')]) }));
    const procedure = vm.runInNewContext(ts.transpileModule(`(${expression})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, { z, TRPCError, protectedProcedure, Buffer,
      db: { getBackupById: async () => ({ id: 1, fileKey: "cmms/backups/fixture", name: "fixture" }), restoreFromBackup: restore, createAuditLog: async () => {} }, storageGetStream: getStream,
    });
    await router({ backups: router({ restore: procedure }) }).createCaller({ user: user("admin") } as any).backups.restore({ id: 1 });
    expect(restore).toHaveBeenCalledWith({ fixture: true }); expect(getStream).toHaveBeenCalledWith("cmms/backups/fixture");
  });
});

describe("Authorized translation source exceptions", () => {
  it("resolves external-job parents as external scope rather than granting generic ticket reads", async () => {
    const authorize = vi.fn(async () => {});
    await assertBusinessTranslationAccess(user("warehouse"), { entityType: "EXTERNAL_MAINTENANCE_JOB", entityIds: [5] }, "batch", { parents: async () => [{ id: 5, parentId: 9 }], authorize });
    expect(authorize).toHaveBeenCalledWith(user("warehouse"), "external", 9);
  });
});

describe("Actual AI context cannot bypass direct data restrictions", () => {
  it.each(["senior_management", "executive_director"])("omits audit/private-PO data for %s before invoking the model", async role => {
    const source = ts.createSourceFile("ai.ts", readFileSync("server/routers/ai/ai.router.ts", "utf8"), ts.ScriptTarget.Latest, true);
    let code = ""; function visit(node: ts.Node) { if (ts.isPropertyAssignment(node) && node.name.getText(source) === "analyze") code = node.initializer.getText(source); ts.forEachChild(node, visit); } visit(source);
    const audit = vi.fn(async () => [{ description: "PRIVATE_AUDIT" }]);
    const llm = vi.fn(async () => ({ choices: [{ message: { content: "fixture answer" } }] }));
    const procedure = vm.runInNewContext(ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, { z, TRPCError, protectedProcedure, isBusinessGuardedRole: () => true,
      filterVisiblePurchaseOrders: async (_u: any, orders: any[]) => orders.filter(order => order.id === 1), invokeLLM: llm,
      db: { getTickets: async () => [], getPurchaseOrders: async () => [{ id: 1, poNumber: "VISIBLE", status: "pending_accounting" }, { id: 2, poNumber: "FOREIGN_DRAFT" }], getInventoryItems: async () => [], getAllUsers: async () => [], getAllSites: async () => [], getDashboardStats: vi.fn(), getAuditLogsEnhanced: audit }, console,
    });
    const api = router({ ai: router({ analyze: procedure }) });
    const result = await api.createCaller({ user: user(role) } as any).ai.analyze({ question: "fixture" });
    expect(result.answer).toBe("fixture answer"); expect(audit).not.toHaveBeenCalled();
    const context = JSON.stringify(llm.mock.calls);
    expect(context).toContain("VISIBLE"); expect(context).not.toContain("FOREIGN_DRAFT"); expect(context).not.toContain("PRIVATE_AUDIT");
  });
});
