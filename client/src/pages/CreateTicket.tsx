import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Upload, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";

export default function CreateTicket() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { getPriorityLabel, getCategoryLabel } = useStaticLabels();
  const { data: sites } = trpc.sites.list.useQuery();
  const createMut = trpc.tickets.create.useMutation({
    onSuccess: (data) => { toast.success(`${t.tickets.createNew} ${data.ticketNumber}`); setLocation(`/tickets/${data.id}`); },
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
      if (data.url) { setForm(f => ({ ...f, beforePhotoUrl: data.url })); toast.success(t.common.save); }
      else toast.error(t.common.close);
    } catch { toast.error(t.common.close); }
    setUploading(false);
  };

  const handleSubmit = () => {
    if (!form.title.trim()) { toast.error(t.tickets.ticketTitle); return; }
    createMut.mutate({
      ...form,
      siteId: form.siteId ? parseInt(form.siteId) : undefined,
    });
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/tickets")}><ArrowRight className="w-5 h-5" /></Button>
        <h1 className="text-xl font-bold">{t.tickets.createNew}</h1>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="space-y-2">
            <Label>{t.tickets.ticketTitle} *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t.tickets.description}</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.tickets.priority}</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(t.priority).map(k => <SelectItem key={k} value={k}>{getPriorityLabel(k)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.tickets.category}</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(t.category).map(k => <SelectItem key={k} value={k}>{getCategoryLabel(k)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t.tickets.site}</Label>
              <Select value={form.siteId} onValueChange={v => setForm(f => ({ ...f, siteId: v }))}>
                <SelectTrigger><SelectValue placeholder={t.tickets.site} /></SelectTrigger>
                <SelectContent>
                  {sites?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t.tickets.site}</Label>
              <Input value={form.locationDetail} onChange={e => setForm(f => ({ ...f, locationDetail: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.tickets.photos}</Label>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
            {form.beforePhotoUrl ? (
              <div className="relative">
                <img src={form.beforePhotoUrl} alt="preview" className="rounded-lg max-h-48 object-cover border" />
                <Button variant="destructive" size="sm" className="absolute top-2 left-2" onClick={() => setForm(f => ({ ...f, beforePhotoUrl: "" }))}>{t.common.delete}</Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full h-24 border-dashed gap-2">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                {uploading ? t.common.loading : t.tickets.photos}
              </Button>
            )}
          </div>
          <Button onClick={handleSubmit} disabled={createMut.isPending} className="w-full" size="lg">
            {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
            {t.tickets.createNew}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
