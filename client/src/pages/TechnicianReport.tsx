import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Users, Trophy, Clock, TrendingUp, BarChart3, Target,
  ArrowUp, ArrowDown, Minus, Loader2, AlertCircle, Zap,
  CheckCircle2, Timer, Activity
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend, LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, CalendarDays, Filter } from "lucide-react";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";

const COLORS = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#6366f1", "#14b8a6"];

const priorityLabels: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
  critical: "حرجة",
};

const categoryLabels: Record<string, string> = {
  electrical: "كهرباء",
  plumbing: "سباكة",
  hvac: "تكييف",
  structural: "إنشائي",
  mechanical: "ميكانيكي",
  general: "عام",
  safety: "سلامة",
  cleaning: "نظافة",
};

function getScoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

function getScoreBg(score: number) {
  if (score >= 80) return "bg-emerald-50 border-emerald-200";
  if (score >= 60) return "bg-amber-50 border-amber-200";
  if (score >= 40) return "bg-orange-50 border-orange-200";
  return "bg-red-50 border-red-200";
}

function getScoreLabel(score: number) {
  if (score >= 80) return "ممتاز";
  if (score >= 60) return "جيد";
  if (score >= 40) return "مقبول";
  return "يحتاج تحسين";
}

function getScoreIcon(score: number) {
  if (score >= 80) return <ArrowUp className="h-4 w-4 text-emerald-600" />;
  if (score >= 60) return <Minus className="h-4 w-4 text-amber-600" />;
  return <ArrowDown className="h-4 w-4 text-red-600" />;
}

