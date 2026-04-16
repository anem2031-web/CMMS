import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Users as UsersIcon, Pencil, Trash2, UserPlus, Eye, EyeOff, KeyRound, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  owner: "bg-purple-100 text-purple-700",
  maintenance_manager: "bg-blue-100 text-blue-700",
  technician: "bg-teal-100 text-teal-700",
  operator: "bg-cyan-100 text-cyan-700",
  purchase_manager: "bg-amber-100 text-amber-700",
  delegate: "bg-orange-100 text-orange-700",
  accountant: "bg-emerald-100 text-emerald-700",
  senior_management: "bg-violet-100 text-violet-700",
  warehouse: "bg-lime-100 text-lime-700",
  supervisor: "bg-indigo-100 text-indigo-700",
  gate_security: "bg-rose-100 text-rose-700",
  user: "bg-gray-100 text-gray-700",
};

const EMPTY_CREATE = {
  username: "",
  password: "",
  name: "",
  role: "technician",
  email: "",
  phone: "",
  department: "",
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  const { getRoleLabel } = useStaticLabels();
  const utils = trpc.useUtils();

  const { data: users, isLoading } = trpc.users.list.useQuery();

  const createMut = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء المستخدم بنجاح");
      utils.users.list.invalidate();
      setCreateOpen(false);
      setCreateForm(EMPTY_CREATE);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success(t.common.savedSuccessfully);
      utils.users.list.invalidate();
      setEditOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const resetPasswordMut = trpc.users.resetPassword.useMutation({
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور بنجاح");
      setResetOpen(false);
      setNewPassword("");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMut = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success(t.common.deletedSuccessfully);
      utils.users.list.invalidate();
      setDeleteOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const canManage = ["admin", "owner"].includes(currentUser?.role || "");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [showCreatePassword, setShowCreatePassword] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "", phone: "", department: "" });

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Search
  const [search, setSearch] = useState("");

  const openEdit = (u: any) => {
    setSelectedUser(u);
    setEditForm({ name: u.name || "", email: u.email || "", role: u.role, phone: u.phone || "", department: u.department || "" });
    setEditOpen(true);
  };

  const openDelete = (u: any) => {
    setSelectedUser(u);
    setDeleteOpen(true);
  };

  const openReset = (u: any) => {
    setResetUser(u);
    setNewPassword("");
    setResetOpen(true);
  };

  const filteredUsers = users?.filter((u: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.username || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      getRoleLabel(u.role).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.users.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة أعضاء الفريق وتحديد صلاحياتهم
          </p>
        </div>
        {canManage && (
          <Button onClick={() => { setCreateForm(EMPTY_CREATE); setCreateOpen(true); }} className="gap-2">
            <UserPlus className="w-4 h-4" />
            إضافة مستخدم جديد
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو اسم المستخدم أو الدور..."
          className="pr-9"
        />
      </div>

      {/* Users list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : !filteredUsers?.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <UsersIcon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">
              {search ? "لا توجد نتائج مطابقة" : t.common.noData}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((u: any) => (
            <Card key={u.id} className="shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {(u.name || u.username || "?")[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm truncate">{u.name || "-"}</h3>
                        {u.username && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                            @{u.username}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {u.email && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                        {u.phone && <p className="text-xs text-muted-foreground">{u.phone}</p>}
                        {u.department && <p className="text-xs text-muted-foreground">• {u.department}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-[11px] ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-700"}`}>
                      {getRoleLabel(u.role)}
                    </Badge>
                    {canManage && u.id !== currentUser?.id && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="تعديل البيانات" onClick={() => openEdit(u)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700" title="تغيير كلمة المرور" onClick={() => openReset(u)}>
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        {u.role !== "owner" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="حذف المستخدم" onClick={() => openDelete(u)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ====== Create User Dialog ====== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              إضافة مستخدم جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم الكامل <span className="text-destructive">*</span></Label>
                <Input
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="مثال: خالد العمري"
                />
              </div>
              <div className="space-y-2">
                <Label>اسم المستخدم (للدخول) <span className="text-destructive">*</span></Label>
                <Input
                  value={createForm.username}
                  onChange={e => setCreateForm(f => ({ ...f, username: e.target.value.trim() }))}
                  placeholder="مثال: khaled"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  type={showCreatePassword ? "text" : "password"}
                  value={createForm.password}
                  onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="4 أحرف على الأقل"
                  dir="ltr"
                  className="pl-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                >
                  {showCreatePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>الدور <span className="text-destructive">*</span></Label>
              <Select value={createForm.role} onValueChange={v => setCreateForm(f => ({ ...f, role: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(t.roles).filter(k => k !== "user").map(k => (
                    <SelectItem key={k} value={k}>{getRoleLabel(k)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>رقم الهاتف</Label>
                <Input
                  value={createForm.phone}
                  onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>القسم</Label>
                <Input
                  value={createForm.department}
                  onChange={e => setCreateForm(f => ({ ...f, department: e.target.value }))}
                  placeholder="مثال: الصيانة الكهربائية"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                placeholder="example@company.com"
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t.common.cancel}</Button>
            <Button
              onClick={() => createMut.mutate({
                username: createForm.username,
                password: createForm.password,
                name: createForm.name,
                role: createForm.role,
                email: createForm.email || undefined,
                phone: createForm.phone || undefined,
                department: createForm.department || undefined,
              })}
              disabled={createMut.isPending || !createForm.username || !createForm.password || !createForm.name}
            >
              {createMut.isPending ? "جاري الإنشاء..." : "إنشاء المستخدم"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Edit User Dialog ====== */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[450px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{t.common.edit} — {selectedUser?.name || selectedUser?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t.common.name}</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t.users.role}</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(t.roles).map(k => (
                    <SelectItem key={k} value={k}>{getRoleLabel(k)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.users.phone}</Label>
                <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>{t.users.department}</Label>
                <Input value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.users.email}</Label>
              <Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} dir="ltr" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={() => updateMut.mutate({ id: selectedUser.id, ...editForm })} disabled={updateMut.isPending}>
              {updateMut.isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Reset Password Dialog ====== */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              تغيير كلمة المرور — {resetUser?.name || resetUser?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="4 أحرف على الأقل"
                  dir="ltr"
                  className="pl-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>{t.common.cancel}</Button>
            <Button
              onClick={() => resetPasswordMut.mutate({ userId: resetUser.id, newPassword })}
              disabled={resetPasswordMut.isPending || newPassword.length < 4}
            >
              {resetPasswordMut.isPending ? "جاري التغيير..." : "تغيير كلمة المرور"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Delete User Dialog ====== */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t.common.confirmDelete}</DialogTitle>
            <DialogDescription>
              {t.common.deleteWarning} <strong>{selectedUser?.name || selectedUser?.username}</strong>؟ {t.common.cannotUndo}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={() => deleteMut.mutate({ id: selectedUser.id })} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? t.common.deleting : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
