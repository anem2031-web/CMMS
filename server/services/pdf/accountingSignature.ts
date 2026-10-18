import { captureDocumentSignature, readDocumentSignature } from "../../../shared/documentSignatureSnapshot";
export const captureAccountingSignature = captureDocumentSignature;

/** Historical approvals without a snapshot keep their existing blank signature. */
export function readAccountingSignature(raw: unknown, approverId: number | null | undefined) {
  return approverId ? readDocumentSignature(raw, approverId) : null;
}
