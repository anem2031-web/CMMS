import { z } from "zod";
import { router, protectedProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { detectLanguage } from "../../services/translation/translation";
import { queueTranslation } from "../../services/translation/translationEngine";
import { localizeNamedRecords } from "../../services/translation/localizedMasterData";

export const assetCategoriesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await db.listAssetCategories();
    return localizeNamedRecords("ASSET_CATEGORY", rows as any[], (ctx.user.preferredLanguage || "ar") as any);
  }),

  create: protectedProcedure.input(z.object({ name: z.string().min(1) })).mutation(async ({ input, ctx }) => {
    const result = await db.createAssetCategory(input.name);
    const id = Number((result as any)?.id ?? (result as any)?.insertId ?? result);
    if (Number.isInteger(id) && id > 0) {
      const sourceLanguage = await detectLanguage(input.name);
      void queueTranslation({ entityType: "ASSET_CATEGORY", entityId: id, fields: [{ fieldName: "name", text: input.name.trim() }], sourceLanguage, userId: ctx.user.id })
        .catch((error) => console.error("[ASSET_CATEGORY] translation queue failed:", error));
    }
    return result;
  }),

  update: protectedProcedure.input(z.object({ id: z.number(), name: z.string().min(1) })).mutation(async ({ input, ctx }) => {
    const result = await db.updateAssetCategory(input.id, input.name);
    const sourceLanguage = await detectLanguage(input.name);
    void queueTranslation({ entityType: "ASSET_CATEGORY", entityId: input.id, fields: [{ fieldName: "name", text: input.name.trim() }], sourceLanguage, userId: ctx.user.id })
      .catch((error) => console.error("[ASSET_CATEGORY] re-translation queue failed:", error));
    return result;
  }),

  delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    return db.deleteAssetCategory(input.id);
  }),
});
