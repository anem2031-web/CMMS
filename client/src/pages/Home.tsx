import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS, STATUS_LABELS } from "@shared/types";
import { useLocation } from "wouter";
import {
  ClipboardList, CheckCircle2, AlertTriangle, ShoppingCart,
  DollarSign, Package, Clock, TrendingUp
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  const cards = [
    {
      title: "بلاغات مفتوحة",
      value: stats?.openTickets ?? 0,
      icon: ClipboardList,
      color: "text-blue-600 bg-blue-50",
      onClick: () => setLocation("/tickets?status=open"),
    },
    {
      title: "أُغلقت اليوم",
      value: stats?.closedToday ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-600 bg-emerald-50",
      onClick: () => setLocation("/tickets?status=closed"),
    },
    {
      title: "بلاغات حرجة",
      value: stats?.criticalTickets ?? 0,
      icon: AlertTriangle,
      color: "text-red-600 bg-red-50",
      onClick: () => setLocation("/tickets?priority=critical"),
    },
    {
      title: "بانتظار الاعتماد",
      value: stats?.pendingApprovals ?? 0,
      icon: Clock,
      color: "text-amber-600 bg-amber-50",
      onClick: () => setLocation("/purchase-orders?status=pending"),
    },
    {
      title: "أصناف تم شراؤها",
      value: stats?.purchasedItems ?? 0,
      icon: ShoppingCart,
      color: "text-teal-600 bg-teal-50",
      onClick: () => setLocation("/purchase-orders"),
    },
    {
      title: "أصناف معلّقة",
      value: stats?.pendingPurchaseItems ?? 0,
      icon: Package,
      color: "text-orange-600 bg-orange-50",
      onClick: () => setLocation("/purchase-orders"),
    },
    {
      title: "إجمالي تكلفة الصيانة",
      value: stats?.totalMaintenanceCost ? `${Number(stats.totalMaintenanceCost).toLocaleString("ar-SA")} ر.س` : "0 ر.س",
      icon: DollarSign,
      color: "text-violet-600 bg-violet-50",
      onClick: () => setLocation("/reports"),
      isLarge: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            مرحباً، {user?.name || "المستخدم"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {ROLE_LABELS[user?.role || "user"]} — نظرة عامة على سير العمل
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 7 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-16" />
              </Card>
            ))
          : cards.map((card, i) => (
              <Card
                key={i}
                className={`stat-card group ${card.isLarge ? "sm:col-span-2 lg:col-span-1" : ""}`}
                onClick={card.onClick}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-muted-foreground">{card.title}</span>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color} transition-transform group-hover:scale-110`}>
                      <card.icon className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{card.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover:shadow-lg hover:border-primary/20 transition-all duration-200 cursor-pointer" onClick={() => setLocation("/tickets/new")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">إنشاء بلاغ جديد</h3>
              <p className="text-sm text-muted-foreground">الإبلاغ عن عطل أو مشكلة صيانة</p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg hover:border-primary/20 transition-all duration-200 cursor-pointer" onClick={() => setLocation("/purchase-orders/new")}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h3 className="font-semibold">طلب شراء جديد</h3>
              <p className="text-sm text-muted-foreground">إنشاء طلب شراء مواد أو قطع غيار</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
