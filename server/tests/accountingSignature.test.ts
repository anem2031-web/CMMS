import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { captureAccountingSignature, readAccountingSignature } from "../services/pdf/accountingSignature";

const source = ts.createSourceFile("exportService.ts", readFileSync("server/services/export/exportService.ts", "utf8"), ts.ScriptTarget.Latest, true);
const generator = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === "generatePurchaseRequestPDF")!;
function evaluate(code: string, scope: object) { return vm.runInNewContext(ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, scope); }
async function render(mode: "order" | "batch" | "package", snapshot: string | null, viewerRole = "accountant") {
  const currentActor = { id: 77, name: "Changed current name", signatureUrl: "cmms/uploads/u-77/changed-signature.png" };
  const viewerId = viewerRole === "delegate" ? 3 : 8;
  const order: any = { id: 1, poNumber: "PR-fixture", requestedById: 2, reviewedById: 4, accountingApprovedById: 77,
    accountingSignatureSnapshot: mode === "order" ? snapshot : captureAccountingSignature({ id: 99, name: "Other header approver", signatureUrl: "cmms/wrong.png" }), requesterSignatureSnapshot: "cmms/requester.png", reviewerSignatureSnapshot: "cmms/reviewer.png" };
  const batch = { id: 10, purchaseOrderId: 1, batchNumber: 1, submittedById: 3, accountingApprovedById: 77,
    accountingSignatureSnapshot: mode === "batch" ? snapshot : null, submittedAt: "2026-10-18T10:00:00Z", delegateSignatureSnapshot: "cmms/delegate.png", custodyAmount: "100" };
  const submission = { id: 20, purchasePackageId: 30, subNumber: 1, accountingApprovedById: 77, accountingSignatureSnapshot: snapshot, custodyBalance: "100" };
  const getSignatureDataUrl = vi.fn(async (key?: string | null) => key ? `data:image/png;base64,${key === "cmms/uploads/u-77/original.png" ? "ORIGINAL" : "OTHER"}` : "");
  const update = vi.fn();
  const db = {
    getPurchaseOrderById: async () => order,
    getPOItems: async () => [{ id: 5, batchId: 10, delegateId: 3, itemName: "Fixture material", unit: "piece", quantity: 2, estimatedUnitCost: "50", status: "estimated" }],
    getPOPricingBatchById: async () => batch,
    getPricingBatchesBySubmission: async () => [batch],
    getPurchasePackageSubmissionById: async () => submission,
    getPurchasePackageById: async () => ({ id: 30, packageNumber: "PB-fixture" }),
    getUserById: async (id: number) => id === 77 ? currentActor : ({ id, name: `Fixture ${id}`, role: id === viewerId ? viewerRole : "delegate", signatureUrl: null }),
    updatePurchaseOrder: update, updatePOPricingBatch: update,
  };
  const scope = { db, readAccountingSignature, getSignatureDataUrl, htmlToPdf: async (html: string) => html,
    escapeHtml: (s: unknown) => String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"), fmtSAR: (n: number) => n.toFixed(2), amountToArabicCurrencyPhrase: () => "مائة ريال", Date, Intl };
  const fn = evaluate(generator.getText(source).replace(/^export\s+/, ""), scope);
  const html = await fn(1, viewerId, mode === "batch" ? 10 : undefined, mode === "package" ? 20 : undefined);
  const row = html.match(/<tr>\s*<td[^>]*>الحسابات<\/td>[\s\S]*?<\/tr>/)?.[0] || "";
  return { html, row, getSignatureDataUrl, update };
}

describe.each(["order", "batch", "package"] as const)("Actual financial PDF template — %s", mode => {
  it("uses the actual approver's frozen name/signature even after the profile changes", async () => {
    const snapshot = captureAccountingSignature({ id: 77, name: "Original <accountant>", signatureUrl: "cmms/uploads/u-77/original.png" });
    const result = await render(mode, snapshot);
    expect(result.row).toContain("Original &lt;accountant&gt;");
    expect(result.row).toContain("data:image/png;base64,ORIGINAL");
    expect(result.row).not.toContain("Changed current name");
    expect(result.row).not.toContain("Other header approver");
    expect(result.getSignatureDataUrl).not.toHaveBeenCalledWith("cmms/uploads/u-77/changed-signature.png");
  });
  it("keeps an absent approval-time signature blank even if one is later uploaded", async () => {
    const snapshot = captureAccountingSignature({ id: 77, name: "Unsigned accountant", signatureUrl: null });
    const result = await render(mode, snapshot);
    expect(result.row).toContain("Unsigned accountant"); expect(result.row).not.toContain("<img");
  });
  it("does not alter old approval signatures or borrow a signature from another scope", async () => {
    const result = await render(mode, null);
    expect(result.row).not.toContain("<img"); expect(result.row).toContain("Changed current name");
    expect(result.update).not.toHaveBeenCalled();
  });
  it("retains the existing delegate pricing copy without an accounting approval row", async () => {
    const result = await render(mode, captureAccountingSignature({ id: 77, name: "Accountant", signatureUrl: "cmms/signature.png" }), "delegate");
    expect(result.row).toBe("");
  });
});

describe("Approval snapshot validation", () => {
  it("rejects another approver, malformed snapshots and missing identities", () => {
    const value = captureAccountingSignature({ id: 77, name: "Fixture", signatureUrl: null });
    expect(readAccountingSignature(value, 77)).toMatchObject({ actorId: 77, signatureUrl: null });
    for (const [raw, id] of [[value, 99], [value, null], ["not-json", 77], [JSON.stringify({ version: 1, actorId: 77, signatureUrl: {} }), 77]] as const) expect(readAccountingSignature(raw, id)).toBeNull();
  });
  it("records the snapshot in all actual approval writes, including both atomic package updates", () => {
    const approvals = readFileSync("server/routers/purchase/approvals.router.ts", "utf8");
    expect(approvals.match(/accountingSignatureSnapshot: captureAccountingSignature\(ctx.user\)/g)).toHaveLength(2);
    const packages = readFileSync("server/routers/purchase/purchase-packages.router.ts", "utf8");
    expect(packages).toContain("accountingSignatureSnapshot: captureAccountingSignature(ctx.user)");
    const db = readFileSync("server/_core/db/purchase.ts", "utf8");
    expect(db.match(/accountingSignatureSnapshot: args.accountingSignatureSnapshot/g)).toHaveLength(2);
  });
});
