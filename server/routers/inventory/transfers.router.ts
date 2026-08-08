import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, warehouseProcedure, inventoryReadProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";

// ============================================================
// transfers.router.ts — التحويل الفعلي بين المخازن (رئيسي↔فرعي، فرعي↔فرعي)
// أُعيد بناؤه بالكامل بتاريخ 2026-08-05 (كان مسجَّلاً بالخادم يستدعي دالتين
// غير موجودتين إطلاقاً بطبقة قاعدة البيانات). في نفس اليوم أُضيف مفهوم
// "العملية المجمَّعة" (createBatch): حتى 20 صنفاً تحت رقم عملية واحد وبطاقة
// واحدة بالواجهة، بدل ظهور كل صنف كعملية منفصلة. راجع
// docs/CHANGELOG_TECHNICAL.md لتفاصيل الإصلاح الكامل قبل أي تعديل هنا.
// ============================================================
export const transfersRouter = router({
  // ── عملية تحويل مجمَّعة: حتى 20 صنفاً برقم عملية واحد ──────────────
  createBatch: warehouseProcedure
    .input(z.object({
      fromWarehouseId: z.number(),
      toWarehouseId: z.number(),
      notes: z.string().optional(),
      items: z.array(z.object({
        fromInventoryId: z.number(),
        quantity: z.number().min(0.001, "الكمية يجب أن تكون أكبر من صفر"),
        notes: z.string().optional(),
      })).min(1, "أضف صنفاً واحداً على الأقل").max(20, "الحد الأقصى 20 صنفاً بالعملية الواحدة"),
    }))
    .mutation(async ({ input, ctx }) => {
      if (input.fromWarehouseId === input.toWarehouseId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن التحويل لنفس المخزن" });
      }
      try {
        const result = await db.createWarehouseTransferBatch({
          ...input,
          createdById: ctx.user.id,
        });
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "warehouse_transfer_batch",
          entityType: "warehouse_transfer_batch",
          entityId: result.batchId,
          newValues: { ...input, batchNumber: result.batchNumber },
        });
        return result;
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),

  // ── بطاقات العمليات (بطاقة واحدة لكل عملية مهما كان عدد أصنافها) ──
  listCards: inventoryReadProcedure
    .input(z.object({ warehouseId: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.getWarehouseTransferBatchCards({ warehouseId: input?.warehouseId });
    }),

  // ── تفاصيل عملية واحدة (كل أصنافها) عبر مفتاح البطاقة ──
  getBatchDetail: inventoryReadProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ input }) => {
      const detail = await db.getWarehouseTransferBatchDetail(input.key);
      if (!detail) throw new TRPCError({ code: "NOT_FOUND", message: "العملية غير موجودة" });
      return detail;
    }),
});
