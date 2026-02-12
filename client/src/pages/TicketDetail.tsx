import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_LABELS, PRIORITY_LABELS, CATEGORY_LABELS, STATUS_COLORS, PRIORITY_COLORS, PO_STATUS_LABELS } from "@shared/types";
import {
  ArrowRight, Clock, User, MapPin, CheckCircle2, Wrench, ShoppingCart,
  Camera, Upload, Loader2, FileText, AlertCircle, Package, ExternalLink
} from "lucide-react";
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
  const { data: allPOs } = trpc.purchaseOrders.list.useQuery();

  const approveMut = trpc.tickets.approve.useMutation({ onSuccess: () => { toast.success("تم اعتماد البلاغ"); refetch(); } });
  const assignMut = trpc.tickets.assign.useMutation({ onSuccess: () => { toast.success("تم إسناد البلاغ"); refetch(); } });
  const startMut = trpc.tickets.startRepair.useMutation({ onSuccess: () => { toast.success("تم بدء الإصلاح"); refetch(); } });
  const completeMut = trpc.tickets.completeRepair.useMutation({ onSuccess: () => { toast.success("تم تسجيل الإصلاح"); refetch(); } });
  const closeMut = trpc.tickets.close.useMutation({ onSuccess: () => { toast.success("تم إغلاق البلاغ"); refetch(); } });

  const [selectedTech, setSelectedTech] = useState("");
  const [repairNotes, setRepairNotes] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [afterPhotoUrl, setAfterPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const technicians = users?.filter(u => u.role === "technician") || [];
  const role = user?.role || "";

  // Linked purchase orders
  const linkedPOs = allPOs?.filter(po => po.ticketId === ticketId) || [];

  // Role-based permissions
  const isManager = ["maintenance_manager", "purchase_manager", "owner", "admin"].includes(role);
  const isTechnician = role === "technician";
  const canApprove = isManager && ticket?.status === "new";
  const canAssign = isManager && ["approved", "received_warehouse"].includes(ticket?.status || "");
  const canStartRepair = isTechnician && ticket?.status === "assigned";
  const canCompleteRepair = isTechnician && ticket?.status === "in_progress";
  const canClose = isManager && ticket?.status === "repaired";
  const canCreatePO = isManager && ["approved", "assigned", "in_progress"].includes(ticket?.status || "");

  const handleUploadAfterPhoto = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) { setAfterPhotoUrl(data.url); toast.success("تم رفع صورة بعد الإصلاح"); }
    } catch { toast.error("فشل رفع الصورة"); }
    setUploading(false);
  };

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!ticket) return <div className="text-center py-12 text-muted-foreground">البلاغ غير موجود</div>;

  const reportedBy = users?.find(u => u.id === ticket.reportedById);
  const assignedTo = users?.find(u => u.id === ticket.assignedToId);
  const site = ticket.siteId ? `موقع #${ticket.siteId}` : null;

  // Workflow step indicator
  const workflowSteps = [
    { key: "new", label: "جديد", done: true },
    { key: "approved", label: "معتمد", done: ["approved", "assigned", "in_progress", "needs_purchase", "purchase_pending_estimate", "purchase_pending_accounting", "purchase_pending_management", "purchase_approved", "partial_purchase", "purchased", "received_warehouse", "repaired", "verified", "closed"].includes(ticket.status) },
    { key: "assigned", label: "مُسند", done: ["assigned", "in_progress", "needs_purchase", "purchase_pending_estimate", "purchase_pending_accounting", "purchase_pending_management", "purchase_approved", "partial_purchase", "purchased", "received_warehouse", "repaired", "verified", "closed"].includes(ticket.status) },
    { key: "in_progress", label: "قيد التنفيذ", done: ["in_progress", "repaired", "verified", "closed"].includes(ticket.status) },
    { key: "repaired", label: "تم الإصلاح", done: ["repaired", "verified", "closed"].includes(ticket.status) },
    { key: "closed", label: "مغلق", done: ticket.status === "closed" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/tickets")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-mono text-muted-foreground">{ticket.ticketNumber}</span>
            <Badge className={`${STATUS_COLORS[ticket.status]}`}>{STATUS_LABELS[ticket.status]}</Badge>
            <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority]}>{PRIORITY_LABELS[ticket.priority]}</Badge>
            <Badge variant="outline">{CATEGORY_LABELS[ticket.category]}</Badge>
          </div>
          <h1 className="text-xl font-bold mt-1">{ticket.title}</h1>
        </div>
      </div>

      {/* Workflow Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-1 overflow-x-auto">
            {workflowSteps.map((step, i) => (
              <div key={step.key} className="flex items-center gap-1 flex-1 min-w-0">
                <div className={`flex items-center gap-1.5 ${step.done ? "text-primary" : "text-muted-foreground/40"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                    ticket.status === step.key ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                    step.done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground/40"
                  }`}>
                    {step.done ? "✓" : i + 1}
                  </div>
                  <span className="text-[11px] font-medium whitespace-nowrap">{step.label}</span>
                </div>
                {i < workflowSteps.length - 1 && (
                  <div className={`flex-1 h-px mx-1 ${step.done ? "bg-primary/40" : "bg-muted"}`} />
                )}
              </div>
            ))}
          </div>
          {/* Purchase flow indicator */}
          {["needs_purchase", "purchase_pending_estimate", "purchase_pending_accounting", "purchase_pending_management", "purchase_approved", "partial_purchase", "purchased", "received_warehouse"].includes(ticket.status) && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                <ShoppingCart className="w-4 h-4 shrink-0" />
                <span className="font-medium">مسار الشراء: {STATUS_LABELS[ticket.status]}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Ticket Details */}
          <Card>
            <CardHeader><CardTitle className="text-base">تفاصيل البلاغ</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {ticket.description && <p className="text-sm leading-relaxed">{ticket.description}</p>}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">الفئة:</span>
                  <span className="font-medium">{CATEGORY_LABELS[ticket.category]}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">الموقع:</span>
                  <span className="font-medium">{ticket.locationDetail || "-"}</span>
                </div>
              </div>

              {/* Photos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ticket.beforePhotoUrl && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> صورة قبل الإصلاح
                    </p>
                    <img src={ticket.beforePhotoUrl} alt="قبل" className="rounded-lg max-h-48 w-full object-cover border" />
                  </div>
                )}
                {ticket.afterPhotoUrl && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> صورة بعد الإصلاح
                    </p>
                    <img src={ticket.afterPhotoUrl} alt="بعد" className="rounded-lg max-h-48 w-full object-cover border" />
                  </div>
                )}
              </div>

              {ticket.repairNotes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-medium mb-1">ملاحظات الإصلاح</p>
                  <p className="text-sm text-muted-foreground">{ticket.repairNotes}</p>
                </div>
              )}
              {ticket.materialsUsed && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-medium mb-1">المواد المستخدمة</p>
                  <p className="text-sm text-muted-foreground">{ticket.materialsUsed}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Linked Purchase Orders */}
          {linkedPOs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> طلبات الشراء المرتبطة ({linkedPOs.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {linkedPOs.map(po => (
                  <div
                    key={po.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/purchase-orders/${po.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{po.poNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {po.totalEstimatedCost ? `تقديري: ${Number(po.totalEstimatedCost).toLocaleString("ar-SA")} ر.س` : "بانتظار التسعير"}
                          {po.totalActualCost ? ` | فعلي: ${Number(po.totalActualCost).toLocaleString("ar-SA")} ر.س` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{PO_STATUS_LABELS[po.status]}</Badge>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader><CardTitle className="text-base">الإجراءات المتاحة</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Approve */}
              {canApprove && (
                <Button onClick={() => approveMut.mutate({ id: ticket.id })} disabled={approveMut.isPending} className="w-full gap-2" size="lg">
                  <CheckCircle2 className="w-4 h-4" /> اعتماد البلاغ
                </Button>
              )}

              {/* Assign Technician */}
              {canAssign && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">إسناد البلاغ لفني:</p>
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
                </div>
              )}

              {/* Start Repair */}
              {canStartRepair && (
                <Button onClick={() => startMut.mutate({ id: ticket.id })} disabled={startMut.isPending} className="w-full gap-2" size="lg">
                  <Wrench className="w-4 h-4" /> بدء الإصلاح
                </Button>
              )}

              {/* Complete Repair */}
              {canCompleteRepair && (
                <div className="space-y-3 bg-muted/30 rounded-xl p-4 border">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> تأكيد إتمام الإصلاح
                  </h4>
                  <Textarea placeholder="ملاحظات الإصلاح — ماذا تم عمله؟" value={repairNotes} onChange={e => setRepairNotes(e.target.value)} rows={3} />
                  <Textarea placeholder="المواد المستخدمة من المخزن (إن وجدت)..." value={materialsUsed} onChange={e => setMaterialsUsed(e.target.value)} rows={2} />

                  {/* After Photo Upload */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">صورة بعد الإصلاح:</p>
                    {afterPhotoUrl ? (
                      <div className="relative">
                        <img src={afterPhotoUrl} alt="بعد الإصلاح" className="rounded-lg max-h-40 object-cover border" />
                        <Button variant="destructive" size="sm" className="absolute top-2 left-2" onClick={() => setAfterPhotoUrl("")}>حذف</Button>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full h-20 border-dashed gap-2" onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file"; input.accept = "image/*";
                        input.onchange = (e: any) => { if (e.target.files[0]) handleUploadAfterPhoto(e.target.files[0]); };
                        input.click();
                      }} disabled={uploading}>
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        {uploading ? "جاري الرفع..." : "رفع صورة بعد الإصلاح"}
                      </Button>
                    )}
                  </div>

                  <Button onClick={() => completeMut.mutate({ id: ticket.id, repairNotes, materialsUsed, afterPhotoUrl: afterPhotoUrl || undefined })} disabled={completeMut.isPending} className="w-full gap-2" size="lg">
                    {completeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    تأكيد الإصلاح
                  </Button>
                </div>
              )}

              {/* Close Ticket */}
              {canClose && (
                <Button onClick={() => closeMut.mutate({ id: ticket.id })} disabled={closeMut.isPending} variant="outline" className="w-full gap-2" size="lg">
                  إغلاق البلاغ
                </Button>
              )}

              {/* Create Purchase Order - linked to this ticket */}
              {canCreatePO && (
                <div className="border-t pt-4">
                  <Button variant="default" onClick={() => setLocation(`/purchase-orders/new?ticketId=${ticket.id}`)} className="w-full gap-2 bg-teal-600 hover:bg-teal-700" size="lg">
                    <ShoppingCart className="w-4 h-4" /> طلب مواد لهذا البلاغ
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">سيتم ربط طلب الشراء تلقائياً بهذا البلاغ</p>
                </div>
              )}

              {/* No actions available */}
              {!canApprove && !canAssign && !canStartRepair && !canCompleteRepair && !canClose && !canCreatePO && (
                <div className="text-center py-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  لا توجد إجراءات متاحة لك حالياً على هذا البلاغ
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Info Card */}
          <Card>
            <CardHeader><CardTitle className="text-base">معلومات البلاغ</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">أنشأه:</span>
                <span className="font-medium">{reportedBy?.name || "-"}</span>
              </div>
              {assignedTo && (
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">مُسند إلى:</span>
                  <span className="font-medium">{assignedTo.name || "-"}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">تاريخ الإنشاء:</span>
                <span className="font-medium">{new Date(ticket.createdAt).toLocaleDateString("ar-SA")}</span>
              </div>
              {ticket.closedAt && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-muted-foreground">تاريخ الإغلاق:</span>
                  <span className="font-medium">{new Date(ticket.closedAt).toLocaleDateString("ar-SA")}</span>
                </div>
              )}
              {linkedPOs.length > 0 && (
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-muted-foreground">طلبات شراء:</span>
                  <span className="font-medium">{linkedPOs.length}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status History */}
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
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                          {i < history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                        </div>
                        <div className="pb-3">
                          <p className="font-medium">{STATUS_LABELS[h.toStatus] || h.toStatus}</p>
                          <p className="text-xs text-muted-foreground">
                            {changedBy?.name || "النظام"} — {new Date(h.createdAt).toLocaleString("ar-SA")}
                          </p>
                          {h.notes && <p className="text-xs text-muted-foreground mt-0.5 bg-muted/50 rounded p-1.5">{h.notes}</p>}
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
