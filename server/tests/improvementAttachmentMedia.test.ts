import { readFileSync } from "node:fs";
import vm from "node:vm";
import { getTableColumns, getTableName, isTable } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../drizzle/schema";
import { assertMediaAccess } from "../_core/authz/media-access";
import { router } from "../_core/trpc";
import { attachmentsRouter } from "../routers/uploads/attachments.router";

const spies = vi.hoisted(() => ({
  db: vi.fn(), idea: vi.fn(), createAttachment: vi.fn(), getAttachments: vi.fn(), audit: vi.fn(),
}));
vi.mock("../_core/db", () => ({
  getDb: spies.db,
  createAttachment: spies.createAttachment,
  getAttachments: spies.getAttachments,
  createAuditLog: spies.audit,
}));
vi.mock("../services/improvement-ideas/improvementIdeas", () => ({ getImprovementIdeaById: spies.idea }));
// This suite exercises the real improvement attachment and media boundaries.
// Unrelated attachment branches must not initialize PM V2's live DB client or
// ticket dependencies merely because attachments.access statically imports them.
vi.mock("../pmv2/technician/evidence-access", () => ({
  assertPmv2ItemActionEvidenceAccess: vi.fn(async () => { throw new Error("Unexpected PM V2 branch in improvement fixture"); }),
}));
vi.mock("../routers/tickets/tickets.access", () => ({
  assertTicketReadable: vi.fn(async () => { throw new Error("Unexpected ticket branch in improvement fixture"); }),
  isTicketReadOnlyForUser: vi.fn(() => { throw new Error("Unexpected ticket branch in improvement fixture"); }),
}));

const owner = { id: 19110006, role: "operator", name: "Idea author fixture", isActive: 1 };
const key = `cmms/uploads/u-${owner.id}/improvement-preview.webp`;
const url = `/api/media?key=${encodeURIComponent(key)}`;
const idea = { id: 13, submittedById: owner.id };
const api = router({ attachments: attachmentsRouter });
const caller = (user = owner) => api.createCaller({ user, req: {}, res: {} } as any).attachments;
const dialect = new MySqlDialect();
type Attachment = {
  id: number; entityType: string; entityId: number; uploadedById: number;
  fileName: string; fileKey: string; fileUrl: string;
};
let saved: Attachment[];

// The real registry, including catalog tables, is intentionally represented.
// The original phantom catalogItems.primaryImageUrl crashed on this metadata
// before an author's brand-new upload could reach the ownership decision.
const metadata = Object.values(schema).filter(isTable).flatMap(table =>
  Object.values(getTableColumns(table)).map(column => ({
    tableName: getTableName(table), columnName: column.name,
  })),
);

const index = ts.createSourceFile("index.ts", readFileSync("server/_core/index.ts", "utf8"), ts.ScriptTarget.Latest, true);
let mediaHandler = "";
function findMediaHandler(node: ts.Node) {
  if (ts.isCallExpression(node) && node.expression.getText(index) === "app.get"
    && (node.arguments[0] as ts.StringLiteral)?.text === "/api/media") {
    mediaHandler = node.arguments[1].getText(index);
  }
  ts.forEachChild(node, findMediaHandler);
}
findMediaHandler(index);

