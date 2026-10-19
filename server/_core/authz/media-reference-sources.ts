import { TRPCError } from "@trpc/server";
import { getTableColumns, getTableName, isTable, type Column, type Table } from "drizzle-orm";
import type * as DatabaseSchema from "../../../drizzle/schema";

type Schema = typeof DatabaseSchema;
type ColumnName<T extends Table> = Extract<keyof T["_"]["columns"], string>;
type MediaSourceDefinition = {
  [Name in keyof Schema]: Schema[Name] extends Table ? readonly [
    table: Name, kind: string, parent: ColumnName<Schema[Name]>,
    owner: ColumnName<Schema[Name]> | null,
    files: readonly [ColumnName<Schema[Name]>, ...ColumnName<Schema[Name]>[]],
    entity?: ColumnName<Schema[Name]>,
  ] : never;
}[keyof Schema];

// Only persisted columns belong here. catalogItems.primaryImageUrl is a derived
// API response field; current catalog pictures are attachments, and historical
// catalogItemImages remain readable through their existing reference rule.
export const MEDIA_REFERENCE_SOURCES = [
  ["attachments", "attachment", "entityId", "uploadedById", ["fileKey", "fileUrl"], "entityType"],
  ["tickets", "ticket", "id", "reportedById", ["beforePhotoUrl", "afterPhotoUrl"]],
  ["ticketItems", "ticket", "ticketId", null, ["afterPhotoUrl"]],
  ["purchaseOrderItems", "po", "purchaseOrderId", null, ["photoUrl", "photoUrls", "invoicePhotoUrl", "purchasedPhotoUrl", "warehousePhotoUrl"]],
  ["ticketConfirmations", "ticket", "ticketId", null, ["photoUrls"]],
  ["warehouseReceipts", "receipt", "id", null, ["invoicePhotoUrl", "goodsPhotoUrl"]],
  ["deliveryDocuments", "delivery", "id", "deliveredToId", ["warehousePhotoUrl", "pdfUrl", "pdfKey", "deliveredBySignatureSnapshot"]],
  ["externalMaintenanceJobs", "external", "ticketId", null, ["assetBeforePhotoUrl", "assetAfterReturnPhotoUrl", "workshopReportUrl"]],
  ["assets", "reference", "id", null, ["photoUrl"]],
  ["catalogItemImages", "reference", "itemId", null, ["imageUrl"]],
  ["catalogKnowledge", "reference", "itemId", null, ["documentUrl"]],
  ["catalogSupplierCandidates", "warehouse", "id", null, ["invoicePhotoUrl"]],
  ["users", "signature", "id", "id", ["signatureUrl"]],
  ["backups", "admin", "id", null, ["fileKey", "fileUrl"]],
  ["inventoryTransactions", "inventory", "id", null, ["documentUrl"]],
  ["disposalItems", "inventory", "id", null, ["attachments"]],
  ["ocrJobs", "warehouse", "id", "createdById", ["imageUrl"]],
  ["pmWorkOrders", "pm", "id", "assignedToId", ["completionPhotoUrl"]],
  ["pmExecutionResults", "pm", "workOrderId", null, ["photoUrl"]],
  ["constructionProjects", "construction", "id", null, ["coverImageUrl", "attachments"]],
  ["constructionPhases", "construction", "projectId", null, ["attachments"]],
  ["constructionActivities", "construction", "projectId", null, ["attachments"]],
  ["constructionTasks", "construction", "projectId", null, ["attachments"]],
  ["constructionDailyReports", "construction", "projectId", null, ["photoUrls"]],
  ["constructionSafetyLogs", "construction", "projectId", null, ["photoUrls"]],
  ["constructionChangeOrders", "construction", "projectId", null, ["attachmentUrls"]],
  ["constructionTaskComments", "construction", "projectId", null, ["attachmentUrls"]],
  ["constructionFieldValues", "construction_task", "taskId", null, ["value"]],
] as const satisfies readonly MediaSourceDefinition[];

export type ResolvedMediaSource = {
  table: Table; tableName: string; kind: string; id: Column; parent: Column;
  owner: Column | null; files: readonly Column[]; entity: Column | null;
};

export function mediaReferenceUnavailable(detail: string) {
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "تعذر التحقق من صلاحية الملف",
    cause: new Error(`[Media access] ${detail}`),
  });
}

/** Validate the complete registry before looking at database availability.
 * A programming error must never look like an unlinked uploader-owned file. */
export function resolveMediaReferenceSources(
  schema: Schema,
  definitions: readonly MediaSourceDefinition[] = MEDIA_REFERENCE_SOURCES,
): ResolvedMediaSource[] {
  return definitions.map(([name, kind, parent, owner, files, entity]) => {
    const table = schema[name];
    if (!isTable(table)) throw mediaReferenceUnavailable(`Invalid table: ${name}`);
    const columns: Record<string, Column> = getTableColumns(table);
    const column = (field: string) => {
      const value = columns[field];
      if (!value) throw mediaReferenceUnavailable(`Invalid column: ${name}.${field}`);
      return value;
    };
    return {
      table, tableName: getTableName(table), kind, id: column("id"), parent: column(parent),
      owner: owner ? column(owner) : null, files: files.map(column), entity: entity ? column(entity) : null,
    };
  });
}
