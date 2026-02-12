import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Trash2, Upload, Loader2, ShoppingCart, Camera, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ItemForm = {
  itemName: string;
  description: string;
  quantity: number;
  unit: string;
  photoUrl: string;
  notes: string;
  delegateId: string;
};

const emptyItem = (): ItemForm => ({ itemName: "", description: "", quantity: 1, unit: "قطعة", photoUrl: "", notes: "", delegateId: "" });

export default function CreatePurchaseOrder() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const ticketId = params.get("ticketId") ? parseInt(params.get("ticketId")!) : undefined;

  const { data: delegates } = trpc.users.byRole.useQuery({ role: "delegate" });
  const { data: ticket } = trpc.tickets.getById.useQuery(
    { id: ticketId || 0 },
    { enabled: !!ticketId }
  );
  const createMut = trpc.purchaseOrders.create.useMutation({
    onSuccess: (data) => { toast.success(`تم إنشاء طلب الشراء ${data.poNumber}`); setLocation(`/purchase-orders/${data.id}`); },
    onError: (err) => toast.error(err.message),
  });

  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

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
      if (data.url) { updateItem(idx, "photoUrl", data.url); toast.success("تم رفع الصورة"); }
    } catch { toast.error("فشل رفع الصورة"); }
    setUploadingIdx(null);
  };

  const handleSubmit = () => {
    const validItems = items.filter(i => i.itemName.trim());
    if (validItems.length === 0) { toast.error("يرجى إضافة صنف واحد على الأقل"); return; }
    const missingDelegate = validItems.some(i => !i.delegateId);
    if (missingDelegate) { toast.error("يرجى اختيار المندوب لكل صنف"); return; }
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
        delegateId: parseInt(i.delegateId),
      })),
    });
  };

  // Group items by delegate for summary
  const delegateGroups = items.filter(i => i.itemName.trim() && i.delegateId).reduce((acc, item) => {
    const did = item.delegateId;
    if (!acc[did]) acc[did] = [];
    acc[did].push(item);
    return acc;
  }, {} as Record<string, ItemForm[]>);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation(ticketId ? `/tickets/${ticketId}` : "/purchase-orders")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">طلب شراء جديد</h1>
          <p className="text-sm text-muted-foreground mt-0.5">أضف الأصناف المطلوبة واختر المندوب المسؤول عن شراء كل صنف</p>
        </div>
      </div>

      {/* Linked Ticket */}
      {ticket && (
        <Card className="border-teal-200 bg-teal-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <Link2 className="w-5 h-5 text-teal-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-teal-800">مرتبط بالبلاغ: {ticket.ticketNumber}</p>
              <p className="text-xs text-teal-600">{ticket.title} — {ticket.locationDetail || ""}</p>
            </div>
            <Button variant="ghost" size="sm" className="mr-auto text-xs" onClick={() => setLocation(`/tickets/${ticketId}`)}>
              عرض البلاغ
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      {items.map((item, idx) => (
        <Card key={idx}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">الصنف #{idx + 1}</CardTitle>
              {items.length > 1 && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم المادة *</Label>
                <Input placeholder="مثال: لوحة تحكم قفل إلكتروني موديل K-55" value={item.itemName} onChange={e => updateItem(idx, "itemName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>المندوب المسؤول *</Label>
                <Select value={item.delegateId} onValueChange={v => updateItem(idx, "delegateId", v)}>
                  <SelectTrigger><SelectValue placeholder="اختر المندوب" /></SelectTrigger>
                  <SelectContent>
                    {delegates?.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.name || d.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea placeholder="وصف تفصيلي للصنف المطلوب..." value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>الكمية *</Label>
                <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>الوحدة</Label>
                <Input placeholder="قطعة" value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>صورة المادة (اختياري)</Label>
                {item.photoUrl ? (
                  <div className="relative">
                    <img src={item.photoUrl} alt="" className="w-full h-20 rounded-lg object-cover border" />
                    <Button variant="destructive" size="icon" className="absolute top-1 left-1 h-6 w-6" onClick={() => updateItem(idx, "photoUrl", "")}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full h-20 border-dashed gap-1" onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file"; input.accept = "image/*";
                    input.onchange = (e: any) => { if (e.target.files[0]) handleUpload(idx, e.target.files[0]); };
                    input.click();
                  }} disabled={uploadingIdx === idx}>
                    {uploadingIdx === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    {uploadingIdx === idx ? "..." : "رفع صورة"}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات / سبب الطلب</Label>
              <Input placeholder="مثال: اللوحة الحالية تالفة بسبب تماس كهربائي" value={item.notes} onChange={e => updateItem(idx, "notes", e.target.value)} />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={() => setItems(prev => [...prev, emptyItem()])} className="w-full gap-2 border-dashed h-12">
        <Plus className="w-4 h-4" /> إضافة صنف آخر
      </Button>

      {/* Delegate Summary */}
      {Object.keys(delegateGroups).length > 0 && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">توزيع الأصناف على المناديب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(delegateGroups).map(([did, ditems]) => {
              const delegateName = delegates?.find(d => String(d.id) === did)?.name || `مندوب #${did}`;
              return (
                <div key={did} className="flex items-center justify-between text-sm bg-background rounded-lg p-2.5 border">
                  <span className="font-medium">{delegateName}</span>
                  <span className="text-muted-foreground">{ditems.length} صنف</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Notes & Submit */}
      <div className="space-y-3">
        <Textarea placeholder="ملاحظات عامة على الطلب (اختياري)..." value={notes} onChange={e => setNotes(e.target.value)} />
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-muted-foreground">{items.filter(i => i.itemName.trim()).length} صنف — {Object.keys(delegateGroups).length} مندوب</span>
              {ticket && <span className="text-xs text-muted-foreground">مرتبط بـ {ticket.ticketNumber}</span>}
            </div>
            <Button onClick={handleSubmit} disabled={createMut.isPending} className="w-full gap-2" size="lg">
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              إرسال طلب الشراء
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">سيتم إرسال الطلب لكل مندوب ليرى فقط الأصناف المسندة إليه</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
