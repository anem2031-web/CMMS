import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_LABELS, CATEGORY_LABELS } from "@shared/types";
import { ArrowRight, Upload, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

export default function CreateTicket() {
  const [, setLocation] = useLocation();
  const { data: sites } = trpc.sites.list.useQuery();
  const createMut = trpc.tickets.create.useMutation({
    onSuccess: (data) => { toast.success(`تم إنشاء البلاغ ${data.ticketNumber}`); setLocation(`/tickets/${data.id}`); },
    onError: (err) => toast.error(err.message),
  });

  const [form, setForm] = useState({ title: "", description: "", priority: "medium", category: "general", siteId: "", locationDetail: "", beforePhotoUrl: "" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) { setForm(f => ({ ...f, beforePhotoUrl: data.url })); toast.success("تم رفع الصورة"); }
      else toast.error("فشل رفع الصورة");
    } catch { toast.error("فشل رفع الصورة"); }
    setUploading(false);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error("يرجى إدخال عنوان البلاغ"); return; }
    createMut.mutate({
      ...form,
      siteId: form.siteId ? parseInt(form.siteId) : undefined,
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/tickets")}><ArrowRight className="w-5 h-5" /></Button>
        <h1 className="text-xl font-bold">إنشاء بلاغ جديد</h1>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>عنوان البلاغ *</Label>
            <Input placeholder="وصف مختصر للمشكلة..." value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>وصف تفصيلي</Label>
            <Textarea placeholder="اشرح المشكلة بالتفصيل..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الأولوية</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفئة</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>الموقع</Label>
              <Select value={form.siteId} onValueChange={v => setForm(f => ({ ...f, siteId: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر الموقع" /></SelectTrigger>
                <SelectContent>
                  {sites?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تفاصيل الموقع</Label>
              <Input placeholder="مثال: الطابق الثاني، غرفة 205" value={form.locationDetail} onChange={e => setForm(f => ({ ...f, locationDetail: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>صورة المشكلة</Label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            {form.beforePhotoUrl ? (
              <div className="relative">
                <img src={form.beforePhotoUrl} alt="preview" className="rounded-lg max-h-48 object-cover border" />
                <Button variant="destructive" size="sm" className="absolute top-2 left-2" onClick={() => setForm(f => ({ ...f, beforePhotoUrl: "" }))}>حذف</Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full h-24 border-dashed gap-2">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                {uploading ? "جاري الرفع..." : "اضغط لرفع صورة"}
              </Button>
            )}
          </div>
          <Button onClick={handleSubmit} disabled={createMut.isPending} className="w-full" size="lg">
            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
            إنشاء البلاغ
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
