import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { ExportButton } from "@/components/ExportButton";

const PO_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending_estimate: "bg-amber-100 text-amber-700",
  pending_accounting: "bg-orange-100 text-orange-700",
  pending_management: "bg-orange-100 text-orange-700",
  approved: "bg-teal-100 text-teal-700",
  partial_purchase: "bg-cyan-100 text-cyan-700",
  purchased: "bg-emerald-100 text-emerald-700",
  received: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-700",
  rejected: "bg-red-100 text-red-700",
};

export default function PurchaseOrders() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState("all");
  const { t, language } = useTranslation();
  const { getPOStatusLabel } = useStaticLabels();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const canDelete = user && ["owner", "admin", "maintenance_manager", "purchase_manager"].includes(user.role);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);

  const { data: pos, isLoading } = trpc.purchaseOrders.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  const deleteMutation = trpc.purchaseOrders.delete.useMutation({
    onSuccess: () => {
      toast.success(t.common.deletedSuccessfully);
      utils.purchaseOrders.list.invalidate();
      setDeleteOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const openDelete = (po: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPO(po);
    setDeleteOpen(true);
  };

  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const currency = language === "en" ? "SAR" : "ر.س";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.purchaseOrders.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.purchaseOrders.justification}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportButton endpoint="purchase-orders" filename="purchase-orders" />
          <Button onClick={() => setLocation("/purchase-orders/new")} className="gap-2">
            <Plus className="w-4 h-4" /> {t.purchaseOrders.createNew}
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder={t.common.status} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.common.all}</SelectItem>
            {Object.keys(t.poStatus).map(k => <SelectItem key={k} value={k}>{getPOStatusLabel(k)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
      ) : !pos?.length ? (
        <Card><CardContent className="p-12 text-center">
          <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">{t.purchaseOrders.noPOs}</h3>
          <p className="text-sm text-muted-foreground">{t.common.noData}</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {pos.map(po => (
            <Card key={po.id} className="hover:shadow-lg hover:border-primary/20 transition-all duration-200 cursor-pointer" onClick={() => setLocation(`/purchase-orders/${po.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-muted-foreground">{po.poNumber}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      {po.totalEstimatedCost && <span>{t.purchaseOrders.totalEstimated}: {Number(po.totalEstimatedCost).toLocaleString(locale)} {currency}</span>}
                      {po.totalActualCost && <span>{t.purchaseOrders.totalActual}: {Number(po.totalActualCost).toLocaleString(locale)} {currency}</span>}
                      <span>{new Date(po.createdAt).toLocaleDateString(locale)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canDelete && !["funded", "partially_purchased", "completed"].includes(po.status) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => openDelete(po, e)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Badge className={`status-badge ${PO_STATUS_COLORS[po.status] || "bg-gray-100 text-gray-700"}`}>
                      {getPOStatusLabel(po.status)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">{t.common.confirmDelete}</DialogTitle>
            <DialogDescription>
              {t.common.deleteWarning} <strong>{selectedPO?.poNumber}</strong>? {t.common.cannotUndo}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t.common.cancel}</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: selectedPO.id })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? t.common.deleting : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
