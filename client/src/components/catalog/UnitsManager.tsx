import { useState } from "react";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { isCatalogAdminRole } from "@shared/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Edit2, Loader2, Ruler, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export default function UnitsManager() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isCatalogAdmin = isCatalogAdminRole(user?.role);
  const [dialogMode, setDialogMode] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected] = useState<{ id: number; nameAr: string; nameEn: string } | null>(null);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");

  const { data: units, isLoading, refetch } = trpc.catalog.units.list.useQuery({
    includeInactive: isCatalogAdmin || undefined,
  });

  const createMut = trpc.catalog.units.create.useMutation({
    onSuccess: () => { refetch(); close(); toast.success("تمت إضافة الوحدة"); },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.catalog.units.update.useMutation({
    onSuccess: () => { refetch(); close(); toast.success("تم تعديل الوحدة"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.catalog.units.delete.useMutation({
    onSuccess: () => { refetch(); toast.success("تم تعطيل الوحدة"); },
    onError: (e) => toast.error(e.message),
  });

  const reactivateMut = trpc.catalog.units.reactivate.useMutation({
    onSuccess: () => { refetch(); toast.success("تمت إعادة تفعيل الوحدة"); },
    onError: (e) => toast.error(e.message),
  });

  const close = () => {
    setDialogMode(null);
    setSelected(null);
    setNameAr("");
    setNameEn("");
  };

  const openAdd = () => { setDialogMode("add"); setNameAr(""); setNameEn(""); };

  const openEdit = (unit: { id: number; nameAr: string; nameEn: string }) => {
    setSelected(unit);
    setNameAr(unit.nameAr);
    setNameEn(unit.nameEn);
    setDialogMode("edit");
  };

  const handleSubmit = async () => {
    if (!nameAr.trim() || !nameEn.trim()) {
      toast.error("الاسم بالعربية والإنجليزية مطلوبان");
      return;
    }
    if (dialogMode === "edit" && selected) {
      await updateMut.mutateAsync({ id: selected.id, nameAr: nameAr.trim(), nameEn: nameEn.trim() });
    } else {
      await createMut.mutateAsync({ nameAr: nameAr.trim(), nameEn: nameEn.trim() });
    }
  };

  const isPending = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">وحدات القياس</h3>
        <Button size="sm" className="gap-2" onClick={openAdd}>
          <Plus className="w-4 h-4" />
          إضافة وحدة
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : units && units.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {units.map((unit: any) => {
            const isActive = Number(unit.isActive) === 1;
            return (
              <Card key={unit.id} className={`hover:shadow-md transition-shadow ${!isActive ? "opacity-80 border-dashed" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Ruler className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{unit.nameAr}</p>
                          {!isActive && (
                            <span className="text-[11px] font-medium rounded-full border px-2 py-0.5 text-muted-foreground">معطّل</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{unit.nameEn}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(unit)}
                        className="p-1 rounded hover:bg-blue-100 hover:text-blue-700 transition-colors"
                        title="تعديل"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {isCatalogAdmin && isActive && (
                        <button
                          onClick={() => {
                            if (confirm(`تعطيل وحدة "${unit.nameAr}"؟\n\nستختفي من الاختيارات الجديدة، مع بقاء السجلات التاريخية كما هي.`)) {
                              deleteMut.mutate(unit.id);
                            }
                          }}
                          className="p-1 rounded hover:bg-red-100 hover:text-red-700 transition-colors"
                          title="تعطيل"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isCatalogAdmin && !isActive && (
                        <button
                          onClick={() => reactivateMut.mutate(unit.id)}
                          className="p-1 rounded hover:bg-green-100 hover:text-green-700 transition-colors"
                          title="إعادة تفعيل"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Ruler className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>لا توجد وحدات — أضف وحدات القياس التي ستستخدمها في الأصناف</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
              إضافة أول وحدة
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!dialogMode} onOpenChange={() => close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "edit" ? "تعديل الوحدة" : "إضافة وحدة جديدة"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">الاسم بالعربية *</label>
              <Input
                value={nameAr}
                onChange={e => setNameAr(e.target.value)}
                placeholder="مثال: قطعة"
                dir="rtl"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">الاسم بالإنجليزية *</label>
              <Input
                value={nameEn}
                onChange={e => setNameEn(e.target.value)}
                placeholder="Example: Piece"
                dir="ltr"
              />
            </div>
            <Button onClick={handleSubmit} disabled={isPending} className="w-full">
              {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isPending ? t.common.saving : t.common.save}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
