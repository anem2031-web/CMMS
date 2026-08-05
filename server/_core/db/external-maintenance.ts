import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import {
  assets,
  externalMaintenanceJobs,
  purchaseOrderItems,
  purchaseOrders,
  ticketStatusHistory,
  tickets,
  users,
} from "../../../drizzle/schema";
import { getDb, withTransaction } from "./client";
import { getNextPONumber } from "./purchase";

export type ExternalMaintenanceJobStatus =
  | "waiting_warehouse_preparation"
  | "waiting_gate_exit"
  | "purchase_cycle"
  | "waiting_gate_entry"
  | "waiting_warehouse_receipt"
  | "waiting_technician_handover"
  | "delivered_for_reinstall"
  | "reinstall_in_progress"
  | "ready_for_closure"
  | "closed";

function documentNumber(prefix: "OUT" | "RET" | "HND", jobId: number) {
  const year = new Date().getFullYear();
  return `EXT-${prefix}-${year}-${String(jobId).padStart(5, "0")}`;
}

export async function getExternalMaintenanceJobById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(externalMaintenanceJobs)
    .where(eq(externalMaintenanceJobs.id, id)).limit(1);
  return rows[0] || null;
}

export async function getExternalMaintenanceJobByTicketId(ticketId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(externalMaintenanceJobs)
    .where(eq(externalMaintenanceJobs.ticketId, ticketId)).limit(1);
  return rows[0] || null;
}

export async function getExternalMaintenanceJobByPurchaseOrderId(purchaseOrderId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(externalMaintenanceJobs)
    .where(eq(externalMaintenanceJobs.purchaseOrderId, purchaseOrderId)).limit(1);
  return rows[0] || null;
}

export async function updateExternalMaintenanceJob(id: number, data: Record<string, any>, tx?: any) {
  const db = tx || await getDb();
  if (!db) return;
  await db.update(externalMaintenanceJobs).set(data as any)
    .where(eq(externalMaintenanceJobs.id, id));
}

export async function updateExternalMaintenanceJobByTicketId(ticketId: number, data: Record<string, any>, tx?: any) {
  const db = tx || await getDb();
  if (!db) return;
  await db.update(externalMaintenanceJobs).set(data as any)
    .where(eq(externalMaintenanceJobs.ticketId, ticketId));
}

export async function listExternalMaintenanceJobs(statuses?: ExternalMaintenanceJobStatus[]) {
  const db = await getDb();
  if (!db) return [];

  const assigned = alias(users, "externalAssignedTechnician");
  const delegate = alias(users, "externalDelegate");
  const actualRecipient = alias(users, "externalActualRecipient");
  const preparedBy = alias(users, "externalPreparedBy");
  const gateExitBy = alias(users, "externalGateExitBy");
  const gateEntryBy = alias(users, "externalGateEntryBy");
  const warehouseReceivedBy = alias(users, "externalWarehouseReceivedBy");
  const handoverBy = alias(users, "externalHandoverBy");

  const where = statuses?.length
    ? inArray(externalMaintenanceJobs.status, statuses as any[])
    : undefined;

  return db.select({
    job: externalMaintenanceJobs,
    ticketNumber: tickets.ticketNumber,
    ticketTitle: tickets.title,
    ticketStatus: tickets.status,
    ticketAssignedToId: tickets.assignedToId,
    ticketAssetId: tickets.assetId,
    assetRegisteredName: assets.name,
    assignedTechnicianName: assigned.name,
    delegateName: delegate.name,
    actualRecipientName: actualRecipient.name,
    warehousePreparedByName: preparedBy.name,
    gateExitApprovedByName: gateExitBy.name,
    gateEntryApprovedByName: gateEntryBy.name,
    warehouseReceivedByName: warehouseReceivedBy.name,
    handoverByName: handoverBy.name,
    poNumber: purchaseOrders.poNumber,
    purchaseOrderStatus: purchaseOrders.status,
  })
    .from(externalMaintenanceJobs)
    .innerJoin(tickets, eq(externalMaintenanceJobs.ticketId, tickets.id))
    .leftJoin(assets, eq(tickets.assetId, assets.id))
    .leftJoin(assigned, eq(tickets.assignedToId, assigned.id))
    .leftJoin(delegate, eq(externalMaintenanceJobs.delegateId, delegate.id))
    .leftJoin(actualRecipient, eq(externalMaintenanceJobs.actualRecipientId, actualRecipient.id))
    .leftJoin(preparedBy, eq(externalMaintenanceJobs.warehousePreparedById, preparedBy.id))
    .leftJoin(gateExitBy, eq(externalMaintenanceJobs.gateExitApprovedById, gateExitBy.id))
    .leftJoin(gateEntryBy, eq(externalMaintenanceJobs.gateEntryApprovedById, gateEntryBy.id))
    .leftJoin(warehouseReceivedBy, eq(externalMaintenanceJobs.warehouseReceivedById, warehouseReceivedBy.id))
    .leftJoin(handoverBy, eq(externalMaintenanceJobs.handoverById, handoverBy.id))
    .leftJoin(purchaseOrders, eq(externalMaintenanceJobs.purchaseOrderId, purchaseOrders.id))
    .where(where)
    .orderBy(desc(externalMaintenanceJobs.updatedAt));
}

