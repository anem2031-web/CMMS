import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Banknote,
  Boxes,
  CircleDollarSign,
  ExternalLink,
  FileSearch,
  Layers3,
  Search,
  ShieldCheck,
  Tags,
  TriangleAlert,
  Warehouse,
} from "lucide-react";
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
type ValueStatus = "all" | "positive" | "zero" | "negative";
type ReviewCondition = "all" | "value_mismatch" | "negative_stored_value" | "negative_quantity" | "reconciliation_exception";
type ValuationView = "detail" | "warehouse" | "category" | "review";

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function InventoryValuationReport() {
  const { t, dir, language } = useLanguage();
  const [, setLocation] = useLocation();
  const copy = t.inventoryReports.valuation;
  const distributionCopy = t.inventoryReports.valueDistribution;
  const reviewCopy = t.inventoryReports.accountingReview;

  const [view, setView] = useState<ValuationView>("detail");
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("all");
  const [status, setStatus] = useState<ValueStatus>("all");
  const [category, setCategory] = useState("all");
  const [condition, setCondition] = useState<ReviewCondition>("all");
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exportState, setExportState] = useState<ReportExportState>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const queryInput = useMemo(() => ({
    search: debouncedSearch || undefined,
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    status,
  }), [debouncedSearch, warehouseId, status]);
  const reviewInput = useMemo(() => ({ ...queryInput, category, condition }), [queryInput, category, condition]);

  const detailQuery = trpc.inventoryReports.valuation.useQuery(queryInput, {
    enabled: view === "detail",
    refetchOnWindowFocus: false,
  });
  const distributionQuery = trpc.inventoryReports.valueDistribution.useQuery(queryInput, {
    enabled: view === "warehouse" || view === "category",
    refetchOnWindowFocus: false,
  });
  const reviewQuery = trpc.inventoryReports.accountingReview.useQuery(reviewInput, {
    enabled: view === "review",
    refetchOnWindowFocus: false,
  });

  useEffect(() => setPage(1), [debouncedSearch, warehouseId, status, category, condition, view]);

  const detailReport = detailQuery.data;
  const distributionReport = distributionQuery.data;
  const reviewReport = reviewQuery.data;
  const activeReport: any = view === "detail" ? detailReport : view === "review" ? reviewReport : distributionReport;
  const activeQuery: any = view === "detail" ? detailQuery : view === "review" ? reviewQuery : distributionQuery;
  const warehouseOptions = activeReport?.warehouses || [];

  const sourceRows: any[] = view === "detail"
    ? (detailReport?.rows || [])
    : view === "warehouse"
      ? (distributionReport?.byWarehouse || [])
      : view === "category"
        ? (distributionReport?.byCategory || [])
        : (reviewReport?.rows || []);
  const totalPages = Math.max(1, Math.ceil(sourceRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = sourceRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const locale = language === "ar" ? "ar-SA-u-nu-latn" : language === "ur" ? "ur-PK-u-nu-latn" : "en-US";
  const quantityFormat = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }), [locale]);
  const costFormat = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }), [locale]);
  const valueFormat = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [locale]);
  const percentFormat = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);

  const warehouseName = (warehouse: any) => {
    const name = language === "en" ? (warehouse.nameEn || warehouse.nameAr) : warehouse.nameAr;
    return `${warehouse.code} - ${name}`;
  };

  const rowWarehouseName = (row: any) => {
    const name = language === "en" ? (row.warehouseNameEn || row.warehouseNameAr) : (row.warehouseNameAr || row.warehouseNameEn);
    return [row.warehouseCode, name].filter(Boolean).join(" - ") || copy.noWarehouse;
  };

  const categoryName = (row: any) => {
    if (row.uncategorized) return distributionCopy.category.uncategorized;
    const path = language === "en" ? (row.categoryPathEn || row.categoryPathAr) : (row.categoryPathAr || row.categoryPathEn);
    const name = language === "en" ? (row.categoryNameEn || row.categoryNameAr) : (row.categoryNameAr || row.categoryNameEn);
    return path || [row.categoryCode, name].filter(Boolean).join(" - ") || distributionCopy.category.uncategorized;
  };

  const categoryOptionName = (row: any) => {
    if (row.uncategorized) return reviewCopy.filters.uncategorized;
    const path = language === "en" ? (row.pathEn || row.pathAr) : (row.pathAr || row.pathEn);
    const name = language === "en" ? (row.nameEn || row.nameAr) : (row.nameAr || row.nameEn);
    return path || [row.code, name].filter(Boolean).join(" - ") || reviewCopy.filters.uncategorized;
  };

  const quantityContext = (rows: any[]) => {
    if (!rows?.length) return "—";
    return rows.map((row: any) => `${quantityFormat.format(Number(row.quantity || 0))} ${row.unit || distributionCopy.noUnit}`).join(" • ");
  };

  const share = (value: number | null | undefined) => value == null
    ? distributionCopy.noShare
    : `${percentFormat.format(value)}%`;

  const exportParams = {
    lang: language,
    search: debouncedSearch || undefined,
    warehouseId: warehouseId === "all" ? undefined : warehouseId,
    status,
    ...(view === "review" ? { category, condition } : {}),
  };

  const exportBase = view === "detail"
    ? "/api/reports/inventory/valuation"
    : view === "warehouse"
      ? "/api/reports/inventory/valuation/by-warehouse"
      : view === "category"
        ? "/api/reports/inventory/valuation/by-category"
        : "/api/reports/inventory/valuation/accounting-review";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await activeQuery.refetch();
      if (result.error) throw result.error;
      toast.success(view === "review" ? reviewCopy.messages.refreshed : copy.messages.refreshed);
    } catch (error: any) {
      toast.error(view === "review" ? reviewCopy.messages.loadFailed : copy.messages.loadFailed, { description: error?.message });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReset = () => {
    setSearch("");
    setWarehouseId("all");
    setStatus("all");
    setCategory("all");
    setCondition("all");
    setPage(1);
    toast.success(view === "review" ? reviewCopy.messages.filtersReset : copy.messages.filtersReset);
  };

  const handlePrint = () => openReportPrintView(`${exportBase}/print`, exportParams);

  const handleExport = async (format: "excel" | "pdf") => {
    setExportState(format);
    try {
      await downloadReportFile({
        endpoint: format === "excel" ? `${exportBase}.xlsx` : `${exportBase}.pdf`,
        fallbackFilename: format === "excel" ? `inventory-value-${view}.xlsx` : `inventory-value-${view}.pdf`,
        params: exportParams,
      });
      toast.success(view === "review"
        ? (format === "excel" ? reviewCopy.messages.excelReady : reviewCopy.messages.pdfReady)
        : (format === "excel" ? copy.messages.excelReady : copy.messages.pdfReady));
    } catch (error: any) {
      toast.error(t.inventoryReports.toolbar.exportFailed, { description: error?.message });
    } finally {
      setExportState(null);
    }
  };

  const statusBadge = (value: Exclude<ValueStatus, "all">) => {
    if (value === "negative") return <Badge variant="destructive">{copy.statuses.negative}</Badge>;
    if (value === "zero") return <Badge variant="outline">{copy.statuses.zero}</Badge>;
    return <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-800">{copy.statuses.positive}</Badge>;
  };

  const conditionBadge = (value: Exclude<ReviewCondition, "all">) => {
    if (value === "value_mismatch" || value === "negative_stored_value" || value === "negative_quantity") {
      return <Badge variant="destructive">{reviewCopy.conditions[value]}</Badge>;
    }
    return <Badge variant="outline">{reviewCopy.conditions[value]}</Badge>;
  };

  const evidenceForRow = (row: any) => row.conditions?.find((item: any) => item.condition === "value_mismatch")
    || row.conditions?.find((item: any) => item.reconciliationCode)
    || row.conditions?.[0];

  const tablePager = sourceRows.length > 0 && (
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
          <Button variant="ghost" size="sm" className="-ms-2" onClick={() => setLocation("/inventory/reports")}>
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
            {copy.backToCenter}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              {copy.readOnly}
            </Badge>
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{copy.description}</p>
          <ReportGeneratedAt value={activeReport?.generatedAt} />
        </div>
        <ReportToolbar
          onRefresh={handleRefresh}
          onResetFilters={handleReset}
          onPrint={handlePrint}
          onExportExcel={() => handleExport("excel")}
          onExportPdf={() => handleExport("pdf")}
          isRefreshing={isRefreshing || activeQuery.isFetching}
          exportState={exportState}
        />
      </div>

      <Tabs value={view} onValueChange={(value) => setView(value as ValuationView)}>
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-fit">
          <TabsTrigger value="detail"><Layers3 className="h-4 w-4" />{distributionCopy.tabs.detail}</TabsTrigger>
          <TabsTrigger value="warehouse"><Warehouse className="h-4 w-4" />{distributionCopy.tabs.warehouse}</TabsTrigger>
          <TabsTrigger value="category"><Tags className="h-4 w-4" />{distributionCopy.tabs.category}</TabsTrigger>
          <TabsTrigger value="review"><FileSearch className="h-4 w-4" />{reviewCopy.tab}</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="text-sm text-muted-foreground">{view === "review" ? reviewCopy.hint : distributionCopy.hints[view]}</p>

      <ReportFiltersBar title={view === "review" ? reviewCopy.filters.title : copy.filters.title}>
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <Label htmlFor="valuation-search">{copy.filters.search}</Label>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="valuation-search" value={search} onChange={(e) => setSearch(e.target.value)} className="ps-9" placeholder={copy.filters.searchPlaceholder} />
          </div>
        </div>
        <div className="min-w-[220px] space-y-1.5">
          <Label>{copy.filters.warehouse}</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent dir={dir}>
              <SelectItem value="all">{copy.filters.allWarehouses}</SelectItem>
              {warehouseOptions.map((warehouse: any) => (
                <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouseName(warehouse)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[190px] space-y-1.5">
          <Label>{copy.filters.status}</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as ValueStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent dir={dir}>
              <SelectItem value="all">{copy.statuses.all}</SelectItem>
              <SelectItem value="positive">{copy.statuses.positive}</SelectItem>
              <SelectItem value="zero">{copy.statuses.zero}</SelectItem>
              <SelectItem value="negative">{copy.statuses.negative}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {view === "review" && (
          <>
            <div className="min-w-[240px] space-y-1.5">
              <Label>{reviewCopy.filters.category}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent dir={dir}>
                  <SelectItem value="all">{reviewCopy.filters.allCategories}</SelectItem>
                  {(reviewReport?.categories || []).map((row: any) => (
                    <SelectItem key={row.key} value={row.key}>{categoryOptionName(row)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[240px] space-y-1.5">
              <Label>{reviewCopy.filters.condition}</Label>
              <Select value={condition} onValueChange={(value) => setCondition(value as ReviewCondition)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent dir={dir}>
                  <SelectItem value="all">{reviewCopy.conditions.all}</SelectItem>
                  <SelectItem value="value_mismatch">{reviewCopy.conditions.value_mismatch}</SelectItem>
                  <SelectItem value="negative_stored_value">{reviewCopy.conditions.negative_stored_value}</SelectItem>
                  <SelectItem value="negative_quantity">{reviewCopy.conditions.negative_quantity}</SelectItem>
                  <SelectItem value="reconciliation_exception">{reviewCopy.conditions.reconciliation_exception}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </ReportFiltersBar>

      {view === "detail" ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.summary.totalValue}</p><p className="mt-1 text-2xl font-bold">{detailReport ? valueFormat.format(detailReport.summary.totalValue) : "—"}</p></div><CircleDollarSign className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.summary.rows}</p><p className="mt-1 text-2xl font-bold">{detailReport?.summary.rows ?? "—"}</p></div><Boxes className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.statuses.positive}</p><p className="mt-1 text-2xl font-bold">{detailReport?.summary.positiveValueRows ?? "—"}</p></div><Banknote className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.statuses.zero}</p><p className="mt-1 text-2xl font-bold">{detailReport?.summary.zeroValueRows ?? "—"}</p></div><Banknote className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.summary.warehouses}</p><p className="mt-1 text-2xl font-bold">{detailReport?.summary.warehouses ?? "—"}</p></div><Warehouse className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{copy.table.title}</CardTitle></CardHeader>
            <CardContent className="p-0">
              {detailQuery.isLoading ? (
                <div className="p-10 text-center text-sm text-muted-foreground">{copy.messages.loading}</div>
              ) : detailQuery.error ? (
                <div className="p-10 text-center"><p className="font-medium text-destructive">{copy.messages.loadFailed}</p><p className="mt-1 text-sm text-muted-foreground">{detailQuery.error.message}</p></div>
              ) : visibleRows.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">{copy.table.empty}</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>{copy.table.item}</TableHead><TableHead>{copy.table.code}</TableHead><TableHead>{copy.table.warehouse}</TableHead><TableHead className="text-end">{copy.table.quantity}</TableHead><TableHead>{copy.table.unit}</TableHead><TableHead className="text-end">{copy.table.averageCost}</TableHead><TableHead className="text-end">{copy.table.value}</TableHead><TableHead>{copy.table.status}</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {visibleRows.map((row: any) => (
                          <TableRow key={row.inventoryId}>
                            <TableCell className="font-medium">{row.itemName}</TableCell>
                            <TableCell dir="ltr" className="text-start">{row.internalCode || "—"}</TableCell>
                            <TableCell>{rowWarehouseName(row)}</TableCell>
                            <TableCell className="text-end tabular-nums">{quantityFormat.format(row.quantity)}</TableCell>
                            <TableCell>{row.unit || "—"}</TableCell>
                            <TableCell className="text-end tabular-nums">{costFormat.format(row.averageCost)}</TableCell>
                            <TableCell className="text-end font-medium tabular-nums">{valueFormat.format(row.totalCostValue)}</TableCell>
                            <TableCell>{statusBadge(row.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {tablePager}
                </>
              )}
            </CardContent>
          </Card>
          <p className="text-xs leading-5 text-muted-foreground">{copy.footerNotice}</p>
        </>
      ) : view === "warehouse" || view === "category" ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.summary.totalValue}</p><p className="mt-1 text-2xl font-bold">{distributionReport ? valueFormat.format(distributionReport.summary.totalValue) : "—"}</p></div><CircleDollarSign className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{distributionCopy.summary.groups}</p><p className="mt-1 text-2xl font-bold">{distributionReport ? (view === "warehouse" ? distributionReport.summary.warehouseGroups : distributionReport.summary.categoryGroups) : "—"}</p></div>{view === "warehouse" ? <Warehouse className="h-5 w-5 text-muted-foreground" /> : <Tags className="h-5 w-5 text-muted-foreground" />}</CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.summary.rows}</p><p className="mt-1 text-2xl font-bold">{distributionReport?.summary.rows ?? "—"}</p></div><Boxes className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{view === "category" ? distributionCopy.summary.uncategorizedRows : copy.summary.warehouses}</p><p className="mt-1 text-2xl font-bold">{distributionReport ? (view === "category" ? distributionReport.summary.uncategorizedInventoryRows : distributionReport.summary.warehouses) : "—"}</p></div><Banknote className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{view === "warehouse" ? distributionCopy.warehouse.title : distributionCopy.category.title}</CardTitle></CardHeader>
            <CardContent className="p-0">
              {distributionQuery.isLoading ? (
                <div className="p-10 text-center text-sm text-muted-foreground">{copy.messages.loading}</div>
              ) : distributionQuery.error ? (
                <div className="p-10 text-center"><p className="font-medium text-destructive">{copy.messages.loadFailed}</p><p className="mt-1 text-sm text-muted-foreground">{distributionQuery.error.message}</p></div>
              ) : visibleRows.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">{distributionCopy.empty}</div>
              ) : view === "warehouse" ? (
                <>
                  <div className="overflow-x-auto"><Table>
                    <TableHeader><TableRow><TableHead>{distributionCopy.warehouse.warehouse}</TableHead><TableHead className="text-end">{distributionCopy.warehouse.inventoryRows}</TableHead><TableHead>{distributionCopy.warehouse.quantityContext}</TableHead><TableHead className="text-end">{distributionCopy.warehouse.value}</TableHead><TableHead className="text-end">{distributionCopy.warehouse.share}</TableHead></TableRow></TableHeader>
                    <TableBody>{visibleRows.map((row: any) => <TableRow key={row.warehouseId ?? "unassigned"}><TableCell className="font-medium">{rowWarehouseName(row)}</TableCell><TableCell className="text-end tabular-nums">{row.inventoryRows}</TableCell><TableCell className="max-w-[360px] whitespace-normal">{quantityContext(row.quantityContext)}</TableCell><TableCell className="text-end font-medium tabular-nums">{valueFormat.format(row.totalValue)}</TableCell><TableCell className="text-end tabular-nums">{share(row.sharePercent)}</TableCell></TableRow>)}</TableBody>
                  </Table></div>
                  {tablePager}
                </>
              ) : (
                <>
                  <div className="overflow-x-auto"><Table>
                    <TableHeader><TableRow><TableHead>{distributionCopy.category.category}</TableHead><TableHead className="text-end">{distributionCopy.category.itemCount}</TableHead><TableHead className="text-end">{distributionCopy.category.inventoryRows}</TableHead><TableHead>{distributionCopy.category.quantityContext}</TableHead><TableHead className="text-end">{distributionCopy.category.value}</TableHead><TableHead className="text-end">{distributionCopy.category.share}</TableHead></TableRow></TableHeader>
                    <TableBody>{visibleRows.map((row: any) => <TableRow key={row.categoryNodeId ?? "uncategorized"}><TableCell className="font-medium">{categoryName(row)}</TableCell><TableCell className="text-end tabular-nums">{row.itemCount}</TableCell><TableCell className="text-end tabular-nums">{row.inventoryRows}</TableCell><TableCell className="max-w-[360px] whitespace-normal">{quantityContext(row.quantityContext)}</TableCell><TableCell className="text-end font-medium tabular-nums">{valueFormat.format(row.totalValue)}</TableCell><TableCell className="text-end tabular-nums">{share(row.sharePercent)}</TableCell></TableRow>)}</TableBody>
                  </Table></div>
                  {tablePager}
                </>
              )}
            </CardContent>
          </Card>
          <p className="text-xs leading-5 text-muted-foreground">{distributionCopy.footerNotice}</p>
        </>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{reviewCopy.summary.checked}</p><p className="mt-1 text-2xl font-bold">{reviewReport?.summary.checkedInventoryRows ?? "—"}</p></div><Boxes className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{reviewCopy.summary.review}</p><p className="mt-1 text-2xl font-bold">{reviewReport?.summary.reviewRows ?? "—"}</p></div><TriangleAlert className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{reviewCopy.summary.valueMismatch}</p><p className="mt-1 text-2xl font-bold">{reviewReport?.summary.valueMismatchRows ?? "—"}</p></div><CircleDollarSign className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{reviewCopy.summary.negativeValue}</p><p className="mt-1 text-2xl font-bold">{reviewReport?.summary.negativeStoredValueRows ?? "—"}</p></div><Banknote className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{reviewCopy.summary.noDetectedReview}</p><p className="mt-1 text-2xl font-bold">{reviewReport?.summary.withoutDetectedReview ?? "—"}</p></div><ShieldCheck className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">{reviewCopy.table.title}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">{reviewCopy.table.scopeNotice}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setLocation(reviewReport?.reconciliationPath || "/inventory/reconciliation")}>
                {reviewCopy.openReconciliation}<ExternalLink className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {reviewQuery.isLoading ? (
                <div className="p-10 text-center text-sm text-muted-foreground">{reviewCopy.messages.loading}</div>
              ) : reviewQuery.error ? (
                <div className="p-10 text-center"><p className="font-medium text-destructive">{reviewCopy.messages.loadFailed}</p><p className="mt-1 text-sm text-muted-foreground">{reviewQuery.error.message}</p></div>
              ) : visibleRows.length === 0 ? (
                <div className="p-10 text-center text-sm text-muted-foreground">{reviewCopy.table.empty}</div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>{reviewCopy.table.item}</TableHead>
                        <TableHead>{reviewCopy.table.warehouse}</TableHead>
                        <TableHead>{reviewCopy.table.category}</TableHead>
                        <TableHead className="text-end">{reviewCopy.table.quantity}</TableHead>
                        <TableHead className="text-end">{reviewCopy.table.averageCost}</TableHead>
                        <TableHead className="text-end">{reviewCopy.table.storedValue}</TableHead>
                        <TableHead>{reviewCopy.table.condition}</TableHead>
                        <TableHead className="text-end">{reviewCopy.table.expected}</TableHead>
                        <TableHead className="text-end">{reviewCopy.table.difference}</TableHead>
                        <TableHead>{reviewCopy.table.evidence}</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {visibleRows.map((row: any) => {
                          const evidence = evidenceForRow(row);
                          return (
                            <TableRow key={row.inventoryId}>
                              <TableCell><div className="font-medium">{row.itemName}</div><div dir="ltr" className="text-start text-xs text-muted-foreground">{row.internalCode || "—"}</div></TableCell>
                              <TableCell>{rowWarehouseName(row)}</TableCell>
                              <TableCell className="max-w-[300px] whitespace-normal">{categoryName(row)}</TableCell>
                              <TableCell className="text-end tabular-nums">{quantityFormat.format(row.quantity)} {row.unit || ""}</TableCell>
                              <TableCell className="text-end tabular-nums">{costFormat.format(row.averageCost)}</TableCell>
                              <TableCell className="text-end font-medium tabular-nums">{valueFormat.format(row.totalCostValue)}</TableCell>
                              <TableCell><div className="flex max-w-[320px] flex-wrap gap-1">{row.conditions.map((item: any) => <span key={`${item.condition}-${item.reconciliationCode || "stored"}`}>{conditionBadge(item.condition)}</span>)}</div></TableCell>
                              <TableCell className="text-end tabular-nums">{evidence?.expectedValue == null ? "—" : valueFormat.format(evidence.expectedValue)}</TableCell>
                              <TableCell className="text-end tabular-nums">{evidence?.difference == null ? "—" : valueFormat.format(evidence.difference)}</TableCell>
                              <TableCell><div dir="ltr" className="text-start text-xs">{row.reconciliationCodes?.join(" | ") || reviewCopy.storedValueEvidence}</div></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {tablePager}
                </>
              )}
            </CardContent>
          </Card>
          <p className="text-xs leading-5 text-muted-foreground">{reviewCopy.footerNotice}</p>
        </>
      )}
    </div>
  );
}