function formatHours(hours: number) {
  if (hours === 0) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} دقيقة`;
  if (hours < 24) return `${hours.toFixed(1)} ساعة`;
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return `${days} يوم ${remainingHours > 0 ? `و ${remainingHours} ساعة` : ""}`;
}

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-");
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return months[parseInt(month) - 1] || monthStr;
}

type PeriodType = "all" | "week" | "month" | "quarter" | "year" | "custom";

const periodLabels: Record<PeriodType, string> = {
  all: "الكل",
  week: "آخر أسبوع",
  month: "آخر شهر",
  quarter: "آخر 3 أشهر",
  year: "آخر سنة",
  custom: "فترة مخصصة",
};

function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

export default function TechnicianReport() {
  const { t, language } = useTranslation();
  const { getPriorityLabel, getCategoryLabel } = useStaticLabels();
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("all");
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [selectedTech, setSelectedTech] = useState<number | null>(null);

  const queryInput = useMemo(() => {
    if (selectedPeriod === "custom" && customDateFrom && customDateTo) {
      return { period: selectedPeriod as PeriodType, dateFrom: customDateFrom, dateTo: customDateTo };
    }
    return { period: selectedPeriod as PeriodType };
  }, [selectedPeriod, customDateFrom, customDateTo]);

  const { data: techData, isLoading, error } = trpc.reports.technicianPerformance.useQuery(queryInput);

  const handlePeriodChange = (period: PeriodType) => {
    if (period === "custom") {
      setShowCustomPicker(true);
      // Set default custom range to last month
      if (!customDateFrom || !customDateTo) {
        const now = new Date();
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        setCustomDateFrom(formatDateInput(monthAgo));
        setCustomDateTo(formatDateInput(now));
      }
      setSelectedPeriod("custom");
    } else {
      setShowCustomPicker(false);
      setSelectedPeriod(period);
    }
  };

  const getPeriodDescription = (): string => {
    if (selectedPeriod === "all") return "جميع الفترات";
    if (selectedPeriod === "custom" && customDateFrom && customDateTo) {
      return `من ${customDateFrom} إلى ${customDateTo}`;
    }
    return periodLabels[selectedPeriod];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">جاري تحميل تقرير أداء الفنيين...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-semibold">حدث خطأ في تحميل التقرير</p>
            <p className="text-muted-foreground text-sm">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const techs = techData || [];

  if (techs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <Users className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-lg font-semibold">لا يوجد فنيون مسجلون</p>
            <p className="text-muted-foreground text-sm">قم بإضافة فنيين من صفحة إدارة المستخدمين</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Summary stats
  const totalTickets = techs.reduce((s, t) => s + t.totalAssigned, 0);
  const totalCompleted = techs.reduce((s, t) => s + t.completed, 0);
  const avgScore = techs.length > 0 ? Math.round(techs.reduce((s, t) => s + t.performanceScore, 0) / techs.length) : 0;
  const avgResolution = techs.filter(t => t.avgResolutionHours > 0);
  const overallAvgHours = avgResolution.length > 0 ? avgResolution.reduce((s, t) => s + t.avgResolutionHours, 0) / avgResolution.length : 0;

  // Comparison chart data
  const comparisonData = techs.map(t => ({
    name: t.technician.name || `فني #${t.technician.id}`,
    "بلاغات مُسندة": t.totalAssigned,
    "بلاغات مُنجزة": t.completed,
    "قيد التنفيذ": t.inProgress,
  }));

  // Radar chart data for selected technician
  const selectedTechData = selectedTech !== null ? techs.find(t => t.technician.id === selectedTech) : techs[0];
  const radarData = selectedTechData ? [
    { metric: "نسبة الإنجاز", value: selectedTechData.completionRate, fullMark: 100 },
    { metric: "سرعة الحل", value: selectedTechData.avgResolutionHours > 0 ? Math.max(0, Math.round(100 - (selectedTechData.avgResolutionHours / 720) * 100)) : 0, fullMark: 100 },
    { metric: "حجم العمل", value: Math.min(100, selectedTechData.totalAssigned * 5), fullMark: 100 },
    { metric: "البلاغات الحرجة", value: Math.min(100, (selectedTechData.priorityBreakdown?.critical || 0) * 20), fullMark: 100 },
    { metric: "التنوع", value: Math.min(100, Object.keys(selectedTechData.categoryBreakdown || {}).length * 20), fullMark: 100 },
  ] : [];

  // Score distribution for pie chart
  const scoreDistribution = [
    { name: "ممتاز (80+)", value: techs.filter(t => t.performanceScore >= 80).length, color: "#10b981" },
    { name: "جيد (60-79)", value: techs.filter(t => t.performanceScore >= 60 && t.performanceScore < 80).length, color: "#f59e0b" },
    { name: "مقبول (40-59)", value: techs.filter(t => t.performanceScore >= 40 && t.performanceScore < 60).length, color: "#f97316" },
    { name: "يحتاج تحسين (<40)", value: techs.filter(t => t.performanceScore < 40).length, color: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              {t.reports.techPerformance}
            </h1>
            <p className="text-muted-foreground mt-1">{t.reports.overview} — <span className="font-medium text-foreground">{getPeriodDescription()}</span></p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">
            {techs.length} فني
          </Badge>
        </div>

        {/* Time Filter Bar */}
        <Card className="border-dashed">
          <CardContent className="py-3 px-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span className="font-medium">الفترة الزمنية:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["all", "week", "month", "quarter", "year"] as PeriodType[]).map((period) => (
                  <Button
                    key={period}
                    variant={selectedPeriod === period ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePeriodChange(period)}
                    className="text-xs h-8"
                  >
                    {periodLabels[period]}
                  </Button>
                ))}
                <Popover open={showCustomPicker} onOpenChange={setShowCustomPicker}>
                  <PopoverTrigger asChild>
                    <Button
                      variant={selectedPeriod === "custom" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePeriodChange("custom")}
                      className="text-xs h-8 gap-1"
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      {selectedPeriod === "custom" && customDateFrom && customDateTo
                        ? `${customDateFrom} → ${customDateTo}`
                        : "فترة مخصصة"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-4" align="start">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">اختر الفترة الزمنية</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">من تاريخ</label>
                          <input
                            type="date"
                            value={customDateFrom}
                            onChange={(e) => setCustomDateFrom(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">إلى تاريخ</label>
                          <input
                            type="date"
                            value={customDateTo}
                            onChange={(e) => setCustomDateTo(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm"
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          if (customDateFrom && customDateTo) {
                            setSelectedPeriod("custom");
                            setShowCustomPicker(false);
                          }
                        }}
                        disabled={!customDateFrom || !customDateTo}
                      >
                        تطبيق
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-lg hover:border-primary/20 transition-all duration-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">إجمالي البلاغات المُسندة</p>
                <p className="text-3xl font-bold mt-1">{totalTickets}</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg hover:border-primary/20 transition-all duration-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">البلاغات المُنجزة</p>
                <p className="text-3xl font-bold mt-1 text-emerald-600">{totalCompleted}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg hover:border-primary/20 transition-all duration-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">متوسط وقت الحل</p>
                <p className="text-2xl font-bold mt-1">{formatHours(Math.round(overallAvgHours * 10) / 10)}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl">
                <Timer className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg hover:border-primary/20 transition-all duration-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">متوسط تقييم الأداء</p>
                <p className={`text-3xl font-bold mt-1 ${getScoreColor(avgScore)}`}>{avgScore}%</p>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl">
                <Trophy className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">{t.reports.overview}</TabsTrigger>
          <TabsTrigger value="comparison">{t.reports.comparison}</TabsTrigger>
          <TabsTrigger value="details">{t.common.details}</TabsTrigger>
          <TabsTrigger value="trends">{t.reports.monthlyTrend}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Ranking Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-amber-500" />
                  ترتيب الفنيين حسب الأداء
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {techs.map((tech, index) => (
                    <div
                      key={tech.technician.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        (selectedTech || techs[0]?.technician.id) === tech.technician.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "hover:border-primary/30 hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedTech(tech.technician.id)}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? "bg-amber-100 text-amber-700" :
                        index === 1 ? "bg-gray-100 text-gray-700" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{tech.technician.name || `فني #${tech.technician.id}`}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{tech.completed}/{tech.totalAssigned} بلاغ</span>
                          <span className="text-xs text-muted-foreground">|</span>
                          <span className="text-xs text-muted-foreground">{formatHours(tech.avgResolutionHours)}</span>
                        </div>
                      </div>
                      <div className="text-left">
                        <div className={`text-lg font-bold ${getScoreColor(tech.performanceScore)}`}>
                          {tech.performanceScore}%
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          {getScoreIcon(tech.performanceScore)}
                          <span className={`text-xs ${getScoreColor(tech.performanceScore)}`}>
                            {getScoreLabel(tech.performanceScore)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Radar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-primary" />
                  تحليل الأداء — {selectedTechData?.technician.name || ""}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar name="الأداء" dataKey="value" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.3} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
                {selectedTechData && (
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">نسبة الإنجاز</p>
                      <p className="font-bold text-sm">{selectedTechData.completionRate}%</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">متوسط الحل</p>
                      <p className="font-bold text-sm">{formatHours(selectedTechData.avgResolutionHours)}</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">التقييم</p>
                      <p className={`font-bold text-sm ${getScoreColor(selectedTechData.performanceScore)}`}>
                        {selectedTechData.performanceScore}%
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-amber-500" />
                  توزيع مستويات الأداء
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={scoreDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {scoreDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Quick Stats per Tech */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  ملخص سريع
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {techs.slice(0, 5).map(tech => (
                  <div key={tech.technician.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{tech.technician.name || `فني #${tech.technician.id}`}</span>
                      <span className="text-sm text-muted-foreground">{tech.completionRate}%</span>
                    </div>
                    <Progress value={tech.completionRate} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                مقارنة أداء الفنيين
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={comparisonData} layout="vertical" margin={{ right: 30, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="بلاغات مُسندة" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="بلاغات مُنجزة" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="قيد التنفيذ" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Resolution Time Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-amber-500" />
                مقارنة أوقات الحل (بالساعات)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={techs.map(t => ({
                    name: t.technician.name || `فني #${t.technician.id}`,
                    "متوسط": t.avgResolutionHours,
                    "أقل": t.minResolutionHours,
                    "أعلى": t.maxResolutionHours,
                  }))}
                  margin={{ right: 30, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip formatter={(value: number) => `${value} ساعة`} />
                  <Legend />
                  <Bar dataKey="أقل" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="متوسط" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="أعلى" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          {techs.map((tech, index) => (
            <Card key={tech.technician.id} className="overflow-hidden">
              <div className={`h-1 ${index === 0 ? "bg-amber-400" : index === 1 ? "bg-gray-400" : index === 2 ? "bg-orange-400" : "bg-primary/30"}`} />
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
                      index === 0 ? "bg-amber-100 text-amber-700" :
                      index === 1 ? "bg-gray-100 text-gray-700" :
                      index === 2 ? "bg-orange-100 text-orange-700" :
                      "bg-primary/10 text-primary"
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{tech.technician.name || `فني #${tech.technician.id}`}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {tech.technician.email || ""}
                        {tech.technician.department ? ` — ${tech.technician.department}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-xl border ${getScoreBg(tech.performanceScore)}`}>
                    <p className={`text-2xl font-bold ${getScoreColor(tech.performanceScore)}`}>{tech.performanceScore}%</p>
                    <p className={`text-xs text-center ${getScoreColor(tech.performanceScore)}`}>{getScoreLabel(tech.performanceScore)}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <div className="p-3 bg-muted/50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">مُسندة</p>
                    <p className="text-xl font-bold">{tech.totalAssigned}</p>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">مُنجزة</p>
                    <p className="text-xl font-bold text-emerald-600">{tech.completed}</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">قيد التنفيذ</p>
                    <p className="text-xl font-bold text-amber-600">{tech.inProgress}</p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">معلّقة</p>
                    <p className="text-xl font-bold text-red-600">{tech.pending}</p>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">نسبة الإنجاز</p>
                    <p className="text-xl font-bold text-blue-600">{tech.completionRate}%</p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg text-center">
                    <p className="text-xs text-muted-foreground">متوسط الحل</p>
                    <p className="text-lg font-bold text-purple-600">{formatHours(tech.avgResolutionHours)}</p>
                  </div>
                </div>

                <Separator />

                {/* Priority & Category Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-2">توزيع حسب الأولوية</p>
                    <div className="space-y-2">
                      {Object.entries(tech.priorityBreakdown || {}).map(([priority, count]) => (
                        <div key={priority} className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {getPriorityLabel(priority)}
                          </Badge>
                          <div className="flex items-center gap-2 flex-1 mx-3">
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  priority === "critical" ? "bg-red-500" :
                                  priority === "high" ? "bg-orange-500" :
                                  priority === "medium" ? "bg-amber-500" : "bg-green-500"
                                }`}
                                style={{ width: `${tech.totalAssigned > 0 ? (count / tech.totalAssigned) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-8 text-left">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-2">توزيع حسب الفئة</p>
                    <div className="space-y-2">
                      {Object.entries(tech.categoryBreakdown || {}).map(([category, count]) => (
                        <div key={category} className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs">
                            {getCategoryLabel(category)}
                          </Badge>
                          <div className="flex items-center gap-2 flex-1 mx-3">
                            <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${tech.totalAssigned > 0 ? (count / tech.totalAssigned) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-8 text-left">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          {techs.map(tech => (
            <Card key={tech.technician.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  الاتجاه الشهري — {tech.technician.name || `فني #${tech.technician.id}`}
                  <Badge variant="outline" className="mr-auto">{getScoreLabel(tech.performanceScore)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart
                    data={(tech.monthlyTrend || []).map(m => ({
                      ...m,
                      month: formatMonth(m.month),
                    }))}
                    margin={{ right: 20, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="assigned" name="مُسندة" stroke="#94a3b8" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="completed" name="مُنجزة" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
