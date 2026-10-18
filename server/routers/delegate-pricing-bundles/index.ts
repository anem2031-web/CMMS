import * as db from "../../_core/db";
import { createPricingBundlesRouter } from "./router";
import { pricingBundlesEnabled } from "../../services/delegate-pricing-bundles/reservations";
import { submitPricedBatchForPO, finalizePricedBatchForPO } from "../purchase/purchase-orders.router";
import { generatePurchaseRequestPDF } from "../../services/export/exportService";
import { getSignatureDataUrl } from "../../services/pdf/signatureImage";
export const delegatePricingBundlesRouter = createPricingBundlesRouter({
  database: async () => { const database = await db.getDb(); if (!database) throw new Error("قاعدة البيانات غير متاحة"); return database; },
  submitPO: submitPricedBatchForPO,
  createPackageSubmission: db.createPurchasePackageSubmission,
  render: snapshot => generatePurchaseRequestPDF(0, snapshot.delegate.id, undefined, undefined, snapshot),
  signature: getSignatureDataUrl,
  sync: async (poId, actorId, batchId) => {
    const [po, batch, actor] = await Promise.all([db.getPurchaseOrderById(poId), db.getPOPricingBatchById(batchId), db.getUserById(actorId)]);
    if (!po || !batch || batch.purchaseOrderId !== poId || batch.submittedById !== actorId || !actor) throw new Error("تعذر استكمال توثيق دفعة التسعير");
    const items = (await db.getPOItems(poId)).filter((item: any) => item.batchId === batchId);
    await finalizePricedBatchForPO(poId, actor, po, batchId, batch.batchNumber, items);
  },
}, pricingBundlesEnabled);
