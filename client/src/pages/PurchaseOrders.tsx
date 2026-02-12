import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PO_STATUS_LABELS } from "@shared/types";
import { Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

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
  const { data: pos, isLoading } = trpc.purchaseOrders.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">طلبات الشراء</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة ومتابعة طلبات الشراء والاعتمادات</p>
        </div>
        <Button onClick={() => setLocation("/purchase-orders/new")} className="gap-2">
          <Plus className="w-4 h-4" /> طلب شراء جديد
        </Button>
      </div>

      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {Object.entries(PO_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}</div>
      ) : !pos?.length ? (
        <Card><CardContent className="p-12 text-center">
          <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="font-semibold text-lg mb-1">لا توجد طلبات شراء</h3>
          <p className="text-sm text-muted-foreground">لم يتم العثور على طلبات مطابقة</p>
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
                      {po.totalEstimatedCost && <span>تقديري: {Number(po.totalEstimatedCost).toLocaleString("ar-SA")} ر.س</span>}
                      {po.totalActualCost && <span>فعلي: {Number(po.totalActualCost).toLocaleString("ar-SA")} ر.س</span>}
                      <span>{new Date(po.createdAt).toLocaleDateString("ar-SA")}</span>
                    </div>
                  </div>
                  <Badge className={`status-badge shrink-0 ${PO_STATUS_COLORS[po.status] || "bg-gray-100 text-gray-700"}`}>
                    {PO_STATUS_LABELS[po.status] || po.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
