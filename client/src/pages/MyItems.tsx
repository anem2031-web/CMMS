import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingBag, Clock, CheckCircle2, Camera,
  Loader2, AlertCircle, DollarSign, Package, Truck, FileDown, XCircle
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { MyItemRow } from "@/components/MyItemRow";

export default function MyItems() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { t, language } = useTranslation();
  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const currency = language === "en" ? "SAR" : "ر.س";

  const { data: myItems, isLoading, refetch } = trpc.purchaseOrders.myItems.useQuery(undefined, {
    enabled: !!user,
  });

  const [exportingPdf, setExportingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState("pending_estimate");
  const [estimateDialog, setEstimateDialog] = useState<any>(null);
  const [estimateCost, setEstimateCost] = useState("");
  const [purchaseDialog, setPurchaseDialog] = useState<any>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [purchasedUrl, setPurchasedUrl] = useState("");

  const estimateMut = trpc.purchaseOrders.estimateCost.useMutation({
    onSuccess: () => {
      toast.success(t.common.save);
      setEstimateDialog(null);
      setEstimateCost("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmPurchaseMut = trpc.purchaseOrders.confirmItemPurchase.useMutation({
    onSuccess: () => {
      toast.success(t.common.confirm);
      setPurchaseDialog(null);
      setInvoiceUrl("");
      setPurchasedUrl("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleExportPdf = useCallback(async () => {
    setExportingPdf(true);
    try {
      const res = await fetch("/api/export/my-items-pdf", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-items-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      toast.success(t.common.save);
    } catch (error) {
      toast.error(t.common.save);
    } finally {
      setExportingPdf(false);
    }
  }, [t.common.save]);

  const handleUpload = useCallback(async (field: "invoice" | "purchased", file: File) => {
    setUploadingField(field);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        if (field === "invoice") setInvoiceUrl(data.url);
        else setPurchasedUrl(data.url);
        toast.success(t.common.save);
      }
    } catch { toast.error(t.common.save); }
    setUploadingField(null);
  }, [t.common.save]);

  const grouped = useMemo(() => {
    if (!myItems) return { pending_estimate: [], approved: [], purchased: [], received: [] };
    const items = myItems as any[];
    return {
      pending_estimate: items.filter((i: any) => i.status === "pending" || i.status === "estimated"),
      approved: items.filter((i: any) => i.status === "approved"),
      purchased: items.filter((i: any) => i.status === "purchased"),
      received: items.filter((i: any) => i.status === "received"),
    };
  }, [myItems]);

  const handleNavigateToPO = useCallback((poId: number) => {
    setLocation(`/purchase-orders/${poId}`);
  }, [setLocation]);

  const handleOpenEstimate = useCallback((item: any) => {
    setEstimateDialog(item);
    setEstimateCost("");
  }, []);

  const handleOpenPurchase = useCallback((item: any) => {
    setPurchaseDialog(item);
    setInvoiceUrl("");
    setPurchasedUrl("");
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Package className="w-6 h-6 text-primary" />
          {t.nav.myItems}
        </h1>
        <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf}>
          {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
          {t.common.export} PDF
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full h-auto p-1 bg-muted/50">
          <TabsTrigger value="pending_estimate" className="py-2 flex flex-col gap-1">
            <Clock className="w-4 h-4" />
            <span className="text-[10px]">{t.poStatus.pending_estimate}</span>
            <Badge variant="secondary" className="text-[9px] h-4 px-1">{grouped.pending_estimate.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="approved" className="py-2 flex flex-col gap-1">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-[10px]">{t.poStatus.approved}</span>
            <Badge variant="secondary" className="text-[9px] h-4 px-1">{grouped.approved.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="purchased" className="py-2 flex flex-col gap-1">
            <ShoppingBag className="w-4 h-4" />
            <span className="text-[10px]">{t.poStatus.purchased}</span>
            <Badge variant="secondary" className="text-[9px] h-4 px-1">{grouped.purchased.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="received" className="py-2 flex flex-col gap-1">
            <Truck className="w-4 h-4" />
            <span className="text-[10px]">{t.poStatus.received}</span>
            <Badge variant="secondary" className="text-[9px] h-4 px-1">{grouped.received.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {Object.entries(grouped).map(([key, items]) => (
          <TabsContent key={key} value={key} className="mt-4 space-y-4">
            {items.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-12 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">{t.common.noData}</p>
                </CardContent>
              </Card>
            ) : (
              items.map((item: any) => (
                <MyItemRow
                  key={item.id}
                  item={item}
                  t={t}
                  locale={locale}
                  currency={currency}
                  onEstimate={handleOpenEstimate}
                  onPurchase={handleOpenPurchase}
                  onNavigateToPO={handleNavigateToPO}
                />
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!estimateDialog} onOpenChange={open => !open && setEstimateDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.purchaseOrders.estimatedUnitCost}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t.purchaseOrders.estimatedUnitCost} ({currency})</Label>
              <Input type="number" value={estimateCost} onChange={e => setEstimateCost(e.target.value)} placeholder="0.00" autoFocus />
            </div>
            {estimateCost && estimateDialog && (
              <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-800">
                {t.purchaseOrders.totalEstimated}: <strong>{(parseFloat(estimateCost) * estimateDialog.quantity).toLocaleString(locale)} {currency}</strong>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEstimateDialog(null)}>{t.common.cancel}</Button>
            <Button onClick={() => estimateMut.mutate({ purchaseOrderId: estimateDialog.purchaseOrderId, items: [{ id: estimateDialog.id, estimatedUnitCost: estimateCost }] })} disabled={estimateMut.isPending || !estimateCost}>
              {estimateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!purchaseDialog} onOpenChange={open => !open && setPurchaseDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.purchaseOrders.confirmPurchase}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.purchaseOrders.accountingNotes}</Label>
                {invoiceUrl ? (
                  <div className="relative">
                    <img src={invoiceUrl} className="w-full h-24 object-cover rounded-lg border" />
                    <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setInvoiceUrl("")}><XCircle className="w-4 h-4" /></Button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full h-24 border-dashed flex-col gap-2" onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file"; input.accept = "image/*";
                    input.onchange = (e: any) => { if (e.target.files[0]) handleUpload("invoice", e.target.files[0]); };
                    input.click();
                  }} disabled={uploadingField === "invoice"}>
                    {uploadingField === "invoice" ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Camera className="w-6 h-6" /><span className="text-xs">{t.common.upload}</span></>}
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t.tickets.photos}</Label>
                {purchasedUrl ? (
                  <div className="relative">
                    <img src={purchasedUrl} className="w-full h-24 object-cover rounded-lg border" />
                    <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => setPurchasedUrl("")}><XCircle className="w-4 h-4" /></Button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full h-24 border-dashed flex-col gap-2" onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file"; input.accept = "image/*";
                    input.onchange = (e: any) => { if (e.target.files[0]) handleUpload("purchased", e.target.files[0]); };
                    input.click();
                  }} disabled={uploadingField === "purchased"}>
                    {uploadingField === "purchased" ? <Loader2 className="w-6 h-6 animate-spin" /> : <><Camera className="w-6 h-6" /><span className="text-xs">{t.common.upload}</span></>}
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPurchaseDialog(null)}>{t.common.cancel}</Button>
            <Button onClick={() => confirmPurchaseMut.mutate({ itemId: purchaseDialog.id, invoicePhotoUrl: invoiceUrl, purchasedPhotoUrl: purchasedUrl })} disabled={confirmPurchaseMut.isPending || !invoiceUrl || !purchasedUrl}>
              {confirmPurchaseMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t.purchaseOrders.confirmPurchase}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
