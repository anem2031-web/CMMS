import { sql } from "drizzle-orm";
import type { MaterialCostSource } from "../../../shared/material-execution-costs";

export type ExecutionCostContext = {
  executionSource: MaterialCostSource; executionId: number | null;
  executionItemId: number | null; executionNumber: string | null; ticketId?: number;
};
async function rows(tx: any, query: any): Promise<any[]> {
  const result = await tx.execute(query);
  return Array.isArray(result[0]) ? result[0] : [];
}

/** Called inside the physical issue transaction. Identity/number are never trusted from a client. */
export async function resolveExecutionCostContext(tx: any, input: {
  ticketId?: number; ticketItemId?: number; pmv2TaskItemId?: number;
  selectedTicketItemId?: number;
  beneficiarySiteId: number; beneficiarySectionId: number | null; beneficiaryAssetId: number | null;
}): Promise<ExecutionCostContext> {
  if (input.pmv2TaskItemId && (input.ticketId || input.ticketItemId || input.selectedTicketItemId)) {
    throw new Error("لا يمكن تحميل حركة صرف واحدة على بلاغ ومهمة PMV2 معًا");
  }
  if (input.pmv2TaskItemId) {
    const [task] = await rows(tx, sql`SELECT t.id,t.taskNumber,i.id AS itemId FROM pmv2_task_items i INNER JOIN pmv2_tasks t ON t.id=i.taskId WHERE i.id=${input.pmv2TaskItemId} AND t.status<>'cancelled' FOR UPDATE`);
    if (!task) throw new Error("مرجع مهمة PMV2 للصرف غير صالح");
    return { executionSource: "pmv2", executionId: Number(task.id), executionItemId: Number(task.itemId), executionNumber: task.taskNumber };
  }
  const itemId = input.selectedTicketItemId ?? input.ticketItemId;
  if (itemId || input.ticketId) {
    const matches = await rows(tx, itemId
      ? sql`SELECT t.id,t.ticketNumber,t.status,t.workflowModel,t.siteId,t.sectionId,t.assetId,i.id AS itemId,i.status AS itemStatus FROM ticket_items i INNER JOIN tickets t ON t.id=i.ticketId WHERE i.id=${itemId} FOR UPDATE`
      : sql`SELECT t.id,t.ticketNumber,t.status,t.workflowModel,t.siteId,t.sectionId,t.assetId,NULL AS itemId,NULL AS itemStatus FROM tickets t WHERE t.id=${input.ticketId} FOR UPDATE`);
    const ticket = matches[0];
    if (!ticket || (input.ticketId && Number(ticket.id) !== input.ticketId) || ["closed", "requester_confirmed", "cancelled", "rejected"].includes(ticket.status) || ticket.workflowModel === "department_tasks") {
      throw new Error("البلاغ المحدد للصرف غير صالح أو لم يعد مفتوحًا للتنفيذ");
    }
    if (input.selectedTicketItemId) {
      if (["closed", "requester_confirmed", "cancelled", "rejected"].includes(ticket.itemStatus)) throw new Error("بند البلاغ المحدد مغلق");
      if (Number(ticket.siteId) !== input.beneficiarySiteId || Number(ticket.sectionId) !== input.beneficiarySectionId || (ticket.assetId == null ? null : Number(ticket.assetId)) !== input.beneficiaryAssetId) {
        throw new Error("جهة تحميل تكلفة الصرف يجب أن تطابق موقع وقسم وأصل البلاغ المختار");
      }
    }
    const [team] = await rows(tx, sql`SELECT id FROM ticket_team_assignments WHERE ticketId=${Number(ticket.id)} ${itemId ? sql`AND ticketItemId=${itemId}` : sql``} LIMIT 1`);
    if (team && input.selectedTicketItemId) throw new Error("مواد فرق البلاغات تُصرف من احتياج الفريق لضمان الاستلام ومنع تكرار الصرف");
    return { executionSource: team ? "ticket_team" : "ticket_named", executionId: Number(ticket.id), executionItemId: itemId ?? null, executionNumber: ticket.ticketNumber, ticketId: Number(ticket.id) };
  }
  return { executionSource: "independent", executionId: null, executionItemId: null, executionNumber: null };
}
