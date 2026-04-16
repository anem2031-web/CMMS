import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, LogOut, LogIn, CheckCircle2, Clock, AlertTriangle, Eye } from "lucide-react";

export default function GateSecurity() {
  const { t } = useLanguage();
  const utils = trpc.useUtils();

  // Tickets approved for work (Path C - external)
  const { data: allTickets = [], isLoading } = trpc.tickets.list.useQuery({});

  // Filter tickets by status
  const pendingExitTickets = allTickets.filter((t: any) =>
    t.maintenancePath === "C" && t.status === "work_approved"
  );
  const outForRepairTickets = allTickets.filter((t: any) =>
    t.status === "out_for_repair"
  );
  const returnedTickets = allTickets.filter((t: any) =>
    t.maintenancePath === "C" && t.status === "out_for_repair" && t.externalRepairCompletedAt
  );

  const [confirmDialog, setConfirmDialog] = useState<{ ticket: any; action: "exit" | "entry" } | null>(null);

  const approveExitMut = trpc.tickets.approveGateExit.useMutation({
    onSuccess: () => {
      toast.success("تمت الموافقة على خروج الأصل");
      utils.tickets.list.invalidate();
      setConfirmDialog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approveEntryMut = trpc.tickets.approveGateEntry.useMutation({
    onSuccess: () => {
      toast.success("تمت الموافقة على دخول الأصل");
      utils.tickets.list.invalidate();
      setConfirmDialog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleConfirm = () => {
    if (!confirmDialog) return;
    if (confirmDialog.action === "exit") {
      approveExitMut.mutate({ id: confirmDialog.ticket.id });
    } else {
      approveEntryMut.mutate({ id: confirmDialog.ticket.id });
    }
  };

  const TicketCard = ({ ticket, action }: { ticket: any; action: "exit" | "entry" }) => (
    <Card className={`hover:shadow-md transition-all border-l-4 ${action === "exit" ? "border-l-orange-400" : "border-l-green-400"}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-mono text-muted-foreground">{ticket.ticketNumber}</span>
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">مسار خارجي</Badge>
              {ticket.externalRepairCompletedAt && (
                <Badge className="bg-green-100 text-green-700 text-xs">تم الإصلاح الخارجي</Badge>
              )}
            </div>
            <h3 className="font-semibold text-base truncate">{ticket.title}</h3>
            {ticket.justification && (
              <p className="text-sm text-muted-foreground mt-1">
                <span className="font-medium">المبرر: </span>{ticket.justification}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>تاريخ الإنشاء: {new Date(ticket.createdAt).toLocaleDateString("ar-SA")}</span>
              {ticket.status === "out_for_repair" && (
                <span className="text-orange-600 font-medium">خارج منذ: {new Date(ticket.updatedAt).toLocaleDateString("ar-SA")}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.href = `/tickets/${ticket.id}`}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setConfirmDialog({ ticket, action })}
              className={action === "exit"
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
              }
            >
              {action === "exit" ? (
                <><LogOut className="w-4 h-4 ml-1" />موافقة الخروج</>
              ) : (
                <><LogIn className="w-4 h-4 ml-1" />موافقة الدخول</>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">لوحة حارس البوابة</h1>
          <p className="text-sm text-muted-foreground">مراقبة حركة الأصول الخارجة والداخلة للصيانة الخارجية</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">بانتظار الخروج</p>
                <p className="text-2xl font-bold text-orange-700">{pendingExitTickets.length}</p>
              </div>
              <LogOut className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">خارج للإصلاح</p>
                <p className="text-2xl font-bold text-red-700">{outForRepairTickets.length}</p>
              </div>
              <Clock className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">بانتظار الدخول</p>
                <p className="text-2xl font-bold text-green-700">{returnedTickets.length}</p>
              </div>
              <LogIn className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="exit">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="exit" className="gap-2">
            <LogOut className="w-4 h-4" />
            موافقة الخروج ({pendingExitTickets.length})
          </TabsTrigger>
          <TabsTrigger value="entry" className="gap-2">
            <LogIn className="w-4 h-4" />
            موافقة الدخول ({returnedTickets.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exit" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : pendingExitTickets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-muted-foreground">لا توجد أصول بانتظار الخروج</p>
              </CardContent>
            </Card>
          ) : (
            pendingExitTickets.map((ticket: any) => (
              <TicketCard key={ticket.id} ticket={ticket} action="exit" />
            ))
          )}
        </TabsContent>

        <TabsContent value="entry" className="space-y-3 mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : returnedTickets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-muted-foreground">لا توجد أصول بانتظار الدخول</p>
              </CardContent>
            </Card>
          ) : (
            returnedTickets.map((ticket: any) => (
              <TicketCard key={ticket.id} ticket={ticket} action="entry" />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {confirmDialog?.action === "exit" ? (
                <><LogOut className="w-5 h-5 text-orange-500" />تأكيد الموافقة على الخروج</>
              ) : (
                <><LogIn className="w-5 h-5 text-green-500" />تأكيد الموافقة على الدخول</>
              )}
            </DialogTitle>
          </DialogHeader>
          {confirmDialog && (
            <div className="py-2">
              <div className="p-3 bg-muted rounded-lg mb-4">
                <p className="font-medium text-sm">{confirmDialog.ticket.ticketNumber}</p>
                <p className="text-sm text-muted-foreground">{confirmDialog.ticket.title}</p>
              </div>
              <div className={`flex items-start gap-2 p-3 rounded-lg ${confirmDialog.action === "exit" ? "bg-orange-50 border border-orange-200" : "bg-green-50 border border-green-200"}`}>
                <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${confirmDialog.action === "exit" ? "text-orange-500" : "text-green-500"}`} />
                <p className="text-sm">
                  {confirmDialog.action === "exit"
                    ? "بالموافقة، ستسجل خروج الأصل رسمياً من المنشأة للصيانة الخارجية."
                    : "بالموافقة، ستسجل دخول الأصل رسمياً إلى المنشأة بعد الصيانة الخارجية."
                  }
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>إلغاء</Button>
            <Button
              onClick={handleConfirm}
              disabled={approveExitMut.isPending || approveEntryMut.isPending}
              className={confirmDialog?.action === "exit"
                ? "bg-orange-500 hover:bg-orange-600 text-white"
                : "bg-green-600 hover:bg-green-700 text-white"
              }
            >
              {(approveExitMut.isPending || approveEntryMut.isPending) ? "جاري..." : "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
