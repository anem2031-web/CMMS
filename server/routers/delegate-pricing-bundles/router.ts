import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../_shared/procedures";
import { canReadPricingBundles } from "../../../shared/delegate-pricing-bundles";
import { PricingBundleService, type PricingBundlePorts } from "../../services/delegate-pricing-bundles/service";
const id = z.number().int().positive();
export function createPricingBundlesRouter(ports: PricingBundlePorts, enabled: () => boolean) {
  const service = new PricingBundleService(ports);
  const available = () => { if (!enabled()) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "حزم التسعير غير مفعلة حاليًا" }); };
  return router({
    status: protectedProcedure.query(({ ctx }) => { if (!canReadPricingBundles(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" }); return { enabled: enabled() }; }),
    list: protectedProcedure.query(({ ctx }) => { if (!canReadPricingBundles(ctx.user)) throw new TRPCError({ code: "FORBIDDEN" }); return enabled() ? service.list(ctx.user) : []; }),
    detail: protectedProcedure.input(z.object({ id })).query(({ ctx, input }) => { available(); return service.detail(ctx.user, input.id); }),
    add: protectedProcedure.input(z.object({ itemId: id })).mutation(({ ctx, input }) => { available(); return service.add(ctx.user, input.itemId); }),
    remove: protectedProcedure.input(z.object({ id, itemId: id })).mutation(({ ctx, input }) => { available(); return service.remove(ctx.user, input.id, input.itemId); }),
    send: protectedProcedure.input(z.object({ id, revision: z.number().int().nonnegative() })).mutation(({ ctx, input }) => { available(); return service.send(ctx.user, input.id, input.revision); }),
    retrySync: protectedProcedure.input(z.object({ id })).mutation(({ ctx, input }) => { available(); return service.finish(ctx.user, input.id); }),
    pdf: protectedProcedure.input(z.object({ id })).mutation(({ ctx, input }) => { available(); return service.pdf(ctx.user, input.id); }),
    archive: protectedProcedure.input(z.object({ id })).mutation(({ ctx, input }) => { available(); return service.archive(ctx.user, input.id); }),
  });
}
