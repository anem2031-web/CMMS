import { sql, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { isExternalRouteReviewer, ownsExternalRouteReview, type ExternalRoute, type ExternalRouteReview } from "../../shared/external-route-review";

type Actor = { id: number; role: string };
export interface RouteReviewDb { execute(query: SQL): Promise<any>; }
export interface RouteReviewPort { transaction<T>(work: (tx: RouteReviewDb) => Promise<T>): Promise<T>; }
const fail = (message: string, code: "FORBIDDEN" | "CONFLICT" | "NOT_FOUND" | "BAD_REQUEST" = "CONFLICT"): never => { throw new TRPCError({ code, message }); };
async function rows(tx: RouteReviewDb, query: SQL): Promise<any[]> {
  const result = await tx.execute(query);
  if (!Array.isArray(result?.[0])) throw new Error("Invalid route review database response");
  return result[0];
}
async function database(): Promise<RouteReviewPort> {
  const { getDb } = await import("../_core/db/client");
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db as unknown as RouteReviewPort;
}
async function identity(tx: RouteReviewDb, actor: Actor) {
  const [u] = await rows(tx, sql`SELECT id,role,isActive FROM users WHERE id=${actor.id}`);
  if (!u || Number(u.isActive) !== 1 || u.role !== actor.role) fail("الحساب غير متاح", "FORBIDDEN");
}
const latestReview = (tx: RouteReviewDb, itemId: number) => rows(tx, sql`
  SELECT id,action,newValues FROM audit_logs WHERE entityType='ticket_item' AND entityId=${itemId}
  AND action IN ('external_route_returned','external_route_decided') ORDER BY id DESC LIMIT 1`);
function payload(row: any): any {
  try { return typeof row?.newValues === "string" ? JSON.parse(row.newValues) : row?.newValues; }
  catch { throw new Error("Invalid external route review audit payload"); }
}

/** Legacy approval must not bypass the warehouse-return decision boundary. */
export async function assertNoPendingExternalRouteReview(ticketId: number, itemId?: number) {
  return (await database()).transaction(async tx => {
    const pending = await rows(tx, sql`SELECT i.id FROM ticket_items i INNER JOIN audit_logs a ON a.entityType='ticket_item' AND a.entityId=i.id AND a.action='external_route_returned'
      WHERE i.ticketId=${ticketId} ${itemId == null ? sql`` : sql`AND i.id=${itemId}`} AND i.status='under_inspection' AND i.maintenancePath='C'
      AND NOT EXISTS (SELECT 1 FROM audit_logs later WHERE later.entityType='ticket_item' AND later.entityId=i.id AND later.action IN ('external_route_returned','external_route_decided') AND later.id>a.id) LIMIT 1`);
    if (pending.length) fail("استخدم مراجعة المسار A / B / C للطلب المعاد من المستودع");
  });
}

/** Locks in the same order as team execution; all callers then serialize on the ticket. */
async function lockItem(tx: RouteReviewDb, ticketId: number, itemId: number) {
  const [ref] = await rows(tx, sql`SELECT id,teamId FROM ticket_team_assignments WHERE ticketId=${ticketId} AND ticketItemId=${itemId}`);
  if (ref) await rows(tx, sql`SELECT id FROM maintenance_teams WHERE id=${Number(ref.teamId)} FOR UPDATE`);
  const [ticket] = await rows(tx, sql`SELECT * FROM tickets WHERE id=${ticketId} FOR UPDATE`);
  const [item] = await rows(tx, sql`SELECT * FROM ticket_items WHERE id=${itemId} AND ticketId=${ticketId} FOR UPDATE`);
  if (!ticket || !item) fail("البلاغ أو البند غير موجود", "NOT_FOUND");
  const [team] = await rows(tx, sql`SELECT * FROM ticket_team_assignments WHERE ticketId=${ticketId} AND ticketItemId=${itemId} FOR UPDATE`);
  if ((ref?.id ?? null) !== (team?.id ?? null)) fail("تغير إسناد الفريق؛ أعد المحاولة");
  const jobs = await rows(tx, sql`SELECT id FROM external_maintenance_jobs WHERE ticketId=${ticketId} AND (ticketItemId=${itemId} OR ticketItemId IS NULL) LIMIT 1 FOR UPDATE`);
  if (jobs.length) fail("تم تجهيز الأصل؛ لا يمكن إعادته أو تغيير مساره من هذا الإجراء");
  return { ticket, item, team };
}
async function audit(tx: RouteReviewDb, actor: Actor, itemId: number, action: string, data: object) {
  await tx.execute(sql`INSERT INTO audit_logs (userId,action,entityType,entityId,newValues) VALUES (${actor.id},${action},'ticket_item',${itemId},${JSON.stringify(data)})`);
}
async function teamAction(tx: RouteReviewDb, team: any, actor: Actor, kind: string, note: string, stage: string, outcome: string | null, key: string) {
  if (!team) return;
  const revision = Number(team.revision) + 1;
  await tx.execute(sql`UPDATE ticket_team_assignments SET stage=${stage},outcome=${outcome},revision=${revision} WHERE id=${Number(team.id)} AND revision=${Number(team.revision)}`);
  await tx.execute(sql`INSERT INTO ticket_team_actions (assignmentId,actorId,kind,note,revision,operationKey) VALUES (${Number(team.id)},${actor.id},${kind},${note},${revision},${key})`);
}

export async function returnExternalRoute(actor: Actor, input: { ticketId: number; ticketItemId: number; reason: string }, port?: RouteReviewPort) {
  if (!["warehouse", "owner", "admin"].includes(actor.role)) fail("الإعادة للمستودع فقط", "FORBIDDEN");
  const reason = input.reason.trim();
  if (!reason || reason.length > 4000) fail("سبب الإعادة مطلوب وبحد أقصى 4000 حرف", "BAD_REQUEST");
  return (port ?? await database()).transaction(async tx => {
    await identity(tx, actor);
    const { item, team } = await lockItem(tx, input.ticketId, input.ticketItemId);
    if (item.maintenancePath !== "C" || item.status !== "work_approved" || (team && team.stage !== "external_in_progress")) fail("الطلب ليس بانتظار تجهيز الصيانة الخارجية");
    const reviewerId = Number(item.approvedById || team?.responsibleManagerId || item.responsibleManagerId);
    const [reviewer] = await rows(tx, sql`SELECT id,role,isActive FROM users WHERE id=${reviewerId}`);
    if (!reviewer || Number(reviewer.isActive) !== 1 || !isExternalRouteReviewer(reviewer.role)) fail("المسؤول المعتمد غير متاح؛ يلزم مراجعة مدير النظام");
    const [last] = await latestReview(tx, item.id);
    if (last?.action === "external_route_returned") fail("الطلب معاد للمسؤول بالفعل");
    // Keep C while returning to inspection; the pending marker guards legacy approval.
    await tx.execute(sql`UPDATE ticket_items SET status='under_inspection' WHERE id=${Number(item.id)} AND ticketId=${input.ticketId}`);
    if (Number(item.itemNumber) === 1) await tx.execute(sql`UPDATE tickets SET status='under_inspection' WHERE id=${input.ticketId}`);
    await teamAction(tx, team, actor, "external_route_returned", reason, "blocked", null, `external-return:${item.id}:${Number(team?.revision ?? 0) + 1}`);
    await audit(tx, actor, item.id, "external_route_returned", { reason, reviewerId, ticketId: input.ticketId });
    await tx.execute(sql`INSERT INTO ticket_status_history (ticketId,fromStatus,toStatus,changedById,notes) VALUES (${input.ticketId},'work_approved','under_inspection',${actor.id},${`إعادة بند ${item.itemNumber} من المستودع لمراجعة المسار: ${reason}`})`);
    await tx.execute(sql`INSERT INTO notifications (userId,title,message,type,relatedTicketId) VALUES (${reviewerId},'طلب مراجعة مسار الصيانة',${`أعاد المستودع بند ${item.itemNumber}: ${reason}`},'ticket_updated',${input.ticketId})`);
    return { success: true };
  });
}

export async function readExternalRouteReviews(actor: Actor, ticketId: number, port?: RouteReviewPort): Promise<ExternalRouteReview[]> {
  if (!isExternalRouteReviewer(actor.role)) fail("المراجعة للمسؤول فقط", "FORBIDDEN");
  return (port ?? await database()).transaction(async tx => {
    await identity(tx, actor);
    // One bounded-by-ticket join, not a permission/database call per displayed item.
    const result = await rows(tx, sql`SELECT i.id AS ticketItemId,i.itemNumber,i.approvedById,a.id AS returnId,a.newValues
      FROM ticket_items i INNER JOIN tickets t ON t.id=i.ticketId
      INNER JOIN audit_logs a ON a.entityType='ticket_item' AND a.entityId=i.id AND a.action='external_route_returned'
      WHERE i.ticketId=${ticketId} AND i.status='under_inspection' AND i.maintenancePath='C'
      AND NOT EXISTS (SELECT 1 FROM audit_logs later WHERE later.entityType='ticket_item' AND later.entityId=i.id AND later.action IN ('external_route_returned','external_route_decided') AND later.id>a.id)
      ORDER BY i.itemNumber,i.id`);
    return result.flatMap(row => {
      const data = payload(row);
      if (!data || Number(data.ticketId) !== ticketId || !ownsExternalRouteReview(actor.role, actor.id, Number(data.reviewerId))) return [];
      if (row.approvedById && Number(row.approvedById) !== Number(data.reviewerId)) return [];
      return [{ ticketId, ticketItemId: Number(row.ticketItemId), itemNumber: Number(row.itemNumber), returnId: Number(row.returnId), reason: String(data.reason), reviewerId: Number(data.reviewerId) }];
    });
  });
}

export async function decideExternalRoute(actor: Actor, input: { ticketId: number; ticketItemId: number; returnId: number; path: ExternalRoute; reason: string }, port?: RouteReviewPort) {
  if (!isExternalRouteReviewer(actor.role)) fail("المراجعة للمسؤول فقط", "FORBIDDEN");
  const reason = input.reason.trim();
  if (!reason || reason.length > 4000 || !["A", "B", "C"].includes(input.path)) fail("حدد المسار واكتب سبب القرار", "BAD_REQUEST");
  return (port ?? await database()).transaction(async tx => {
    await identity(tx, actor);
    const { item, team } = await lockItem(tx, input.ticketId, input.ticketItemId);
    const [last] = await latestReview(tx, item.id);
    const data = payload(last);
    if (last?.action !== "external_route_returned" || Number(last.id) !== input.returnId || item.maintenancePath !== "C" || item.status !== "under_inspection" || (team && team.stage !== "blocked")) fail("تغير الطلب أو تمت مراجعته من نافذة أخرى؛ حدّث الصفحة");
    if (!data || Number(data.ticketId) !== input.ticketId || !ownsExternalRouteReview(actor.role, actor.id, Number(data.reviewerId)) || (item.approvedById && Number(item.approvedById) !== Number(data.reviewerId))) fail("القرار للمسؤول عن الاعتماد فقط", "FORBIDDEN");
    let stage = input.path === "C" ? "external_in_progress" : input.path === "B" ? "waiting_material" : "action_required";
    if (team && input.path !== "C") {
      const needs = await rows(tx, sql`SELECT n.id,n.requestedQuantity,n.usedQuantity,COALESCE(SUM(d.issuedQuantity-d.returnedQuantity),0) AS delivered FROM ticket_team_material_needs n LEFT JOIN ticket_team_delivery_links d ON d.needId=n.id WHERE n.assignmentId=${Number(team.id)} AND n.materialRound=${Number(team.materialRound)} GROUP BY n.id,n.requestedQuantity,n.usedQuantity`);
      if (input.path === "A" && needs.some(n => Number(n.requestedQuantity) > Number(n.usedQuantity))) fail("يوجد احتياج مواد قائم؛ اختر مسار B لاستكماله");
      if (input.path === "B" && needs.length && needs.every(n => Number(n.delivered) >= Number(n.requestedQuantity))) stage = "ready_to_repair";
    }
    await tx.execute(sql`UPDATE ticket_items SET status='work_approved',maintenancePath=${input.path},justification=${reason},approvedById=${actor.id},approvedAt=CURRENT_TIMESTAMP WHERE id=${Number(item.id)} AND ticketId=${input.ticketId}`);
    if (Number(item.itemNumber) === 1) await tx.execute(sql`UPDATE tickets SET status='work_approved',maintenancePath=${input.path},justification=${reason},approvedById=${actor.id},approvedAt=CURRENT_TIMESTAMP WHERE id=${input.ticketId}`);
    const note = `المسار ${input.path}: ${reason}`;
    await teamAction(tx, team, actor, "external_route_decided", note, stage, input.path === "B" ? "needs_material" : input.path === "C" ? "external" : null, `external-decision:${input.returnId}`);
    await audit(tx, actor, item.id, "external_route_decided", { returnId: input.returnId, path: input.path, reason, ticketId: input.ticketId });
    await tx.execute(sql`INSERT INTO ticket_status_history (ticketId,fromStatus,toStatus,changedById,notes) VALUES (${input.ticketId},'under_inspection','work_approved',${actor.id},${`مراجعة بند ${item.itemNumber} المعاد من المستودع — ${note}`})`);
    // Notify the existing executor(s), or warehouse for a renewed C decision.
    const recipients = input.path === "C"
      ? await rows(tx, sql`SELECT id FROM users WHERE role='warehouse' AND isActive=1`)
      : team ? await rows(tx, sql`SELECT DISTINCT u.id FROM maintenance_team_members m INNER JOIN users u ON u.id=m.userId WHERE m.teamId=${Number(team.teamId)} AND m.isActive=1 AND u.isActive=1`)
      : await rows(tx, sql`SELECT id FROM users WHERE id=${Number(item.assignedToId || 0)} AND isActive=1`);
    for (const recipient of recipients) await tx.execute(sql`INSERT INTO notifications (userId,title,message,type,relatedTicketId) VALUES (${Number(recipient.id)},'تمت مراجعة مسار الصيانة',${note},'ticket_updated',${input.ticketId})`);
    return { success: true };
  });
}
