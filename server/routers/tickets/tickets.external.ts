import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, gateSecurityProcedure, delegateProcedure } from "../_shared/procedures";

/**
 * Legacy Path-C ticket endpoints are intentionally blocked.
 * The external-maintenance module is now the single workflow authority because
 * it requires warehouse preparation, signed gate exit/entry, the linked
 * pricing/approval cycle, warehouse return receipt, and technician handover.
 */
export const ticketsExternalRouter = router({
  approveGateExit: gateSecurityProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "استخدم صفحة الحراسة ضمن دورة الصيانة الخارجية؛ لا يمكن اعتماد الخروج مباشرة من البلاغ",
    });
  }),

  markExternalRepairDone: delegateProcedure.input(z.object({
    id: z.number(),
    repairNotes: z.string().optional(),
  })).mutation(async () => {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "اكتمال الصيانة الخارجية يُسجل من دورة التسعير والاعتمادات الخاصة بالمندوب",
    });
  }),

  approveGateEntry: gateSecurityProcedure.input(z.object({ id: z.number() })).mutation(async () => {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "استخدم صفحة الحراسة ضمن دورة الصيانة الخارجية؛ لا يمكن اعتماد الدخول مباشرة من البلاغ",
    });
  }),

  listForGate: gateSecurityProcedure.query(async () => []),
});
