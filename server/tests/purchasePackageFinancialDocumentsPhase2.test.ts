import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { documentDatabase } from "./fixtures/documentDatabase";
let db: ReturnType<typeof documentDatabase>;
vi.mock("../_core/db/client", () => ({ getDb: async () => db }));
vi.mock("../_core/env", () => ({ ENV: {} }));
const { getFinancialBatchAttachmentsWithDelegate } = await import("../_core/db/attachments");
describe("Purchase Packages — financial document archive compatibility", () => {
  beforeEach(() => { db = documentDatabase(); });
  afterEach(() => db.memory.close());
  it("keeps legacy and package scope identities, totals, delegate and custody without per-document reads", async () => {
    db.insert("users", { id: 30, name: "مندوب الحزمة" });
    db.insert("po_pricing_batches", { id: 601, purchaseOrderId: 101, submittedById: 30, totalEstimatedCost: "1000.00", custodyAmount: "1200.00" });
    db.insert("purchase_package_submissions", { id: 501, purchasePackageId: 10, totalEstimatedCost: "3000.00", custodyBalance: "4500.00" });
    db.insert("po_pricing_batches", { id: 602, purchaseOrderId: 102, purchasePackageSubmissionId: 501, submittedById: 30 });
    db.insert("po_pricing_batches", { id: 603, purchaseOrderId: 103, purchasePackageSubmissionId: 501, submittedById: 30 });
    db.insert("attachments", { id: 11, entityType: "po_financial_batch", entityId: 601, createdAt: "2026-08-31 08:00:00", fileName: "old.pdf" });
    db.insert("attachments", { id: 12, entityType: "purchase_package_submission_financial", entityId: 501, createdAt: "2026-08-31 09:00:00", fileName: "package.pdf" });
    const rows = await getFinancialBatchAttachmentsWithDelegate();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 12, entityType: "purchase_package_submission_financial", entityId: 501, delegateId: 30, delegateName: "مندوب الحزمة", totalEstimatedCost: "3000.00", custodyBalance: "4500.00", financialDocumentScope: "package_submission" });
    expect(rows[1]).toMatchObject({ id: 11, entityType: "po_financial_batch", financialDocumentScope: "pricing_batch", totalEstimatedCost: "1000.00", custodyBalance: "1200.00" });
    expect(db.queries).toHaveLength(1);
  });
});
