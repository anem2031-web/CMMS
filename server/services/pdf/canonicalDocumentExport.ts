import { TRPCError } from "@trpc/server";

const inventoryTypes = ["receipt", "delivery", "warehouse_issue", "return", "disposal", "count", "settlement"] as const;
export type InventoryPdfSource = { type: typeof inventoryTypes[number]; id: number };
type Actor = { id: number; role: string; preferredLanguage?: string | null };
export type CanonicalPdfPort = (source: InventoryPdfSource) => Promise<{ html: string; filename: string }>;

/** A source label attached to arbitrary HTML is not authorization. Approvers
 * can only export unrelated inventory documents rebuilt from authorized data. */
export async function resolveDocumentPdfInput(actor: Actor, body: unknown, canonical: CanonicalPdfPort) {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (["accountant", "senior_management"].includes(actor.role)) {
    const source = input.source && typeof input.source === "object" ? input.source as Record<string, unknown> : {};
    if (!inventoryTypes.includes(source.type as any) || !Number.isSafeInteger(source.id) || Number(source.id) <= 0) {
      throw new TRPCError({ code: "FORBIDDEN", message: "استخدم مستند النظام المعتمد؛ تحويل HTML المباشر غير متاح لهذا الحساب" });
    }
    // Neither the submitted HTML nor its filename enters the trusted renderer.
    return canonical({ type: source.type as InventoryPdfSource["type"], id: Number(source.id) });
  }
  if (typeof input.html !== "string" || !input.html) throw new TRPCError({ code: "BAD_REQUEST", message: "الحقل html مطلوب" });
  return { html: input.html, filename: typeof input.filename === "string" ? input.filename : `document-${Date.now()}` };
}

export interface InventoryDocumentCaller {
  warehouseReceipts: { getForPrint(input: { id: number }): Promise<any> };
  deliveryDocuments: { getForPrint(input: { id: number }): Promise<any> };
  warehouseIssueBatches: { getById(input: { id: number }): Promise<any> };
  returnDocuments: { list(): Promise<any[]> };
  disposal: { getById(input: { id: number }): Promise<any> };
  inventoryCount: {
    operationDetails(input: { operationId: number }): Promise<any>;
    settlementDetails(input: { settlementId: number }): Promise<any>;
  };
}
type Renderers = {
  receipt(data: any, language: "ar" | "en" | "ur"): Promise<string>;
  delivery(data: any, language: "ar" | "en" | "ur"): string;
  warehouseIssue(data: any): string;
  return(data: any): Promise<string>;
  disposal(data: any): string;
  count(data: any): string;
  settlement(data: any): string;
};
const notFound = () => new TRPCError({ code: "NOT_FOUND", message: "المستند غير موجود" });

/** The caller is created from the HTTP authenticated identity. Each read runs
 * the original RPC allowlist and document guard before any template executes. */
export async function canonicalInventoryDocument(
  source: InventoryPdfSource, caller: InventoryDocumentCaller, actor: Actor, templates?: Renderers,
) {
  const language = actor.preferredLanguage === "en" || actor.preferredLanguage === "ur" ? actor.preferredLanguage : "ar";
  // Load only the requested existing template, after the document is authorized.
  const render = async (name: keyof Renderers, data: any): Promise<string> => {
    if (templates) return (templates[name] as any)(data, language);
    switch (name) {
      case "receipt": return (await import("../../../client/src/lib/printReceiptDocument")).buildReceiptHtml(data, language);
      case "delivery": return (await import("../../../client/src/lib/printDeliveryDocument")).buildDeliveryReceiptHtml(data, language);
      case "warehouseIssue": return (await import("../../../client/src/lib/printWarehouseIssueDocument")).buildWarehouseIssueHtml(data);
      case "return": return (await import("../../../client/src/lib/printReturnDocument")).buildReturnDocumentHtml(data);
      case "disposal": return (await import("../../../client/src/lib/printInventoryOperationDocuments")).buildDisposalHtml(data);
      case "count": return (await import("../../../client/src/lib/printInventoryOperationDocuments")).buildCountHtml(data);
      case "settlement": return (await import("../../../client/src/lib/printInventoryOperationDocuments")).buildSettlementHtml(data);
    }
  };
  let data: any, name: keyof Renderers, filename: unknown;
  switch (source.type) {
    case "receipt":
      data = await caller.warehouseReceipts.getForPrint({ id: source.id });
      name = "receipt"; filename = data?.receiptNumber; break;
    case "delivery": {
      const row = await caller.deliveryDocuments.getForPrint({ id: source.id });
      if (!row) throw notFound();
      data = { itemName: row.itemName, quantity: row.quantity, unit: row.unit || "",
        supplierName: row.supplierName ?? undefined, actualUnitCost: row.actualUnitCost ?? undefined,
        warehousePhotoUrl: row.warehousePhotoUrl ?? undefined, deliveredByName: row.deliveredByName,
        deliveredBySignature: row.deliveredBySignature, deliveredToName: row.deliveredToName,
        notes: row.notes ?? undefined, poNumber: row.poNumber ?? undefined, deliveryNumber: row.deliveryNumber,
        deliveredAt: row.createdAt ? new Date(row.createdAt).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" }) : "—",
        itemId: row.poItemId, initialPrintCount: row.printCount };
      name = "delivery"; filename = row.deliveryNumber; break;
    }
    case "warehouse_issue":
      data = await caller.warehouseIssueBatches.getById({ id: source.id });
      name = "warehouseIssue"; filename = data?.issueNumber; break;
    case "return":
      data = (await caller.returnDocuments.list()).find(row => Number(row.id) === source.id);
      name = "return"; filename = data?.returnNumber; break;
    case "disposal":
      data = await caller.disposal.getById({ id: source.id });
      name = "disposal"; filename = data?.operationNumber; break;
    case "count":
      data = await caller.inventoryCount.operationDetails({ operationId: source.id });
      name = "count"; filename = data?.operation?.operationNumber; break;
    case "settlement":
      data = await caller.inventoryCount.settlementDetails({ settlementId: source.id });
      name = "settlement"; filename = data?.settlement?.settlementNumber; break;
    default: throw new TRPCError({ code: "FORBIDDEN", message: "نوع المستند غير مسموح" });
  }
  if (!data || typeof filename !== "string" || !filename) throw notFound();
  return { html: await render(name, data), filename };
}