export async function listPathCTicketsWaitingWarehousePreparation() {
  const db = await getDb();
  if (!db) return [];
  const assigned = alias(users, "pathCAssignedTechnician");
  return db.select({
    ticketId: tickets.id,
    ticketNumber: tickets.ticketNumber,
    ticketTitle: tickets.title,
    ticketStatus: tickets.status,
    assetId: tickets.assetId,
    assetName: assets.name,
    assetPhotoUrl: assets.photoUrl,
    assignedTechnicianId: tickets.assignedToId,
    assignedTechnicianName: assigned.name,
    createdAt: tickets.createdAt,
  })
    .from(tickets)
    .leftJoin(assets, eq(tickets.assetId, assets.id))
    .leftJoin(assigned, eq(tickets.assignedToId, assigned.id))
    .leftJoin(externalMaintenanceJobs, eq(externalMaintenanceJobs.ticketId, tickets.id))
    .where(and(
      eq(tickets.maintenancePath, "C"),
      eq(tickets.status, "work_approved"),
      isNull(externalMaintenanceJobs.id),
    ))
    .orderBy(desc(tickets.updatedAt));
}

export async function prepareExternalMaintenanceJob(input: {
  ticketId: number;
  assetName: string;
  assetBeforePhotoUrl: string;
  assetBeforeCondition: string;
  delegateId: number;
  warehousePreparedById: number;
  warehouseNotes?: string;
}) {
  return withTransaction(async (tx) => {
    const existing = await tx.select({ id: externalMaintenanceJobs.id })
      .from(externalMaintenanceJobs)
      .where(eq(externalMaintenanceJobs.ticketId, input.ticketId))
      .limit(1);
    if (existing.length) throw new Error("EXTERNAL_JOB_EXISTS");

    const result = await tx.insert(externalMaintenanceJobs).values({
      ticketId: input.ticketId,
      status: "waiting_gate_exit",
      assetName: input.assetName,
      assetBeforePhotoUrl: input.assetBeforePhotoUrl,
      assetBeforeCondition: input.assetBeforeCondition,
      delegateId: input.delegateId,
      warehousePreparedById: input.warehousePreparedById,
      warehousePreparedAt: new Date(),
      warehouseNotes: input.warehouseNotes,
    } as any);
    const jobId = Number(result[0].insertId);
    const exitDocumentNumber = documentNumber("OUT", jobId);
    await tx.update(externalMaintenanceJobs)
      .set({ exitDocumentNumber } as any)
      .where(eq(externalMaintenanceJobs.id, jobId));
    await tx.insert(ticketStatusHistory).values({
      ticketId: input.ticketId,
      fromStatus: "work_approved",
      toStatus: "work_approved",
      changedById: input.warehousePreparedById,
      notes: `جهز المستودع الأصل للصيانة الخارجية وأصدر وثيقة الخروج ${exitDocumentNumber}`,
    } as any);
    return { jobId, exitDocumentNumber };
  });
}

