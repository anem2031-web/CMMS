import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, warehouseProcedure, inventoryReadProcedure, adminOwnerProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";

// Warehouse delivery confirmations — called after PO items are purchased
export const warehouseRouter = router({
  // ── إدارة المخازن (رئيسي/فرعي) — البند 7، 2026-08-05 ──────────────
  // راجع docs/CHANGELOG_TECHNICAL.md قبل أي تعديل: كل مخزن فرعي يجب أن
  // يُربط بتصنيف واحد من المستوى الأول بالكتالوج، ولا يجوز تكرار الربط.
  list: inventoryReadProcedure.query(async () => {
    return db.getAllWarehouses();
  }),

  getAvailableCategories: warehouseProcedure.query(async () => {
    return db.getAvailableLevel1CatalogNodes();
  }),

  create: warehouseProcedure
    .input(z.object({
      nameAr: z.string().min(1, "اسم المخزن مطلوب"),
      nameEn: z.string().optional(),
      description: z.string().optional(),
      catalogNodeId: z.number({ required_error: "الربط بتصنيف من المستوى الأول إلزامي" }),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const id = await db.createSubWarehouse(input);
        await db.createAuditLog({
          userId: ctx.user.id,
          action: "create_warehouse",
          entityType: "warehouse",
          entityId: id,
          newValues: input,
        });
        return { success: true, id };
      } catch (err: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: err.message });
      }
    }),

  // تعديل مسمى/بيانات مخزن — حصريًا لأدمن ومالك فقط (2026-08-05)، ليس حتى دور
  // warehouse العادي، لأنها عملية حسّاسة قد تؤثر على تقارير ومستندات سابقة
  // تعتمد على اسم المخزن.
  update: adminOwnerProcedure
    .input(z.object({
      id: z.number(),
      nameAr: z.string().min(1).optional(),
      nameEn: z.string().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await db.updateWarehouse(id, data);
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "update_warehouse",
        entityType: "warehouse",
        entityId: id,
        newValues: data,
      });
      return { success: true };
    }),

  confirmDeliveryToWarehouse: warehouseProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.updatePOItem(input.itemId, {
        status: "delivered_to_warehouse",
        deliveredToWarehouseById: ctx.user.id,
        deliveredToWarehouseAt: new Date(),
      });
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "confirm_delivery_warehouse",
        entityType: "purchase_order_item",
        entityId: input.itemId,
      });
      return { success: true };
    }),

  confirmDeliveryToRequester: warehouseProcedure
    .input(z.object({ itemId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db.updatePOItem(input.itemId, {
        status: "delivered_to_requester",
        deliveredToRequesterById: ctx.user.id,
        deliveredToRequesterAt: new Date(),
      });
      await db.createAuditLog({
        userId: ctx.user.id,
        action: "confirm_delivery_requester",
        entityType: "purchase_order_item",
        entityId: input.itemId,
      });
      return { success: true };
    }),
});
