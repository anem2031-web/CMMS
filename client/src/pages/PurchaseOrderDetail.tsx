import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PO_STATUS_LABELS, PO_ITEM_STATUS_LABELS } from "@shared/types";
import {
  ArrowRight, ShoppingCart, CheckCircle2, Clock, DollarSign, Loader2,
  Camera, Package, User, FileText, AlertCircle, Truck, ExternalLink, XCircle
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const PO_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_estimate: "bg-amber-100 text-amber-700",
  pending_accounting: "bg-orange-100 text-orange-700",
  pending_management: "bg-orange-100 text-orange-700",
  approved: "bg-teal-100 text-teal-700",
  partial_purchase: "bg-cyan-100 text-cyan-700",
  purchased: "bg-emerald-100 text-emerald-700",
  received: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-700",
  rejected: "bg-red-100 text-red-700",
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  estimated: "bg-amber-100 text-amber-700",
  approved: "bg-teal-100 text-teal-700",
  purchased: "bg-emerald-100 text-emerald-700",
  received: "bg-green-100 text-green-700",
};

function numberToArabicWords(num: number): string {
  if (num === 0) return "صفر ريال";
  const ones = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
  const tens = ["", "عشرة", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
  const teens = ["عشرة", "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
  const hundreds = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];
  const parts: string[] = [];
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  if (intPart >= 1000000) { const m = Math.floor(intPart / 1000000); parts.push(m === 1 ? "مليون" : m === 2 ? "مليونان" : `${ones[m] || m} ملايين`); }
  const rem = intPart % 1000000;
  if (rem >= 1000) { const t = Math.floor(rem / 1000); if (t === 1) parts.push("ألف"); else if (t === 2) parts.push("ألفان"); else if (t <= 10) parts.push(`${ones[t]} آلاف`); else parts.push(`${t} ألف`); }
  const r = rem % 1000;
  if (r >= 100) parts.push(hundreds[Math.floor(r / 100)]);
  const lastTwo = r % 100;
  if (lastTwo >= 10 && lastTwo <= 19) { parts.push(teens[lastTwo - 10]); }
  else { if (lastTwo % 10 > 0) parts.push(ones[lastTwo % 10]); if (Math.floor(lastTwo / 10) > 0) parts.push(tens[Math.floor(lastTwo / 10)]); }
  let result = parts.join(" و") + " ريال";
  if (decPart > 0) result += ` و${decPart} هللة`;
  return result;
}

export default function PurchaseOrderDetail() {
  const [, params] = useRoute("/purchase-orders/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const poId = parseInt(params?.id || "0");

  const { data: po, isLoading, refetch } = trpc.purchaseOrders.getById.useQuery({ id: poId }, { enabled: !!poId });
  const { data: users } = trpc.users.list.useQuery();

  const estimateMut = trpc.purchaseOrders.estimateCost.useMutation({ onSuccess: () => { toast.success("تم حفظ التسعير التقديري"); refetch(); }, onError: (e) => toast.error(e.message) });
  const approveAccMut = trpc.purchaseOrders.approveAccounting.useMutation({ onSuccess: () => { toast.success("تم اعتماد الحسابات"); refetch(); }, onError: (e) => toast.error(e.message) });
  const approveMgmtMut = trpc.purchaseOrders.approveManagement.useMutation({ onSuccess: () => { toast.success("تم اعتماد الإدارة العليا"); refetch(); }, onError: (e) => toast.error(e.message) });
  const rejectMut = trpc.purchaseOrders.reject.useMutation({ onSuccess: () => { toast.success("تم رفض الطلب"); refetch(); }, onError: (e) => toast.error(e.message) });
  const confirmPurchaseMut = trpc.purchaseOrders.confirmItemPurchase.useMutation({ onSuccess: () => { toast.success("تم تأكيد الشراء"); refetch(); }, onError: (e) => toast.error(e.message) });
  const receiveItemMut = trpc.purchaseOrders.receiveItem.useMutation({ onSuccess: () => { toast.success("تم تأكيد الاستلام"); refetch(); }, onError: (e) => toast.error(e.message) });

  const role = user?.role || "";
  const userId = user?.id;

  const [estimates, setEstimates] = useState<Record<number, string>>({});
  const [rejectReason, setRejectReason] = useState("");
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [itemPhotos, setItemPhotos] = useState<Record<number, { invoice?: string; purchased?: string }>>({});
  const [receiveData, setReceiveData] = useState<Record<number, { cost: string; supplier: string }>>({});

  const isDelegate = role === "delegate";
  const isAccountant = role === "accountant";
  const isManagement = role === "senior_management";
  const isWarehouse = role === "warehouse";

  // Filter items for delegate - only their assigned items
  const myItems = useMemo(() => {
    if (!po?.items) return [];
    if (isDelegate) return po.items.filter((item: any) => item.delegateId === userId);
    return po.items;
  }, [po?.items, isDelegate, userId]);

  // Calculate totals
  const totalEstimated = useMemo(() => myItems.reduce((sum: number, item: any) => sum + (parseFloat(item.estimatedTotalCost || "0")), 0), [myItems]);
  const totalActual = useMemo(() => myItems.reduce((sum: number, item: any) => sum + (parseFloat(item.actualTotalCost || "0")), 0), [myItems]);

  const handleUpload = async (file: File, itemId: number, type: "invoice" | "purchased") => {
    setUploadingItem(`${itemId}-${type}`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setItemPhotos(prev => ({ ...prev, [itemId]: { ...prev[itemId], [type]: data.url } }));
        toast.success("تم رفع الصورة");
      }
    } catch { toast.error("فشل رفع الصورة"); }
    setUploadingItem(null);
  };

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!po) return <div className="text-center py-12 text-muted-foreground">طلب الشراء غير موجود</div>;

  const requestedBy = users?.find((u: any) => u.id === po.requestedById);

  // Workflow steps
  const steps = [
    { key: "draft", label: "مسودة", done: true },
    { key: "pending_estimate", label: "تسعير المندوب", done: !["draft"].includes(po.status) },
    { key: "pending_accounting", label: "اعتماد الحسابات", done: !["draft", "pending_estimate"].includes(po.status) },
    { key: "pending_management", label: "اعتماد الإدارة", done: !["draft", "pending_estimate", "pending_accounting"].includes(po.status) },
    { key: "approved", label: "معتمد", done: ["approved", "partial_purchase", "purchased", "received", "closed"].includes(po.status) },
    { key: "purchased", label: "تم الشراء", done: ["purchased", "received", "closed"].includes(po.status) },
    { key: "received", label: "تم الاستلام", done: ["received", "closed"].includes(po.status) },
  ];

  const purchasedCount = myItems.filter((i: any) => ["purchased", "received"].includes(i.status)).length;
  const pendingCount = myItems.filter((i: any) => !["purchased", "received"].includes(i.status)).length;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/purchase-orders")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-mono text-muted-foreground">{po.poNumber}</span>
            <Badge className={PO_STATUS_COLORS[po.status] || "bg-gray-100 text-gray-700"}>{PO_STATUS_LABELS[po.status] || po.status}</Badge>
            {po.status === "rejected" && <Badge className="bg-red-100 text-red-700">مرفوض</Badge>}
          </div>
          <h1 className="text-xl font-bold mt-1">تفاصيل طلب الشراء</h1>
        </div>
      </div>

      {/* Workflow Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
            {steps.map((step, i) => (
              <div key={step.key} className="flex items-center gap-1 flex-1 min-w-0">
                <div className={`flex items-center gap-1.5 shrink-0 ${step.done ? "text-primary" : "text-muted-foreground/40"}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    po.status === step.key ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1" :
                    step.done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground/40"
                  }`}>
                    {step.done && po.status !== step.key ? "✓" : i + 1}
                  </div>
                  <span className="text-[10px] font-medium whitespace-nowrap hidden sm:inline">{step.label}</span>
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 rounded ${step.done ? "bg-primary/40" : "bg-muted"}`} />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Linked Ticket */}
      {po.ticketId && (
        <Card className="border-teal-200 bg-teal-50/50 cursor-pointer hover:bg-teal-50 transition-colors" onClick={() => setLocation(`/tickets/${po.ticketId}`)}>
          <CardContent className="p-3 flex items-center gap-3">
            <FileText className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-sm font-medium text-teal-800">مرتبط بالبلاغ رقم #{po.ticketId}</span>
            <ExternalLink className="w-3.5 h-3.5 text-teal-600 mr-auto" />
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-3 flex items-center gap-2.5">
          <User className="w-4 h-4 text-muted-foreground shrink-0" />
          <div><p className="text-[10px] text-muted-foreground">أنشأه</p><p className="text-sm font-medium">{requestedBy?.name || "-"}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <div><p className="text-[10px] text-muted-foreground">التاريخ</p><p className="text-sm font-medium">{new Date(po.createdAt).toLocaleDateString("ar-SA")}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2.5">
          <Package className="w-4 h-4 text-muted-foreground shrink-0" />
          <div><p className="text-[10px] text-muted-foreground">الأصناف</p><p className="text-sm font-medium">{myItems.length} صنف</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-3 flex items-center gap-2.5">
          <ShoppingCart className="w-4 h-4 text-muted-foreground shrink-0" />
          <div><p className="text-[10px] text-muted-foreground">تم شراؤه</p><p className="text-sm font-medium">{purchasedCount} / {myItems.length}</p></div>
        </CardContent></Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            {isDelegate ? "الأصناف المسندة إليك" : "أصناف طلب الشراء"}
          </CardTitle>
          {isDelegate && pendingCount > 0 && (
            <p className="text-xs text-amber-600 mt-1">لديك {pendingCount} صنف بانتظار إجراءك</p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {myItems.map((item: any) => {
            const delegate = users?.find((u: any) => u.id === item.delegateId);
            const isMyItem = isDelegate && item.delegateId === userId;

            return (
              <div key={item.id} className="border rounded-xl p-4 space-y-3 hover:border-primary/20 transition-colors">
                {/* Item Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-medium text-sm">{item.itemName}</h4>
                      <Badge className={`text-[10px] ${ITEM_STATUS_COLORS[item.status] || "bg-gray-100 text-gray-700"}`}>
                        {PO_ITEM_STATUS_LABELS[item.status] || item.status}
                      </Badge>
                    </div>
                    {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span>الكمية: <strong>{item.quantity} {item.unit || "قطعة"}</strong></span>
                      {delegate && <span>المندوب: <strong>{delegate.name}</strong></span>}
                    </div>
                    {item.notes && <p className="text-xs text-muted-foreground mt-1.5 bg-muted/50 rounded-lg p-2">{item.notes}</p>}
                  </div>
                  {item.photoUrl && <img src={item.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border shrink-0" />}
                </div>

                {/* Costs Display */}
                {(item.estimatedUnitCost || item.actualUnitCost) && (
                  <div className="bg-muted/30 rounded-lg p-2.5 space-y-1">
                    {item.estimatedUnitCost && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">تقديري:</span>
                        <span className="font-medium">{Number(item.estimatedUnitCost).toLocaleString("ar-SA")} ر.س × {item.quantity} = <strong>{parseFloat(item.estimatedTotalCost || "0").toLocaleString("ar-SA")} ر.س</strong></span>
                      </div>
                    )}
                    {item.actualUnitCost && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-emerald-600">فعلي:</span>
                        <span className="font-medium text-emerald-700">{Number(item.actualUnitCost).toLocaleString("ar-SA")} ر.س × {item.quantity} = <strong>{parseFloat(item.actualTotalCost || "0").toLocaleString("ar-SA")} ر.س</strong></span>
                      </div>
                    )}
                    {item.supplierName && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-muted">
                        <span className="text-muted-foreground">المورد:</span>
                        <span className="font-medium">{item.supplierName}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Photos Display */}
                {(item.invoicePhotoUrl || item.purchasedPhotoUrl) && (
                  <div className="flex gap-3 border-t pt-2">
                    {item.invoicePhotoUrl && (
                      <a href={item.invoicePhotoUrl} target="_blank" rel="noopener" className="group">
                        <p className="text-[10px] text-muted-foreground mb-1">صورة الفاتورة</p>
                        <img src={item.invoicePhotoUrl} className="w-20 h-20 rounded-lg object-cover border group-hover:ring-2 ring-primary/30 transition-all" />
                      </a>
                    )}
                    {item.purchasedPhotoUrl && (
                      <a href={item.purchasedPhotoUrl} target="_blank" rel="noopener" className="group">
                        <p className="text-[10px] text-muted-foreground mb-1">صورة القطعة</p>
                        <img src={item.purchasedPhotoUrl} className="w-20 h-20 rounded-lg object-cover border group-hover:ring-2 ring-primary/30 transition-all" />
                      </a>
                    )}
                  </div>
                )}

                {/* === DELEGATE: Estimate Cost === */}
                {isMyItem && item.status === "pending" && po.status === "pending_estimate" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> أدخل التكلفة التقديرية لهذا الصنف:
                    </p>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-[11px] text-amber-700">سعر الوحدة التقديري (ر.س)</Label>
                        <Input type="number" placeholder="0.00" value={estimates[item.id] || ""} onChange={e => setEstimates(p => ({ ...p, [item.id]: e.target.value }))} className="bg-white" />
                      </div>
                      {estimates[item.id] && parseFloat(estimates[item.id]) > 0 && (
                        <div className="text-xs text-amber-700 pb-2">
                          = {(parseFloat(estimates[item.id]) * item.quantity).toLocaleString("ar-SA")} ر.س
                        </div>
                      )}
                      <Button size="sm" onClick={() => {
                        if (!estimates[item.id] || parseFloat(estimates[item.id]) <= 0) { toast.error("يرجى إدخال تكلفة صحيحة"); return; }
                        estimateMut.mutate({ purchaseOrderId: po.id, items: [{ id: item.id, estimatedUnitCost: estimates[item.id] }] });
                      }} disabled={estimateMut.isPending} className="shrink-0">
                        {estimateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "حفظ التسعير"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* === DELEGATE: Confirm Purchase === */}
                {isMyItem && item.status === "approved" && ["approved", "partial_purchase"].includes(po.status) && (
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-3">
                    <p className="text-xs font-medium text-teal-800 flex items-center gap-1.5">
                      <ShoppingCart className="w-3.5 h-3.5" /> تأكيد شراء هذا الصنف:
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[11px] text-teal-700">صورة الفاتورة</Label>
                        {itemPhotos[item.id]?.invoice ? (
                          <div className="relative mt-1">
                            <img src={itemPhotos[item.id]!.invoice} alt="" className="w-full h-20 rounded-lg object-cover border" />
                            <Button variant="destructive" size="icon" className="absolute top-1 left-1 h-5 w-5 rounded-full" onClick={() => setItemPhotos(p => ({ ...p, [item.id]: { ...p[item.id], invoice: undefined } }))}>
                              <XCircle className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="w-full h-20 border-dashed mt-1 gap-1" onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file"; input.accept = "image/*";
                            input.onchange = (e: any) => { if (e.target.files[0]) handleUpload(e.target.files[0], item.id, "invoice"); };
                            input.click();
                          }} disabled={uploadingItem === `${item.id}-invoice`}>
                            {uploadingItem === `${item.id}-invoice` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileText className="w-4 h-4" /><span className="text-[10px]">رفع الفاتورة</span></>}
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className="text-[11px] text-teal-700">صورة القطعة المشتراة</Label>
                        {itemPhotos[item.id]?.purchased ? (
                          <div className="relative mt-1">
                            <img src={itemPhotos[item.id]!.purchased} alt="" className="w-full h-20 rounded-lg object-cover border" />
                            <Button variant="destructive" size="icon" className="absolute top-1 left-1 h-5 w-5 rounded-full" onClick={() => setItemPhotos(p => ({ ...p, [item.id]: { ...p[item.id], purchased: undefined } }))}>
                              <XCircle className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="outline" size="sm" className="w-full h-20 border-dashed mt-1 gap-1" onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file"; input.accept = "image/*";
                            input.onchange = (e: any) => { if (e.target.files[0]) handleUpload(e.target.files[0], item.id, "purchased"); };
                            input.click();
                          }} disabled={uploadingItem === `${item.id}-purchased`}>
                            {uploadingItem === `${item.id}-purchased` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Camera className="w-4 h-4" /><span className="text-[10px]">رفع صورة القطعة</span></>}
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button size="sm" className="w-full gap-1.5" onClick={() => {
                      confirmPurchaseMut.mutate({
                        itemId: item.id,
                        invoicePhotoUrl: itemPhotos[item.id]?.invoice,
                        purchasedPhotoUrl: itemPhotos[item.id]?.purchased,
                      });
                    }} disabled={confirmPurchaseMut.isPending}>
                      {confirmPurchaseMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      تأكيد شراء هذا الصنف
                    </Button>
                  </div>
                )}

                {/* === WAREHOUSE: Receive Item === */}
                {isWarehouse && item.status === "purchased" && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-3">
                    <p className="text-xs font-medium text-green-800 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" /> استلام هذا الصنف — سجل البيانات النهائية:
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-green-700">قيمة الشراء الفعلية (ر.س) *</Label>
                        <Input type="number" placeholder="القيمة الفعلية" className="bg-white" value={receiveData[item.id]?.cost || ""} onChange={e => setReceiveData(p => ({ ...p, [item.id]: { cost: e.target.value, supplier: p[item.id]?.supplier || "" } }))} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-green-700">اسم المورد *</Label>
                        <Input placeholder="اسم المورد" className="bg-white" value={receiveData[item.id]?.supplier || ""} onChange={e => setReceiveData(p => ({ ...p, [item.id]: { cost: p[item.id]?.cost || "", supplier: e.target.value } }))} />
                      </div>
                    </div>
                    <Button size="sm" className="w-full gap-1.5" onClick={() => {
                      const d = receiveData[item.id];
                      if (!d?.cost || !d?.supplier) { toast.error("يرجى إدخال القيمة الفعلية واسم المورد"); return; }
                      receiveItemMut.mutate({ itemId: item.id, actualUnitCost: d.cost, supplierName: d.supplier });
                    }} disabled={receiveItemMut.isPending}>
                      {receiveItemMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                      تأكيد استلام هذا الصنف
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Totals Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> ملخص التكاليف
          </h3>
          {totalEstimated > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">المجموع التقديري:</span>
                <span className="font-bold text-lg">{totalEstimated.toLocaleString("ar-SA")} ر.س</span>
              </div>
              <p className="text-xs text-muted-foreground text-left">({numberToArabicWords(totalEstimated)})</p>
            </div>
          )}
          {totalActual > 0 && (
            <div className="space-y-1 pt-3 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">المجموع الفعلي:</span>
                <span className="font-bold text-lg text-emerald-700">{totalActual.toLocaleString("ar-SA")} ر.س</span>
              </div>
              <p className="text-xs text-emerald-600 text-left">({numberToArabicWords(totalActual)})</p>
            </div>
          )}
          {totalEstimated > 0 && totalActual > 0 && (
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">الفرق (تقديري - فعلي):</span>
                <span className={totalActual > totalEstimated ? "text-red-600 font-semibold" : "text-emerald-600 font-semibold"}>
                  {totalActual > totalEstimated ? "+" : "-"}{Math.abs(totalActual - totalEstimated).toLocaleString("ar-SA")} ر.س
                  ({totalEstimated > 0 ? ((Math.abs(totalActual - totalEstimated) / totalEstimated) * 100).toFixed(1) : 0}%)
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounting Approval */}
      {isAccountant && po.status === "pending_accounting" && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2"><CardTitle className="text-base text-orange-800">اعتماد الحسابات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-orange-600">راجع التكاليف التقديرية أعلاه ثم اعتمد أو ارفض الطلب</p>
            <div className="flex gap-2">
              <Button onClick={() => approveAccMut.mutate({ id: po.id })} disabled={approveAccMut.isPending} className="flex-1 gap-1.5">
                {approveAccMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                اعتماد وإرسال للإدارة العليا
              </Button>
              <Button variant="destructive" onClick={() => {
                if (!rejectReason.trim()) { toast.error("يرجى كتابة سبب الرفض"); return; }
                rejectMut.mutate({ id: po.id, reason: rejectReason });
              }} disabled={rejectMut.isPending} className="gap-1">
                <XCircle className="w-4 h-4" /> رفض
              </Button>
            </div>
            <Input placeholder="سبب الرفض (مطلوب في حالة الرفض)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          </CardContent>
        </Card>
      )}

      {/* Management Approval */}
      {isManagement && po.status === "pending_management" && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2"><CardTitle className="text-base text-orange-800">اعتماد الإدارة العليا</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-orange-600">راجع التكاليف التقديرية أعلاه ثم اعتمد أو ارفض الطلب</p>
            <div className="flex gap-2">
              <Button onClick={() => approveMgmtMut.mutate({ id: po.id })} disabled={approveMgmtMut.isPending} className="flex-1 gap-1.5">
                {approveMgmtMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                اعتماد والسماح بالشراء
              </Button>
              <Button variant="destructive" onClick={() => {
                if (!rejectReason.trim()) { toast.error("يرجى كتابة سبب الرفض"); return; }
                rejectMut.mutate({ id: po.id, reason: rejectReason });
              }} disabled={rejectMut.isPending} className="gap-1">
                <XCircle className="w-4 h-4" /> رفض
              </Button>
            </div>
            <Input placeholder="سبب الرفض (مطلوب في حالة الرفض)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          </CardContent>
        </Card>
      )}

      {/* Delegate estimate progress */}
      {isDelegate && po.status === "pending_estimate" && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <AlertCircle className="w-4 h-4" />
              <span>تم تسعير <strong>{myItems.filter((i: any) => i.status === "estimated").length}</strong> من <strong>{myItems.length}</strong> صنف</span>
            </div>
            <p className="text-xs text-amber-600 mt-1">بعد تسعير جميع الأصناف، سيتم إرسال الطلب تلقائياً للحسابات للاعتماد</p>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {po.notes && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">ملاحظات:</p>
            <p className="text-sm">{po.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
