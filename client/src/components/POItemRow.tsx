import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Pencil, Camera, Upload, XCircle, Loader2, ShoppingCart, 
  Package, DollarSign, CheckCircle2, FileText 
} from "lucide-react";
import { mediaUrl } from "@/lib/mediaUrl";
import DropZone, { type UploadedFile } from "@/components/DropZone";

interface POItemRowProps {
  item: any;
  isAdminOrOwner: boolean;
  isDelegate: boolean;
  userId: number | undefined;
  role: string;
  poStatus: string;
  itemStatusColors: Record<string, string>;
  getPOItemStatusLabel: (status: string) => string;
  t: any;
  locale: string;
  currency: string;
  onEdit: (item: any) => void;
  onUpload: (file: File, itemId: number, type: any) => Promise<string | null>;
  onConfirmPurchase: (itemId: number, data: any) => void;
  onReceiveItem: (itemId: number, data: any) => void;
  onRequestReview: (itemId: number) => void;
  onEstimate: (itemId: number, cost: string) => void;
  uploadingItem: string | null;
  dropZoneFor: string | null;
  setDropZoneFor: (val: string | null) => void;
  trackObjectUrl: (key: string, url: string) => void;
  users: any[] | undefined;
  isEstimating: boolean;
  isConfirming: boolean;
  isReceiving: boolean;
}

