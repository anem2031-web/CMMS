import { describe, it, expect, vi } from "vitest";
import { documentDatabase } from "./fixtures/documentDatabase";
import { documentListPageInput } from "../../shared/document-list";
import { getAttachmentDocumentPage } from "../_core/db/document-list";
vi.mock("../_core/db/client", () => ({ getDb: () => { throw Error("No remote DB"); } }));

describe("Mixed document SQL executed against disposable fixtures", () => {
  it("returns exactly one row per attachment, orders across both sources, filters before pagination and isolates counts", async () => {
    const db = documentDatabase();
    try {
      db.insert("users", { id: 7, name: "Own delegate" }); db.insert("users", { id: 8, name: "Other delegate" });
      db.insert("purchase_package_submissions", { id: 30, purchasePackageId: 40, totalEstimatedCost: "12.00", custodyBalance: "15.00" });
      db.insert("po_pricing_batches", { id: 1, purchaseOrderId: 10, submittedById: 7, totalEstimatedCost: "3.00" });
      db.insert("po_pricing_batches", { id: 2, purchaseOrderId: 20, submittedById: 7, purchasePackageSubmissionId: 30, totalEstimatedCost: "4.00" });
      db.insert("po_pricing_batches", { id: 3, purchaseOrderId: 21, submittedById: 7, purchasePackageSubmissionId: 30, totalEstimatedCost: "8.00" });
      db.insert("po_pricing_batches", { id: 4, purchaseOrderId: 22, submittedById: 8, totalEstimatedCost: "9.00" });
      for (let i = 1; i <= 43; i++) db.insert("attachments", { id: i, entityType: i % 2 ? "delegate_pricing_batch" : "delegate_package_submission_pricing", entityId: i % 2 ? 1 : 30, uploadedById: 7, createdAt: "2026-10-19 07:00:00", fileName: `Document ${i}` });
      db.insert("attachments", { id: 99, entityType: "delegate_pricing_batch", entityId: 4, uploadedById: 8, createdAt: "2026-10-19 09:00:00", fileName: "Other private" });
      db.insert("attachments", { id: 100, entityType: "delegate_package_submission_pricing", entityId: 999, uploadedById: 7, createdAt: "2026-10-19 10:00:00", fileName: "Legacy orphan" });
      const page = await getAttachmentDocumentPage("delegate_pricing_documents", documentListPageInput.parse({ page: 2 }), 7, db);
      expect(page).toMatchObject({ total: 44, count: 44, page: 2 });
      expect(page.rows.map(row => row.id)).toEqual(Array.from({ length: 20 }, (_, i) => 24 - i));
      expect(page.delegates).toEqual([{ id: 7, name: "Own delegate" }]);
      expect(page.rows.filter(row => row.entityId === 30).every(row => Number(row.totalEstimatedCost) === 12)).toBe(true);
      expect(page.rows.some(row => row.id === 99)).toBe(false);
      const last = await getAttachmentDocumentPage("delegate_pricing_documents", documentListPageInput.parse({ page: 3 }), 7, db);
      expect(last.rows.map(row => row.id)).toEqual([4, 3, 2, 1]);
      const foreign = await getAttachmentDocumentPage("delegate_pricing_documents", documentListPageInput.parse({ page: 1, delegateId: 8 }), 7, db);
      expect(foreign.total).toBe(0); expect(foreign.rows).toEqual([]); expect(foreign.delegates).toEqual([{ id: 7, name: "Own delegate" }]);
      const orphan = await getAttachmentDocumentPage("delegate_pricing_documents", documentListPageInput.parse({ page: 1, search: "orphan" }), 7, db);
      expect(orphan.rows[0]).toMatchObject({ id: 100, delegateId: 7, delegateName: "Own delegate", totalEstimatedCost: 0 });
      db.insert("attachments", { id: 101, entityType: "delegate_pricing_batch", entityId: 1, createdAt: "2026-10-18 20:59:59", fileName: "Before Riyadh day" });
      db.insert("attachments", { id: 102, entityType: "delegate_pricing_batch", entityId: 1, createdAt: "2026-10-18 21:00:00", fileName: "Start Riyadh day" });
      const day = await getAttachmentDocumentPage("delegate_pricing_documents", documentListPageInput.parse({ page: 1, dateFrom: "2026-10-19", dateTo: "2026-10-19", search: "Riyadh" }), 7, db);
      expect(day.rows.map(row => row.id)).toEqual([102]);
    } finally { db.memory.close(); }
  });
});
