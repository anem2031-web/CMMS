import { TRPCError } from "@trpc/server";
type Actor = { id: number; role: string };
export interface PurchaseDocumentPort {
  order(id: number): Promise<any>;
  batch(id: number): Promise<any>;
  submission(id: number): Promise<any>;
  batches(submissionId: number): Promise<any[]>;
  authorize(user: Actor, order: any): Promise<void>;
}
const port: PurchaseDocumentPort = {
  order: async id => (await import("../db")).getPurchaseOrderById(id),
  batch: async id => (await import("../db")).getPOPricingBatchById(id),
  submission: async id => (await import("../db")).getPurchasePackageSubmissionById(id),
  batches: async id => (await import("../db")).getPricingBatchesBySubmission(id),
  authorize: async (user, order) => (await import("./guard")).assertCanViewPurchaseOrder(user, order),
};
const denied = () => new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لمستند طلب الشراء المحدد" });

/** Authorize the exact document scope before the PDF generator reads its lines. */
export async function authorizePurchaseDocument(user: Actor, poId: number, batchId?: number, submissionId?: number, source = port) {
  if (![poId, batchId, submissionId].filter(id => id !== undefined).every(id => Number.isSafeInteger(id) && id! > 0) || (batchId && submissionId)) throw denied();
  const order = await source.order(poId);
  if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الشراء غير موجود" });
  // A financial approver must still be able to print the exact approved
  // document after it leaves the pending-accounting inbox. This grants no
  // access to the PO screen, other batches, or another accountant's approval.
  const ownApproval = (scope: any) => user.role === "accountant"
    && Number(scope?.accountingApprovedById) === user.id && !!scope?.accountingApprovedAt;
  if (submissionId) {
    const submission = await source.submission(submissionId);
    if (!submission) throw denied();
    const batches = await source.batches(submissionId);
    if (!batches.length || !batches.some(batch => Number(batch.purchaseOrderId) === poId)) throw denied();
    for (const batch of batches) {
      if (user.role === "delegate" && Number(batch.submittedById) !== user.id) throw denied();
      const related = Number(batch.purchaseOrderId) === poId ? order : await source.order(Number(batch.purchaseOrderId));
      if (!related) throw denied();
      if (!ownApproval(submission)) await source.authorize(user, related);
    }
  } else if (batchId) {
    const batch = await source.batch(batchId);
    if (!batch || Number(batch.purchaseOrderId) !== poId || (user.role === "delegate" && Number(batch.submittedById) !== user.id)) throw denied();
    if (!ownApproval(batch)) await source.authorize(user, order);
  } else if (!ownApproval(order)) await source.authorize(user, order);
  return order;
}
