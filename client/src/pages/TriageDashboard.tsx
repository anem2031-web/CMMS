import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ClipboardList, AlertTriangle, Eye, CheckCircle2, Users } from "lucide-react";

export default function TriageDashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: tickets = [], isLoading } = trpc.tickets.list.useQuery({ status: "pending_triage" });
  const { data: users = [] } = trpc.users.list.useQuery();

  const [triageDialog, setTriageDialog] = useState<any>(null);
  const [triageForm, setTriageForm] = useState({
    ticketType: "internal" as "internal" | "external" | "procurement",
    priority: "",
    triageNotes: "",
    assignedToId: "",
  });

  const triageMut = trpc.tickets.triage.useMutation({
    onSuccess: () => {
      toast.success("تم الفرز بنجاح");
      utils.tickets.list.invalidate();
      setTriageDialog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const technicians = users.filter((u: any) => ["technician", "maintenance_manager"].includes(u.role));

  const PRIORITY_COLORS: Record<string, string> = {
    low: "bg-green-100 text-green-800",
    medium: "bg-yellow-100 text-yellow-800",
    high: "bg-orange-100 text-orange-800",
    critical: "bg-red-100 text-red-800",
  };

  const handleTriage = () => {
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">لوحة الفرز والتصنيف</h1>
          <p className="text-sm text-muted-foreground">البلاغات بانتظار الفرز والتصنيف من المشرف</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">بانتظار الفرز</p>
                <p className="text-2xl font-bold text-purple-700">{tickets.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">حرجة</p>
                <p className="text-2xl font-bold text-orange-700">
                  {tickets.filter((t: any) => t.priority === "critical").length}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">فنيون متاحون</p>
                <p className="text-2xl font-bold text-blue-700">{technicians.length}</p>
              </div>
              <Users className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-muted-foreground">لا توجد بلاغات بانتظار الفرز</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket: any) => (
            <Card key={ticket.id} className="hover:shadow-md transition-all border-l-4 border-l-purple-400">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                      <Badge className={PRIORITY_COLORS[ticket.priority] || "bg-gray-100 text-gray-700"}>
                        {ticket.priority === "critical" ? "حرج" : ticket.priority === "high" ? "عالي" : ticket.priority === "medium" ? "متوسط" : "منخفض"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{ticket.category}</Badge>
                    </div>
                    <h3 className="font-semibold text-base truncate">{ticket.title}</h3>
                    {ticket.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ticket.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(ticket.createdAt).toLocaleString("ar-SA")}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.location.href = `/tickets/${ticket.id}`}
                    >
                      <Eye className="w-4 h-4 ml-1" />
                      عرض
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openTriageDialog(ticket)}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <ClipboardList className="w-4 h-4 ml-1" />
                      فرز وتصنيف
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Triage Dialog */}
      <Dialog open={!!triageDialog} onOpenChange={() => setTriageDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>فرز وتصنيف البلاغ</DialogTitle>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الأولوية" />
                  </SelectTrigger>
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
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الفني أو المسؤول" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech: any) => (
                      <SelectItem key={tech.id} value={tech.id.toString()}>
                        {tech.name} ({tech.role === "technician" ? "فني" : "مدير صيانة"})
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
              onClick={handleTriage}
              disabled={triageMut.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              {triageMut.isPending ? "جاري الحفظ..." : "تأكيد الفرز"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
