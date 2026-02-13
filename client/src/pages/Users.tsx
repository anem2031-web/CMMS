import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Users as UsersIcon, Pencil, Trash2 } from "lucide-react";
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
  operations: "bg-cyan-100 text-cyan-700",
  purchase_manager: "bg-amber-100 text-amber-700",
  delegate: "bg-orange-100 text-orange-700",
  accountant: "bg-emerald-100 text-emerald-700",
  senior_management: "bg-violet-100 text-violet-700",
  warehouse: "bg-lime-100 text-lime-700",
  user: "bg-gray-100 text-gray-700",
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { t } = useTranslation();
  const { getRoleLabel } = useStaticLabels();
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();

  const updateRoleMut = trpc.users.updateRole.useMutation({
    onSuccess: () => { toast.success(t.common.savedSuccessfully); utils.users.list.invalidate(); },
    onError: (err) => toast.error(err.message),
  });
  const updateMut = trpc.users.update.useMutation({
    onSuccess: () => { toast.success(t.common.savedSuccessfully); utils.users.list.invalidate(); setEditOpen(false); },
    onError: (err) => toast.error(err.message),
  });
  const deleteMut = trpc.users.delete.useMutation({
    onSuccess: () => { toast.success(t.common.deletedSuccessfully); utils.users.list.invalidate(); setDeleteOpen(false); },
    onError: (err) => toast.error(err.message),
  });

  const canManage = ["admin", "owner"].includes(currentUser?.role || "");

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "" });

  const openEdit = (u: any) => {
    setSelectedUser(u);
    setEditForm({ name: u.name || "", email: u.email || "", role: u.role });
    setEditOpen(true);
  };

  const openDelete = (u: any) => {
    setSelectedUser(u);
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t.users.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.users.changeRole}</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-14 w-full" /></CardContent></Card>)}</div>
      ) : !users?.length ? (
        <Card><CardContent className="p-12 text-center">
          <UsersIcon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">{t.common.noData}</h3>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <Card key={u.id} className="hover:shadow-lg hover:border-primary/20 transition-all duration-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                      {(u.name || u.email || "?")[0]}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium text-sm truncate">{u.name || "-"}</h3>
                      <p className="text-xs text-muted-foreground truncate">{u.email || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManage && u.id !== currentUser?.id ? (
                      <>
                        <Select value={u.role} onValueChange={v => updateRoleMut.mutate({ userId: u.id, role: v })}>
                          <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(t.roles).map(k => (
                              <SelectItem key={k} value={k}>{getRoleLabel(k)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {u.role !== "owner" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(u)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      <Badge className={`text-[11px] ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-700"}`}>
                        {getRoleLabel(u.role)}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{t.common.edit} - {selectedUser?.name || selectedUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>{t.common.name}</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>{t.users.email}</Label>
              <Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t.common.cancel}</Button>
            <Button onClick={() => updateMut.mutate({ id: selectedUser.id, ...editForm })} disabled={updateMut.isPending}>
              {updateMut.isPending ? t.common.saving : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t.common.confirmDelete}</DialogTitle>
            <DialogDescription>
              {t.common.deleteWarning} <strong>{selectedUser?.name || selectedUser?.email}</strong>? {t.common.cannotUndo}
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