export async function approveExternalMaintenanceGateExit(input: {
  jobId: number;
  gateUserId: number;
  carrierName: string;
  notes?: string;
}) {
  const poNumber = await getNextPONumber();
  return withTransaction(async (tx) => {
    const rows = await tx.select().from(externalMaintenanceJobs)
      .where(eq(externalMaintenanceJobs.id, input.jobId)).limit(1);
    const job = rows[0];
    if (!job) throw new Error("EXTERNAL_JOB_NOT_FOUND");
    if (job.status !== "waiting_gate_exit") throw new Error("EXTERNAL_JOB_INVALID_EXIT_STAGE");
    if (!job.delegateId) throw new Error("EXTERNAL_JOB_DELEGATE_REQUIRED");

    const ticketRows = await tx.select().from(tickets)
      .where(eq(tickets.id, job.ticketId)).limit(1);
    const ticket = ticketRows[0];
    if (!ticket || ticket.maintenancePath !== "C" || ticket.status !== "work_approved") {
      throw new Error("EXTERNAL_TICKET_INVALID_EXIT_STAGE");
    }

    const poResult = await tx.insert(purchaseOrders).values({
      poNumber,
      ticketId: ticket.id,
      requestedById: job.warehousePreparedById || input.gateUserId,
      status: "pending_estimate",
      notes: `صيانة خارجية للأصل: ${job.assetName || ticket.title}`,
      submittedAt: new Date(),
    } as any);
    const purchaseOrderId = Number(poResult[0].insertId);

    await tx.insert(purchaseOrderItems).values({
      purchaseOrderId,
      itemName: `صيانة خارجية: ${job.assetName || ticket.title}`,
      description: job.assetBeforeCondition || ticket.description || undefined,
      quantity: 1,
      unit: "خدمة",
      photoUrl: job.assetBeforePhotoUrl || ticket.beforePhotoUrl || undefined,
      notes: job.warehouseNotes || undefined,
      delegateId: job.delegateId,
      status: "pending",
    } as any);

    const now = new Date();
    await tx.update(externalMaintenanceJobs).set({
      status: "purchase_cycle",
      gateExitApprovedById: input.gateUserId,
      gateExitApprovedAt: now,
      gateExitCarrierName: input.carrierName,
      gateExitNotes: input.notes,
      purchaseOrderId,
    } as any).where(eq(externalMaintenanceJobs.id, job.id));

    await tx.update(tickets).set({
      status: "out_for_repair",
      gateExitApprovedById: input.gateUserId,
      gateExitApprovedAt: now,
    } as any).where(eq(tickets.id, ticket.id));

    await tx.insert(ticketStatusHistory).values({
      ticketId: ticket.id,
      fromStatus: ticket.status,
      toStatus: "out_for_repair",
      changedById: input.gateUserId,
      notes: `وافقت الحراسة على خروج الأصل. حامل الأصل: ${input.carrierName}. تم إنشاء دورة الصيانة الخارجية ${poNumber}`,
    } as any);

    return { job, ticket, purchaseOrderId, poNumber };
  });
}

export async function approveExternalMaintenanceGateEntry(input: {
  jobId: number;
  gateUserId: number;
  carrierName: string;
  notes?: string;
}) {
  return withTransaction(async (tx) => {
    const rows = await tx.select().from(externalMaintenanceJobs)
      .where(eq(externalMaintenanceJobs.id, input.jobId)).limit(1);
    const job = rows[0];
    if (!job) throw new Error("EXTERNAL_JOB_NOT_FOUND");
    if (job.status !== "waiting_gate_entry") throw new Error("EXTERNAL_JOB_INVALID_ENTRY_STAGE");

    const now = new Date();
    await tx.update(externalMaintenanceJobs).set({
      status: "waiting_warehouse_receipt",
      gateEntryApprovedById: input.gateUserId,
      gateEntryApprovedAt: now,
      gateEntryCarrierName: input.carrierName,
      gateEntryNotes: input.notes,
    } as any).where(eq(externalMaintenanceJobs.id, job.id));

    await tx.update(tickets).set({
      gateEntryApprovedById: input.gateUserId,
      gateEntryApprovedAt: now,
    } as any).where(eq(tickets.id, job.ticketId));

    await tx.insert(ticketStatusHistory).values({
      ticketId: job.ticketId,
      fromStatus: "out_for_repair",
      toStatus: "out_for_repair",
      changedById: input.gateUserId,
      notes: `وافقت الحراسة على دخول الأصل بعد الصيانة الخارجية. معيد الأصل: ${input.carrierName}`,
    } as any);

    return job;
  });
}

