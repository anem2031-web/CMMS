// Browser-only fixtures. No real API, credentials, environment or database imports.
import React, { useState, useSyncExternalStore } from "react";
const listeners = new Set<() => void>(); let version = 0;
const emit = () => { version++; listeners.forEach(fn => fn()); };
export const language = new URLSearchParams(location.search).get("lang") || "ar";
const mode = new URLSearchParams(location.search).get("mode") || "pricing";
export const user = { id: 11, isActive: 1, role: mode === "manager" ? "maintenance_manager" : mode === "warehouse" ? "warehouse" : "delegate" };
const row = (id: number) => ({ id, purchaseOrderId: 100 + id, poNumber: `PR-DEMO-${id}`, itemName: id === 1 ? "فلتر التكييف" : "صمام مياه", categoryName: id === 1 ? "تكييف" : "سباكة", sectionName: id === 1 ? "التشغيل" : "الصيانة", quantity: 2, unit: "حبة", estimatedUnitCost: "25.00", estimatedTotalCost: "50.00", supplierName: "مورد تجريبي" });
const bundle: any = { id: 1, bundleNumber: "DPB-DEMO-000001", delegateName: "مندوب المعاينة", createdAt: "2026-10-17T12:00:00Z", status: "open", revision: 2, effectsDone: 1, items: [row(1),row(2)], total: 100 };
const order: any = { id: 1, orderNumber: "OPR-DEMO-000001", creatorName: "مدير الصيانة", collectorName: "فني المعاينة", siteName: "الموقع التجريبي", sectionName: "قسم التشغيل", reason: "تجهيز الموقع للتشغيل", status: "pending", revision: 0 };
let orderItems: any[] = [{ id: 1, catalogItemId: 55, itemName: "فلتر التكييف", unit: "حبة", quantity: 2, issuedQuantity: 0 }]; const deliveries: any[] = [];
const catalog = [{ id: 55, code: "DEMO-55", nameAr: "فلتر التكييف", nameEn: "AC Filter", unit: "كرتون", isActive: 1 }];
const lot = { inventoryId: 1, linkedItemId: 55, trackingToken: "LOT-DEMO-1", lotCode: "LOT-DEMO-1", lotBalanceQuantity: 20, lotIssueUnitCost: 25, unit: "حبة" };
function data(path: string, input: any) {
  if (path.endsWith(".status")) return { enabled: true };
  if (path === "delegatePricingBundles.list") return [{ ...bundle, itemCount: bundle.items.length }];
  if (path === "delegatePricingBundles.detail") return bundle;
  if (path === "operationalIssues.list") return { enabled: true, orders: [order] };
  if (path === "operationalIssues.detail") return input?.id ? { order, items: orderItems, deliveries, cost: { issued: deliveries.length * 50, returned: 0, net: deliveries.length * 50 } } : undefined;
  if (path === "operationalIssues.itemUnits") return input.catalogItemIds.map((catalogItemId: number) => ({ catalogItemId, unit: "حبة" }));
  if (path === "operationalIssues.choices") return { collectors: [{ id: 22, name: "فني المعاينة" }] };
  if (path === "sites.list") return [{ id: 1, name: "الموقع التجريبي" }];
  if (path === "sections.list") return [{ id: 2, name: "قسم التشغيل", siteId: 1 }];
  if (path === "warehouse.list") return [{ id: 1, nameAr: "المستودع الرئيسي", nameEn: "Main warehouse", isActive: 1 }];
  if (path === "catalog.items.list") return catalog;
  if (path === "catalog.units.list") return [{ id: 1, name: "حبة", nameAr: "حبة", nameEn: "Piece", isActive: 1 }];
  return [];
}
async function mutate(path: string, input: any) {
  if (path === "delegatePricingBundles.remove") { bundle.items = bundle.items.filter((item: any) => item.id !== input.itemId); bundle.total = bundle.items.length * 50; bundle.revision++; }
  if (path === "delegatePricingBundles.send") bundle.status = "sent";
  if (path === "delegatePricingBundles.archive") bundle.status = "archived";
  if (path === "operationalIssues.create") { if (input.items.some((item: any) => item.unit !== "حبة")) throw Error("Expected real stock issue unit"); order.reason = input.reason; orderItems = input.items.map((item: any) => ({ ...item, id: 1, itemName: "فلتر التكييف", unit: "حبة", issuedQuantity: 0 })); }
  if (path === "operationalIssues.approve") { order.status = "approved"; order.revision++; }
  if (path === "operationalIssues.issue") { orderItems[0].issuedQuantity += input.quantity; order.status = "completed"; deliveries.push({ id: 1, deliveryDocumentId: 1, deliveryNumber: "DLV-DEMO-1", lotCode: lot.lotCode, quantity: input.quantity, returnedQuantity: 0 }); }
  emit(); return path === "warehouseIssueBatches.resolveLot" ? lot : { success: true, effectsDone: true };
}
const proxy = (path = ""): any => new Proxy(() => {}, { get(_target, key) {
  if (key === "useUtils") return () => proxy("utils");
  if (key === "invalidate") return async () => emit();
  if (key === "useQuery") return (input: any, opts: any) => {
    useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => version);
    return { data: opts?.enabled === false ? undefined : data(path,input), isLoading: false, isFetching: false, error: null, refetch: async () => emit() };
  };
  if (key === "useMutation") return (opts: any) => { const [pending,setPending] = useState(false); const run = async (input: any) => { setPending(true); try { const result = await mutate(path,input); await opts?.onSuccess?.(result); return result; } catch(error) { opts?.onError?.(error); throw error; } finally { setPending(false); } }; return { isPending: pending, mutate: (input: any) => void run(input), mutateAsync: run }; };
  return proxy(path ? `${path}.${String(key)}` : String(key));
} });
export const trpc = proxy();
