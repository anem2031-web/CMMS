// Isolated browser fixture: no environment, credentials, server or database imports.
import React, { useState, useSyncExternalStore } from "react";
import { OperationalStockPanel } from "../../client/src/pages/operational-issues/OperationalStockPanel";
import { BranchTransferConfirmation } from "../../client/src/components/inventory/BranchTransferConfirmation";
import { Button } from "../../client/src/components/ui/button";
const listeners = new Set<() => void>(); let version = 0;
const emit = () => { version++; listeners.forEach(fn => fn()); };
export const language = new URLSearchParams(location.search).get("lang") || "ar";
const lines = [
  { id: 11, orderId: 1, catalogItemId: 5, itemName: "فلتر تكييف — متوفر في مخزنين", quantity: 5, issuedQuantity: 0, unit: "حبة" },
  { id: 12, orderId: 1, catalogItemId: 6, itemName: "صمام مياه — غير متوفر", quantity: 4, issuedQuantity: 0, unit: "حبة" },
];
const stock: any[] = [
  { itemId: 11, totalQuantity: 5, unit: "حبة", needsReview: false, purchase: null, lots: [
    { inventoryId: 1, warehouseId: 1, warehouseNameAr: "مخزن التكييف", warehouseNameEn: "AC warehouse", lotId: 101, lotCode: "LOT-AC-101", trackingToken: "token-ac", quantity: 3, unit: "حبة", unitCost: 10 },
    { inventoryId: 2, warehouseId: 2, warehouseNameAr: "المستودع الرئيسي", warehouseNameEn: "Main warehouse", lotId: 102, lotCode: "LOT-MAIN-102", trackingToken: "token-main", quantity: 2, unit: "حبة", unitCost: 20 },
  ] },
  { itemId: 12, totalQuantity: 0, unit: "حبة", needsReview: false, purchase: null, lots: [] },
];
const calls: any[] = []; let transferCount = 0;
function useFixture() { useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => version); }
async function mutate(path: string, input: any) {
  if (path === "operationalIssues.issue") {
    const line = lines.find(row => row.id === input.itemId)!; const entry = stock.find(row => row.itemId === input.itemId);
    const lot = entry.lots.find((row: any) => row.trackingToken === input.lotTrackingToken && row.warehouseId === input.warehouseId);
    if (!lot || !Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > Math.min(lot.quantity, line.quantity - line.issuedQuantity)) throw Error("Invalid fixture issue");
    line.issuedQuantity += input.quantity; lot.quantity -= input.quantity; entry.totalQuantity -= input.quantity;
    entry.lots = entry.lots.filter((row: any) => row.quantity > 0);
  } else if (path === "operationalIssues.addToPurchaseDraft") {
    const entry = stock.find(row => row.itemId === input.itemId); if (entry.purchase) return entry.purchase;
    if (entry.totalQuantity !== 0) throw Error("Stock available");
    entry.purchase = { orderItemId: input.itemId, purchaseOrderId: 200, purchaseOrderItemId: 201, poNumber: "DFT-2026-DEMO", status: "draft", itemStatus: "pending", quantity: 4, unit: "حبة", changed: false };
  } else throw Error(`Unexpected fixture mutation: ${path}`);
  calls.push({ path, ...input }); emit(); return { success: true };
}
const proxy = (path = ""): any => new Proxy(() => {}, { get(_target, key) {
  if (key === "useMutation") return () => {
    const [isPending, setPending] = useState(false);
    return { isPending, mutateAsync: async (input: any) => { setPending(true); try { return await mutate(path, input); } finally { setPending(false); } } };
  };
  return proxy(path ? `${path}.${String(key)}` : String(key));
} });
export const trpc = proxy();
export default function Preview() {
  useFixture(); const [open, setOpen] = useState(false);
  return <main className="max-w-5xl mx-auto p-6 space-y-5">
    <p className="rounded-md border p-3 text-sm">اختبار محلي ببيانات تجريبية فقط — دون اتصال بالنظام أو القاعدة</p>
    <h1 className="text-xl font-bold">الصرف التشغيلي — معاينة الرصيد واللوتات</h1>
    {lines.map((line, index) => <OperationalStockPanel key={line.id} line={line} stock={stock[index]} orderId={1} approved canProcess showStock loading={false} procurementReady refresh={async () => emit()} />)}
    <Button variant="outline" onClick={() => setOpen(true)}>تجربة التحويل بين مخزنين فرعيين</Button>
    <BranchTransferConfirmation open={open} onOpenChange={setOpen} sourceName="مخزن التكييف" targetName="مخزن السباكة" onConfirm={() => { transferCount++; emit(); }} />
    <p>عمليات التحويل التجريبية: {transferCount}</p>
    <output className="block rounded-md border p-3 text-xs whitespace-pre-wrap" dir="ltr">{JSON.stringify(calls, null, 2)}</output>
  </main>;
}