export async function receiveExternalMaintenanceAsset(input: {
  jobId: number;
  warehouseUserId: number;
  assetAfterReturnPhotoUrl: string;
  returnCondition: string;
  workshopReportUrl?: string;
  notes?: string;
}) {
  return withTransaction(async (tx) => {
    const rows = await tx.select().from(externalMaintenanceJobs)
      .where(eq(externalMaintenanceJobs.id, input.jobId)).limit(1);
    const job = rows[0];
    if (!job) throw new Error("EXTERNAL_JOB_NOT_FOUND");
    if (job.status !== "waiting_warehouse_receipt") throw new Error("EXTERNAL_JOB_INVALID_RECEIPT_STAGE");
    const returnDocumentNumber = documentNumber("RET", job.id);
    const now = new Date();
    await tx.update(externalMaintenanceJobs).set({
      status: "waiting_technician_handover",
      warehouseReceivedById: input.warehouseUserId,
      warehouseReceivedAt: now,
      assetAfterReturnPhotoUrl: input.assetAfterReturnPhotoUrl,
      returnCondition: input.returnCondition,
      workshopReportUrl: input.workshopReportUrl,
      warehouseReturnNotes: input.notes,
      returnDocumentNumber,
    } as any).where(eq(externalMaintenanceJobs.id, job.id));

    // الصيانة الخارجية تستخدم نفس دلالة دورة B بعد العودة: استلام المستودع
    // ثم تسليم الأصل للمسؤول. لا يظهر بند الخدمة في شاشة استلام البضائع العامة.
    if (job.purchaseOrderId) {
      await tx.update(purchaseOrderItems).set({
        status: "delivered_to_warehouse",
        receivedAt: now,
        receivedById: input.warehouseUserId,
        receivedQuantity: 1,
        warehousePhotoUrl: input.assetAfterReturnPhotoUrl,
      } as any).where(eq(purchaseOrderItems.purchaseOrderId, job.purchaseOrderId));
      await tx.update(purchaseOrders).set({ status: "received" } as any)
        .where(eq(purchaseOrders.id, job.purchaseOrderId));
    }

    await tx.insert(ticketStatusHistory).values({
      ticketId: job.ticketId,
      fromStatus: "out_for_repair",
      toStatus: "out_for_repair",
      changedById: input.warehouseUserId,
      notes: `استلم المستودع الأصل العائد من الصيانة الخارجية وأصدر الوثيقة ${returnDocumentNumber}`,
    } as any);
    return { job, returnDocumentNumber };
  });
}

export async function handoverExternalMaintenanceAsset(input: {
  jobId: number;
  warehouseUserId: number;
  actualRecipientId: number;
  notes?: string;
}) {
  return withTransaction(async (tx) => {
    const rows = await tx.select().from(externalMaintenanceJobs)
      .where(eq(externalMaintenanceJobs.id, input.jobId)).limit(1);
    const job = rows[0];
    if (!job) throw new Error("EXTERNAL_JOB_NOT_FOUND");
    if (job.status !== "waiting_technician_handover") throw new Error("EXTERNAL_JOB_INVALID_HANDOVER_STAGE");

    const ticketRows = await tx.select().from(tickets)
      .where(eq(tickets.id, job.ticketId)).limit(1);
    const ticket = ticketRows[0];
    if (!ticket?.assignedToId) throw new Error("EXTERNAL_TICKET_ASSIGNED_TECHNICIAN_REQUIRED");

    const handoverDocumentNumber = documentNumber("HND", job.id);
    const now = new Date();
    await tx.update(externalMaintenanceJobs).set({
      status: "delivered_for_reinstall",
      assignedTechnicianId: ticket.assignedToId,
      actualRecipientId: input.actualRecipientId,
      handoverById: input.warehouseUserId,
      handoverAt: now,
      handoverNotes: input.notes,
      handoverDocumentNumber,
    } as any).where(eq(externalMaintenanceJobs.id, job.id));

    if (job.purchaseOrderId) {
      await tx.update(purchaseOrderItems).set({
        status: "delivered_to_requester",
        deliveredAt: now,
        deliveredById: input.warehouseUserId,
        deliveredToId: input.actualRecipientId,
        deliveredQuantity: 1,
      } as any).where(eq(purchaseOrderItems.purchaseOrderId, job.purchaseOrderId));
    }

    await tx.update(tickets).set({ status: "received_warehouse" } as any)
      .where(eq(tickets.id, ticket.id));
    await tx.insert(ticketStatusHistory).values({
      ticketId: ticket.id,
      fromStatus: ticket.status,
      toStatus: "received_warehouse",
      changedById: input.warehouseUserId,
      notes: "استلم المستودع الأصل العائد ثم سلّمه للمسؤول لإعادة تركيبه في موقعه",
    } as any);

    return { job, ticket, handoverDocumentNumber };
  });
}
