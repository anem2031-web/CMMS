import { TRPCError } from "@trpc/server";
import * as db from "../../_core/db";
import { operationalIssuesEnabled } from "../../services/operational-issues/feature";
import { createOperationalIssuesRouter } from "./router";
export const operationalIssuesRouter = createOperationalIssuesRouter({
  database: async () => { const value = await db.getDb(); if (!value) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر قراءة أوامر الصرف" }); return value; },
  issue: (tx, input) => db.issueDelivery(input, tx),
  resolveLot: input => db.resolveWarehouseIssueLot(input),
  returnDelivery: (tx, input) => db.createRecipientWarehouseReturn(input, tx),
}, operationalIssuesEnabled);
