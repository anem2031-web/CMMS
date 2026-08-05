import { TRPCError } from "@trpc/server";
import { APP_ROLE } from "@shared/roles";
import {
  ACTIVE_PATH_B_PURCHASE_ORDER_STATUSES,
  derivePathBTicketPurchaseStatus,
} from "@shared/pathBPurchaseWorkflow";
import * as db from "../../_core/db";
import { assertTicketWorkflowManageable } from "../tickets/tickets.access";

export const PATH_B_TICKET_PURCHASE_CREATOR_ROLES = new Set<string>([
  APP_ROLE.MAINTENANCE_MANAGER,
  APP_ROLE.GENERAL_MAINTENANCE_MANAGER,
  APP_ROLE.CONSTRUCTION_PROCUREMENT_MANAGER,
  APP_ROLE.ADMIN,
  APP_ROLE.OWNER,
]);

const TERMINAL_TICKET_STATUSES = new Set<string>([
  "in_progress",
  "ready_for_closure",
  "repaired",
  "verified",
  "closed",
  "requester_confirmed",
]);

const TERMINAL_ITEM_STATUSES = new Set<string>(["cancelled", "rejected"]);
export interface TicketPurchaseUser {
  id: number;
  role: string;
}

export interface AssertTicketPurchaseOptions {
  currentPurchaseOrderId?: number;
  submittingExistingDraft?: boolean;
}

/**
 * Ticket-linked purchase orders are a Path B workflow action, not a generic
 * protected action. Standalone purchase orders remain governed by the normal
 * purchase-order authorization policy.
 */
export async function assertCanCreateTicketLinkedPurchaseOrder(
  user: TicketPurchaseUser,
  ticketId?: number,
  options: AssertTicketPurchaseOptions = {},
): Promise<any | null> {
  if (!ticketId) return null;

  const ticket = await db.getTicketById(ticketId);
  if (!ticket) {
    throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ المرتبط غير موجود" });
  }

  if (!PATH_B_TICKET_PURCHASE_CREATOR_ROLES.has(user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "إنشاء طلب شراء مرتبط ببلاغ متاح فقط لمديري الصيانة ومدير الإنشاءات والمشتريات والإدارة والمالك",
    });
  }

  assertTicketWorkflowManageable(user, ticket as any);

  if (ticket.maintenancePath !== "B") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "لا يمكن إنشاء طلب شراء مرتبط إلا لبلاغ تم اعتماد المسار B له",
    });
  }

  const allowedStatuses = options.submittingExistingDraft
    ? new Set(["work_approved", "needs_purchase"])
    : new Set(["work_approved"]);
  if (!allowedStatuses.has(ticket.status)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `لا يمكن إنشاء طلب شراء جديد في حالة البلاغ الحالية: ${ticket.status}`,
    });
  }

  const linkedOrders = await db.getPurchaseOrdersByTicketId(ticketId);
  const conflictingOrder = linkedOrders.find((po: any) =>
    po.id !== options.currentPurchaseOrderId && ACTIVE_PATH_B_PURCHASE_ORDER_STATUSES.has(po.status)
  );
  if (conflictingOrder) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `يوجد طلب شراء نشط مرتبط بهذا البلاغ بالفعل (${conflictingOrder.poNumber || conflictingOrder.id})`,
    });
  }

  return ticket;
}

/**
 * Recomputes the Path B ticket stage from all linked purchase orders. Final or
 * repair-stage tickets are immutable here, so a late PO update cannot reopen a
 * completed ticket.
 */
export async function syncPathBTicketFromTicketId(
  ticketId: number,
  actorId: number,
  notes = "مزامنة حالة البلاغ مع دورة طلب الشراء",
): Promise<void> {
  const ticket = await db.getTicketById(ticketId);
  if (!ticket || ticket.maintenancePath !== "B") return;
  if (TERMINAL_TICKET_STATUSES.has(ticket.status)) return;

  const linkedOrders = await db.getPurchaseOrdersByTicketId(ticketId);
  const allItems = (
    await Promise.all(linkedOrders.map((linked: any) => db.getPOItems(linked.id)))
  ).flat();

  const nextStatus = derivePathBTicketPurchaseStatus({
    purchaseOrders: linkedOrders.map((linked: any) => ({ id: linked.id, status: linked.status })),
    items: allItems.map((item: any) => ({ purchaseOrderId: item.purchaseOrderId, status: item.status })),
  });

  if (nextStatus === ticket.status) return;
  await db.updateTicket(ticket.id, { status: nextStatus });
  await db.addTicketStatusHistory({
    ticketId: ticket.id,
    fromStatus: ticket.status,
    toStatus: nextStatus,
    changedById: actorId,
    notes,
  });
}

export async function syncPathBTicketFromPurchaseOrder(
  purchaseOrderId: number,
  actorId: number,
  notes = "مزامنة حالة البلاغ مع دورة طلب الشراء",
): Promise<void> {
  const po = await db.getPurchaseOrderById(purchaseOrderId);
  if (!po?.ticketId) return;
  await syncPathBTicketFromTicketId(po.ticketId, actorId, notes);
}

export async function assertPathBMaterialsDeliveredToTechnician(ticketId: number): Promise<void> {
  const ticket = await db.getTicketById(ticketId);
  if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "البلاغ غير موجود" });
  if (ticket.maintenancePath !== "B") return;

  const linkedOrders = await db.getPurchaseOrdersByTicketId(ticketId);
  const activeOrders = linkedOrders.filter((po: any) => ACTIVE_PATH_B_PURCHASE_ORDER_STATUSES.has(po.status));
  if (activeOrders.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "لا يوجد طلب شراء نشط مرتبط بالبلاغ" });
  }

  const allItems = (
    await Promise.all(activeOrders.map((po: any) => db.getPOItems(po.id)))
  ).flat().filter((item: any) => !TERMINAL_ITEM_STATUSES.has(item.status));

  if (allItems.length === 0 || !allItems.every((item: any) => item.status === "delivered_to_requester")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "لا يمكن بدء إصلاح المسار B قبل تسليم جميع المواد الفعالة إلى الفني فعليًا",
    });
  }
}
