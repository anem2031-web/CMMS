import { getTableColumns, getTableName, isTable } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import * as schema from "../../drizzle/schema";
import { assertMediaAccess, mediaAccessPort } from "../_core/authz/media-access";
import { resolveMediaReferenceSources } from "../_core/authz/media-reference-sources";
import { protectedProcedure, router } from "../_core/trpc";

const spies = vi.hoisted(() => ({ db: vi.fn() }));
vi.mock("../_core/db", () => ({ getDb: spies.db }));

function fullMetadata() {
  return Object.values(schema).filter(isTable).flatMap(table =>
    Object.values(getTableColumns(table)).map(column => ({
      tableName: getTableName(table), columnName: column.name,
    })),
  );
}

const actor = { id: 3, role: "operator", isActive: 1 };
const uploadKey = "cmms/uploads/u-3/new-ticket.png";
const dialect = new MySqlDialect();
const sqlText = (execute: ReturnType<typeof vi.fn>, call = 1) => dialect.sqlToQuery(execute.mock.calls[call][0]).sql;

describe("Media references with the application's actual schema", () => {
  it("can inspect a new upload when all catalog and document tables exist", async () => {
    const execute = vi.fn().mockResolvedValueOnce([fullMetadata()]).mockResolvedValueOnce([[]]);
    spies.db.mockResolvedValue({ execute });
    await expect(mediaAccessPort.references("cmms/uploads/u-3/new-ticket.png")).resolves.toEqual([]);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(sqlText(execute)).not.toContain("`catalog_items`");
    expect(sqlText(execute)).toContain("`catalog_item_images`.`imageUrl`");
  });

  it.each([
    { kind: "ticket", file: "ticket.png", payload: (key: string) => [key] },
    { kind: "reference", file: "catalog.jpg", payload: (key: string) => [key] },
    { kind: "attachment", file: "document.pdf", payload: (key: string) => [key] },
    { kind: "po", file: "invoice.jpg", payload: (key: string) => [JSON.stringify([`/api/media?key=${encodeURIComponent(key)}`])] },
  ])("finds exact $file references with all source tables present", async ({ kind, file, payload }) => {
    const key = `cmms/uploads/${file}`;
    const execute = vi.fn().mockResolvedValueOnce([fullMetadata()]).mockResolvedValueOnce([[
      { kind, id: 8, parentId: 9, payload: payload(key) },
      { kind, id: 88, parentId: 99, payload: [`${key}.different`] },
    ]]);
    spies.db.mockResolvedValue({ execute });
    await expect(mediaAccessPort.references(key)).resolves.toEqual([{ kind, id: 8, parentId: 9 }]);
  });

  it("reaches ticket creation through the real central guard for an own new image", async () => {
    const execute = vi.fn().mockResolvedValueOnce([fullMetadata()]).mockResolvedValueOnce([[]]);
    spies.db.mockResolvedValue({ execute });
    const save = vi.fn(() => ({ id: 123 }));
    const api = router({ tickets: router({ create: protectedProcedure
      .input(z.object({ beforePhotoUrl: z.string() })).mutation(save) }) });
    const caller = api.createCaller({ user: actor } as any);
    await expect(caller.tickets.create({ beforePhotoUrl: `/api/media?key=${encodeURIComponent(uploadKey)}` }))
      .resolves.toEqual({ id: 123 });
    expect(save).toHaveBeenCalledOnce();
  });

  it("reaches catalog attachment saving for the warehouse without widening file access", async () => {
    const key = "cmms/uploads/u-3/catalog.jpg";
    const execute = vi.fn().mockResolvedValueOnce([fullMetadata()]).mockResolvedValueOnce([[]]);
    spies.db.mockResolvedValue({ execute });
    const save = vi.fn(() => ({ id: 12 }));
    const api = router({ attachments: router({ add: protectedProcedure.input(z.object({
      entityType: z.string(), entityId: z.number(), fileKey: z.string(), fileUrl: z.string(),
    })).mutation(save) }) });
    const caller = api.createCaller({ user: { ...actor, role: "warehouse" } } as any);
    await expect(caller.attachments.add({ entityType: "catalog_item", entityId: 5,
      fileKey: key, fileUrl: `/api/media?key=${encodeURIComponent(key)}` })).resolves.toEqual({ id: 12 });
    expect(save).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("still rejects a different uploader before the ticket resolver runs", async () => {
    const execute = vi.fn().mockResolvedValueOnce([fullMetadata()]).mockResolvedValueOnce([[]]);
    spies.db.mockResolvedValue({ execute });
    const save = vi.fn();
    const api = router({ tickets: router({ create: protectedProcedure
      .input(z.object({ beforePhotoUrl: z.string() })).mutation(save) }) });
    await expect(api.createCaller({ user: actor } as any).tickets.create({
      beforePhotoUrl: "/api/media?key=cmms%2Fuploads%2Fu-30%2Fprivate.png",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(save).not.toHaveBeenCalled();
  });

  it("does not allow an own-namespace image already linked to a forbidden reference", async () => {
    const execute = vi.fn().mockResolvedValueOnce([fullMetadata()]).mockResolvedValueOnce([[
      { kind: "signature", id: 99, parentId: 99, ownerId: 99, payload: [uploadKey] },
    ]]);
    spies.db.mockResolvedValue({ execute });
    await expect(assertMediaAccess(actor, uploadKey)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps current catalog attachments when the historical image table is absent", async () => {
    const key = "cmms/uploads/catalog.png";
    const metadata = fullMetadata().filter(row => row.tableName !== "catalog_item_images");
    const execute = vi.fn().mockResolvedValueOnce([metadata]).mockResolvedValueOnce([[
      { kind: "attachment", id: 7, parentId: 11, entityType: "catalog_item", payload: [key] },
    ]]);
    spies.db.mockResolvedValue({ execute });
    await expect(mediaAccessPort.references(key)).resolves.toEqual([
      { kind: "attachment", id: 7, parentId: 11, entityType: "catalog_item" },
    ]);
    expect(sqlText(execute)).toContain("`attachments`");
    expect(sqlText(execute)).not.toContain("`catalog_item_images`");
  });

  it("still finds before-photos when an optional after-photo column does not exist", async () => {
    const metadata = fullMetadata().filter(row => !(row.tableName === "tickets" && row.columnName === "afterPhotoUrl"));
    const execute = vi.fn().mockResolvedValueOnce([metadata]).mockResolvedValueOnce([[
      { kind: "ticket", id: 7, parentId: 7, ownerId: 3, payload: [uploadKey] },
    ]]);
    spies.db.mockResolvedValue({ execute });
    await expect(mediaAccessPort.references(uploadKey)).resolves.toEqual([{ kind: "ticket", id: 7, parentId: 7, ownerId: 3 }]);
    expect(sqlText(execute)).toContain("`tickets`.`beforePhotoUrl`");
    expect(sqlText(execute)).not.toContain("`tickets`.`afterPhotoUrl`");
  });

  it("fails closed if an existing file source is missing its ownership column", async () => {
    const metadata = fullMetadata().filter(row => !(row.tableName === "tickets" && row.columnName === "reportedById"));
    const execute = vi.fn().mockResolvedValue([metadata]);
    spies.db.mockResolvedValue({ execute });
    await expect(assertMediaAccess(actor, uploadKey)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it.each([null, [{ tableName: "tickets" }]])("does not treat malformed metadata as an unlinked upload (%j)", async rows => {
    const execute = vi.fn().mockResolvedValue([rows]);
    spies.db.mockResolvedValue({ execute });
    await expect(assertMediaAccess(actor, uploadKey)).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("propagates metadata failure instead of granting uploader access", async () => {
    const error = new Error("fixture metadata unavailable");
    spies.db.mockResolvedValue({ execute: vi.fn().mockRejectedValue(error) });
    await expect(assertMediaAccess(actor, uploadKey)).rejects.toBe(error);
  });

  it("refreshes incomplete metadata so a newly added file column is not hidden by cache", async () => {
    const metadata = fullMetadata().filter(row => !(row.tableName === "tickets" && row.columnName === "afterPhotoUrl"));
    const execute = vi.fn().mockResolvedValueOnce([metadata]).mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([fullMetadata()]).mockResolvedValueOnce([[
        { kind: "ticket", id: 5, parentId: 5, ownerId: 9, payload: [uploadKey] },
      ]]);
    spies.db.mockResolvedValue({ execute });
    await expect(mediaAccessPort.references(uploadKey)).resolves.toEqual([]);
    await expect(mediaAccessPort.references(uploadKey)).resolves.toEqual([{ kind: "ticket", id: 5, parentId: 5, ownerId: 9 }]);
    expect(execute).toHaveBeenCalledTimes(4);
    expect(sqlText(execute, 3)).toContain("`tickets`.`afterPhotoUrl`");
  });

  it("retains the metadata cache for a complete schema", async () => {
    const execute = vi.fn().mockResolvedValueOnce([fullMetadata()]).mockResolvedValue([[]]);
    spies.db.mockResolvedValue({ execute });
    await mediaAccessPort.references(uploadKey);
    await mediaAccessPort.references(uploadKey);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("rejects an invalid runtime column definition rather than silently skipping it", () => {
    expect(() => resolveMediaReferenceSources(schema, [
      // @ts-expect-error The registry also rejects non-persisted fields at compile time.
      ["catalogItems", "reference", "id", null, ["primaryImageUrl"]],
    ])).toThrow("تعذر التحقق من صلاحية الملف");
  });

  it("rejects an invalid runtime table definition before metadata availability matters", () => {
    expect(() => resolveMediaReferenceSources({ ...schema, tickets: undefined } as any))
      .toThrow("تعذر التحقق من صلاحية الملف");
  });
});
