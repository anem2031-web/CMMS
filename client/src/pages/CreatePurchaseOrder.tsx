import { trpc } from "@/lib/trpc";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
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
        delegateId: i.delegateId ? parseInt(i.delegateId) : undefined,
      })),
    });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/purchase-orders")}><ArrowRight className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-xl font-bold">طلب شراء جديد</h1>
          {ticketId && <p className="text-sm text-muted-foreground">مرتبط بالبلاغ رقم {ticketId}</p>}
        </div>
      </div>

      {/* Items */}
      {items.map((item, idx) => (
        <Card key={idx}>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">الصنف {idx + 1}</h3>
              {items.length > 1 && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم المادة *</Label>
                <Input placeholder="مثال: لوحة تحكم قفل إلكتروني" value={item.itemName} onChange={e => updateItem(idx, "itemName", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>المندوب</Label>
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
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>الكمية</Label>
                <Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} />
              </div>
              <div className="space-y-2">
                <Label>الوحدة</Label>
                <Input placeholder="قطعة" value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>صورة</Label>
                {item.photoUrl ? (
                  <div className="relative">
                    <img src={item.photoUrl} alt="" className="w-full h-20 rounded object-cover border" />
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
                    {uploadingIdx === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Input placeholder="ملاحظات إضافية..." value={item.notes} onChange={e => updateItem(idx, "notes", e.target.value)} />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={() => setItems(prev => [...prev, emptyItem()])} className="w-full gap-2 border-dashed h-12">
        <Plus className="w-4 h-4" /> إضافة صنف آخر
      </Button>

      <div className="space-y-3">
        <Textarea placeholder="ملاحظات عامة على الطلب (اختياري)..." value={notes} onChange={e => setNotes(e.target.value)} />
        <Button onClick={handleSubmit} disabled={createMut.isPending} className="w-full" size="lg">
          {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
          إرسال طلب الشراء
        </Button>
      </div>
    </div>
  );
}
