import { trpc } from "@/lib/trpc";
import { mediaUrl } from "@/lib/mediaUrl";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight, ShoppingCart, DollarSign, Loader2, AlertCircle, Pencil
} from "lucide-react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";
import { RevisionDialog, ItemReviewDialog } from "@/components/PODialogs";
import { POItemRow } from "@/components/POItemRow";

const PO_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_review: "bg-purple-100 text-purple-700",
  pending_estimate: "bg-amber-100 text-amber-700",
  pending_accounting: "bg-orange-100 text-orange-700",
  pending_management: "bg-orange-100 text-orange-700",
  approved: "bg-teal-100 text-teal-700",
  partial_purchase: "bg-cyan-100 text-cyan-700",
  purchased: "bg-emerald-100 text-emerald-700",
  received: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-700",
  rejected: "bg-red-100 text-red-700",
  revision_needed: "bg-rose-100 text-rose-700",
};

const ITEM_STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700",
  estimated: "bg-amber-100 text-amber-700",
  approved: "bg-teal-100 text-teal-700",
  rejected: "bg-red-100 text-red-700",
  purchased: "bg-emerald-100 text-emerald-700",
  received: "bg-green-100 text-green-700",
  pending_review: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-gray-200 text-gray-600",
};

export default function PurchaseOrderDetail() {
  const [, params] = useRoute("/purchase-orders/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const { getPOStatusLabel, getPOItemStatusLabel } = useStaticLabels();
  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const currency = language === "en" ? "SAR" : "ر.س";
  const poId = parseInt(params?.id || "0");

  const { data: po, isLoading, refetch } = trpc.purchaseOrders.getById.useQuery({ id: poId }, { enabled: !!poId });
  const { data: users } = trpc.users.list.useQuery();

  const estimateMut = trpc.purchaseOrders.estimateCost.useMutation({ onSuccess: () => { toast.success(t.common.save); refetch(); }, onError: (e) => toast.error(e.message) });
  const confirmPurchaseMut = trpc.purchaseOrders.confirmItemPurchase.useMutation({ onSuccess: () => { toast.success(t.common.confirm); refetch(); }, onError: (e) => toast.error(e.message) });
  const receiveItemMut = trpc.purchaseOrders.confirmDeliveryToWarehouse.useMutation({ onSuccess: () => { toast.success(t.common.confirm); refetch(); }, onError: (e: any) => toast.error(e.message) });
  const editItemMut = trpc.purchaseOrders.editItem.useMutation({ onSuccess: () => { toast.success(t.common.savedSuccessfully); setEditingItem(null); refetch(); }, onError: (e: any) => toast.error(e.message) });

  const role = user?.role || "";
  const userId = user?.id;

  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [itemPhotos, setItemPhotos] = useState<Record<number, { invoice?: string; purchased?: string; warehouse?: string }>>({})
  const [dropZoneFor, setDropZoneFor] = useState<string | null>(null);
  const [receiveData, setReceiveData] = useState<Record<number, { cost: string; supplier: string; supplierItemName: string; warehousePhotoUrl: string }>>({});
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editForm, setEditForm] = useState<{ itemName: string; description: string; quantity: number; estimatedUnitCost: string; unit: string; photoUrl: string; notes: string }>({ itemName: "", description: "", quantity: 1, estimatedUnitCost: "", unit: "", photoUrl: "", notes: "" });
  
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = useState(false);
  const [reviewItemId, setReviewItemId] = useState<number | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);

  const objectUrlsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach(url => {
        try { URL.revokeObjectURL(url); } catch (e) { console.warn("Failed to revoke ObjectURL:", e); }
      });
      objectUrlsRef.current.clear();
    };
  }, []);

  const trackObjectUrl = useCallback((key: string, url: string) => {
    if (url.startsWith("blob:")) {
      objectUrlsRef.current.set(key, url);
    }
  }, []);

  const requestRevisionMut = trpc.purchaseOrders.requestRevision.useMutation({
    onSuccess: () => { toast.success("تم إرسال الطلب للمراجعة"); setIsRevisionDialogOpen(false); refetch(); },
    onError: (e) => toast.error(e.message)
  });

  const requestItemReviewMut = trpc.purchaseOrders.requestItemReview.useMutation({
    onSuccess: () => { toast.success("تم طلب المراجعة بنجاح"); setIsReviewDialogOpen(false); setReviewItemId(null); refetch(); },
    onError: (e) => toast.error(e.message)
  });

  const isAdminOrOwner = useMemo(() => ["admin", "owner"].includes(role), [role]);
  const isDelegate = useMemo(() => role === "delegate", [role]);

  const visibleItems = useMemo(() => {
    if (!po?.items) return [];
    if (isAdminOrOwner) return po.items;
    if (isDelegate) return po.items.filter((item: any) => item.delegateId === userId);
    return po.items;
  }, [po?.items, isAdminOrOwner, isDelegate, userId]);

  const handleEditItem = useCallback((item: any) => {
    setEditingItem(item);
    setEditForm({ itemName: item.itemName, description: item.description || "", quantity: item.quantity, estimatedUnitCost: item.estimatedUnitCost || "", unit: item.unit || "", photoUrl: item.photoUrl || "", notes: item.notes || "" });
  }, []);

  const handleRequestReview = useCallback((itemId: number) => {
    setReviewItemId(itemId);
    setIsReviewDialogOpen(true);
  }, []);

  const handleUpload = useCallback(async (file: File, itemId: number, type: "invoice" | "purchased" | "warehouse") => {
    const key = `${itemId}-${type}`;
    setUploadingItem(key);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        if (type === "warehouse") {
          setReceiveData(p => ({ ...p, [itemId]: { ...p[itemId], warehousePhotoUrl: data.url } }));
        } else {
          setItemPhotos(p => ({ ...p, [itemId]: { ...p[itemId], [type]: data.url } }));
        }
        setUploadingItem(null);
        return data.url;
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setUploadingItem(null);
    return null;
  }, []);

  const handleConfirmPurchase = useCallback((itemId: number) => {
    const d = receiveData[itemId];
    const photos = itemPhotos[itemId];
    if (!d?.cost || !d?.supplier || !photos?.invoice || !photos?.purchased) { toast.error(t.common.save); return; }
    confirmPurchaseMut.mutate({ itemId, invoicePhotoUrl: photos.invoice, purchasedPhotoUrl: photos.purchased });
  }, [receiveData, itemPhotos, confirmPurchaseMut, t.common.save]);

  const handleReceiveItem = useCallback((itemId: number) => {
    const d = receiveData[itemId];
    if (!d?.cost || !d?.supplier || !d?.warehousePhotoUrl) { toast.error(t.common.save); return; }
    receiveItemMut.mutate({ itemId, actualUnitCost: d.cost, supplierName: d.supplier, supplierItemName: d.supplierItemName, warehousePhotoUrl: d.warehousePhotoUrl });
  }, [receiveData, receiveItemMut, t.common.save]);

  if (isLoading) return <div className="p-4 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>;
  if (!po) return <div className="p-8 text-center"><AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p>{t.common.notFound}</p></div>;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4 pb-24">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/purchase-orders")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-lg font-bold">{t.purchaseOrders.title} #{po.id}</h1>
          <p className="text-xs text-muted-foreground">{new Date(po.createdAt).toLocaleDateString(locale)}</p>
        </div>
        <Badge className={`px-3 py-1 rounded-full ${PO_STATUS_COLORS[po.status] || "bg-gray-100 text-gray-700"}`}>
          {getPOStatusLabel(po.status)}
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            {t.purchaseOrders.items}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visibleItems.map((item: any) => (
            <POItemRow
              key={item.id}
              item={item}
              isAdminOrOwner={isAdminOrOwner}
              isDelegate={isDelegate}
              userId={userId}
              role={role}
              poStatus={po.status}
              itemStatusColors={ITEM_STATUS_COLORS}
              getPOItemStatusLabel={getPOItemStatusLabel}
              t={t}
              locale={locale}
              currency={currency}
              onEdit={handleEditItem}
              onUpload={handleUpload}
              onConfirmPurchase={handleConfirmPurchase}
              onReceiveItem={handleReceiveItem}
              onRequestReview={handleRequestReview}
              onEstimate={(itemId, cost) => estimateMut.mutate({ purchaseOrderId: po.id, items: [{ id: itemId, estimatedUnitCost: cost }] })}
              uploadingItem={uploadingItem}
              dropZoneFor={dropZoneFor}
              setDropZoneFor={setDropZoneFor}
              trackObjectUrl={trackObjectUrl}
              users={users}
              isEstimating={estimateMut.isPending}
              isConfirming={confirmPurchaseMut.isPending}
              isReceiving={receiveItemMut.isPending}
            />
          ))}
        </CardContent>
      </Card>

      <RevisionDialog 
        isOpen={isRevisionDialogOpen}
        onClose={() => setIsRevisionDialogOpen(false)}
        onConfirm={(note) => requestRevisionMut.mutate({ id: po.id, note })}
        isPending={requestRevisionMut.isPending}
        title={t.purchaseOrders.revisionDialogTitle}
        desc={t.purchaseOrders.revisionDialogDesc}
        label={`${t.purchaseOrders.revisionReason} *`}
        placeholder="مثال: يرجى تعديل الكمية في الصنف الأول لتكون 5 بدلاً من 10..."
        confirmText={t.purchaseOrders.returnForRevision}
      />

      <ItemReviewDialog 
        isOpen={isReviewDialogOpen}
        onClose={() => setIsReviewDialogOpen(false)}
        onConfirm={(reason) => requestItemReviewMut.mutate({ itemId: reviewItemId!, reason })}
        isPending={requestItemReviewMut.isPending}
        title="طلب مراجعة الصنف"
        label="سبب طلب المراجعة *"
        confirmText="طلب المراجعة"
      />

      <Dialog open={!!editingItem} onOpenChange={(open) => { if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4" />
              {t.common.edit} - {editingItem?.itemName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.purchaseOrders.itemName}</Label>
              <Input value={editForm.itemName} onChange={e => setEditForm(p => ({ ...p, itemName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t.common.description}</Label>
              <Textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t.purchaseOrders.quantity}</Label>
                <Input type="number" min={1} value={editForm.quantity} onChange={e => setEditForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="space-y-2">
                <Label>{t.purchaseOrders.estimatedUnitCost}</Label>
                <Input type="number" step="0.01" value={editForm.estimatedUnitCost} onChange={e => setEditForm(p => ({ ...p, estimatedUnitCost: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label>{t.purchaseOrders.unit}</Label>
                <Input value={editForm.unit} onChange={e => setEditForm(p => ({ ...p, unit: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Photo URL</Label>
                <Input value={editForm.photoUrl} onChange={e => setEditForm(p => ({ ...p, photoUrl: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.common.notes}</Label>
              <Textarea value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>{t.common.cancel}</Button>
            <Button onClick={() => {
              if (!editingItem) return;
              editItemMut.mutate({
                id: editingItem.id,
                purchaseOrderId: po.id,
                itemName: editForm.itemName,
                description: editForm.description,
                quantity: editForm.quantity,
                estimatedUnitCost: editForm.estimatedUnitCost || undefined,
                unit: editForm.unit || undefined,
                photoUrl: editForm.photoUrl || undefined,
                notes: editForm.notes || undefined,
              });
            }} disabled={editItemMut.isPending}>
              {editItemMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
