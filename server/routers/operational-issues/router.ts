import { z } from "zod";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, warehouseProcedure } from "../_shared/procedures";
import { OperationalIssueService, type OperationalPorts } from "../../services/operational-issues/service";
import { canReadOperationalIssue, type OperationalActor } from "../../../shared/operational-issues";
import { executionRows } from "../../services/operational-issues/issue-reference";
const id = z.number().int().positive();
const quantity = z.number().int("كمية الصرف التشغيلي يجب أن تكون عددًا صحيحًا").positive().max(2_147_483_647);
export function createOperationalIssuesRouter(ports: OperationalPorts, enabled: () => boolean) {
  const service = new OperationalIssueService(ports);
  const available = () => { if (!enabled()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "الصرف التشغيلي غير متاح حاليًا" }); };
  const read = (actor: OperationalActor) => { if (actor.isActive !== 1 || !canReadOperationalIssue(actor.role)) throw new TRPCError({ code: "FORBIDDEN" }); };
  return router({
    status: protectedProcedure.query(({ ctx }) => { read(ctx.user); return { enabled: enabled() }; }),
    list: protectedProcedure.query(async ({ ctx }) => { read(ctx.user); return { enabled: enabled(), orders: enabled() ? await service.list(ctx.user) : [] }; }),
    detail: protectedProcedure.input(z.object({ id })).query(({ ctx, input }) => { read(ctx.user); available(); return service.detail(ctx.user, input.id); }),
    itemUnits: protectedProcedure.input(z.object({ catalogItemIds: z.array(id).min(1).max(20) })).query(({ ctx, input }) => { read(ctx.user); available(); return service.itemUnits(ctx.user, input.catalogItemIds); }),
    choices: protectedProcedure.query(async ({ ctx }) => {
      read(ctx.user); if (!enabled()) return { collectors: [] as Array<{ id: number; name: string }> };
      return { collectors: await executionRows(await ports.database(), sql`SELECT id,name FROM users WHERE isActive=1 AND role='technician' ORDER BY name`) as Array<{ id: number; name: string }> };
    }),
    create: protectedProcedure.input(z.object({ siteId: id, sectionId: id, collectorId: id, reason: z.string().trim().min(1).max(2000), operationKey: z.string().min(1).max(120), items: z.array(z.object({ catalogItemId: id, quantity, unit: z.string().trim().min(1).max(50) })).min(1).max(20) }))
      .mutation(({ ctx, input }) => { available(); return service.create(ctx.user, input); }),
    approve: warehouseProcedure.input(z.object({ id, revision: z.number().int().nonnegative() })).mutation(({ ctx, input }) => { available(); return service.approve(ctx.user, input.id, input.revision); }),
    issue: warehouseProcedure.input(z.object({ orderId: id, itemId: id, warehouseId: id, lotTrackingToken: z.string().trim().min(1), quantity, operationKey: z.string().min(1).max(120) }))
      .mutation(({ ctx, input }) => { available(); return service.issue(ctx.user, input); }),
    returnMaterial: warehouseProcedure.input(z.object({ orderId: id, deliveryDocumentId: id, quantity: z.number().int().positive(), reason: z.string().trim().min(1).max(2000), operationKey: z.string().min(1).max(120) }))
      .mutation(({ ctx, input }) => { available(); return service.returnMaterial(ctx.user, input); }),
  });
}
