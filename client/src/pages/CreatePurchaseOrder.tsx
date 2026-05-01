import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowRight, Plus, Trash2, Loader2, ShoppingCart, Camera, Link2, Upload } from "lucide-react";
import DropZone, { type UploadedFile } from "@/components/DropZone";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

type ItemForm = {
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  photoUrl: string;
  notes: string;
};

const emptyItem = (): ItemForm => ({ itemName: "", description: "", quantity: 1, unit: "قطعة", photoUrl: "", notes: "" });

export default function CreatePurchaseOrder() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const ticketId = params.get("ticketId") ? parseInt(params.get("ticketId")!) : undefined;

  const { data: ticket } = trpc.tickets.getById.useQuery(
    { id: ticketId || 0 },
    { enabled: !!ticketId }
  );
  const createMut = trpc.purchaseOrders.create.useMutation({
    onSuccess: (data) => { toast.success(`${t.purchaseOrders.createNew} ${data.poNumber}`); setLocation(`/purchase-orders/${data.id}`); },
    onError: (err) => toast.error(err.message),
  });

  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [showDropZoneIdx, setShowDropZoneIdx] = useState<number | null>(null);

  const updateItem = (idx: number, field: keyof ItemForm, value: any) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleUpload = async (idx: number, file: File) => {
    setUploadingIdx(idx);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) { updateItem(idx, "photoUrl", data.url); toast.success(t.common.save); }
    } catch { toast.error(t.common.close); }
    setUploadingIdx(null);
  };

  const handleSubmit = () => {
    const validItems = items.filter(i => i.itemName.trim());
    if (validItems.length === 0) { toast.error(t.purchaseOrders.items); return; }
    createMut.mutate({
      ticketId,
      notes: notes || undefined,
      items: validItems.map(i => ({
        itemName: i.itemName,
        description: i.description || undefined,
        quantity: i.quantity,
        unit: i.unit || undefined,
        photoUrl: i.photoUrl || undefined,
        notes: i.notes || undefined,
      })),
    });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(ticketId ? `/tickets/${ticketId}` : "/purchase-orders")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">{t.purchaseOrders.createNew}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t.purchaseOrders.items}</p>
        </div>
      </div>

      {ticket && (
        <Card className="border-teal-200 bg-teal-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Link2 className="w-5 h-5 text-teal-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-teal-800">{t.purchaseOrders.relatedTicket}: {ticket.ticketNumber}</p>
              <p className="text-xs text-teal-600">{ticket.title} — {ticket.locationDetail || ""}</p>
            </div>
            <Button variant="ghost" size="sm" className="mr-auto text-xs" onClick={() => setLocation(`/tickets/${ticketId}`)}>
              {t.common.back}
            </Button>
          </CardContent>
        </Card>
      )}

      {items.map((item, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{t.purchaseOrders.itemName} #{idx + 1}</CardTitle>
              {items.length > 1 && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t.purchaseOrders.itemName} *</Label>
              <Input value={item.itemName} onChange={e => updateItem(idx, "itemName", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t.tickets.description}</Label>
              <Textarea value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t.purchaseOrders.quantity} *</Label>
                <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>{t.purchaseOrders.unit}</Label>
                <Input value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t.tickets.photos}</Label>
                {item.photoUrl ? (
                  <div className="relative">
                    <img src={item.photoUrl} alt="" className="w-full h-20 rounded-lg object-cover border" />
                    <Button variant="destructive" size="icon" className="absolute top-1 left-1 h-6 w-6" onClick={() => { updateItem(idx, "photoUrl", ""); setShowDropZoneIdx(null); }}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ) : showDropZoneIdx === idx ? (
                  <DropZone
                    maxFiles={1}
                    accept="image/*"
                    label="اسحب صورة الصنف"
                    sublabel="صورة واحدة فقط"
                    onFilesUploaded={(files: UploadedFile[]) => {
                      const done = files.find(f => f.status === "done" && f.url);
                      if (done?.url) { updateItem(idx, "photoUrl", done.url); setShowDropZoneIdx(null); }
                    }}
                  />
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-20 border-dashed gap-1" onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file"; input.accept = "image/*";
                      input.onchange = (e: any) => { if (e.target.files[0]) handleUpload(idx, e.target.files[0]); };
                      input.click();
                    }} disabled={uploadingIdx === idx}>
                      {uploadingIdx === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      {uploadingIdx === idx ? "..." : t.common.upload}
                    </Button>
                    <Button variant="outline" size="sm" className="h-20 px-3 border-dashed" onClick={() => setShowDropZoneIdx(idx)} title="سحب وإفلات">
                      <Upload className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.purchaseOrders.justification}</Label>
              <Input value={item.notes} onChange={e => updateItem(idx, "notes", e.target.value)} />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={() => setItems(prev => [...prev, emptyItem()])} className="w-full gap-2 border-dashed h-12">
        <Plus className="w-4 h-4" /> {t.common.add}
      </Button>

      <div className="space-y-3">
        <Textarea placeholder={t.purchaseOrders.justification} value={notes} onChange={e => setNotes(e.target.value)} />
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-muted-foreground">{items.filter(i => i.itemName.trim()).length} {t.purchaseOrders.items}</span>
              {ticket && <span className="text-xs text-muted-foreground">{t.purchaseOrders.relatedTicket}: {ticket.ticketNumber}</span>}
            </div>
            <Button onClick={handleSubmit} disabled={createMut.isPending} className="w-full gap-2" size="lg">
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              {t.common.submit}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
