import { z } from "zod";
import { attachments, auditLogs } from "../../../drizzle/schema";

export const ticketCreationAttachmentSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  fileKey: z.string().min(1),
  mimeType: z.string().optional(),
  fileSize: z.number().nonnegative().optional(),
});

/** Initial evidence belongs to the newly created ticket, before routing makes
 * its reporter read-only. Persist it in the creation transaction; do not grant
 * the reporter any new attachment or workflow permissions on existing tickets.
 */
export async function saveTicketCreationAttachments(
  tx: { insert: (table: any) => any },
  ticketId: number,
  actorId: number,
  files: z.infer<typeof ticketCreationAttachmentSchema>[],
): Promise<void> {
  for (const file of files) {
    const [result] = await tx.insert(attachments).values({
      entityType: "ticket",
      entityId: ticketId,
      fileName: file.fileName,
      fileUrl: file.fileUrl,
      fileKey: file.fileKey,
      mimeType: file.mimeType || null,
      fileSize: file.fileSize ?? null,
      uploadedById: actorId,
    });
    await tx.insert(auditLogs).values({
      userId: actorId,
      action: "add_attachment",
      entityType: "ticket",
      entityId: ticketId,
      newValues: {
        attachmentId: result.insertId,
        fileName: file.fileName,
        fileKey: file.fileKey,
        mimeType: file.mimeType || null,
        fileSize: file.fileSize ?? null,
      },
    });
  }
}
