import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import type { TeamDatabaseTransaction } from "./repository";
import { selectRows } from "./execution.repository";
/** Only the team branch is blocked; existing name/IT/PMV2 tickets retain their procedures. */
export async function readTeamTicketExecution(
  ticket: any,
  itemId?: number,
  injected?: TeamDatabaseTransaction
) {
  if (ticket.workflowModel !== "sub_ticket") return;
  const db =
    injected ?? (await (await import("../../_core/db/client")).getDb());
  if (!db)
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "قاعدة البيانات غير متاحة",
    });
  const rows = await selectRows(
    db,
    sql`SELECT id,stage FROM ticket_team_assignments WHERE ticketId=${ticket.id} ${itemId == null ? sql`` : sql`AND ticketItemId=${itemId}`} LIMIT 1`
  );
  return rows[0] as { id: number; stage: string } | undefined;
}
export async function assertLegacyTeamExecutionAllowed(
  ticket: any,
  itemId?: number,
  mode: "execution" | "closure" = "execution",
  injected?: TeamDatabaseTransaction
) {
  const execution = await readTeamTicketExecution(ticket, itemId, injected);
  if (execution && !(mode === "closure" && execution.stage === "closed"))
    throw new TRPCError({
      code: "CONFLICT",
      message: "هذا البلاغ مسند لفريق؛ نفّذ الإجراء من نافذة تذاكر الصيانة",
    });
}
