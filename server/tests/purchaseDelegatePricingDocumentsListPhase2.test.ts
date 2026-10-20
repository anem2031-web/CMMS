import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { documentDatabase } from "./fixtures/documentDatabase";
let db: ReturnType<typeof documentDatabase>;
vi.mock("../_core/db/client", () => ({ getDb: async () => db }));
vi.mock("../_core/env", () => ({ ENV: {} }));
const { getDelegatePricingAttachmentsWithDelegate } = await import("../_core/db/attachments");
describe("Delegate pricing document archive compatibility", () => {
  beforeEach(() => { db = documentDatabase(); });
  afterEach(() => db.memory.close());
  it("keeps batch/submission identities, package sum and delegate with stable ordering", async () => {
    db.insert("users", { id: 30, name: "مندوب الحزمة" });
    db.insert("po_pricing_batches", { id: 601, purchaseOrderId: 101, submittedById: 30, totalEstimatedCost: "1000.00" });
    db.insert("po_pricing_batches", { id: 602, purchaseOrderId: 102, purchasePackageSubmissionId: 501, submittedById: 30, totalEstimatedCost: "1500.00" });
    db.insert("po_pricing_batches", { id: 603, purchaseOrderId: 103, purchasePackageSubmissionId: 501, submittedById: 30, totalEstimatedCost: "2500.00" });
    db.insert("attachments", { id: 21, entityType: "delegate_pricing_batch", entityId: 601, createdAt: "2026-08-31 09:00:00", fileName: "single.pdf" });
    db.insert("attachments", { id: 22, entityType: "delegate_package_submission_pricing", entityId: 501, uploadedById: 30, createdAt: "2026-08-31 10:00:00", fileName: "package.pdf" });
    const rows = await getDelegatePricingAttachmentsWithDelegate();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ id: 22, entityType: "delegate_package_submission_pricing", delegateId: 30, delegateName: "مندوب الحزمة", totalEstimatedCost: "4000.00", pricingDocumentScope: "package_submission" });
    expect(rows[1]).toMatchObject({ id: 21, entityType: "delegate_pricing_batch", totalEstimatedCost: "1000.00", pricingDocumentScope: "pricing_batch" });
    expect(db.queries).toHaveLength(1);
  });
});
