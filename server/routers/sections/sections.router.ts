import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, protectedProcedure } from "../_shared/procedures";
import { translateFields, detectLanguage } from "../../services/translation/translation";
import * as db from "../../_core/db";
import { localizeNamedRecords } from "../../services/translation/localizedMasterData";
import { storeCompletedEntityTranslation } from "../../services/translation/translationEngine";

export const sectionsRouter = router({
  list: protectedProcedure.input(z.object({ siteId: z.number().optional() }).optional()).query(async ({ input, ctx }) => {
    const rows = await db.getSections(input?.siteId);
    return localizeNamedRecords("SECTION", rows as any[], (ctx.user.preferredLanguage || "ar") as any);
  }),

  create: protectedProcedure.input(z.object({
    name: z.string().min(1),
    siteId: z.number(),
    description: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    // Auto-translate name
    let sectionNameAr: string | undefined;
    let sectionNameEn: string | undefined;
    let sectionNameUr: string | undefined;
    try {
      const translations = await translateFields({ name: input.name });
      sectionNameAr = translations.name?.ar;
      sectionNameEn = translations.name?.en;
      sectionNameUr = translations.name?.ur;
    } catch (e) { /* fallback */ }
    const id = await db.createSection({ ...input, nameEn: sectionNameEn, nameUr: sectionNameUr, isActive: true });
    if (id) {
      await Promise.all([
        sectionNameAr && storeCompletedEntityTranslation("SECTION", id, "name", "ar", sectionNameAr),
        sectionNameEn && storeCompletedEntityTranslation("SECTION", id, "name", "en", sectionNameEn),
        sectionNameUr && storeCompletedEntityTranslation("SECTION", id, "name", "ur", sectionNameUr),
      ]);
    }
    await db.createAuditLog({ userId: ctx.user.id, action: "create_section", entityType: "section", entityId: id!, newValues: input });
    return { id };
  }),

  update: protectedProcedure.input(z.object({
    id: z.number(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  })).mutation(async ({ input, ctx }) => {
    const { id, ...updateData } = input;
    let sectionExtraFields: { nameEn?: string; nameUr?: string } = {};
    let translatedNames: { ar?: string; en?: string; ur?: string } = {};
    if (updateData.name) {
      try {
        const translations = await translateFields({ name: updateData.name });
        translatedNames = translations.name || {};
        sectionExtraFields.nameEn = translations.name?.en;
        sectionExtraFields.nameUr = translations.name?.ur;
      } catch (e) { /* fallback */ }
    }
    await db.updateSection(id, { ...updateData, ...sectionExtraFields });
    if (updateData.name) {
      await Promise.all([
        translatedNames.ar && storeCompletedEntityTranslation("SECTION", id, "name", "ar", translatedNames.ar),
        translatedNames.en && storeCompletedEntityTranslation("SECTION", id, "name", "en", translatedNames.en),
        translatedNames.ur && storeCompletedEntityTranslation("SECTION", id, "name", "ur", translatedNames.ur),
      ]);
    }
    await db.createAuditLog({ userId: ctx.user.id, action: "update_section", entityType: "section", entityId: id, newValues: updateData });
    return { success: true };
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    await db.deleteSection(input.id);
    await db.createAuditLog({ userId: ctx.user.id, action: "delete_section", entityType: "section", entityId: input.id });
    return { success: true };
  }),
});
