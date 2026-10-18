export type DocumentSigningActor = { id: number; name?: string | null; signatureUrl?: string | null };
export type DocumentSignatureSnapshot = {
  version: 1; actorId: number; name: string; signatureUrl: string | null; capturedAt: string;
};

/** Capture the real actor, including an explicitly absent signature. */
export function captureDocumentSignature(actor: DocumentSigningActor, now = new Date()): string {
  return JSON.stringify({ version: 1, actorId: actor.id, name: actor.name || "",
    signatureUrl: actor.signatureUrl || null, capturedAt: now.toISOString() } satisfies DocumentSignatureSnapshot);
}

/** No live-profile fallback for unsigned or historical documents. */
export function readDocumentSignature(raw: unknown, expectedActorId?: number | null): DocumentSignatureSnapshot | null {
  if (typeof raw !== "string" || expectedActorId === null) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Number.isSafeInteger(value.actorId) || value.actorId <= 0
      || (expectedActorId !== undefined && value.actorId !== expectedActorId) || typeof value.name !== "string"
      || (value.signatureUrl !== null && typeof value.signatureUrl !== "string") || typeof value.capturedAt !== "string") return null;
    return value;
  } catch { return null; }
}
