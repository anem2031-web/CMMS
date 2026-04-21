import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

export default function Technicians() {
  const [isOpen, setIsOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", specialty: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const { data: technicians = [], refetch } = trpc.technicians.list.useQuery({ activeOnly: false });

  const createMutation = trpc.technicians.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة الفني بنجاح"); refetch(); closeDialog(); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.technicians.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث بيانات الفني"); refetch(); closeDialog(); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.technicians.delete.useMutation({
    onSuccess: () => { toast.success("تم حذف الفني"); refetch(); setDeleteConfirm(null); },
    onError: (e) => toast.error(e.message),
  });

  const toggleStatusMutation = trpc.technicians.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث الحالة"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setForm({ name: "", specialty: "" });
    setIsOpen(true);
  }

  function openEdit(tech: { id: number; name: string | null; specialty: string | null }) {
    setEditId(tech.id);
    setForm({ name: tech.name || "", specialty: tech.specialty || "" });
    setIsOpen(true);
  }

  function closeDialog() {
    setIsOpen(false);
    setEditId(null);
    setForm({ name: "", specialty: "" });
  }

  function handleSubmit() {
    if (!form.name.trim()) { toast.error("اسم الفني مطلوب"); return; }
    if (editId) {
      updateMutation.mutate({ id: editId, name: form.name, specialty: form.specialty || undefined });
    } else {
      createMutation.mutate({ name: form.name, specialty: form.specialty || undefined });
    }
  }

  const activeTechs = technicians.filter(t => t.status === "active").length;
  const inactiveTechs = technicians.filter(t => t.status === "inactive").length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UserCog className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">إدارة الفنيين</h1>
            <p className="text-sm text-muted-foreground">إضافة وإدارة الفنيين الميدانيين</p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة فني
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-primary">{technicians.length}</div>
          <div className="text-sm text-muted-foreground mt-1">إجمالي الفنيين</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{activeTechs}</div>
          <div className="text-sm text-muted-foreground mt-1">فنيون نشطون</div>
        </div>
        <div className="bg-card border rounded-lg p-4 text-center">
          <div className="text-3xl font-bold text-gray-400">{inactiveTechs}</div>
          <div className="text-sm text-muted-foreground mt-1">فنيون غير نشطين</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">#</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">التخصص</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {technicians.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  لا يوجد فنيون مسجلون. أضف أول فني الآن.
                </TableCell>
              </TableRow>
            ) : (
              technicians.map((tech, idx) => (
                <TableRow key={tech.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{tech.name}</TableCell>
                  <TableCell className="text-muted-foreground">{tech.specialty || "—"}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleStatusMutation.mutate({ id: tech.id, status: tech.status === "active" ? "inactive" : "active" })}
                      className="cursor-pointer"
                    >
                      <Badge variant={tech.status === "active" ? "default" : "secondary"}>
                        {tech.status === "active" ? "نشط" : "غير نشط"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(tech)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(tech.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "تعديل بيانات الفني" : "إضافة فني جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>الاسم <span className="text-destructive">*</span></Label>
              <Input
                placeholder="اسم الفني"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>التخصص</Label>
              <Input
                placeholder="مثال: كهربائي، سباك، ميكانيكي..."
                value={form.specialty}
                onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editId ? "حفظ التعديلات" : "إضافة الفني"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">هل أنت متأكد من حذف هذا الفني؟ لا يمكن التراجع عن هذا الإجراء.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>إلغاء</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm })} disabled={deleteMutation.isPending}>
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
