import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PO_STATUS_LABELS, PO_ITEM_STATUS_LABELS } from "@shared/types";
import { ArrowRight, CheckCircle2, XCircle, Upload, Loader2, Package } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const ITEM_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  estimated: "bg-amber-100 text-amber-700",
  approved: "bg-teal-100 text-teal-700",
  purchased: "bg-emerald-100 text-emerald-700",
  received: "bg-green-100 text-green-700",
};

export default function PurchaseOrderDetail() {
  const [, params] = useRoute("/purchase-orders/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const poId = parseInt(params?.id || "0");

  const { data: po, isLoading, refetch } = trpc.purchaseOrders.getById.useQuery({ id: poId }, { enabled: !!poId });
  const { data: users } = trpc.users.list.useQuery();

  const estimateMut = trpc.purchaseOrders.estimateCost.useMutation({ onSuccess: () => { toast.success("تم حفظ التسعير"); refetch(); } });
  const approveAccMut = trpc.purchaseOrders.approveAccounting.useMutation({ onSuccess: () => { toast.success("تم اعتماد الحسابات"); refetch(); } });
  const approveMgmtMut = trpc.purchaseOrders.approveManagement.useMutation({ onSuccess: () => { toast.success("تم اعتماد الإدارة العليا"); refetch(); } });
  const rejectMut = trpc.purchaseOrders.reject.useMutation({ onSuccess: () => { toast.success("تم رفض الطلب"); refetch(); } });
  const confirmPurchaseMut = trpc.purchaseOrders.confirmItemPurchase.useMutation({ onSuccess: () => { toast.success("تم تأكيد الشراء"); refetch(); } });
  const receiveItemMut = trpc.purchaseOrders.receiveItem.useMutation({ onSuccess: () => { toast.success("تم تأكيد الاستلام"); refetch(); } });

  const [estimates, setEstimates] = useState<Record<number, string>>({});
  const [rejectReason, setRejectReason] = useState("");
  const [accNotes, setAccNotes] = useState("");
  const [mgmtNotes, setMgmtNotes] = useState("");
  const [receiveData, setReceiveData] = useState<Record<number, { cost: string; supplier: string }>>({});
  const [uploadingItem, setUploadingItem] = useState<number | null>(null);
  const [itemPhotos, setItemPhotos] = useState<Record<number, { invoice?: string; purchased?: string }>>({});

  const role = user?.role || "";
  const isDelegate = role === "delegate";
  const isAccountant = role === "accountant";
  const isManagement = role === "senior_management";
  const isWarehouse = role === "warehouse";
  const isManager = ["maintenance_manager", "purchase_manager", "owner", "admin"].includes(role);

  const handleUpload = async (file: File, itemId: number, type: "invoice" | "purchased") => {
    setUploadingItem(itemId);
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

  const requestedBy = users?.find(u => u.id === po.requestedById);
  const totalEstimated = po.items?.reduce((s, i) => s + parseFloat(i.estimatedTotalCost || "0"), 0) || 0;
  const totalActual = po.items?.reduce((s, i) => s + parseFloat(i.actualTotalCost || "0"), 0) || 0;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/purchase-orders")}><ArrowRight className="w-5 h-5" /></Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-mono text-muted-foreground">{po.poNumber}</span>
            <Badge className="status-badge">{PO_STATUS_LABELS[po.status]}</Badge>
          </div>
          <h1 className="text-xl font-bold mt-1">تفاصيل طلب الشراء</h1>
        </div>
      </div>

      {/* Info */}
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">طلب بواسطة:</span><p className="font-medium">{requestedBy?.name || "-"}</p></div>
            <div><span className="text-muted-foreground">التاريخ:</span><p className="font-medium">{new Date(po.createdAt).toLocaleDateString("ar-SA")}</p></div>
            <div><span className="text-muted-foreground">التكلفة التقديرية:</span><p className="font-medium">{totalEstimated.toLocaleString("ar-SA")} ر.س</p></div>
            <div><span className="text-muted-foreground">التكلفة الفعلية:</span><p className="font-medium">{totalActual.toLocaleString("ar-SA")} ر.س</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader><CardTitle className="text-base">الأصناف ({po.items?.length || 0})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {po.items?.map(item => {
            const delegate = users?.find(u => u.id === item.delegateId);
            const isMyItem = isDelegate && item.delegateId === user?.id;
            return (
              <div key={item.id} className="border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{item.itemName}</h4>
                      <Badge className={`text-[10px] ${ITEM_STATUS_COLORS[item.status]}`}>{PO_ITEM_STATUS_LABELS[item.status]}</Badge>
                    </div>
                    {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>الكمية: {item.quantity} {item.unit || ""}</span>
                      {delegate && <span>المندوب: {delegate.name}</span>}
                      {item.estimatedUnitCost && <span>تقديري: {Number(item.estimatedTotalCost).toLocaleString("ar-SA")} ر.س</span>}
                      {item.actualUnitCost && <span>فعلي: {Number(item.actualTotalCost).toLocaleString("ar-SA")} ر.س</span>}
                      {item.supplierName && <span>المورد: {item.supplierName}</span>}
                    </div>
                  </div>
                  {item.photoUrl && <img src={item.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border" />}
                </div>

                {/* Delegate: Estimate cost */}
                {isMyItem && item.status === "pending" && po.status === "pending_estimate" && (
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">التكلفة التقديرية للوحدة</label>
                      <Input type="number" placeholder="0.00" value={estimates[item.id] || ""} onChange={e => setEstimates(p => ({ ...p, [item.id]: e.target.value }))} />
                    </div>
                    <Button size="sm" onClick={() => {
                      if (!estimates[item.id]) return;
                      estimateMut.mutate({ purchaseOrderId: po.id, items: [{ id: item.id, estimatedUnitCost: estimates[item.id] }] });
                    }} disabled={estimateMut.isPending}>حفظ</Button>
                  </div>
                )}

                {/* Delegate: Confirm purchase */}
                {isMyItem && item.status === "approved" && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium">تأكيد شراء هذا الصنف:</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file"; input.accept = "image/*";
                        input.onchange = (e: any) => { if (e.target.files[0]) handleUpload(e.target.files[0], item.id, "invoice"); };
                        input.click();
                      }} disabled={uploadingItem === item.id}>
                        {uploadingItem === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        صورة الفاتورة
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file"; input.accept = "image/*";
                        input.onchange = (e: any) => { if (e.target.files[0]) handleUpload(e.target.files[0], item.id, "purchased"); };
                        input.click();
                      }} disabled={uploadingItem === item.id}>
                        {uploadingItem === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        صورة القطعة
                      </Button>
                    </div>
                    {(itemPhotos[item.id]?.invoice || itemPhotos[item.id]?.purchased) && (
                      <div className="flex gap-2">
                        {itemPhotos[item.id]?.invoice && <img src={itemPhotos[item.id]!.invoice} className="w-16 h-16 rounded object-cover border" />}
                        {itemPhotos[item.id]?.purchased && <img src={itemPhotos[item.id]!.purchased} className="w-16 h-16 rounded object-cover border" />}
                      </div>
                    )}
                    <Button size="sm" onClick={() => confirmPurchaseMut.mutate({
                      itemId: item.id,
                      invoicePhotoUrl: itemPhotos[item.id]?.invoice,
                      purchasedPhotoUrl: itemPhotos[item.id]?.purchased,
                    })} disabled={confirmPurchaseMut.isPending} className="gap-1">
                      <CheckCircle2 className="w-3 h-3" /> تأكيد الشراء
                    </Button>
                  </div>
                )}

                {/* Warehouse: Receive item */}
                {isWarehouse && item.status === "purchased" && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium">استلام هذا الصنف:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="قيمة الشراء الفعلية" type="number" value={receiveData[item.id]?.cost || ""} onChange={e => setReceiveData(p => ({ ...p, [item.id]: { ...p[item.id], cost: e.target.value, supplier: p[item.id]?.supplier || "" } }))} />
                      <Input placeholder="اسم المورد" value={receiveData[item.id]?.supplier || ""} onChange={e => setReceiveData(p => ({ ...p, [item.id]: { ...p[item.id], supplier: e.target.value, cost: p[item.id]?.cost || "" } }))} />
                    </div>
                    <Button size="sm" onClick={() => {
                      const d = receiveData[item.id];
                      if (!d?.cost || !d?.supplier) { toast.error("يرجى إدخال القيمة واسم المورد"); return; }
                      receiveItemMut.mutate({ itemId: item.id, actualUnitCost: d.cost, supplierName: d.supplier });
                    }} disabled={receiveItemMut.isPending} className="gap-1">
                      <Package className="w-3 h-3" /> تأكيد الاستلام
                    </Button>
                  </div>
                )}

                {/* Show photos if available */}
                {(item.invoicePhotoUrl || item.purchasedPhotoUrl) && (
                  <div className="flex gap-2 border-t pt-2">
                    {item.invoicePhotoUrl && <div><p className="text-[10px] text-muted-foreground mb-1">الفاتورة</p><img src={item.invoicePhotoUrl} className="w-20 h-20 rounded object-cover border" /></div>}
                    {item.purchasedPhotoUrl && <div><p className="text-[10px] text-muted-foreground mb-1">القطعة</p><img src={item.purchasedPhotoUrl} className="w-20 h-20 rounded object-cover border" /></div>}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Approval Actions */}
      {isAccountant && po.status === "pending_accounting" && (
        <Card>
          <CardHeader><CardTitle className="text-base">اعتماد الحسابات</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="ملاحظات (اختياري)..." value={accNotes} onChange={e => setAccNotes(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => approveAccMut.mutate({ id: po.id, notes: accNotes })} disabled={approveAccMut.isPending} className="gap-1 flex-1">
                <CheckCircle2 className="w-4 h-4" /> اعتماد
              </Button>
              <Button variant="destructive" onClick={() => { if (!rejectReason) { toast.error("يرجى كتابة سبب الرفض"); return; } rejectMut.mutate({ id: po.id, reason: rejectReason }); }} disabled={rejectMut.isPending} className="gap-1">
                <XCircle className="w-4 h-4" /> رفض
              </Button>
            </div>
            {po.status === "pending_accounting" && <Input placeholder="سبب الرفض (إن وجد)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />}
          </CardContent>
        </Card>
      )}

      {isManagement && po.status === "pending_management" && (
        <Card>
          <CardHeader><CardTitle className="text-base">اعتماد الإدارة العليا</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea placeholder="ملاحظات (اختياري)..." value={mgmtNotes} onChange={e => setMgmtNotes(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={() => approveMgmtMut.mutate({ id: po.id, notes: mgmtNotes })} disabled={approveMgmtMut.isPending} className="gap-1 flex-1">
                <CheckCircle2 className="w-4 h-4" /> اعتماد
              </Button>
              <Button variant="destructive" onClick={() => { if (!rejectReason) { toast.error("يرجى كتابة سبب الرفض"); return; } rejectMut.mutate({ id: po.id, reason: rejectReason }); }} disabled={rejectMut.isPending} className="gap-1">
                <XCircle className="w-4 h-4" /> رفض
              </Button>
            </div>
            <Input placeholder="سبب الرفض (إن وجد)..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
