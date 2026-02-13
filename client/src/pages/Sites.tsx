import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";

export default function Sites() {
  const { t } = useTranslation();
  const { data: sites, isLoading, refetch } = trpc.sites.list.useQuery();
  const createMut = trpc.sites.create.useMutation({
    onSuccess: () => { toast.success(t.common.save); refetch(); setOpen(false); resetForm(); },
    onError: (err) => toast.error(err.message),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", address: "", description: "" });
  const resetForm = () => setForm({ name: "", address: "", description: "" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.sites.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.sites.description}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> {t.sites.addSite}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t.sites.addSite}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>{t.sites.siteName} *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>{t.sites.address}</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="space-y-2"><Label>{t.sites.description}</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} /></div>
              <Button onClick={() => { if (!form.name.trim()) { toast.error(t.sites.siteName); return; } createMut.mutate(form); }} disabled={createMut.isPending} className="w-full">{t.common.add}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
      ) : !sites?.length ? (
        <Card><CardContent className="p-12 text-center">
          <MapPin className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">{t.common.noData}</h3>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map(site => (
            <Card key={site.id} className="hover:shadow-lg hover:border-primary/20 transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">{site.name}</h3>
                    {site.address && <p className="text-xs text-muted-foreground mt-0.5">{site.address}</p>}
                    {site.description && <p className="text-xs text-muted-foreground mt-1">{site.description}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
