import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Wrench, CheckCircle2, AlertCircle, Clock, FileText, ClipboardCheck, CheckSquare, AlertTriangle, Timer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";
import { useTranslatedField } from "@/hooks/useTranslatedField";
import { STATUS_COLORS, PRIORITY_COLORS } from "@shared/types";

export default function AssetHistory() {
  const [, setLocation] = useLocation();
  const { t, language } = useTranslation();
  const { getStatusLabel, getPriorityLabel } = useStaticLabels();
  const { getField } = useTranslatedField();

  // Get assetId from URL params
  const params = new URLSearchParams(window.location.search);
  const assetId = parseInt(params.get("id") || "0");

  if (!assetId) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/assets")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h3 className="font-semibold text-lg mb-1">خطأ</h3>
            <p className="text-sm text-muted-foreground">معرّف الأصل غير صحيح</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: asset, isLoading: assetLoading } = trpc.assets.getById.useQuery({ id: assetId });
  const { data: history, isLoading: historyLoading } = trpc.assets.getMaintenanceHistory.useQuery({ id: assetId });
  const { data: stats, isLoading: statsLoading } = trpc.assets.getMaintenanceStats.useQuery({ id: assetId });
  const { data: inspectionHistory, isLoading: inspectionLoading } = trpc.preventive.getAssetInspectionHistory.useQuery({ assetId, limit: 10 });

  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";

  if (assetLoading || historyLoading || statsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-32" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/assets")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
            <h3 className="font-semibold text-lg mb-1">غير موجود</h3>
            <p className="text-sm text-muted-foreground">الأصل غير موجود</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/assets")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{asset.name}</h1>
          <p className="text-sm text-muted-foreground">{asset.assetNumber}</p>
        </div>
      </div>

      {/* Asset Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            معلومات الأصل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">الفئة</p>
              <p className="font-semibold">{asset.category || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">الحالة</p>
              <Badge className={STATUS_COLORS[asset.status] || ""}>{asset.status}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">الموقع</p>
              <p className="font-semibold text-sm">{asset.locationDetail || "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">الرقم التسلسلي</p>
              <p className="font-semibold text-sm">{asset.serialNumber || "-"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{stats.totalTickets}</div>
              <p className="text-xs text-muted-foreground mt-1">إجمالي البلاغات</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-500">{stats.openTickets}</div>
              <p className="text-xs text-muted-foreground mt-1">بلاغات مفتوحة</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-500">{stats.totalPMPlans}</div>
              <p className="text-xs text-muted-foreground mt-1">خطط الصيانة</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-500">{stats.totalWorkOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">أوامر العمل</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-500">{stats.completedWorkOrders}</div>
              <p className="text-xs text-muted-foreground mt-1">مكتملة</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="tickets" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tickets">البلاغات ({history?.tickets.length || 0})</TabsTrigger>
          <TabsTrigger value="plans">خطط الصيانة ({history?.pmPlans.length || 0})</TabsTrigger>
          <TabsTrigger value="workorders">أوامر العمل ({history?.workOrders.length || 0})</TabsTrigger>
          <TabsTrigger value="inspections" className="flex items-center gap-1">
            <ClipboardCheck className="w-3.5 h-3.5" />
            سجل الفحوصات ({inspectionHistory?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Tickets Tab */}
        <TabsContent value="tickets" className="space-y-3">
          {!history?.tickets || history.tickets.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد بلاغات لهذا الأصل</p>
              </CardContent>
            </Card>
          ) : (
            history.tickets.map((ticket: any) => (
              <Card
                key={ticket.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setLocation(`/tickets/${ticket.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{ticket.ticketNumber}</span>
                        <Badge variant="outline" className={`text-[11px] ${PRIORITY_COLORS[ticket.priority] || ""}`}>
                          {getPriorityLabel(ticket.priority)}
                        </Badge>
                      </div>
                      <h4 className="font-medium truncate">{getField(ticket, "title")}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(ticket.createdAt).toLocaleDateString(locale)}
                      </p>
                    </div>
                    <Badge className={STATUS_COLORS[ticket.status] || ""}>
                      {getStatusLabel(ticket.status)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* PM Plans Tab */}
        <TabsContent value="plans" className="space-y-3">
          {!history?.pmPlans || history.pmPlans.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Wrench className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد خطط صيانة لهذا الأصل</p>
              </CardContent>
            </Card>
          ) : (
            history.pmPlans.map((plan: any) => (
              <Card key={plan.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{plan.planNumber}</span>
                        {plan.isActive && <Badge className="bg-green-500">نشطة</Badge>}
                      </div>
                      <h4 className="font-medium truncate">{getField(plan, "title")}</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        التكرار: {plan.frequency} كل {plan.frequencyValue} {plan.frequencyValue > 1 ? "مرات" : "مرة"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        آخر تنفيذ: {plan.lastExecutedDate ? new Date(plan.lastExecutedDate).toLocaleDateString(locale) : "لم يتم التنفيذ"}
                      </p>
                    </div>
                    <Clock className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Work Orders Tab */}
        <TabsContent value="workorders" className="space-y-3">
          {!history?.workOrders || history.workOrders.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد أوامر عمل لهذا الأصل</p>
              </CardContent>
            </Card>
          ) : (
            history.workOrders.map((wo: any) => (
              <Card key={wo.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">{wo.workOrderNumber}</span>
                        <Badge
                          className={
                            wo.status === "completed"
                              ? "bg-green-500"
                              : wo.status === "in_progress"
                                ? "bg-blue-500"
                                : "bg-gray-500"
                          }
                        >
                          {wo.status === "completed" ? "مكتملة" : wo.status === "in_progress" ? "قيد التنفيذ" : "مجدولة"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        التاريخ المجدول: {new Date(wo.scheduledDate).toLocaleDateString(locale)}
                      </p>
                      {wo.completedDate && (
                        <p className="text-xs text-muted-foreground">
                          تاريخ الإنجاز: {new Date(wo.completedDate).toLocaleDateString(locale)}
                        </p>
                      )}
                    </div>
                    <Wrench className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        {/* Inspection History Tab */}
        <TabsContent value="inspections" className="space-y-3">
          {inspectionLoading ? (
            <Card><CardContent className="p-8 text-center"><Clock className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3 animate-spin" /></CardContent></Card>
          ) : !inspectionHistory || inspectionHistory.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ClipboardCheck className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">لا توجد فحوصات مكتملة لهذا الأصل</p>
              </CardContent>
            </Card>
          ) : (
            inspectionHistory.map((session: any) => {
              const hasIssues = session.issueCount > 0;
              const hasFixed = session.fixedCount > 0;
              const borderColor = hasIssues ? "border-red-200" : hasFixed ? "border-blue-200" : "border-green-200";
              const bgColor = hasIssues ? "bg-red-50" : hasFixed ? "bg-blue-50" : "bg-green-50";
              const icon = hasIssues ? (
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              ) : hasFixed ? (
                <Wrench className="w-5 h-5 text-blue-500 flex-shrink-0" />
              ) : (
                <CheckSquare className="w-5 h-5 text-green-500 flex-shrink-0" />
              );
              const durationMin = session.durationSeconds ? Math.round(session.durationSeconds / 60) : null;
              return (
                <Card key={session.id} className={`border ${borderColor} hover:shadow-md transition-shadow`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {icon}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">{session.workOrderNumber}</span>
                            {hasIssues && <Badge className="bg-red-500 text-white text-[10px] px-1.5">{session.issueCount} خلل</Badge>}
                            {hasFixed && <Badge className="bg-blue-500 text-white text-[10px] px-1.5">{session.fixedCount} إصلاح</Badge>}
                            {!hasIssues && !hasFixed && <Badge className="bg-green-500 text-white text-[10px] px-1.5">جميعها سليمة</Badge>}
                          </div>
                          <h4 className="font-medium text-sm truncate">{session.workOrderTitle}</h4>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {session.completedAt ? new Date(session.completedAt).toLocaleDateString(locale) : "—"}
                            </span>
                            {durationMin !== null && (
                              <span className="flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                {durationMin} دقيقة
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={`text-center px-3 py-1.5 rounded-lg ${bgColor}`}>
                        <div className="text-lg font-bold">{session.totalItems}</div>
                        <div className="text-[10px] text-muted-foreground">بند</div>
                      </div>
                    </div>
                    {/* Mini stats row */}
                    <div className="flex gap-4 mt-3 pt-3 border-t text-xs">
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        سليم: {session.okCount}
                      </span>
                      <span className="flex items-center gap-1 text-blue-600">
                        <Wrench className="w-3.5 h-3.5" />
                        إصلاح: {session.fixedCount}
                      </span>
                      <span className="flex items-center gap-1 text-red-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        خلل: {session.issueCount}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
