import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { managerProcedure, protectedProcedure, router } from "../_shared/procedures";
import * as db from "../../_core/db";
import { detectLanguage } from "../../services/translation/translation";
import { queueTranslation } from "../../services/translation/translationEngine";
import { localizeNamedRecords } from "../../services/translation/localizedMasterData";

const nameSchema = z.string().trim().min(1, "اسم التصنيف مطلوب").max(255, "اسم التصنيف طويل جدًا");

export const centerCategoriesRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().optional() }).optional())
    .query(async ({ input, ctx }) => {
      const rows = await db.listCenterCategories(Boolean(input?.activeOnly));
      return localizeNamedRecords("CENTER_CATEGORY", rows as any[], (ctx.user.preferredLanguage || "ar") as any);
    }),

  create: managerProcedure
    .input(z.object({ name: nameSchema }))
    .mutation(async ({ input, ctx }) => {
      try {
        const created = await db.createCenterCategory(input.name);
        if (created?.id) {
          const sourceLanguage = await detectLanguage(input.name);
          void queueTranslation({ entityType: "CENTER_CATEGORY", entityId: created.id, fields: [{ fieldName: "name", text: input.name.trim() }], sourceLanguage, userId: ctx.user.id })
            .catch((error) => console.error("[CENTER_CATEGORY] translation queue failed:", error));
        }
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "create_center_category",
          entityType: "center_category",
          entityId: created?.id ?? undefined,
          newValues: { name: input.name },
        });
        return created;
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: "يوجد تصنيف بنفس الاسم مسبقًا" });
        }
        throw error;
      }
    }),

  update: managerProcedure
    .input(z.object({
      id: z.number().int().positive(),
      name: nameSchema.optional(),
      isActive: z.boolean().optional(),
    }).refine((value) => value.name !== undefined || value.isActive !== undefined, {
      message: "لا توجد تغييرات للحفظ",
    }))
    .mutation(async ({ input, ctx }) => {
      const current = await db.getCenterCategoryById(input.id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "التصنيف غير موجود" });
      if (current.systemKey === "it" && input.isActive === false) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "تصنيف تقنية المعلومات تصنيف نظامي مطلوب لمسار بلاغات IT ولا يمكن تعطيله.",
        });
      }
      try {
        const updated = await db.updateCenterCategory(input.id, {
          name: input.name,
          isActive: input.isActive,
        });
        if (input.name?.trim()) {
          const sourceLanguage = await detectLanguage(input.name);
          void queueTranslation({ entityType: "CENTER_CATEGORY", entityId: input.id, fields: [{ fieldName: "name", text: input.name.trim() }], sourceLanguage, userId: ctx.user.id })
            .catch((error) => console.error("[CENTER_CATEGORY] re-translation queue failed:", error));
        }
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "update_center_category",
          entityType: "center_category",
          entityId: input.id,
          oldValues: { name: current.name, isActive: current.isActive },
          newValues: { name: input.name, isActive: input.isActive },
        });
        return updated;
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: "يوجد تصنيف بنفس الاسم مسبقًا" });
        }
        throw error;
      }
    }),

  delete: managerProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const current = await db.getCenterCategoryById(input.id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "التصنيف غير موجود" });
      if (current.systemKey) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "هذا تصنيف نظامي محمي ولا يمكن حذفه. يمكن تعديل الاسم فقط.",
        });
      }
      const usage = await db.getCenterCategoryUsageCount(input.id);
      if (usage.total > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `لا يمكن حذف التصنيف لأنه مستخدم في ${usage.total} سجل (${usage.purchaseOrders} طلب شراء، ${usage.tickets} بلاغ صيانة). يمكنك تعطيله بدلًا من الحذف.`,
        });
      }
      try {
        await db.deleteCenterCategory(input.id);
      } catch (error: any) {
        if (error?.code === "ER_ROW_IS_REFERENCED_2" || error?.errno === 1451) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "لا يمكن حذف التصنيف لأنه أصبح مستخدمًا في طلب شراء. يمكنك تعطيله بدلًا من الحذف.",
          });
        }
        throw error;
      }
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "delete_center_category",
        entityType: "center_category",
        entityId: input.id,
        oldValues: { name: current.name, isActive: current.isActive },
      });
      return { success: true };
    }),
});
