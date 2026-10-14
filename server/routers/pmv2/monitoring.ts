import { z } from "zod";
import { router } from "../_shared/procedures";
import { pmv2ManagementProcedure } from "../../pmv2/security/procedures";
import { pmv2MonitoringService } from "../../pmv2/monitoring/service";
import { pmv2SlaService, PMV2_SLA_ROLE_CATALOG } from "../../pmv2/monitoring/sla-service";
import { pmv2AlertService } from "../../pmv2/monitoring/alert-service";
import { localizeMasterDataReferences } from "../../services/translation/localizedMasterData";
import type { SupportedLanguage } from "../../services/translation/translation";

const nullableMinutes = z.number().int().min(1).max(60 * 24 * 90).nullable();

export const pmv2MonitoringRouter = router({
  overview: pmv2ManagementProcedure.query(async ({ ctx }) => localizeMasterDataReferences(
    await pmv2MonitoringService.getOverview(),
    (ctx.user.preferredLanguage || "ar") as SupportedLanguage,
  )),

  taskDetail: pmv2ManagementProcedure
    .input(z.object({ taskId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => localizeMasterDataReferences(
      await pmv2MonitoringService.getTaskDetail(input.taskId),
      (ctx.user.preferredLanguage || "ar") as SupportedLanguage,
    )),

  slaRules: pmv2ManagementProcedure.query(() => pmv2SlaService.listRules()),

  updateSlaRule: pmv2ManagementProcedure
    .input(z.object({
      roleKey: z.string().refine((value) => PMV2_SLA_ROLE_CATALOG.some((item) => item.roleKey === value), "دور SLA غير معتمد"),
      slaMinutes: nullableMinutes,
      reminderMinutes: nullableMinutes,
      isActive: z.boolean(),
    }))
    .mutation(({ input, ctx }) => pmv2SlaService.upsertRule({ ...input, updatedById: ctx.user.id })),

  runAlertSweep: pmv2ManagementProcedure
    .mutation(() => pmv2AlertService.sweep()),
});
