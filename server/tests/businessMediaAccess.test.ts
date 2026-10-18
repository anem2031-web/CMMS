import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";
import { assertMediaAccess, assertMediaInputAccess, mediaKeyFromValue, normalizeMediaKey } from "../_core/authz/media-access";
import { BUSINESS_GUARDED_ROLES } from "../../shared/business-role-policy";

const actor = (role = "accountant", id = 3, isActive = 1) => ({ id, role, isActive });
const privateKey = "cmms/uploads/old-private.png";
describe("Parent-authorized media reads", () => {
  it.each(BUSINESS_GUARDED_ROLES)("rejects unknown/forbidden files for %s without opening storage", async role => {
    const port = { references: vi.fn(async () => [{ kind: "po", id: 2, parentId: 9 }]), authorize: vi.fn(async (): Promise<void> => { throw new TRPCError({ code: "FORBIDDEN" }); }) };
    await expect(assertMediaAccess(actor(role), privateKey, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(port.references).toHaveBeenCalledWith(privateKey);
    port.authorize.mockResolvedValueOnce(undefined);
    await expect(assertMediaAccess(actor(role), privateKey, port)).resolves.toBe(privateKey);
  });
  it("rejects logged-out and inactive identities before looking up the document", async () => {
    const port = { references: vi.fn(), authorize: vi.fn() };
    await expect(assertMediaAccess(null, privateKey, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertMediaAccess(actor("warehouse", 3, 0), privateKey, port)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(port.references).not.toHaveBeenCalled();
  });
  it("retains previews for the authenticated uploader before saving a form, without granting another uploader's namespace", async () => {
    const port = { references: vi.fn(async () => []), authorize: vi.fn() };
    await expect(assertMediaAccess(actor(), "cmms/uploads/u-3/new.png", port)).resolves.toBe("cmms/uploads/u-3/new.png");
    expect(port.references).toHaveBeenCalledWith("cmms/uploads/u-3/new.png");
    await expect(assertMediaAccess(actor(), "cmms/uploads/u-30/new.png", port)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it.each(["cmms/../other", "cmms/%2e%2e/private", "cmms/%252e%252e/private", "cmms/a\\b", "other/private", "cmms/a\u0000.png", "cmms//file", "cmms/a?x=1"])("rejects noncanonical storage key %s", key => {
    expect(() => normalizeMediaKey(key)).toThrow();
  });
  it("fails closed on a DB outage instead of returning a file", async () => {
    const error = new Error("fixture dependency failure");
    await expect(assertMediaAccess(actor(), privateKey, { references: async () => { throw error; }, authorize: async () => {} })).rejects.toBe(error);
  });
  it.each(["observer", ...BUSINESS_GUARDED_ROLES])("does not expose raw backup files to %s through a known media URL", async role => {
    await expect(assertMediaAccess(actor(role), "cmms/backups/private.json", { references: async () => [], authorize: async () => {} })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(assertMediaAccess(actor("admin"), "cmms/backups/private.json")).resolves.toBe("cmms/backups/private.json");
  });
  it("prevents grafting an unreadable known file onto an own editable document", async () => {
    const authorize = vi.fn(async () => { throw new TRPCError({ code: "FORBIDDEN" }); });
    const fileUrl = `/api/media?key=${encodeURIComponent(privateKey)}`;
    await expect(assertMediaInputAccess(actor(), { entityType: "improvement_idea", entityId: 1, fileKey: privateKey, fileUrl }, authorize)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(authorize).toHaveBeenCalledWith(actor(), privateKey);
    authorize.mockClear();
    await assertMediaInputAccess(actor(), { description: fileUrl, operationKey: "fixture" }, authorize);
    expect(authorize).not.toHaveBeenCalled();
  });
  it("recognizes stored URL representations and checks nested attachment URLs once", async () => {
    const url = `/api/media?key=${encodeURIComponent(privateKey)}`;
    expect(mediaKeyFromValue(url)).toBe(privateKey);
    expect(mediaKeyFromValue(`https://fixture.invalid${url}`)).toBe(privateKey);
    const authorize = vi.fn(async (_u, key) => key);
    await assertMediaInputAccess(actor(), { attachments: [{ fileUrl: url }, { fileKey: privateKey }] }, authorize);
    expect(authorize).toHaveBeenCalledTimes(1);
  });
});

describe("Actual media HTTP handler", () => {
  const source = ts.createSourceFile("index.ts", readFileSync("server/_core/index.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let handler = "";
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "app.get" && (node.arguments[0] as ts.StringLiteral)?.text === "/api/media") handler = node.arguments[1].getText(source);
    ts.forEachChild(node, visit);
  } visit(source);
  async function run(user: ReturnType<typeof actor> | null, allowed: boolean) {
    const storage = vi.fn(async () => ({ stream: { pipe: vi.fn() }, contentType: "image/png" }));
    const headers: Record<string, string> = {}, json = vi.fn(), status = vi.fn();
    const res = { setHeader: (key: string, value: string) => { headers[key] = value; }, status: (code: number) => { status(code); return { json }; } };
    const fn = vm.runInNewContext(ts.transpileModule(`(${handler})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
      sdk: { authenticateRequest: async () => { if (!user) throw Error("fixture logged out"); return user; } },
      assertMediaAccess: async (u: any, key: string) => { if (!allowed) throw new TRPCError({ code: "FORBIDDEN" }); return key; },
      storageGetStream: storage, isSessionAuthenticationError: (error: Error) => error.message === "fixture logged out", console: { error: () => {} }, encodeURIComponent,
    });
    await fn({ query: { key: privateKey } }, res);
    return { storage, headers, status };
  }
  it("returns 401 after logout and 403 for a forbidden parent, before a storage read", async () => {
    const logout = await run(null, false); expect(logout.status).toHaveBeenCalledWith(401); expect(logout.storage).not.toHaveBeenCalled();
    const forbidden = await run(actor(), false); expect(forbidden.status).toHaveBeenCalledWith(403); expect(forbidden.storage).not.toHaveBeenCalled();
  });
  it("retains an authorized image and prevents new public/browser caching", async () => {
    const result = await run(actor(), true);
    expect(result.storage).toHaveBeenCalledWith(privateKey);
    expect(result.headers["Cache-Control"]).toContain("private, no-store"); expect(result.headers.Vary).toBe("Cookie");
  });
});
