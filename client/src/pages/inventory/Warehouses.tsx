import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Warehouse, Plus, Loader2, Tag, ArrowLeftRight, Pencil } from "lucide-react";

const WAREHOUSE_TYPE_LABEL: Record<string, string> = {
  main: "رئيسي",
  branch: "فرعي",
  project: "مشروع",
  kitchen: "مطبخ",
};

export default function Warehouses() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const canEditWarehouseName = user?.role === "admin" || user?.role === "owner";

  const { data: warehousesList, isLoading, refetch } = trpc.warehouse.list.useQuery();
  const { data: availableCategories, isLoading: loadingCategories } =
    trpc.warehouse.getAvailableCategories.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [description, setDescription] = useState("");
  const [catalogNodeId, setCatalogNodeId] = useState<string>("");

  const resetForm = () => {
    setNameAr("");
    setNameEn("");
    setDescription("");
    setCatalogNodeId("");
  };

  const createMut = trpc.warehouse.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء المخزن الفرعي بنجاح");
      setShowCreate(false);
      resetForm();
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleCreate = () => {
    if (!nameAr.trim()) { toast.error("اسم المخزن مطلوب"); return; }
    if (!catalogNodeId) { toast.error("الربط بتصنيف من المستوى الأول إلزامي"); return; }
    createMut.mutate({
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || undefined,
      description: description.trim() || undefined,
      catalogNodeId: Number(catalogNodeId),
    });
  };

  // ── تعديل مسمى مخزن فرعي — حصريًا لأدمن ومالك (مفروض أيضًا بالخادم) ──
  const [editingWarehouse, setEditingWarehouse] = useState<any>(null);
  const [editNameAr, setEditNameAr] = useState("");
  const [editNameEn, setEditNameEn] = useState("");

  const openEdit = (wh: any) => {
    setEditingWarehouse(wh);
    setEditNameAr(wh.nameAr);
    setEditNameEn(wh.nameEn || "");
  };

  const updateMut = trpc.warehouse.update.useMutation({
    onSuccess: () => {
      toast.success("تم تعديل اسم المخزن بنجاح");
      setEditingWarehouse(null);
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSaveEdit = () => {
    if (!editingWarehouse) return;
    if (!editNameAr.trim()) { toast.error("اسم المخزن مطلوب"); return; }
    updateMut.mutate({
      id: editingWarehouse.id,
      nameAr: editNameAr.trim(),
      nameEn: editNameEn.trim() || undefined,
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/inventory")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">المخازن</h1>
          <p className="text-sm text-muted-foreground">
            المخزن الرئيسي والمخازن الفرعية، كل مخزن فرعي مرتبط بتصنيف واحد من الكتالوج
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate("/warehouse/transfer")}>
          <ArrowLeftRight className="w-4 h-4" /> تحويل بين المخازن
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> مخزن فرعي جديد
        </Button>
      </div>

      {isLoading && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        </CardContent></Card>
      )}

      {!isLoading && (!warehousesList || warehousesList.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Warehouse className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">لا توجد مخازن بعد</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && warehousesList && warehousesList.length > 0 && (
        <div className="space-y-3">
          {warehousesList.map((wh: any) => (
            <Card key={wh.id} className={wh.type === "main" ? "border-r-4 border-r-primary/60" : "border-r-4 border-r-blue-500/50"}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="font-semibold text-base truncate">{wh.nameAr}</p>
                      {!wh.isActive && <Badge variant="destructive">معطّل</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="bg-muted font-mono px-2 py-0.5 rounded">{wh.code}</span>
                      <Badge variant="outline">{WAREHOUSE_TYPE_LABEL[wh.type] || wh.type}</Badge>
                      {wh.catalogNodeNameAr && (
                        <span className="flex items-center gap-1 text-blue-700">
                          <Tag className="w-3 h-3" /> {wh.catalogNodeNameAr}
                        </span>
                      )}
                    </div>
                    {wh.description && (
                      <p className="text-xs text-muted-foreground">{wh.description}</p>
                    )}
                  </div>
                  {canEditWarehouseName && wh.type !== "main" && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEdit(wh)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ══ نافذة إنشاء مخزن فرعي جديد ══ */}
      <Dialog open={showCreate} onOpenChange={(v) => { setShowCreate(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>مخزن فرعي جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">اسم المخزن *</Label>
              <Input
                placeholder="مثال: مخزن الدهانات"
                value={nameAr}
                onChange={e => setNameAr(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">الاسم بالإنجليزية (اختياري)</Label>
              <Input
                dir="ltr"
                placeholder="e.g. Paint Warehouse"
                value={nameEn}
                onChange={e => setNameEn(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">وصف المخزن (اختياري)</Label>
              <Textarea
                placeholder="ملاحظات إضافية عن هذا المخزن..."
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">التصنيف المرتبط (المستوى الأول بالكتالوج) *</Label>
              <Select value={catalogNodeId} onValueChange={setCatalogNodeId}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingCategories ? "جارِ التحميل..." : "اختر تصنيفاً"} />
                </SelectTrigger>
                <SelectContent>
                  {(availableCategories || []).map((node: any) => (
                    <SelectItem key={node.id} value={String(node.id)}>
                      {node.nameAr}
                    </SelectItem>
                  ))}
                  {!loadingCategories && (!availableCategories || availableCategories.length === 0) && (
                    <div className="p-2 text-xs text-muted-foreground text-center">
                      لا توجد تصنيفات متاحة — كل تصنيفات المستوى الأول مرتبطة بمخازن حالياً
                    </div>
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                يظهر هنا فقط تصنيفات المستوى الأول غير المرتبطة بمخزن آخر بعد
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreate}
              disabled={createMut.isPending || !nameAr.trim() || !catalogNodeId}
            >
              {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنشاء المخزن"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ نافذة تعديل مسمى مخزن فرعي — أدمن ومالك فقط ══ */}
      <Dialog open={!!editingWarehouse} onOpenChange={(v) => !v && setEditingWarehouse(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>تعديل مسمى المخزن</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">اسم المخزن *</Label>
              <Input value={editNameAr} onChange={e => setEditNameAr(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">الاسم بالإنجليزية (اختياري)</Label>
              <Input dir="ltr" value={editNameEn} onChange={e => setEditNameEn(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMut.isPending || !editNameAr.trim()}
            >
              {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ التعديل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
