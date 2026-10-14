import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag, Plus, Pencil, Check, X, Power } from "lucide-react";

export default function PurchaseCategories() {
  const { language } = useTranslation();
  const copy = language === "ar"
    ? {
        title: "التصنيفات",
        subtitle: "إدارة التصنيفات المركزية المستخدمة في طلبات الشراء وتذاكر الصيانة",
        addTitle: "إضافة تصنيف جديد",
        placeholder: "اسم التصنيف الجديد",
        add: "إضافة",
        current: "التصنيفات الحالية",
        empty: "لا توجد تصنيفات بعد. أضف أول تصنيف من الأعلى.",
        edit: "تعديل",
        activate: "تفعيل",
        deactivate: "تعطيل",
        active: "نشط",
        inactive: "معطّل",
        added: "تم إضافة التصنيف بنجاح",
        updated: "تم تعديل التصنيف بنجاح",
        statusChanged: "تم تحديث حالة التصنيف",
      }
    : language === "ur"
      ? {
          title: "خریداری کی درجہ بندیاں",
          subtitle: "خریداری آرڈرز اور مینٹیننس ٹکٹس میں استعمال ہونے والی مرکزی درجہ بندیوں کا انتظام",
          addTitle: "نئی درجہ بندی شامل کریں",
          placeholder: "درجہ بندی کا نام",
          add: "شامل کریں",
          current: "موجودہ درجہ بندیاں",
          empty: "ابھی کوئی درجہ بندی نہیں۔ اوپر سے پہلی درجہ بندی شامل کریں۔",
          edit: "ترمیم",
          activate: "فعال کریں",
          deactivate: "غیر فعال کریں",
          active: "فعال",
          inactive: "غیر فعال",
          added: "درجہ بندی شامل کر دی گئی",
          updated: "درجہ بندی اپ ڈیٹ کر دی گئی",
          statusChanged: "درجہ بندی کی حالت اپ ڈیٹ ہو گئی",
        }
      : {
          title: "Purchase Categories",
          subtitle: "Manage the central categories used by purchase orders and maintenance tickets",
          addTitle: "Add new category",
          placeholder: "Category name",
          add: "Add",
          current: "Current categories",
          empty: "No categories yet. Add the first category above.",
          edit: "Edit",
          activate: "Activate",
          deactivate: "Deactivate",
          active: "Active",
          inactive: "Inactive",
          added: "Category added successfully",
          updated: "Category updated successfully",
          statusChanged: "Category status updated",
        };

  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const utils = trpc.useUtils();
  const { data: categories = [], isLoading } = trpc.centerCategories.list.useQuery({ activeOnly: false });

  const refresh = () => utils.centerCategories.list.invalidate();
  const createMut = trpc.centerCategories.create.useMutation({
    onSuccess: () => { refresh(); setNewName(""); toast.success(copy.added); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.centerCategories.update.useMutation({
    onSuccess: () => { refresh(); setEditId(null); setEditName(""); toast.success(copy.updated); },
    onError: (e) => toast.error(e.message),
  });
  const toggleMut = trpc.centerCategories.update.useMutation({
    onSuccess: () => { refresh(); toast.success(copy.statusChanged); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Tag className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">{copy.title}</h1>
          <p className="text-muted-foreground text-sm">{copy.subtitle}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{copy.addTitle}</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder={copy.placeholder}
              value={newName}
              maxLength={255}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) createMut.mutate({ name: newName.trim() });
              }}
            />
            <Button onClick={() => createMut.mutate({ name: newName.trim() })} disabled={createMut.isPending || !newName.trim()}>
              <Plus className="h-4 w-4 me-1" />{copy.add}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {copy.current}
            <Badge variant="secondary">{categories.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />)}</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{copy.empty}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((category: any) => {
                const active = Boolean(category.isActive);
                return (
                  <div key={category.id} className="flex items-center gap-2 border rounded-lg px-4 py-3 bg-background hover:bg-muted/30 transition-colors">
                    {editId === category.id ? (
                      <>
                        <Input
                          className="flex-1"
                          value={editName}
                          maxLength={255}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && editName.trim()) updateMut.mutate({ id: category.id, name: editName.trim() });
                            if (e.key === "Escape") { setEditId(null); setEditName(""); }
                          }}
                          autoFocus
                        />
                        <Button size="sm" onClick={() => updateMut.mutate({ id: category.id, name: editName.trim() })} disabled={updateMut.isPending || !editName.trim()}><Check className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditId(null); setEditName(""); }}><X className="h-4 w-4" /></Button>
                      </>
                    ) : (
                      <>
                        <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="flex-1 text-sm font-medium">{category.name}</span>
                        {category.systemKey === "it" && <Badge variant="outline">IT System</Badge>}
                        <Badge variant={active ? "default" : "secondary"}>{active ? copy.active : copy.inactive}</Badge>
                        <Button size="sm" variant="outline" onClick={() => { setEditId(category.id); setEditName(category.sourceName || category.name); }}>
                          <Pencil className="h-3.5 w-3.5 me-1" />{copy.edit}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => toggleMut.mutate({ id: category.id, isActive: !active })} disabled={toggleMut.isPending || !!category.systemKey}>
                          <Power className="h-3.5 w-3.5 me-1" />{active ? copy.deactivate : copy.activate}
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
