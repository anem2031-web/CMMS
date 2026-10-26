import { describe, it, expect, vi } from "vitest";
import { documentDatabase } from "./fixtures/documentDatabase";
import { documentListPageInput } from "../../shared/document-list";
import { getAttachmentDocumentPage } from "../_core/db/document-list";
vi.mock("../_core/db/client", () => ({ getDb: () => { throw Error("No remote DB"); } }));

const accounting = { accountingApprovedById: 3, accountingApprovedAt: "2026-10-26 08:00:00" };
const management = { managementApprovedById: 4, managementApprovedAt: "2026-10-26 09:00:00" };
const bothApprovals = { ...accounting, ...management };

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

describe("Accountant financial archive requires both approvals before pagination", () => {
  it("checks the exact batch, submission and every member, including undisplayed members and missing parents", async () => {
    const db = documentDatabase();
    try {
      const states = [{}, accounting, management, bothApprovals,
        { ...bothApprovals, accountingApprovedById: 0 },
        { ...bothApprovals, managementApprovedAt: null }];
      states.forEach((state, index) => {
        db.insert("po_pricing_batches", { id: index + 1, purchaseOrderId: 10, ...state });
        db.insert("attachments", { id: index + 1, entityType: "po_financial_batch", entityId: index + 1 });
      });
      db.insert("attachments", { id: 7, entityType: "po_financial_batch", entityId: 999 });
      // Only submission 20 is complete. 21 has an unapproved hidden member;
      // 22 has no members, 23 is missing and 24 lacks the submission's approval.
      for (const id of [20, 21, 22, 24]) db.insert("purchase_package_submissions", { id, ...(id === 24 ? accounting : bothApprovals) });
      for (const id of [20, 21, 23, 24]) db.insert("po_pricing_batches", { id: id * 10, purchaseOrderId: id, purchasePackageSubmissionId: id, ...bothApprovals });
      db.insert("po_pricing_batches", { id: 211, purchaseOrderId: 999, purchasePackageSubmissionId: 21, submittedById: 99, ...accounting });
      for (const id of [20, 21, 22, 23, 24]) db.insert("attachments", { id, entityType: "purchase_package_submission_financial", entityId: id });
      const page = await getAttachmentDocumentPage("po_financial_batch", documentListPageInput.parse({ page: 1 }), undefined, db, "accountant");
      expect(page.rows.map(row => row.id)).toEqual([20, 4]);
      expect(page).toMatchObject({ total: 2, count: 2 });
      expect(db.queries).toHaveLength(3);
    } finally { db.memory.close(); }
  });

  it.each(["owner", "admin", "senior_management"])("preserves %s visibility and accountant pricing-review metadata", async role => {
    const db = documentDatabase();
    try {
      db.insert("po_pricing_batches", { id: 1, ...accounting });
      db.insert("attachments", { id: 1, entityType: "po_financial_batch", entityId: 1 });
      db.insert("attachments", { id: 2, entityType: "delegate_pricing_batch", entityId: 1 });
      const input = documentListPageInput.parse({ page: 1 });
      expect((await getAttachmentDocumentPage("po_financial_batch", input, undefined, db, role)).rows.map(row => row.id)).toEqual([1]);
      expect((await getAttachmentDocumentPage("po_financial_batch", input, undefined, db, "accountant")).rows).toEqual([]);
      expect((await getAttachmentDocumentPage("delegate_pricing_documents", input, undefined, db, "accountant")).rows.map(row => row.id)).toEqual([2]);
    } finally { db.memory.close(); }
  });

  it("filters before counts, delegate options, search and limit with constant queries for repeated parents in a large list", async () => {
    const db = documentDatabase();
    try {
      db.insert("users", { id: 7, name: "Approved delegate" });
      db.insert("users", { id: 8, name: "Pending delegate" });
      db.insert("po_pricing_batches", { id: 1, submittedById: 7, ...bothApprovals });
      db.insert("po_pricing_batches", { id: 2, submittedById: 8, ...accounting });
      for (let id = 1; id <= 1100; id++) db.insert("attachments", {
        id, entityType: "po_financial_batch", entityId: id % 2 ? 2 : 1,
        fileName: id % 2 ? "Pending.pdf" : "Approved.pdf", createdAt: "2026-10-26 10:00:00",
      });
      const page = await getAttachmentDocumentPage("po_financial_batch", documentListPageInput.parse({ page: 2 }), undefined, db, "accountant");
      expect(page).toMatchObject({ total: 550, count: 550, page: 2, delegates: [{ id: 7, name: "Approved delegate" }] });
      expect(page.rows.map(row => row.id)).toEqual(Array.from({ length: 20 }, (_, i) => 1060 - i * 2));
      expect(db.queries).toHaveLength(3);
      const filtered = await getAttachmentDocumentPage("po_financial_batch", documentListPageInput.parse({ page: 1, search: "Pending", delegateId: 8 }), undefined, db, "accountant");
      expect(filtered).toMatchObject({ rows: [], total: 0, count: 550, delegates: [{ id: 7, name: "Approved delegate" }] });
      expect(db.queries).toHaveLength(6);
    } finally { db.memory.close(); }
  });

  it("rechecks approvals independently on consecutive requests without carrying another role's result", async () => {
    const db = documentDatabase();
    try {
      db.insert("po_pricing_batches", { id: 1, ...accounting });
      db.insert("attachments", { id: 1, entityType: "po_financial_batch", entityId: 1 });
      const read = (role = "accountant") => getAttachmentDocumentPage("po_financial_batch", documentListPageInput.parse({ page: 1 }), undefined, db, role);
      expect((await read()).rows).toEqual([]);
      expect((await read("admin")).rows).toHaveLength(1);
      db.memory.prepare("UPDATE po_pricing_batches SET managementApprovedById=?, managementApprovedAt=? WHERE id=1").run(management.managementApprovedById, management.managementApprovedAt);
      expect((await read()).rows).toHaveLength(1);
      db.memory.exec("UPDATE po_pricing_batches SET accountingApprovedAt=NULL WHERE id=1");
      expect((await read()).rows).toEqual([]);
    } finally { db.memory.close(); }
  });

  it("propagates database failures instead of presenting an empty archive", async () => {
    await expect(getAttachmentDocumentPage("po_financial_batch", documentListPageInput.parse({ page: 1 }), undefined,
      { execute: async () => { throw new Error("fixture outage"); } }, "accountant")).rejects.toThrow("fixture outage");
  });
});
