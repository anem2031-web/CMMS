import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { attachments, auditLogs } from "../../../drizzle/schema";

export const catalogItemImageSchema = z.object({
  fileName: z.string().trim().min(1),
  fileKey: z.string().trim().min(1),
  mimeType: z.string().regex(/^image\//i, "يجب اختيار صورة للصنف"),
  fileSize: z.number().positive(),
}, { required_error: "صورة الصنف إلزامية؛ يرجى إضافة صورة قبل الحفظ" });
export type CatalogItemImage = z.infer<typeof catalogItemImageSchema>;

export function assertCatalogImageUpload(image: CatalogItemImage, actorId: number) {
  // Manual catalog saves only attach a file uploaded by the current actor.
  // The central media guard additionally checks the key before this handler.
  if (!image.fileKey.startsWith(`cmms/uploads/u-${actorId}/`) ||
      /[\\%?#\x00-\x1f]/.test(image.fileKey) || image.fileKey.includes("..") ||
      !/\.(webp|png|jpe?g|gif|heic|heif|bmp|tiff?)$/i.test(image.fileKey)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "يرجى رفع صورة صالحة للصنف من حسابك" });
  }
}

/** Called inside the item transaction: a failed image link rolls back the item. */
export async function saveRequiredCatalogImage(tx: any, itemId: number, actorId: number,
  image?: CatalogItemImage, isNew = false, requestMeta: { ipAddress?: string; userAgent?: string } = {}) {
  if (!image) {
    const existing = isNew ? [] : await tx.select().from(attachments).where(and(
      eq(attachments.entityType, "catalog_item"), eq(attachments.entityId, itemId),
    ));
    if (!existing.some((file: any) => /^image\//i.test(file.mimeType || "") ||
        /\.(webp|png|jpe?g|gif|heic|heif|bmp|tiff?)$/i.test(file.fileName || ""))) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "صورة الصنف إلزامية؛ يرجى إضافة صورة قبل الحفظ" });
    }
    return;
  }
  assertCatalogImageUpload(image, actorId);
  const [result] = await tx.insert(attachments).values({ ...image,
    fileUrl: `/api/media?key=${encodeURIComponent(image.fileKey)}`,
    entityType: "catalog_item", entityId: itemId, uploadedById: actorId,
  });
  await tx.insert(auditLogs).values({ userId: actorId, action: "add_attachment",
    entityType: "catalog_item", entityId: itemId,
    newValues: { attachmentId: result.insertId, ...image },
    ...requestMeta,
  });
}
