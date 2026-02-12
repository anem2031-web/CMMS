import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Package, Plus, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function Inventory() {
  const { data: items, isLoading, refetch } = trpc.inventory.list.useQuery();
  const createMut = trpc.inventory.create.useMutation({ onSuccess: () => { toast.success("تمت إضافة الصنف"); refetch(); setOpen(false); } });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ itemName: "", description: "", quantity: 0, unit: "قطعة", minQuantity: 0, location: "" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">المستودع</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة المخزون والمواد</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="w-4 h-4" /> إضافة صنف</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>إضافة صنف جديد</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>اسم الصنف *</Label><Input value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))} /></div>
              <div className="space-y-2"><Label>الوصف</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2"><Label>الكمية</Label><Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: parseInt(e.target.value) || 0 }))} /></div>
                <div className="space-y-2"><Label>الوحدة</Label><Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} /></div>
                <div className="space-y-2"><Label>الحد الأدنى</Label><Input type="number" value={form.minQuantity} onChange={e => setForm(f => ({ ...f, minQuantity: parseInt(e.target.value) || 0 }))} /></div>
              </div>
              <div className="space-y-2"><Label>الموقع</Label><Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} /></div>
              <Button onClick={() => { if (!form.itemName) { toast.error("يرجى إدخال اسم الصنف"); return; } createMut.mutate(form); }} disabled={createMut.isPending} className="w-full">إضافة</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full" /></CardContent></Card>)}</div>
      ) : !items?.length ? (
        <Card><CardContent className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">المستودع فارغ</h3>
          <p className="text-sm text-muted-foreground">لم تتم إضافة أي أصناف بعد</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(item => {
            const isLow = (item.minQuantity || 0) > 0 && item.quantity <= (item.minQuantity || 0);
            return (
              <Card key={item.id} className="hover:shadow-lg hover:border-primary/20 transition-all duration-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-sm">{item.itemName}</h3>
                    {isLow && <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="w-3 h-3" /> منخفض</Badge>}
                  </div>
                  {item.description && <p className="text-xs text-muted-foreground mb-2">{item.description}</p>}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">الكمية:</span>
                    <span className={`font-bold ${isLow ? "text-destructive" : ""}`}>{item.quantity} {item.unit}</span>
                  </div>
                  {item.location && <div className="flex items-center justify-between text-xs text-muted-foreground mt-1"><span>الموقع:</span><span>{item.location}</span></div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
