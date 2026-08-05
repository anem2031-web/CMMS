import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, inventoryReadProcedure, warehouseProcedure } from "../_shared/procedures";
import * as db from "../../_core/db";
import { syncPathBTicketFromPurchaseOrder } from "../purchase/ticket-purchase-workflow";

export const inventoryRouter = router({
  list: inventoryReadProcedure.query(async () => {
    return db.getInventoryItems();
  }),

  create: warehouseProcedure.input(z.object({
    itemName: z.string().min(1),
    description: z.string().optional(),
    quantity: z.number().default(0),
    unit: z.string().optional(),
    minQuantity: z.number().optional(),
    location: z.string().optional(),
    siteId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    const id = await db.createInventoryItem(input);
    await db.createAuditLog({ userId: ctx.user.id, action: "create_inventory", entityType: "inventory", entityId: id! });
    return { id };
  }),

  update: warehouseProcedure.input(z.object({
    id: z.number(),
    itemName: z.string().optional(),
    description: z.string().optional(),
    unit: z.string().optional(),
    minQuantity: z.number().optional(),
    location: z.string().optional(),
    siteId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    const item = await db.getInventoryItemById(input.id);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود" });
    const { id, ...updateData } = input;
    const oldValues = { itemName: item.itemName, description: item.description, unit: item.unit, minQuantity: item.minQuantity, location: item.location };
    await db.updateInventoryItem(id, updateData);
    await db.createAuditLog({ userId: ctx.user.id, action: "update_inventory", entityType: "inventory", entityId: id, oldValues, newValues: updateData });
    return { success: true };
  }),

  delete: warehouseProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const item = await db.getInventoryItemById(input.id);
    if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود" });
    await db.deleteInventoryItem(input.id);
    await db.createAuditLog({ userId: ctx.user.id, action: "delete_inventory", entityType: "inventory", entityId: input.id, oldValues: { itemName: item.itemName, quantity: item.quantity } });
    return { success: true };
  }),

  addTransaction: inventoryReadProcedure.input(z.object({
    inventoryId: z.number(),
    type: z.enum(["in", "out"]),
    quantity: z.number().min(1),
    reason: z.string().optional(),
    ticketId: z.number().optional(),
  })).mutation(async ({ input, ctx }) => {
    await db.addInventoryTransaction({ ...input, performedById: ctx.user.id });
    return { success: true };
  }),

  // جلب حركات المخزون
  getTransactions: warehouseProcedure
    .input(z.object({ inventoryId: z.number().optional() }))
    .query(async ({ input }) => {
      return db.getInventoryTransactions(input.inventoryId);
    }),

  // البحث بالباركود
  scanBarcode: warehouseProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ input }) => {
      return db.getInventoryByBarcode(input.code);
    }),

  // ── Phase 2A: بطاقة الصنف — المعلومات العامة + ملخص سريع ──────────────
  getItemSummary: inventoryReadProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const item = await db.getInventoryItemById(input.id);
      if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود" });
      // نفس منطق آخر توريد/صرف/سعر المستخدم في شاشة الملخص — لضمان تطابق الأرقام
      const allItems = await db.getInventoryItems();
      const enriched = allItems.find((i: any) => i.id === input.id);
      return { ...item, ...(enriched ?? {}) };
    }),

  // ── Phase 2B: سجل التوريد — كل الفواتير التي دخل منها الصنف ────────────
  getPurchaseHistory: inventoryReadProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getInventoryPurchaseHistory(input.id);
    }),

  // ── Phase 2C: سجل الحركة — كشف حساب كامل (وارد/صادر/رصيد بعد الحركة) ──
  getLedger: inventoryReadProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getInventoryLedger(input.id);
    }),

  // مسار توافق قديم للتسليم من المخزون. أُحكم بنفس قواعد المسار المركزي:
  // لا يثق بمعرّفات الربط المرسلة، ويُلزم فنيًا مستلمًا فعليًا، ويجعل التحديث
  // داخل خدمة issueDelivery الذرية حتى لا يمكن تجاوز دورة البلاغ.
  deliverToRequester: warehouseProcedure
    .input(z.object({
      inventoryId: z.number(),
      purchaseOrderItemId: z.number(),
      purchaseOrderId: z.number(),
      deliveredToId: z.number(),
      deliveredQuantity: z.number().positive(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const inventoryItem = await db.getInventoryItemById(input.inventoryId);
      if (!inventoryItem) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الصنف غير موجود في المخزون" });
      }
      if (input.deliveredQuantity > Number(inventoryItem.quantity || 0)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `الكمية المتاحة في المخزون ${inventoryItem.quantity} أقل من الكمية المطلوبة`,
        });
      }

      const poItem = await db.getPOItemById(input.purchaseOrderItemId);
      if (!poItem || poItem.purchaseOrderId !== input.purchaseOrderId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "بند طلب الشراء لا يطابق الطلب المحدد" });
      }
      const linkedInventory = await db.getInventoryByPOItemId(input.purchaseOrderItemId);
      if (!linkedInventory || linkedInventory.id !== input.inventoryId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "صنف المخزون غير مرتبط ببند طلب الشراء المحدد" });
      }

      const recipient = await db.getUserById(input.deliveredToId);
      if (!recipient || (recipient as any).isActive === 0 || recipient.role !== "technician") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "يجب اختيار فني مستلم فعلي نشط" });
      }

      const po = await db.getPurchaseOrderById(input.purchaseOrderId);
      if (!po) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الشراء غير موجود" });
      const ticket = po.ticketId ? await db.getTicketById(po.ticketId) : null;
      if (ticket?.maintenancePath === "B" && !ticket.assignedToId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد فني مسند للبلاغ المرتبط" });
      }
      const assignedTechnician = ticket?.assignedToId
        ? await db.getUserById(ticket.assignedToId)
        : null;

      const deliveryResult = await db.issueDelivery({
        inventoryId: input.inventoryId,
        quantity: input.deliveredQuantity,
        unit: inventoryItem.unit || undefined,
        performedById: ctx.user.id,
        deliveredToId: input.deliveredToId,
        purchaseOrderItemId: input.purchaseOrderItemId,
        ticketId: ticket?.maintenancePath === "B" ? ticket.id : undefined,
        ticketNumber: ticket?.maintenancePath === "B" ? ticket.ticketNumber : undefined,
        assignedTechnicianId: ticket?.maintenancePath === "B" ? ticket.assignedToId ?? undefined : undefined,
        assignedTechnicianName: ticket?.maintenancePath === "B" ? (assignedTechnician as any)?.name ?? undefined : undefined,
        notes: input.notes || "تسليم مادة مرتبطة ببلاغ من المخزون",
        markPurchaseOrderItemDelivered: true,
      });

      await syncPathBTicketFromPurchaseOrder(
        input.purchaseOrderId,
        ctx.user.id,
        "تم تسليم مادة مرتبطة بالبلاغ عبر مسار المخزون",
      );

      await db.createNotification({
        userId: input.deliveredToId,
        title: "📦 تم تسليم مواد لك من المخزون",
        message: `تم تسليم ${input.deliveredQuantity} ${inventoryItem.unit || "وحدة"} من "${inventoryItem.itemName}" إليك`,
        type: "info",
        relatedTicketId: ticket?.id,
      });

      await db.createAuditLog({
        userId: ctx.user.id,
        action: "inventory_delivery",
        entityType: "inventory",
        entityId: input.inventoryId,
        newValues: {
          deliveredQuantity: input.deliveredQuantity,
          deliveredToId: input.deliveredToId,
          assignedTechnicianId: ticket?.assignedToId ?? null,
          purchaseOrderItemId: input.purchaseOrderItemId,
          ticketId: ticket?.id ?? null,
        },
      });

      return {
        success: true,
        remainingQuantity: Number(inventoryItem.quantity) - input.deliveredQuantity,
        ...deliveryResult,
      };
    }),


});