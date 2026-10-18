import { TRPCError } from "@trpc/server";
import { isBusinessGuardedRole, type BusinessIdentity } from "../../../shared/business-role-policy";

const parentTables = {
  PO_ITEM: ["purchaseOrderItems", "purchaseOrderId", "po"],
  PO_BATCH: ["poPricingBatches", "purchaseOrderId", "po"],
  PO_COMMENT: ["procurementComments", "purchaseOrderId", "po"],
  PO_ITEM_HISTORY: ["purchaseOrderItemHistory", "purchaseOrderId", "po"],
  TICKET_ITEM: ["ticketItems", "ticketId", "ticket"],
  TICKET_TASK: ["ticketTasks", "ticketId", "ticket"],
  TICKET_STATUS_HISTORY: ["ticketStatusHistory", "ticketId", "ticket"],
  TICKET_DEPARTMENT: ["ticketDepartments", "ticketId", "ticket"],
  INSPECTION_RESULT: ["inspectionResults", "ticketId", "ticket"],
  EXTERNAL_MAINTENANCE_JOB: ["externalMaintenanceJobs", "ticketId", "external"],
  NOTIFICATION: ["notifications", "userId", "user"],
} as const;
type ScopeKind = "po" | "ticket" | "external" | "package" | "user";
export interface BusinessTranslationPort {
  parents(type: keyof typeof parentTables, ids: number[]): Promise<Array<{ id: number; parentId: number }>>;
  authorize(user: BusinessIdentity, kind: ScopeKind, id: number): Promise<void>;
}
const denied = () => new TRPCError({ code: "FORBIDDEN", message: "ليس لديك صلاحية لبيانات الترجمة المطلوبة" });
const port: BusinessTranslationPort = {
  async parents(type, ids) {
    const db = await import("../db");
    const schema = await import("../../../drizzle/schema");
    const { inArray } = await import("drizzle-orm");
    const [tableName, parentColumn] = parentTables[type];
    const table = (schema as any)[tableName];
    const connection = await db.getDb();
    if (!connection) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "قاعدة البيانات غير متاحة" });
    return connection.select({ id: table.id, parentId: table[parentColumn] }).from(table).where(inArray(table.id, ids));
  },
  async authorize(user, kind, id) {
    if (kind === "user") { if (id !== user.id) throw denied(); return; }
    const db = await import("../db");
    if (kind === "external" && user.role === "warehouse") return;
    if (kind === "ticket" || kind === "external") {
      const ticket = await db.getTicketById(id);
      if (!ticket) throw denied();
      const { assertTicketReadable } = await import("../../routers/tickets/tickets.access");
      await assertTicketReadable(user, ticket);
      return;
    }
    const { assertCanViewPurchaseOrder, assertCanPerformPOAction, filterVisiblePurchaseOrders } = await import("./guard");
    if (kind === "po") {
      const po = await db.getPurchaseOrderById(id);
      if (!po) throw denied();
      await assertCanViewPurchaseOrder(user, po);
      return;
    }
    assertCanPerformPOAction("viewPurchasePackage", user);
    const orders = await db.getPurchaseOrdersByPackage(id);
    if (!(await filterVisiblePurchaseOrders(user, orders)).length) throw denied();
  },
};
const referenceTypes = new Set(["USER", "SITE", "SECTION", "ASSET", "CENTER_CATEGORY", "ASSET_CATEGORY", "INVENTORY"]);
const legacyReportTypes = new Set(["PM_PLAN", "PM_WORK_ORDER", "PM_RESULT", "PM_SESSION", "PM_CHECKLIST"]);

/** Match the chosen parser, and authorize every parent before reading any text. */
export async function assertBusinessTranslationAccess(user: BusinessIdentity, raw: unknown, mode: "single" | "batch", source = port) {
  if (!isBusinessGuardedRole(user.role)) return;
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const type = String(input.entityType);
  const values = mode === "batch" ? input.entityIds : [input.entityId];
  if (!Array.isArray(values) || values.length > 200 || values.some(id => !Number.isSafeInteger(id) || id <= 0)) throw denied();
  const ids = Array.from(new Set(values)) as number[];
  if (referenceTypes.has(type)) return;
  if (["DELIVERY_DOCUMENT", "RETURN_DOCUMENT"].includes(type) && user.role !== "accountant") return;
  if (legacyReportTypes.has(type) && ["senior_management", "executive_director"].includes(user.role)) return;
  const kind = type === "PO" ? "po" : type === "TICKET" ? "ticket" : type === "PO_PACKAGE" ? "package" : null;
  if (kind) { for (const id of ids) await source.authorize(user, kind, id); return; }
  if (!Object.hasOwn(parentTables, type)) throw denied();
  const tableType = type as keyof typeof parentTables;
  const rows = ids.length ? await source.parents(tableType, ids) : [];
  if (rows.length !== ids.length || ids.some(id => !rows.some(row => row.id === id))) throw denied();
  for (const parentId of Array.from(new Set(rows.map(row => row.parentId)))) await source.authorize(user, parentTables[tableType][2], parentId);
}
