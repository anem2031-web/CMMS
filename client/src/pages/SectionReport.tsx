import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, AlertTriangle, CheckCircle2, Clock, Wrench, Package, TrendingUp } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";

export default function SectionReport() {
  const { t } = useTranslation();
  const [siteFilter, setSiteFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: sites = [] } = trpc.sites.list.useQuery();
  const { data: report, isLoading } = trpc.reports.sectionReport.useQuery({
    siteId: siteFilter !== "all" ? Number(siteFilter) : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const sections = report?.sections || [];
  const maxTickets = sections.length > 0 ? Math.max(...sections.map(s => s.totalTickets)) : 1;

  const getBarWidth = (count: number) => {
    if (maxTickets === 0) return "0%";
    return `${Math.max(4, (count / maxTickets) * 100)}%`;
  };

  const formatHours = (hours: number | null) => {
    if (hours === null) return "-";
    if (hours < 24) return `${hours} ساعة`;
    return `${Math.round(hours / 24 * 10) / 10} يوم`;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" />
          تقرير حسب الأقسام
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          عدد البلاغات وتكاليف الصيانة مقسّمة حسب الأقسام
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">الموقع</Label>
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="كل المواقع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المواقع</SelectItem>
                  {sites.map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">من تاريخ</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">إلى تاريخ</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عدد الأقسام</p>
                <p className="text-2xl font-bold">{sections.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Wrench className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي البلاغات</p>
                <p className="text-2xl font-bold">{report?.totalTickets || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">بلاغات بدون قسم</p>
                <p className="text-2xl font-bold">{report?.unassignedTickets || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sections Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            تفاصيل الأقسام
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : sections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>لا توجد أقسام مسجّلة</p>
              <p className="text-xs mt-1">أضف أقساماً من صفحة "الأقسام" أولاً</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((section: any) => (
                <div key={section.sectionId} className="border rounded-lg p-4 space-y-3">
                  {/* Section Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span className="font-semibold">{section.sectionName}</span>
                      {section.urgentTickets > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {section.urgentTickets} عاجل
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        {section.totalAssets} أصل
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        متوسط الإغلاق: {formatHours(section.avgCloseTimeHours)}
                      </span>
                    </div>
                  </div>

                  {/* Bar Chart */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-24 shrink-0">إجمالي البلاغات</span>
                      <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{ width: getBarWidth(section.totalTickets) }}
                        >
                          <span className="text-xs text-primary-foreground font-medium">{section.totalTickets}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-muted/40 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">مفتوحة</p>
                      <p className="text-lg font-bold text-orange-500">{section.openTickets}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">مغلقة</p>
                      <p className="text-lg font-bold text-emerald-500">{section.closedTickets}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">عاجلة/حرجة</p>
                      <p className="text-lg font-bold text-red-500">{section.urgentTickets}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-2 text-center">
                      <p className="text-xs text-muted-foreground">تكلفة الصيانة</p>
                      <p className="text-lg font-bold">
                        {section.maintenanceCost > 0 ? `${section.maintenanceCost.toLocaleString()} ر.س` : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
