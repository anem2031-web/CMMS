import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Boxes, Clock3, Gauge, PackageOpen, Search, ShieldCheck, Tags, TrendingUp, Warehouse } from "lucide-react";
import { toast } from "sonner";

import { ReportFiltersBar } from "@/components/reports/ReportFiltersBar";
import { ReportGeneratedAt } from "@/components/reports/ReportGeneratedAt";
import { ReportToolbar, type ReportExportState } from "@/components/reports/ReportToolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { downloadReportFile, openReportPrintView } from "@/lib/reportExport";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 50;
type AnalyticsView = "slow" | "dead" | "abc" | "aging" | "turnover";

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function InventoryAnalyticsReport() {
  const { t, dir, language } = useLanguage();
  const [, setLocation] = useLocation();
  const copy = t.inventoryReports.analytics;
  const [view, setView] = useState<AnalyticsView>("slow");
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("all");
  const [category, setCategory] = useState("all");
  const [slowDays, setSlowDays] = useState(90);
  const [deadDays, setDeadDays] = useState(180);
  const [turnoverDays, setTurnoverDays] = useState(365);
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exportState, setExportState] = useState<ReportExportState>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const queryInput = useMemo(() => ({
    search: debouncedSearch || undefined,
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    category,
    slowDays,
    deadDays,
    turnoverDays,
  }), [debouncedSearch, warehouseId, category, slowDays, deadDays, turnoverDays]);

  const reportQuery = trpc.inventoryReports.analytics.useQuery(queryInput, { refetchOnWindowFocus: false });
  const report = reportQuery.data;

  useEffect(() => setPage(1), [view, debouncedSearch, warehouseId, category, slowDays, deadDays, turnoverDays]);

  const sourceRows: any[] = view === "slow" ? (report?.slowRows || [])
    : view === "dead" ? (report?.deadRows || [])
      : view === "abc" ? (report?.abcRows || [])
        : view === "aging" ? (report?.agingRows || [])
          : (report?.turnoverRows || []);
  const totalPages = Math.max(1, Math.ceil(sourceRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = sourceRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const locale = language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US";
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }), [locale]);
  const valueFormat = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [locale]);
  const percentFormat = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);

  const warehouseName = (warehouse: any) => `${warehouse.code} - ${language === "en" ? (warehouse.nameEn || warehouse.nameAr) : warehouse.nameAr}`;
  const rowWarehouse = (row: any) => [row.warehouseCode, language === "en" ? (row.warehouseNameEn || row.warehouseNameAr) : (row.warehouseNameAr || row.warehouseNameEn)].filter(Boolean).join(" - ") || copy.noWarehouse;
  const categoryName = (row: any) => {
    const cat = row.category || row;
    if (cat.uncategorized) return copy.filters.uncategorized;
    return language === "en" ? (cat.pathEn || cat.pathAr || cat.nameEn || cat.nameAr || cat.code || "—") : (cat.pathAr || cat.pathEn || cat.nameAr || cat.nameEn || cat.code || "—");
  };
  const dateTime = (value: any) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : copy.notAvailable;
  const dateOnly = (value: any) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value)) : "—";

  const exportParams = {
    lang: language,
    view,
    search: debouncedSearch || undefined,
    warehouseId: warehouseId === "all" ? undefined : warehouseId,
    category,
    slowDays: String(slowDays),
    deadDays: String(deadDays),
    turnoverDays: String(turnoverDays),
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await reportQuery.refetch();
      if (result.error) throw result.error;
      toast.success(copy.messages.refreshed);
    } catch (error: any) {
      toast.error(copy.messages.loadFailed, { description: error?.message });
    } finally {
      setIsRefreshing(false);
    }
  };
  const handleReset = () => {
    setSearch(""); setWarehouseId("all"); setCategory("all"); setSlowDays(90); setDeadDays(180); setTurnoverDays(365); setPage(1);
    toast.success(copy.messages.filtersReset);
  };
  const handlePrint = () => openReportPrintView("/api/reports/inventory/analytics/print", exportParams);
  const handleExport = async (format: "excel" | "pdf") => {
    setExportState(format);
    try {
      await downloadReportFile({
        endpoint: format === "excel" ? "/api/reports/inventory/analytics.xlsx" : "/api/reports/inventory/analytics.pdf",
        fallbackFilename: `inventory-analytics-${view}.${format === "excel" ? "xlsx" : "pdf"}`,
        params: exportParams,
      });
      toast.success(format === "excel" ? copy.messages.excelReady : copy.messages.pdfReady);
    } catch (error: any) {
      toast.error(t.inventoryReports.toolbar.exportFailed, { description: error?.message });
    } finally { setExportState(null); }
  };

  const summaryCards = view === "slow" ? [
    [copy.summary.slowRows, report?.summary.slowRows, Clock3],
    [copy.summary.noOutboundHistory, report?.summary.noOutboundHistoryRows, PackageOpen],
    [copy.summary.positiveRows, report?.summary.positiveQuantityRows, Boxes],
  ] : view === "dead" ? [
    [copy.summary.deadRows, report?.summary.deadRows, PackageOpen],
    [copy.summary.noOutboundHistory, report?.summary.noOutboundHistoryRows, Clock3],
    [copy.summary.positiveRows, report?.summary.positiveQuantityRows, Boxes],
  ] : view === "abc" ? [
    [copy.summary.abcItems, report?.summary.abcItems, Tags],
    [copy.summary.inventoryRows, report?.summary.inventoryRowsInScope, Boxes],
  ] : view === "aging" ? [
    [copy.summary.agingLots, report?.summary.agingLots, Clock3],
    [copy.summary.agingUncovered, report?.summary.agingUncoveredInventoryRows, PackageOpen],
  ] : [
    [copy.summary.turnoverRows, report?.summary.turnoverRows, TrendingUp],
    [copy.summary.valuedOutbound, report?.summary.turnoverValuedOutboundMovements, Gauge],
    [copy.summary.unvaluedOutbound, report?.summary.turnoverUnvaluedOutboundMovements, PackageOpen],
  ];

  const pager = sourceRows.length > 0 && (
    <div className="flex flex-col gap-2 border-t p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>{copy.table.showing.replace("{from}", String((safePage - 1) * PAGE_SIZE + 1)).replace("{to}", String(Math.min(safePage * PAGE_SIZE, sourceRows.length))).replace("{total}", String(sourceRows.length))}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>{copy.table.previous}</Button>
        <span>{copy.table.page.replace("{page}", String(safePage)).replace("{pages}", String(totalPages))}</span>
        <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>{copy.table.next}</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 p-4 md:p-6" dir={dir}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="-ms-2" onClick={() => setLocation("/inventory/reports")}><ArrowLeft className="h-4 w-4 rtl:rotate-180" />{copy.backToCenter}</Button>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1><Badge variant="outline" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" />{copy.readOnly}</Badge></div>
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">{copy.description}</p>
          <ReportGeneratedAt value={report?.generatedAt} />
        </div>
        <ReportToolbar onRefresh={handleRefresh} onResetFilters={handleReset} onPrint={handlePrint} onExportExcel={() => handleExport("excel")} onExportPdf={() => handleExport("pdf")} isRefreshing={isRefreshing || reportQuery.isFetching} exportState={exportState} />
      </div>

      <Tabs value={view} onValueChange={(value) => setView(value as AnalyticsView)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="slow">{copy.tabs.slow}</TabsTrigger><TabsTrigger value="dead">{copy.tabs.dead}</TabsTrigger><TabsTrigger value="abc">{copy.tabs.abc}</TabsTrigger><TabsTrigger value="aging">{copy.tabs.aging}</TabsTrigger><TabsTrigger value="turnover">{copy.tabs.turnover}</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="text-sm leading-6 text-muted-foreground">{copy.hints[view]}</p>

      <ReportFiltersBar title={copy.filters.title}>
        <div className="min-w-[240px] flex-1 space-y-1.5"><Label>{copy.filters.search}</Label><div className="relative"><Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" placeholder={copy.filters.searchPlaceholder} /></div></div>
        <div className="min-w-[220px] space-y-1.5"><Label>{copy.filters.warehouse}</Label><Select value={warehouseId} onValueChange={setWarehouseId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent dir={dir}><SelectItem value="all">{copy.filters.allWarehouses}</SelectItem>{(report?.warehouses || []).map((row: any) => <SelectItem key={row.id} value={String(row.id)}>{warehouseName(row)}</SelectItem>)}</SelectContent></Select></div>
        <div className="min-w-[240px] space-y-1.5"><Label>{copy.filters.category}</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent dir={dir}><SelectItem value="all">{copy.filters.allCategories}</SelectItem>{(report?.categories || []).map((row: any) => <SelectItem key={row.key} value={row.key}>{categoryName(row)}</SelectItem>)}</SelectContent></Select></div>
        {(view === "slow" || view === "dead") && <><div className="min-w-[150px] space-y-1.5"><Label>{copy.filters.slowDays}</Label><Input type="number" min={1} max={3650} value={slowDays} onChange={(e) => setSlowDays(Math.max(1, Number(e.target.value) || 90))} /></div><div className="min-w-[150px] space-y-1.5"><Label>{copy.filters.deadDays}</Label><Input type="number" min={2} max={3650} value={deadDays} onChange={(e) => setDeadDays(Math.max(2, Number(e.target.value) || 180))} /></div></>}
        {view === "turnover" && <div className="min-w-[170px] space-y-1.5"><Label>{copy.filters.turnoverDays}</Label><Input type="number" min={1} max={3650} value={turnoverDays} onChange={(e) => setTurnoverDays(Math.max(1, Number(e.target.value) || 365))} /></div>}
      </ReportFiltersBar>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{summaryCards.map(([label, value, Icon]: any) => <Card key={String(label)}><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value ?? "—"}</p></div><Icon className="h-5 w-5 text-muted-foreground" /></CardContent></Card>)}</div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">{copy.table.titles[view]}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {reportQuery.isLoading ? <div className="p-10 text-center text-sm text-muted-foreground">{copy.messages.loading}</div>
            : reportQuery.error ? <div className="p-10 text-center"><p className="font-medium text-destructive">{copy.messages.loadFailed}</p><p className="mt-1 text-sm text-muted-foreground">{reportQuery.error.message}</p></div>
              : visibleRows.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">{copy.table.empty[view]}</div>
                : <><div className="overflow-x-auto"><Table><TableHeader><TableRow>
                  {(view === "slow" || view === "dead") && <><TableHead>{copy.table.item}</TableHead><TableHead>{copy.table.code}</TableHead><TableHead>{copy.table.warehouse}</TableHead><TableHead>{copy.table.category}</TableHead><TableHead className="text-end">{copy.table.quantity}</TableHead><TableHead>{copy.table.unit}</TableHead><TableHead className="text-end">{copy.table.currentValue}</TableHead><TableHead>{copy.table.lastOutbound}</TableHead><TableHead className="text-end">{copy.table.days}</TableHead></>}
                  {view === "abc" && <><TableHead>{copy.table.item}</TableHead><TableHead>{copy.table.code}</TableHead><TableHead>{copy.table.category}</TableHead><TableHead className="text-end">{copy.table.currentValue}</TableHead><TableHead className="text-end">{copy.table.share}</TableHead><TableHead className="text-end">{copy.table.cumulative}</TableHead><TableHead>{copy.table.abcClass}</TableHead><TableHead className="text-end">{copy.table.warehouseCount}</TableHead></>}
                  {view === "aging" && <><TableHead>{copy.table.lot}</TableHead><TableHead>{copy.table.item}</TableHead><TableHead>{copy.table.warehouse}</TableHead><TableHead>{copy.table.category}</TableHead><TableHead className="text-end">{copy.table.lotBalance}</TableHead><TableHead>{copy.table.unit}</TableHead><TableHead>{copy.table.lotCreated}</TableHead><TableHead className="text-end">{copy.table.days}</TableHead><TableHead>{copy.table.ageBucket}</TableHead><TableHead>{copy.table.expiry}</TableHead></>}
                  {view === "turnover" && <><TableHead>{copy.table.item}</TableHead><TableHead>{copy.table.code}</TableHead><TableHead>{copy.table.warehouse}</TableHead><TableHead>{copy.table.category}</TableHead><TableHead className="text-end">{copy.table.currentValue}</TableHead><TableHead className="text-end">{copy.table.outboundValue}</TableHead><TableHead className="text-end">{copy.table.valuedMovements}</TableHead><TableHead className="text-end">{copy.table.unvaluedMovements}</TableHead><TableHead className="text-end">{copy.table.turnoverIndicator}</TableHead></>}
                </TableRow></TableHeader><TableBody>{visibleRows.map((row: any) => <TableRow key={view === "aging" ? `lot-${row.lotId}-${row.inventoryId}` : `${row.itemKey || row.inventoryId}-${row.warehouseId || "none"}`}>
                  {(view === "slow" || view === "dead") && <><TableCell className="font-medium">{row.itemName}</TableCell><TableCell dir="ltr">{row.internalCode || "—"}</TableCell><TableCell>{rowWarehouse(row)}</TableCell><TableCell>{categoryName(row)}</TableCell><TableCell className="text-end">{numberFormat.format(row.quantity)}</TableCell><TableCell>{row.unit || "—"}</TableCell><TableCell className="text-end">{valueFormat.format(row.currentStoredValue)}</TableCell><TableCell>{dateTime(row.lastOutboundAt)}</TableCell><TableCell className="text-end">{row.daysSinceLastOutbound ?? "—"}</TableCell></>}
                  {view === "abc" && <><TableCell className="font-medium">{row.itemName}</TableCell><TableCell dir="ltr">{row.internalCode || "—"}</TableCell><TableCell>{categoryName(row)}</TableCell><TableCell className="text-end">{valueFormat.format(row.currentStoredValue)}</TableCell><TableCell className="text-end">{row.sharePercent == null ? "—" : `${percentFormat.format(row.sharePercent)}%`}</TableCell><TableCell className="text-end">{row.cumulativePercent == null ? "—" : `${percentFormat.format(row.cumulativePercent)}%`}</TableCell><TableCell><Badge variant={row.abcClass === "A" ? "default" : "outline"}>{row.abcClass}</Badge></TableCell><TableCell className="text-end">{row.warehouseCount}</TableCell></>}
                  {view === "aging" && <><TableCell dir="ltr" className="font-medium">{row.lotCode}</TableCell><TableCell>{row.itemName}</TableCell><TableCell>{rowWarehouse(row)}</TableCell><TableCell>{categoryName(row)}</TableCell><TableCell className="text-end">{numberFormat.format(row.balanceQuantity)}</TableCell><TableCell>{row.unit || "—"}</TableCell><TableCell>{dateTime(row.lotCreatedAt)}</TableCell><TableCell className="text-end">{row.ageDays ?? "—"}</TableCell><TableCell>{copy.ageBuckets[row.bucket]}</TableCell><TableCell>{dateOnly(row.expiryDate)}</TableCell></>}
                  {view === "turnover" && <><TableCell className="font-medium">{row.itemName}</TableCell><TableCell dir="ltr">{row.internalCode || "—"}</TableCell><TableCell>{rowWarehouse(row)}</TableCell><TableCell>{categoryName(row)}</TableCell><TableCell className="text-end">{valueFormat.format(row.currentStoredValue)}</TableCell><TableCell className="text-end">{valueFormat.format(row.recordedOutboundValue)}</TableCell><TableCell className="text-end">{row.valuedOutboundMovements}</TableCell><TableCell className="text-end">{row.unvaluedOutboundMovements}</TableCell><TableCell className="text-end">{row.turnoverIndicator == null ? copy.notAvailable : numberFormat.format(row.turnoverIndicator)}</TableCell></>}
                </TableRow>)}</TableBody></Table></div>{pager}</>}
        </CardContent>
      </Card>

      <p className="text-xs leading-5 text-muted-foreground">{copy.footerNotice}</p>
    </div>
  );
}
