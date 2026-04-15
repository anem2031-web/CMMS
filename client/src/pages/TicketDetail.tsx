import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useRoute, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { STATUS_COLORS, PRIORITY_COLORS } from "@shared/types";
import {
  ArrowRight, Clock, User, MapPin, CheckCircle2, Wrench, ShoppingCart,
  Camera, Loader2, FileText, AlertCircle, ExternalLink, Upload
} from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";
import DropZone, { type UploadedFile } from "@/components/DropZone";

export default function TicketDetail() {
  const [, params] = useRoute("/tickets/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const { getStatusLabel, getPriorityLabel, getCategoryLabel, getPOStatusLabel } = useStaticLabels();
  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const currency = language === "en" ? "SAR" : "ر.س";
  const ticketId = parseInt(params?.id || "0");

  const { data: ticket, isLoading, refetch } = trpc.tickets.getById.useQuery({ id: ticketId }, { enabled: !!ticketId });
  const { data: history } = trpc.tickets.history.useQuery({ ticketId }, { enabled: !!ticketId });
  const { data: users } = trpc.users.list.useQuery();
  const { data: allPOs } = trpc.purchaseOrders.list.useQuery();
  const attachmentsInput = useMemo(() => ({ entityType: "ticket", entityId: ticketId }), [ticketId]);
  const { data: ticketAttachments } = trpc.attachments.list.useQuery(attachmentsInput, { enabled: !!ticketId });

  const approveMut = trpc.tickets.approve.useMutation({ onSuccess: () => { toast.success(t.common.confirm); refetch(); } });
  const assignMut = trpc.tickets.assign.useMutation({ onSuccess: () => { toast.success(t.tickets.assignedTo); refetch(); } });
  const startMut = trpc.tickets.startRepair.useMutation({ onSuccess: () => { toast.success(t.tickets.startRepair); refetch(); } });
  const completeMut = trpc.tickets.completeRepair.useMutation({ onSuccess: () => { toast.success(t.tickets.completeRepair); refetch(); } });
  const closeMut = trpc.tickets.close.useMutation({ onSuccess: () => { toast.success(t.tickets.closeTicket); refetch(); } });

  const [selectedTech, setSelectedTech] = useState("");
  const [repairNotes, setRepairNotes] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [afterPhotoUrl, setAfterPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showAttachDropZone, setShowAttachDropZone] = useState(false);

  const addAttachMut = trpc.attachments.add.useMutation({
    onSuccess: () => { refetch(); },
  });

  const handleNewAttachments = useCallback(async (uploaded: UploadedFile[]) => {
    for (const f of uploaded) {
      if (f.url && f.status === "done") {
        // Extract fileKey from URL path (last segment)
        const fileKey = f.url.split("/").slice(-2).join("/") || f.name;
        await addAttachMut.mutateAsync({
          entityType: "ticket",
          entityId: ticketId,
          fileUrl: f.url,
          fileKey,
          fileName: f.name,
          mimeType: f.mimeType,
          fileSize: f.size,
        });
      }
    }
  }, [addAttachMut, ticketId]);

  const technicians = users?.filter(u => u.role === "technician") || [];
  const role = user?.role || "";

  const linkedPOs = allPOs?.filter(po => po.ticketId === ticketId) || [];

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
      if (data.url) { setAfterPhotoUrl(data.url); toast.success(t.common.save); }
    } catch { toast.error(t.common.close); }
    setUploading(false);
  };

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  if (!ticket) return <div className="text-center py-12 text-muted-foreground">{t.common.noData}</div>;

  const reportedBy = users?.find(u => u.id === ticket.reportedById);
  const assignedTo = users?.find(u => u.id === ticket.assignedToId);

  const workflowSteps = [
    { key: "new", label: getStatusLabel("new"), done: true },
    { key: "approved", label: getStatusLabel("approved"), done: ["approved", "assigned", "in_progress", "needs_purchase", "purchase_pending_estimate", "purchase_pending_accounting", "purchase_pending_management", "purchase_approved", "partial_purchase", "purchased", "received_warehouse", "repaired", "verified", "closed"].includes(ticket.status) },
    { key: "assigned", label: getStatusLabel("assigned"), done: ["assigned", "in_progress", "needs_purchase", "purchase_pending_estimate", "purchase_pending_accounting", "purchase_pending_management", "purchase_approved", "partial_purchase", "purchased", "received_warehouse", "repaired", "verified", "closed"].includes(ticket.status) },
    { key: "in_progress", label: getStatusLabel("in_progress"), done: ["in_progress", "repaired", "verified", "closed"].includes(ticket.status) },
    { key: "repaired", label: getStatusLabel("repaired"), done: ["repaired", "verified", "closed"].includes(ticket.status) },
    { key: "closed", label: getStatusLabel("closed"), done: ticket.status === "closed" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/tickets")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-mono text-muted-foreground">{ticket.ticketNumber}</span>
            <Badge className={`${STATUS_COLORS[ticket.status]}`}>{getStatusLabel(ticket.status)}</Badge>
            <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority]}>{getPriorityLabel(ticket.priority)}</Badge>
            <Badge variant="outline">{getCategoryLabel(ticket.category)}</Badge>
          </div>
          <h1 className="text-xl font-bold mt-1">{ticket.title}</h1>
        </div>
      </div>

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
          {["needs_purchase", "purchase_pending_estimate", "purchase_pending_accounting", "purchase_pending_management", "purchase_approved", "partial_purchase", "purchased", "received_warehouse"].includes(ticket.status) && (
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                <ShoppingCart className="w-4 h-4 shrink-0" />
                <span className="font-medium">{t.purchaseOrders.title}: {getStatusLabel(ticket.status)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{t.tickets.ticketTitle}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {ticket.description && <p className="text-sm leading-relaxed">{ticket.description}</p>}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{t.tickets.category}:</span>
                  <span className="font-medium">{getCategoryLabel(ticket.category)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{t.tickets.site}:</span>
                  <span className="font-medium">{ticket.locationDetail || "-"}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ticket.beforePhotoUrl && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" /> {t.tickets.photos}
                    </p>
                    <img src={ticket.beforePhotoUrl} alt="before" className="rounded-lg max-h-48 w-full object-cover border" />
                  </div>
                )}
                {ticket.afterPhotoUrl && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {t.tickets.photos}
                    </p>
                    <img src={ticket.afterPhotoUrl} alt="after" className="rounded-lg max-h-48 w-full object-cover border" />
                  </div>
                )}
              </div>

              {/* Ticket Attachments - Additive: existing display + new DropZone */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> {(t as any).attachments?.title || "المرفقات"} ({ticketAttachments?.length ?? 0})
                  </p>
                  {isManager && (
                    <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setShowAttachDropZone(v => !v)}>
                      <Upload className="w-3.5 h-3.5" />
                      إضافة مرفق
                    </Button>
                  )}
                </div>

                {/* Existing attachments grid */}
                {(ticketAttachments ?? []).length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {(ticketAttachments ?? []).map((att: any) => (
                      <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="group border rounded-lg overflow-hidden hover:border-primary transition-colors">
                        {att.mimeType?.startsWith("image/") ? (
                          <img src={att.fileUrl} alt={att.fileName} className="w-full h-28 object-cover" />
                        ) : (
                          <div className="w-full h-28 flex flex-col items-center justify-center bg-muted/50 gap-2">
                            <FileText className="w-8 h-8 text-muted-foreground" />
                          </div>
                        )}
                        <div className="px-2 py-1.5 text-xs truncate text-muted-foreground group-hover:text-primary">
                          {att.fileName}
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {/* NEW: Drag & Drop zone (additive - shown on demand) */}
                {showAttachDropZone && (
                  <DropZone
                    onFilesUploaded={handleNewAttachments}
                    label="اسحب ملفات إضافية للبلاغ"
                    sublabel="صور ومستندات PDF — حد أقصى 10 MB"
                  />
                )}
              </div>

              {ticket.repairNotes && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-medium mb-1">{t.tickets.repairNotes}</p>
                  <p className="text-sm text-muted-foreground">{ticket.repairNotes}</p>
                </div>
              )}
              {ticket.materialsUsed && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-sm font-medium mb-1">{t.tickets.materialsUsed}</p>
                  <p className="text-sm text-muted-foreground">{ticket.materialsUsed}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {linkedPOs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4" /> {t.purchaseOrders.title} ({linkedPOs.length})
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
                          {po.totalEstimatedCost ? `${t.purchaseOrders.totalEstimated}: ${Number(po.totalEstimatedCost).toLocaleString(locale)} ${currency}` : t.common.loading}
                          {po.totalActualCost ? ` | ${t.purchaseOrders.totalActual}: ${Number(po.totalActualCost).toLocaleString(locale)} ${currency}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{getPOStatusLabel(po.status)}</Badge>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">{t.common.actions}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {canApprove && (
                <Button onClick={() => approveMut.mutate({ id: ticket.id })} disabled={approveMut.isPending} className="w-full gap-2" size="lg">
                  <CheckCircle2 className="w-4 h-4" /> {t.tickets.approve}
                </Button>
              )}

              {canAssign && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t.tickets.assignTechnician}:</p>
                  <div className="flex gap-2">
                    <Select value={selectedTech} onValueChange={setSelectedTech}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder={t.tickets.assignTechnician} /></SelectTrigger>
                      <SelectContent>
                        {technicians.map(tech => <SelectItem key={tech.id} value={String(tech.id)}>{tech.name || tech.email}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button onClick={() => { if (selectedTech) assignMut.mutate({ id: ticket.id, technicianId: parseInt(selectedTech) }); }} disabled={!selectedTech || assignMut.isPending}>
                      {t.tickets.assignTechnician}
                    </Button>
                  </div>
                </div>
              )}

              {canStartRepair && (
                <Button onClick={() => startMut.mutate({ id: ticket.id })} disabled={startMut.isPending} className="w-full gap-2" size="lg">
                  <Wrench className="w-4 h-4" /> {t.tickets.startRepair}
                </Button>
              )}

              {canCompleteRepair && (
                <div className="space-y-3 bg-muted/30 rounded-xl p-4 border">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {t.tickets.completeRepair}
                  </h4>
                  <Textarea placeholder={t.tickets.repairNotes} value={repairNotes} onChange={e => setRepairNotes(e.target.value)} rows={3} />
                  <Textarea placeholder={t.tickets.materialsUsed} value={materialsUsed} onChange={e => setMaterialsUsed(e.target.value)} rows={2} />

                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t.tickets.photos}:</p>
                    {afterPhotoUrl ? (
                      <div className="relative">
                        <img src={afterPhotoUrl} alt="after" className="rounded-lg max-h-40 object-cover border" />
                        <Button variant="destructive" size="sm" className="absolute top-2 left-2" onClick={() => setAfterPhotoUrl("")}>{t.common.delete}</Button>
                      </div>
                    ) : (
                      <Button variant="outline" className="w-full h-20 border-dashed gap-2" onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file"; input.accept = "image/*";
                        input.onchange = (e: any) => { if (e.target.files[0]) handleUploadAfterPhoto(e.target.files[0]); };
                        input.click();
                      }} disabled={uploading}>
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        {uploading ? t.common.loading : t.tickets.photos}
                      </Button>
                    )}
                  </div>

                  <Button onClick={() => completeMut.mutate({ id: ticket.id, repairNotes, materialsUsed, afterPhotoUrl: afterPhotoUrl || undefined })} disabled={completeMut.isPending} className="w-full gap-2" size="lg">
                    {completeMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {t.tickets.completeRepair}
                  </Button>
                </div>
              )}

              {canClose && (
                <Button onClick={() => closeMut.mutate({ id: ticket.id })} disabled={closeMut.isPending} variant="outline" className="w-full gap-2" size="lg">
                  {t.tickets.closeTicket}
                </Button>
              )}

              {canCreatePO && (
                <div className="border-t pt-4">
                  <Button variant="default" onClick={() => setLocation(`/purchase-orders/new?ticketId=${ticket.id}`)} className="w-full gap-2 bg-teal-600 hover:bg-teal-700" size="lg">
                    <ShoppingCart className="w-4 h-4" /> {t.purchaseOrders.createNew}
                  </Button>
                </div>
              )}

              {!canApprove && !canAssign && !canStartRepair && !canCompleteRepair && !canClose && !canCreatePO && (
                <div className="text-center py-4 text-sm text-muted-foreground flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {t.tickets.noTickets}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{t.tickets.ticketTitle}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{t.tickets.reporter}:</span>
                <span className="font-medium">{reportedBy?.name || "-"}</span>
              </div>
              {assignedTo && (
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">{t.tickets.assignedTo}:</span>
                  <span className="font-medium">{assignedTo.name || "-"}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{t.tickets.timeline}:</span>
                <span className="font-medium">{new Date(ticket.createdAt).toLocaleDateString(locale)}</span>
              </div>
              {ticket.closedAt && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-muted-foreground">{t.tickets.closeTicket}:</span>
                  <span className="font-medium">{new Date(ticket.closedAt).toLocaleDateString(locale)}</span>
                </div>
              )}
              {linkedPOs.length > 0 && (
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-teal-600 shrink-0" />
                  <span className="text-muted-foreground">{t.purchaseOrders.title}:</span>
                  <span className="font-medium">{linkedPOs.length}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{t.tickets.timeline}</CardTitle></CardHeader>
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
                          <p className="font-medium">{getStatusLabel(h.toStatus)}</p>
                          <p className="text-xs text-muted-foreground">
                            {changedBy?.name || "-"} — {new Date(h.createdAt).toLocaleString(locale)}
                          </p>
                          {h.notes && <p className="text-xs text-muted-foreground mt-0.5 bg-muted/50 rounded p-1.5">{h.notes}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-muted-foreground">{t.common.noData}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
