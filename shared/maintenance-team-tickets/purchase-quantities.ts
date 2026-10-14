import { TeamTicketError } from "./model";

export const MAX_TICKET_PURCHASE_QUANTITY = 2_147_483_647;
export function validWarehouseExtra(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_TICKET_PURCHASE_QUANTITY
  );
}

export function ticketPurchaseQuantities(
  technicianQuantity: number,
  ticketPurchaseQuantity: number,
  warehouseExtraQuantity = 0
) {
  if (
    !Number.isSafeInteger(technicianQuantity) ||
    technicianQuantity <= 0 ||
    !Number.isSafeInteger(ticketPurchaseQuantity) ||
    ticketPurchaseQuantity <= 0 ||
    ticketPurchaseQuantity > technicianQuantity ||
    !validWarehouseExtra(warehouseExtraQuantity) ||
    ticketPurchaseQuantity + warehouseExtraQuantity >
      MAX_TICKET_PURCHASE_QUANTITY
  )
    throw new TeamTicketError(
      "INVALID",
      "كمية إضافة المستودع يجب أن تكون عددًا صحيحًا غير سالب، والإجمالي ضمن الحد المسموح"
    );
  return {
    technicianQuantity,
    ticketPurchaseQuantity,
    warehouseExtraQuantity,
    purchaseTotalQuantity: ticketPurchaseQuantity + warehouseExtraQuantity,
  };
}

/** Readable, server-generated breakdown in the existing PO/item notes. */
export function ticketPurchaseBreakdown(
  q: ReturnType<typeof ticketPurchaseQuantities>,
  unit: string
): string {
  return `كمية الفني المطلوبة: ${q.technicianQuantity} ${unit}؛ كمية الشراء للتذكرة: ${q.ticketPurchaseQuantity} ${unit}؛ إضافة المستودع للتخزين: ${q.warehouseExtraQuantity} ${unit}؛ إجمالي طلب الشراء: ${q.purchaseTotalQuantity} ${unit}`;
}