export const POItemRow = React.memo(({
  item,
  isAdminOrOwner,
  isDelegate,
  userId,
  role,
  poStatus,
  itemStatusColors,
  getPOItemStatusLabel,
  t,
  locale,
  currency,
  onEdit,
  onUpload,
  onConfirmPurchase,
  onReceiveItem,
  onEstimate,
  uploadingItem,
  dropZoneFor,
  setDropZoneFor,
  trackObjectUrl,
  users,
  isEstimating,
  isConfirming,
  isReceiving
}: POItemRowProps) => {
  const delegate = users?.find((u: any) => u.id === item.delegateId);
  const isMyItem = isAdminOrOwner || (isDelegate && item.delegateId === userId);
  
  const [localEstimate, setLocalEstimate] = useState("");
  const [purchaseData, setPurchaseData] = useState({ cost: "", supplier: "", invoice: "", purchased: "" });
  const [receiveData, setReceiveData] = useState({ cost: "", supplier: "", supplierItemName: "", warehousePhotoUrl: "" });

  return (
    <div className={`border rounded-xl p-4 space-y-3 hover:border-primary/20 transition-colors ${item.status === "cancelled" ? "bg-gray-50 opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className={`font-medium text-sm ${item.status === "cancelled" ? "line-through text-gray-500" : ""}`}>{item.itemName}</h4>
            <Badge className={`text-[10px] ${itemStatusColors[item.status] || "bg-gray-100 text-gray-700"}`}>
              {getPOItemStatusLabel(item.status)}
            </Badge>
          </div>
          {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
            <span>{t.purchaseOrders.quantity}: <strong>{item.quantity} {item.unit || ""}</strong></span>
            {delegate && <span>{t.purchaseOrders.delegate}: <strong>{delegate.name}</strong></span>}
          </div>
          {item.notes && <p className="text-xs text-muted-foreground mt-1.5 bg-muted/50 rounded-lg p-2">{item.notes}</p>}
        </div>
        {item.photoUrl && <img src={item.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover border shrink-0" />}
        {role !== "delegate" && ['draft', 'pending_estimate', 'pending_accounting', 'revision_needed'].includes(poStatus) && ['pending', 'estimated'].includes(item.status) && (
          <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => onEdit(item)}>
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        )}
      </div>

      {(item.estimatedUnitCost || item.actualUnitCost) && (
        <div className="bg-muted/30 rounded-lg p-2.5 space-y-1">
          {item.estimatedUnitCost && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t.purchaseOrders.totalEstimated}:</span>
              <span className="font-medium">{Number(item.estimatedUnitCost).toLocaleString(locale)} {currency} × {item.quantity} = <strong>{parseFloat(item.estimatedTotalCost || "0").toLocaleString(locale)} {currency}</strong></span>
            </div>
          )}
          {item.actualUnitCost && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-emerald-600">{t.purchaseOrders.totalActual}:</span>
              <span className="font-medium text-emerald-700">{Number(item.actualUnitCost).toLocaleString(locale)} {currency} × {item.quantity} = <strong>{parseFloat(item.actualTotalCost || "0").toLocaleString(locale)} {currency}</strong></span>
            </div>
          )}
          {item.supplierName && (
            <div className="flex items-center justify-between text-xs pt-1 border-t border-muted">
              <span className="text-muted-foreground">{t.purchaseOrders.supplier}:</span>
              <span className="font-medium">{item.supplierName}</span>
            </div>
          )}
        </div>
      )}

      {(item.invoicePhotoUrl || item.purchasedPhotoUrl) && (
        <div className="flex gap-3 border-t pt-2">
          {item.invoicePhotoUrl && (
            <a href={mediaUrl(item.invoicePhotoUrl)} target="_blank" rel="noopener" className="group">
              <p className="text-[10px] text-muted-foreground mb-1">{t.purchaseOrders.accountingNotes}</p>
              <img src={mediaUrl(item.invoicePhotoUrl)} className="w-20 h-20 rounded-lg object-cover border group-hover:ring-2 ring-primary/30 transition-all" />
            </a>
          )}
          {item.purchasedPhotoUrl && (
            <a href={mediaUrl(item.purchasedPhotoUrl)} target="_blank" rel="noopener" className="group">
              <p className="text-[10px] text-muted-foreground mb-1">{t.tickets.photos}</p>
              <img src={mediaUrl(item.purchasedPhotoUrl)} className="w-20 h-20 rounded-lg object-cover border group-hover:ring-2 ring-primary/30 transition-all" />
            </a>
          )}
        </div>
      )}

      {isMyItem && item.status === "pending" && poStatus === "pending_estimate" && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-amber-800 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> {t.purchaseOrders.estimatedUnitCost}:
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label className="text-[11px] text-amber-700">{t.purchaseOrders.estimatedUnitCost} ({currency})</Label>
              <Input type="number" placeholder="0.00" value={localEstimate} onChange={e => setLocalEstimate(e.target.value)} className="bg-white" />
            </div>
            <Button size="sm" onClick={() => onEstimate(item.id, localEstimate)} disabled={isEstimating} className="shrink-0">
              {isEstimating ? <Loader2 className="w-3 h-3 animate-spin" /> : t.common.save}
            </Button>
          </div>
        </div>
      )}

      {isMyItem && item.status === "approved" && ["approved", "partial_purchase"].includes(poStatus) && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 space-y-3">
          <p className="text-xs font-medium text-teal-800 flex items-center gap-1.5">
            <ShoppingCart className="w-3.5 h-3.5" /> {t.purchaseOrders.confirmPurchase}:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-teal-700">{t.purchaseOrders.accountingNotes}</Label>
              {purchaseData.invoice ? (
                <div className="relative mt-1">
                  <img src={purchaseData.invoice} alt="" className="w-full h-20 rounded-lg object-cover border" />
                  <Button variant="destructive" size="icon" className="absolute top-1 left-1 h-5 w-5 rounded-full" onClick={() => setPurchaseData(p => ({ ...p, invoice: "" }))}>
                    <XCircle className="w-3 h-3" />
                  </Button>
                </div>
              ) : dropZoneFor === `${item.id}-invoice` ? (
                <DropZone
                  maxFiles={1}
                  accept="image/*,application/pdf"
                  label="اسحب صورة الفاتورة"
                  sublabel="صورة أو PDF"
                  onFilesUploaded={(files: UploadedFile[]) => {
                    const done = files.find(f => f.status === "done" && f.url);
                    if (done?.url) { 
                      trackObjectUrl(`item-${item.id}-invoice`, done.url);
                      setPurchaseData(p => ({ ...p, invoice: done.url! }));
                      setDropZoneFor(null); 
                    }
                  }}
                />
              ) : (
                <div className="flex gap-1 mt-1">
                  <Button variant="outline" size="sm" className="flex-1 h-20 border-dashed gap-1" onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file"; input.accept = "image/*";
                    input.onchange = (e: any) => { if (e.target.files[0]) onUpload(e.target.files[0], item.id, "invoice").then(url => url && setPurchaseData(p => ({ ...p, invoice: url }))); };
                    input.click();
                  }} disabled={uploadingItem === `${item.id}-invoice`}>
                    {uploadingItem === `${item.id}-invoice` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileText className="w-4 h-4" /><span className="text-[10px]">{t.common.upload}</span></>}
                  </Button>
                  <Button variant="outline" size="sm" className="h-20 px-2 border-dashed" onClick={() => setDropZoneFor(`${item.id}-invoice`)} title="سحب وإفلات">
                    <Upload className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label className="text-[11px] text-teal-700">{t.tickets.photos}</Label>
              {purchaseData.purchased ? (
                <div className="relative mt-1">
                  <img src={purchaseData.purchased} alt="" className="w-full h-20 rounded-lg object-cover border" />
                  <Button variant="destructive" size="icon" className="absolute top-1 left-1 h-5 w-5 rounded-full" onClick={() => setPurchaseData(p => ({ ...p, purchased: "" }))}>
                    <XCircle className="w-3 h-3" />
                  </Button>
                </div>
              ) : dropZoneFor === `${item.id}-purchased` ? (
                <DropZone
                  maxFiles={1}
                  accept="image/*"
                  label="اسحب صورة الصنف"
                  sublabel="صورة واحدة"
                  onFilesUploaded={(files: UploadedFile[]) => {
                    const done = files.find(f => f.status === "done" && f.url);
                    if (done?.url) { 
                      trackObjectUrl(`item-${item.id}-purchased`, done.url);
                      setPurchaseData(p => ({ ...p, purchased: done.url! }));
                      setDropZoneFor(null); 
                    }
                  }}
                />
              ) : (
                <div className="flex gap-1 mt-1">
                  <Button variant="outline" size="sm" className="flex-1 h-20 border-dashed gap-1" onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file"; input.accept = "image/*";
                    input.onchange = (e: any) => { if (e.target.files[0]) onUpload(e.target.files[0], item.id, "purchased").then(url => url && setPurchaseData(p => ({ ...p, purchased: url }))); };
                    input.click();
                  }} disabled={uploadingItem === `${item.id}-purchased`}>
                    {uploadingItem === `${item.id}-purchased` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Camera className="w-4 h-4" /><span className="text-[10px]">{t.common.upload}</span></>}
                  </Button>
                  <Button variant="outline" size="sm" className="h-20 px-2 border-dashed" onClick={() => setDropZoneFor(`${item.id}-purchased`)} title="سحب وإفلات">
                    <Upload className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-teal-700">{t.purchaseOrders.actualUnitCost} ({currency})</Label>
              <Input type="number" placeholder="0.00" value={purchaseData.cost} onChange={e => setPurchaseData(p => ({ ...p, cost: e.target.value }))} className="bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-teal-700">{t.purchaseOrders.supplier}</Label>
              <Input placeholder="..." value={purchaseData.supplier} onChange={e => setPurchaseData(p => ({ ...p, supplier: e.target.value }))} className="bg-white" />
            </div>
          </div>
          <Button size="sm" className="w-full gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={() => onConfirmPurchase(item.id, purchaseData)} disabled={isConfirming}>
            {isConfirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {t.purchaseOrders.confirmPurchase}
          </Button>
        </div>
      )}

      {isMyItem && item.status === "purchased" && poStatus === "received" && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-3">
          <p className="text-xs font-medium text-green-800 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> {t.purchaseOrders.receiveItem}:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-green-700">{t.purchaseOrders.actualUnitCost} ({currency})</Label>
              <Input type="number" placeholder="0.00" value={receiveData.cost} onChange={e => setReceiveData(p => ({ ...p, cost: e.target.value }))} className="bg-white" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-green-700">{t.purchaseOrders.supplier}</Label>
              <Input placeholder="..." value={receiveData.supplier} onChange={e => setReceiveData(p => ({ ...p, supplier: e.target.value }))} className="bg-white" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-green-700">{t.purchaseOrders.supplierItemName}</Label>
            <Input placeholder="..." value={receiveData.supplierItemName} onChange={e => setReceiveData(p => ({ ...p, supplierItemName: e.target.value }))} className="bg-white" />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-green-700">صورة استلام المستودع</Label>
            {receiveData.warehousePhotoUrl ? (
              <div className="relative mt-1">
                <img src={receiveData.warehousePhotoUrl} alt="" className="w-full h-24 rounded-lg object-cover border" />
                <Button variant="destructive" size="icon" className="absolute top-1 left-1 h-5 w-5 rounded-full" onClick={() => setReceiveData(p => ({ ...p, warehousePhotoUrl: "" }))}>
                  <XCircle className="w-3 h-3" />
                </Button>
              </div>
            ) : dropZoneFor === `${item.id}-warehouse` ? (
              <DropZone
                maxFiles={1}
                accept="image/*"
                label="اسحب صورة الاستلام"
                sublabel="صورة واحدة"
                onFilesUploaded={(files: UploadedFile[]) => {
                  const done = files.find(f => f.status === "done" && f.url);
                  if (done?.url) { 
                    trackObjectUrl(`item-${item.id}-warehouse`, done.url);
                    setReceiveData(p => ({ ...p, warehousePhotoUrl: done.url! }));
                    setDropZoneFor(null); 
                  }
                }}
              />
            ) : (
              <div className="flex gap-1 mt-1">
                <Button variant="outline" size="sm" className="flex-1 h-20 border-dashed gap-1 border-green-300 text-green-700" onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file"; input.accept = "image/*";
                  input.onchange = (e: any) => { if (e.target.files[0]) onUpload(e.target.files[0], item.id, "warehouse").then(url => url && setReceiveData(p => ({ ...p, warehousePhotoUrl: url }))); };
                  input.click();
                }} disabled={uploadingItem === `${item.id}-warehouse`}>
                  {uploadingItem === `${item.id}-warehouse` ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Camera className="w-4 h-4" /><span className="text-[10px]">التقط صورة</span></>}
                </Button>
                <Button variant="outline" size="sm" className="h-20 px-2 border-dashed border-green-300" onClick={() => setDropZoneFor(`${item.id}-warehouse`)} title="سحب وإفلات">
                  <Upload className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
          <Button size="sm" className="w-full gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => onReceiveItem(item.id, receiveData)} disabled={isReceiving}>
            {isReceiving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {t.purchaseOrders.receiveItem}
          </Button>
        </div>
      )}
    </div>
  );
});

POItemRow.displayName = "POItemRow";
