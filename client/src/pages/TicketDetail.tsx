import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS, STATUS_COLORS, PRIORITY_COLORS } from "@shared/types";
import { ArrowRight, Clock, User, MapPin, CheckCircle2, Wrench, ShoppingCart, Camera } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function TicketDetail() {
  const [, params] = useRoute("/tickets/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const ticketId = parseInt(params?.id || "0");

  const { data: ticket, isLoading, refetch } = trpc.tickets.getById.useQuery({ id: ticketId }, { enabled: !!ticketId });
  const { data: history } = trpc.tickets.history.useQuery({ ticketId }, { enabled: !!ticketId });
  const { data: users } = trpc.users.list.useQuery();
  const { data: allTickets } = trpc.tickets.list.useQuery();

  const approveMut = trpc.tickets.approve.useMutation({ onSuccess: () => { toast.success("تم اعتماد البلاغ"); refetch(); } });
  const assignMut = trpc.tickets.assign.useMutation({ onSuccess: () => { toast.success("تم إسناد البلاغ"); refetch(); } });
  const startMut = trpc.tickets.startRepair.useMutation({ onSuccess: () => { toast.success("تم بدء الإصلاح"); refetch(); } });
  const completeMut = trpc.tickets.completeRepair.useMutation({ onSuccess: () => { toast.success("تم تسجيل الإصلاح"); refetch(); } });
  const closeMut = trpc.tickets.close.useMutation({ onSuccess: () => { toast.success("تم إغلاق البلاغ"); refetch(); } });

  const [selectedTech, setSelectedTech] = useState("");
  const [repairNotes, setRepairNotes] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");

  const technicians = users?.filter(u => u.role === "technician") || [];
  const role = user?.role || "";
  const canApprove = ["maintenance_manager", "owner", "admin"].includes(role) && ticket?.status === "new";
  const canAssign = ["maintenance_manager", "owner", "admin"].includes(role) && (ticket?.status === "approved" || ticket?.status === "received_warehouse");
  const canStartRepair = ["technician"].includes(role) && ticket?.status === "assigned";
  const canCompleteRepair = ["technician"].includes(role) && ticket?.status === "in_progress";
  const canClose = ["maintenance_manager", "owner", "admin"].includes(role) && ticket?.status === "repaired";
  const canCreatePO = ["maintenance_manager", "purchase_manager", "owner", "admin"].includes(role) && ["approved", "assigned", "in_progress"].includes(ticket?.status || "");

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!ticket) return <div className="text-center py-12 text-muted-foreground">البلاغ غير موجود</div>;

  const reportedBy = users?.find(u => u.id === ticket.reportedById);
  const assignedTo = users?.find(u => u.id === ticket.assignedToId);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/tickets")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-mono text-muted-foreground">{ticket.ticketNumber}</span>
            <Badge className={`status-badge ${STATUS_COLORS[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</Badge>
            <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
          </div>
          <h1 className="text-xl font-bold mt-1">{ticket.title}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">تفاصيل البلاغ</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {ticket.description && <p className="text-sm leading-relaxed">{ticket.description}</p>}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">الفئة:</span> <span className="font-medium mr-1">{CATEGORY_LABELS[ticket.category]}</span></div>
                <div><span className="text-muted-foreground">الموقع:</span> <span className="font-medium mr-1">{ticket.locationDetail || "-"}</span></div>
              </div>
              {ticket.beforePhotoUrl && (
                <div>
                  <p className="text-sm font-medium mb-2">صورة قبل الإصلاح</p>
                  <img src={ticket.beforePhotoUrl} alt="قبل" className="rounded-lg max-h-64 object-cover border" />
                </div>
              )}
              {ticket.afterPhotoUrl && (
                <div>
                  <p className="text-sm font-medium mb-2">صورة بعد الإصلاح</p>
                  <img src={ticket.afterPhotoUrl} alt="بعد" className="rounded-lg max-h-64 object-cover border" />
                </div>
              )}
              {ticket.repairNotes && (
                <div><p className="text-sm font-medium mb-1">ملاحظات الإصلاح</p><p className="text-sm text-muted-foreground">{ticket.repairNotes}</p></div>
              )}
              {ticket.materialsUsed && (
                <div><p className="text-sm font-medium mb-1">المواد المستخدمة</p><p className="text-sm text-muted-foreground">{ticket.materialsUsed}</p></div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader><CardTitle className="text-base">الإجراءات</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canApprove && (
                <Button onClick={() => approveMut.mutate({ id: ticket.id })} disabled={approveMut.isPending} className="w-full gap-2">
                  <CheckCircle2 className="w-4 h-4" /> اعتماد البلاغ
                </Button>
              )}
              {canAssign && (
                <div className="flex gap-2">
                  <Select value={selectedTech} onValueChange={setSelectedTech}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="اختر الفني" /></SelectTrigger>
                    <SelectContent>
                      {technicians.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name || t.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => { if (selectedTech) assignMut.mutate({ id: ticket.id, technicianId: parseInt(selectedTech) }); }} disabled={!selectedTech || assignMut.isPending}>
                    إسناد
                  </Button>
                </div>
              )}
              {canStartRepair && (
                <Button onClick={() => startMut.mutate({ id: ticket.id })} disabled={startMut.isPending} className="w-full gap-2">
                  <Wrench className="w-4 h-4" /> بدء الإصلاح
                </Button>
              )}
              {canCompleteRepair && (
                <div className="space-y-3">
                  <Textarea placeholder="ملاحظات الإصلاح..." value={repairNotes} onChange={e => setRepairNotes(e.target.value)} />
                  <Textarea placeholder="المواد المستخدمة..." value={materialsUsed} onChange={e => setMaterialsUsed(e.target.value)} />
                  <Button onClick={() => completeMut.mutate({ id: ticket.id, repairNotes, materialsUsed })} disabled={completeMut.isPending} className="w-full gap-2">
                    <CheckCircle2 className="w-4 h-4" /> تأكيد الإصلاح
                  </Button>
                </div>
              )}
              {canClose && (
                <Button onClick={() => closeMut.mutate({ id: ticket.id })} disabled={closeMut.isPending} variant="outline" className="w-full gap-2">
                  إغلاق البلاغ
                </Button>
              )}
              {canCreatePO && (
                <Button variant="outline" onClick={() => setLocation(`/purchase-orders/new?ticketId=${ticket.id}`)} className="w-full gap-2">
                  <ShoppingCart className="w-4 h-4" /> طلب مواد
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">معلومات</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2"><User className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">أنشأه:</span><span className="font-medium">{reportedBy?.name || "-"}</span></div>
              {assignedTo && <div className="flex items-center gap-2"><Wrench className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">مُسند إلى:</span><span className="font-medium">{assignedTo.name || "-"}</span></div>}
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /><span className="text-muted-foreground">التاريخ:</span><span className="font-medium">{new Date(ticket.createdAt).toLocaleDateString("ar-SA")}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">سجل الحالات</CardTitle></CardHeader>
            <CardContent>
              {history?.length ? (
                <div className="space-y-3">
                  {history.map((h, i) => {
                    const changedBy = users?.find(u => u.id === h.changedById);
                    return (
                      <div key={h.id} className="flex gap-3 text-sm">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary mt-1.5" />
                          {i < history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                        </div>
                        <div className="pb-3">
                          <p className="font-medium">{STATUS_LABELS[h.toStatus] || h.toStatus}</p>
                          <p className="text-xs text-muted-foreground">{changedBy?.name} — {new Date(h.createdAt).toLocaleString("ar-SA")}</p>
                          {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-muted-foreground">لا يوجد سجل</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