async function requestMedia(user: typeof owner | null, fileKey = key) {
  const pipe = vi.fn();
  const storage = vi.fn(async () => ({ stream: { pipe }, contentType: "image/webp" }));
  const headers: Record<string, string> = {};
  const status = vi.fn();
  const json = vi.fn();
  const response = {
    setHeader: (name: string, value: string) => { headers[name] = value; },
    status: (value: number) => { status(value); return { json }; },
  };
  const handler = vm.runInNewContext(ts.transpileModule(`(${mediaHandler})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    sdk: { authenticateRequest: async () => { if (!user) throw new Error("fixture logged out"); return user; } },
    assertMediaAccess,
    storageGetStream: storage,
    isSessionAuthenticationError: (error: Error) => error.message === "fixture logged out",
    console: { error: () => {} }, encodeURIComponent,
  });
  await handler({ query: { key: fileKey } }, response);
  return { pipe, storage, headers, status, json };
}

function attachmentInput(entityId = idea.id, fileKey = key) {
  return {
    entityType: "improvement_idea", entityId, fileName: "idea-photo.webp",
    fileKey, fileUrl: `/api/media?key=${encodeURIComponent(fileKey)}`, mimeType: "image/webp", fileSize: 128,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  saved = [];
  spies.idea.mockImplementation(async (id: number) => id === idea.id ? idea : null);
  const execute = vi.fn(async (query: any) => {
    const statement = dialect.sqlToQuery(query).sql;
    if (statement.includes("information_schema.COLUMNS")) return [metadata];
    return [saved.map(attachment => ({
      kind: "attachment", id: attachment.id, parentId: attachment.entityId,
      ownerId: attachment.uploadedById, entityType: attachment.entityType,
      payload: [attachment.fileKey, attachment.fileUrl],
    }))];
  });
  spies.db.mockResolvedValue({ execute });
  spies.createAttachment.mockImplementation(async (input: Omit<Attachment, "id">) => {
    saved.push({ ...input, id: saved.length + 1 });
    return saved.length;
  });
  spies.getAttachments.mockImplementation(async (type: string, id: number) =>
    saved.filter(attachment => attachment.entityType === type && attachment.entityId === id));
  spies.audit.mockResolvedValue(undefined);
});

describe("Improvement image preview and attachment save through the actual guards", () => {
  it("streams an authenticated author's newly uploaded preview before the idea is linked", async () => {
    const response = await requestMedia(owner);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.storage).toHaveBeenCalledWith(key);
    expect(response.pipe).toHaveBeenCalledOnce();
    expect(response.headers["Content-Type"]).toBe("image/webp");
    expect(response.headers["Cache-Control"]).toContain("private, no-store");
  });

  it("saves via the real attachments.add resolver and retains owner list/preview after linking", async () => {
    await expect(caller().add(attachmentInput())).resolves.toEqual({ id: 1 });
    expect(spies.createAttachment).toHaveBeenCalledWith(expect.objectContaining({
      entityType: "improvement_idea", entityId: idea.id, uploadedById: owner.id, fileKey: key, fileUrl: url,
    }));
    expect(spies.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "add_attachment", entityId: idea.id }));
    await expect(caller().list({ entityType: "improvement_idea", entityId: idea.id })).resolves.toHaveLength(1);
    const response = await requestMedia(owner);
    expect(response.status).not.toHaveBeenCalled();
    expect(response.storage).toHaveBeenCalledWith(key);
  });

  it.each(["maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "senior_management", "executive_director"])(
    "retains the authorized %s reviewer's access after linking, not before", async role => {
      const reviewer = { ...owner, id: 77, role };
      const unlinked = await requestMedia(reviewer);
      expect(unlinked.status).toHaveBeenCalledWith(403);
      expect(unlinked.storage).not.toHaveBeenCalled();
      await caller().add(attachmentInput());
      await expect(caller(reviewer).list({ entityType: "improvement_idea", entityId: idea.id })).resolves.toHaveLength(1);
      const linked = await requestMedia(reviewer);
      expect(linked.status).not.toHaveBeenCalled();
      expect(linked.storage).toHaveBeenCalledWith(key);
    },
  );

  it.each(["operator", "accountant", "delegate", "warehouse", "food_warehouse_assistant"])(
    "does not expose another author's linked image/list to %s", async role => {
      await caller().add(attachmentInput());
      const stranger = { ...owner, id: 88, role };
      await expect(caller(stranger).list({ entityType: "improvement_idea", entityId: idea.id }))
        .rejects.toMatchObject({ code: "FORBIDDEN" });
      const response = await requestMedia(stranger);
      expect(response.status).toHaveBeenCalledWith(403);
      expect(response.storage).not.toHaveBeenCalled();
    },
  );

  it("rejects grafting another uploader's unlinked image before persistence", async () => {
    await expect(caller().add(attachmentInput(idea.id, "cmms/uploads/u-88/private.webp")))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(spies.createAttachment).not.toHaveBeenCalled();
    expect(spies.audit).not.toHaveBeenCalled();
  });

  it("rejects adding an own upload to someone else's idea", async () => {
    spies.idea.mockResolvedValue({ ...idea, submittedById: 88 });
    await expect(caller().add(attachmentInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(spies.createAttachment).not.toHaveBeenCalled();
  });

  it("does not keep uploader access after the linked idea no longer belongs to that user", async () => {
    await caller().add(attachmentInput());
    spies.idea.mockResolvedValue({ ...idea, submittedById: 88 });
    const response = await requestMedia(owner);
    expect(response.status).toHaveBeenCalledWith(403);
    expect(response.storage).not.toHaveBeenCalled();
  });

  it("keeps gate accounts outside the improvement RPC and file boundaries, even for an own unlinked key", async () => {
    const gate = { ...owner, role: "gate_security" };
    await expect(caller(gate).add(attachmentInput())).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(gate).list({ entityType: "improvement_idea", entityId: idea.id })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(spies.createAttachment).not.toHaveBeenCalled();
    const unlinked = await requestMedia(gate);
    expect(unlinked.status).toHaveBeenCalledWith(403);
    expect(unlinked.storage).not.toHaveBeenCalled();
    await caller().add(attachmentInput());
    const linked = await requestMedia(gate);
    expect(linked.status).toHaveBeenCalledWith(403);
    expect(linked.storage).not.toHaveBeenCalled();
  });

  it("rejects logged-out previews before reading storage", async () => {
    const response = await requestMedia(null);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.storage).not.toHaveBeenCalled();
  });
});
