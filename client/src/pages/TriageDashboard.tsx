import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ClipboardList, AlertTriangle, Eye, CheckCircle2, Users,
  Zap, Search, ArrowRight, Clock, Microscope
} from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "منخفض", medium: "متوسط", high: "عالي", critical: "حرج"
};

export default function TriageDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // Tickets in pending_triage
  const { data: pendingTickets = [], isLoading: loadingPending } =
    trpc.tickets.list.useQuery({ status: "pending_triage" });

  // Tickets in under_inspection
  const { data: inspectionTickets = [], isLoading: loadingInspection } =
    trpc.tickets.list.useQuery({ status: "under_inspection" });

  const { data: users = [] } = trpc.users.list.useQuery();

  const [activeTab, setActiveTab] = useState<"pending" | "inspection">("pending");

  // Triage dialog state
  const [triageDialog, setTriageDialog] = useState<any>(null);
  const [triageForm, setTriageForm] = useState({
    ticketType: "internal" as "internal" | "external" | "procurement",
    priority: "",
    triageNotes: "",
    assignedToId: "",
  });

  // Inspect dialog state
  const [inspectDialog, setInspectDialog] = useState<any>(null);
  const [inspectionNotes, setInspectionNotes] = useState("");

  // Quick Triage (one-click: just move to under_inspection)
  const quickTriageMut = trpc.tickets.triageTicket.useMutation({
    onSuccess: () => {
      toast.success("تم نقل البلاغ لمرحلة الفحص");
      utils.tickets.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Full Triage (with form)
  const triageMut = trpc.tickets.triage.useMutation({
    onSuccess: () => {
      toast.success("تم الفرز بنجاح");
      utils.tickets.list.invalidate();
      setTriageDialog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Inspect Ticket
  const inspectMut = trpc.tickets.inspectTicket.useMutation({
    onSuccess: () => {
      toast.success("تم إكمال الفحص - تم إشعار مدير الصيانة للموافقة");
      utils.tickets.list.invalidate();
      setInspectDialog(null);
      setInspectionNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const technicians = users.filter((u: any) =>
    ["technician", "maintenance_manager", "supervisor"].includes(u.role)
  );

  const handleFullTriage = () => {
    if (!triageDialog) return;
    triageMut.mutate({
      id: triageDialog.id,
      ticketType: triageForm.ticketType,
      priority: triageForm.priority || undefined,
      triageNotes: triageForm.triageNotes || undefined,
      assignedToId: triageForm.assignedToId ? parseInt(triageForm.assignedToId) : undefined,
    });
  };

  const openTriageDialog = (ticket: any) => {
    setTriageForm({
      ticketType: "internal",
      priority: ticket.priority || "medium",
      triageNotes: "",
      assignedToId: ticket.assignedToId?.toString() || "",
    });
    setTriageDialog(ticket);
  };

  const handleInspect = () => {
    if (!inspectDialog || !inspectionNotes.trim()) {
      toast.error("يجب إدخال ملاحظات الفحص");
      return;
    }
    inspectMut.mutate({ id: inspectDialog.id, inspectionNotes });
  };

  const tabs = [
    {
      id: "pending" as const,
      label: "بانتظار الفرز",
      count: pendingTickets.length,
      color: "text-purple-600",
      activeBg: "bg-purple-600 text-white",
    },
    {
      id: "inspection" as const,
      label: "قيد الفحص",
      count: inspectionTickets.length,
      color: "text-blue-600",
      activeBg: "bg-blue-600 text-white",
    },
  ];

  const currentTickets = activeTab === "pending" ? pendingTickets : inspectionTickets;
  const isLoading = activeTab === "pending" ? loadingPending : loadingInspection;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">لوحة الفرز والتصنيف</h1>
          <p className="text-sm text-muted-foreground">إدارة البلاغات من الفرز حتى الفحص</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-900/10">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">بانتظار الفرز</p>
                <p className="text-2xl font-bold text-purple-700">{pendingTickets.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">قيد الفحص</p>
                <p className="text-2xl font-bold text-blue-700">{inspectionTickets.length}</p>
              </div>
              <Microscope className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-900/10">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">حرجة بانتظار الفرز</p>
                <p className="text-2xl font-bold text-orange-700">
                  {pendingTickets.filter((t: any) => t.priority === "critical").length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? tab.activeBg
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              activeTab === tab.id ? "bg-white/20" : "bg-muted-foreground/20"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : currentTickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {activeTab === "pending" ? "لا توجد بلاغات بانتظار الفرز" : "لا توجد بلاغات قيد الفحص"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {currentTickets.map((ticket: any) => (
            <Card
              key={ticket.id}
              className={`hover:shadow-md transition-all border-l-4 ${
                activeTab === "pending" ? "border-l-purple-400" : "border-l-blue-400"
              }`}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  {/* Ticket Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                      <Badge className={PRIORITY_COLORS[ticket.priority] || "bg-gray-100 text-gray-700"}>
                        {PRIORITY_LABELS[ticket.priority] || ticket.priority}
                      </Badge>
                      {ticket.category && (
                        <Badge variant="outline" className="text-xs">{ticket.category}</Badge>
                      )}
                    </div>
                    <h3 className="font-semibold text-base truncate">{ticket.title}</h3>
                    {ticket.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{ticket.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ticket.createdAt).toLocaleString("ar-SA")}
                      </span>
                      {ticket.siteName && (
                        <span>{ticket.siteName}</span>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 shrink-0 flex-wrap">
                    {/* View Details */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.href = `/tickets/${ticket.id}`}
                    >
                      <Eye className="w-4 h-4 ml-1" />
                      عرض
                    </Button>

                    {/* PENDING_TRIAGE: Quick Triage (one-click) + Full Triage (with form) */}
                    {activeTab === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-300 text-blue-700 hover:bg-blue-50"
                          onClick={() => quickTriageMut.mutate({ id: ticket.id })}
                          disabled={quickTriageMut.isPending}
                          title="نقل مباشر لمرحلة الفحص بدون إعدادات"
                        >
                          <Zap className="w-4 h-4 ml-1" />
                          فرز سريع
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openTriageDialog(ticket)}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          <ClipboardList className="w-4 h-4 ml-1" />
                          فرز مفصّل
                        </Button>
                      </>
                    )}

                    {/* UNDER_INSPECTION: Complete Inspection button */}
                    {activeTab === "inspection" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setInspectDialog(ticket);
                          setInspectionNotes("");
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Search className="w-4 h-4 ml-1" />
                        إكمال الفحص
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Full Triage Dialog */}
      <Dialog open={!!triageDialog} onOpenChange={() => setTriageDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-600" />
              فرز وتصنيف البلاغ
            </DialogTitle>
          </DialogHeader>
          {triageDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm">{triageDialog.ticketNumber}</p>
                <p className="text-sm text-muted-foreground">{triageDialog.title}</p>
              </div>

              <div className="space-y-2">
                <Label>نوع البلاغ *</Label>
                <Select
                  value={triageForm.ticketType}
                  onValueChange={(v: any) => setTriageForm(f => ({ ...f, ticketType: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">داخلي (صيانة داخلية)</SelectItem>
                    <SelectItem value="external">خارجي (صيانة خارجية)</SelectItem>
                    <SelectItem value="procurement">مشتريات (يحتاج قطع غيار)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>الأولوية</Label>
                <Select
                  value={triageForm.priority}
                  onValueChange={(v) => setTriageForm(f => ({ ...f, priority: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="اختر الأولوية" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفضة</SelectItem>
                    <SelectItem value="medium">متوسطة</SelectItem>
                    <SelectItem value="high">عالية</SelectItem>
                    <SelectItem value="critical">حرجة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>تعيين فريق الفحص</Label>
                <Select
                  value={triageForm.assignedToId}
                  onValueChange={(v) => setTriageForm(f => ({ ...f, assignedToId: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="اختر الفني أو المسؤول" /></SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech: any) => (
                      <SelectItem key={tech.id} value={tech.id.toString()}>
                        {tech.name} ({tech.role === "technician" ? "فني" : tech.role === "supervisor" ? "مشرف" : "مدير صيانة"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>ملاحظات الفرز</Label>
                <Textarea
                  value={triageForm.triageNotes}
                  onChange={(e) => setTriageForm(f => ({ ...f, triageNotes: e.target.value }))}
                  placeholder="أي ملاحظات أو توجيهات للفحص..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTriageDialog(null)}>إلغاء</Button>
            <Button
              onClick={handleFullTriage}
              disabled={triageMut.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              <ArrowRight className="w-4 h-4 ml-1" />
              {triageMut.isPending ? "جاري الحفظ..." : "تأكيد الفرز"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspect Dialog */}
      <Dialog open={!!inspectDialog} onOpenChange={() => setInspectDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-600" />
              إكمال الفحص الميداني
            </DialogTitle>
          </DialogHeader>
          {inspectDialog && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium text-sm">{inspectDialog.ticketNumber}</p>
                <p className="text-sm text-muted-foreground">{inspectDialog.title}</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  بعد إكمال الفحص، سيُرسل إشعار تلقائي لمدير الصيانة للموافقة على بدء العمل واختيار المسار (A/B/C).
                </p>
              </div>
              <div className="space-y-2">
                <Label>ملاحظات الفحص الميداني *</Label>
                <Textarea
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="وصف الحالة الفنية، المشكلة المكتشفة، التوصيات..."
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInspectDialog(null)}>إلغاء</Button>
            <Button
              onClick={handleInspect}
              disabled={inspectMut.isPending || !inspectionNotes.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 ml-1" />
              {inspectMut.isPending ? "جاري الحفظ..." : "إكمال الفحص وإشعار المدير"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
