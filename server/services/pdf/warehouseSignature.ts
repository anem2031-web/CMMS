import { readDocumentSignature } from "../../../shared/documentSignatureSnapshot";

/** Read private storage after document authorization, outside stock transactions.
 * Embed image bytes so browser print and server PDF use the same signature.
 */
export async function getWarehouseSignatureForPrint(raw: unknown, actorId?: number) {
  const snapshot = readDocumentSignature(raw, actorId);
  if (!snapshot?.signatureUrl) return "";
  const { getSignatureDataUrl } = await import("./signatureImage");
  return getSignatureDataUrl(snapshot.signatureUrl);
}
