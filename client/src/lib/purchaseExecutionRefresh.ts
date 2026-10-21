type ExecutionResult = {
  itemId: number;
  purchaseOrderId: number;
  itemStatus: "purchased" | "delivered_to_warehouse";
  purchaseOrderStatus?: string;
};

export const purchaseRefreshNotice = (language: string) => language === "ar"
  ? "تم الحفظ، لكن تعذر تحديث بعض القوائم. حدّث البيانات دون تكرار الحفظ."
  : language === "ur" ? "محفوظ ہو گیا، مگر کچھ فہرستیں تازہ نہیں ہو سکیں۔ دوبارہ محفوظ کیے بغیر تازہ کریں۔"
  : "Saved, but some lists could not refresh. Refresh the data without saving again.";

/** Called only after a successful server mutation. Cancel older reads before
 * applying the acknowledged result, then revalidate all affected views. This is
 * display state, never a permission snapshot or a substitute for server guards.
 */
export async function refreshPurchaseExecution(utils: any, result: ExecutionResult, savedFields: Record<string, unknown>) {
  const po = utils.purchaseOrders;
  const detail = { id: result.purchaseOrderId };
  const cycles = [po.pendingPurchaseItems, po.pendingWarehouseItems, po.pendingDeliveryItems];
  const cancelled = await Promise.allSettled([po.getById.cancel(detail), po.myItems.cancel(), ...cycles.map(query => query.cancel())]);
  if (cancelled.some(result => result.status === "rejected")) return false;
  const updateItem = (item: any) => item.id === result.itemId
    ? { ...item, ...savedFields, status: result.itemStatus } : item;
  po.getById.setData(detail, (old: any) => old ? {
    ...old,
    status: result.purchaseOrderStatus || old.status,
    items: old.items?.map(updateItem),
  } : old);
  po.myItems.setData(undefined, (old: any[] | undefined) => old?.map(updateItem));
  // Remove completed actions immediately. Only move rows already visible to
  // this actor; server revalidation supplies any newly visible rows.
  const source = result.itemStatus === "purchased" ? po.pendingPurchaseItems : po.pendingWarehouseItems;
  const target = result.itemStatus === "purchased" ? po.pendingWarehouseItems : po.pendingDeliveryItems;
  const existing = source.getData()?.find((item: any) => item.id === result.itemId);
  source.setData(undefined, (old: any[] | undefined) => old?.filter(item => item.id !== result.itemId));
  if (existing) target.setData(undefined, (old: any[] | undefined) => old
    ? [...old.filter(item => item.id !== result.itemId), updateItem(existing)] : old);

  // Refresh failures must not turn an already committed write into a failed
  // mutation (which would invite a duplicate click). Keep the acknowledged UI.
  const refreshed = await Promise.allSettled([
    po.getById.invalidate(detail), ...cycles.map(query => query.invalidate()),
    po.list.invalidate(), po.actionableForMe.invalidate(), po.actionableItemsForMe.invalidate(),
    po.supplyTracking.invalidate(), po.myItems.invalidate(),
    utils.purchasePackages.getById.invalidate(), utils.purchasePackages.cards.invalidate(),
  ]);
  return refreshed.every(result => result.status === "fulfilled");
}
