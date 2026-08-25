import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  PackageSearch,
  Search,
  ShieldCheck,
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
import { useLanguage } from "@/contexts/LanguageContext";
import { downloadReportFile, openReportPrintView } from "@/lib/reportExport";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 50;

type StatusFilter = "all" | "normal" | "low" | "zero" | "negative";

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function InventoryStockBalanceReport() {
  const { t, dir, language } = useLanguage();
  const [, setLocation] = useLocation();
  const copy = t.inventoryReports.stockBalance;

  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [expandedInventoryId, setExpandedInventoryId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exportState, setExportState] = useState<ReportExportState>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const queryInput = useMemo(() => ({
    search: debouncedSearch || undefined,
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    status,
  }), [debouncedSearch, warehouseId, status]);

  const reportQuery = trpc.inventoryReports.stockBalance.useQuery(queryInput, {
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    setPage(1);
    setExpandedInventoryId(null);
  }, [debouncedSearch, warehouseId, status]);

  const report = reportQuery.data;
  const rows = report?.rows || [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const locale = language === "ar" ? "ar-SA-u-nu-latn" : language === "ur" ? "ur-PK-u-nu-latn" : "en-US";
  const numberFormat = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }), [locale]);
  const costFormat = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }), [locale]);
  const valueFormat = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [locale]);

  const statusLabel = (value: StatusFilter) => copy.statuses[value];
  const statusBadge = (value: Exclude<StatusFilter, "all">) => {
    if (value === "negative") return <Badge variant="destructive">{statusLabel(value)}</Badge>;
    if (value === "zero") return <Badge variant="outline">{statusLabel(value)}</Badge>;
    if (value === "low") return <Badge variant="secondary" className="border-amber-300 bg-amber-50 text-amber-800">{statusLabel(value)}</Badge>;
    return <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-800">{statusLabel(value)}</Badge>;
  };

  const warehouseName = (warehouse: any) => {
    const name = language === "en" ? (warehouse.nameEn || warehouse.nameAr) : warehouse.nameAr;
    return `${warehouse.code} - ${name}`;
  };

  const rowWarehouseName = (row: any) => {
    const name = language === "en" ? (row.warehouseNameEn || row.warehouseNameAr) : (row.warehouseNameAr || row.warehouseNameEn);
    return [row.warehouseCode, name].filter(Boolean).join(" - ") || copy.noWarehouse;
  };

  const exportParams = {
    lang: language,
    search: debouncedSearch || undefined,
    warehouseId: warehouseId === "all" ? undefined : warehouseId,
    status,
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
    setSearch("");
    setWarehouseId("all");
    setStatus("all");
    setPage(1);
    setExpandedInventoryId(null);
    toast.success(copy.messages.filtersReset);
  };

  const handlePrint = () => {
    openReportPrintView("/api/reports/inventory/stock-balance/print", exportParams);
  };

  const handleExport = async (format: "excel" | "pdf") => {
    setExportState(format);
    try {
      await downloadReportFile({
        endpoint: format === "excel"
          ? "/api/reports/inventory/stock-balance.xlsx"
          : "/api/reports/inventory/stock-balance.pdf",
        fallbackFilename: format === "excel" ? "stock-balance.xlsx" : "stock-balance.pdf",
        params: exportParams,
      });
      toast.success(format === "excel" ? copy.messages.excelReady : copy.messages.pdfReady);
    } catch (error: any) {
      toast.error(t.inventoryReports.toolbar.exportFailed, { description: error?.message });
    } finally {
      setExportState(null);
    }
  };

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
          <p className="max-w-4xl text-sm leading-6 text-muted-foreground">{copy.description}</p>
        </div>

        <div className="space-y-2 xl:min-w-[520px]">
          <ReportToolbar
            onRefresh={handleRefresh}
            onResetFilters={handleReset}
            onPrint={handlePrint}
            onExportExcel={() => handleExport("excel")}
            onExportPdf={() => handleExport("pdf")}
            isRefreshing={isRefreshing || reportQuery.isFetching}
            exportState={exportState}
          />
          <ReportGeneratedAt value={report?.generatedAt} />
        </div>
      </div>

      <ReportFiltersBar title={copy.filters.title}>
        <div className="min-w-[240px] flex-1 space-y-1.5">
          <Label htmlFor="stock-balance-search">{copy.filters.search}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="stock-balance-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="ps-9"
              placeholder={copy.filters.searchPlaceholder}
            />
          </div>
        </div>

        <div className="min-w-[230px] space-y-1.5">
          <Label>{copy.filters.warehouse}</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{copy.filters.allWarehouses}</SelectItem>
              {(report?.warehouses || []).map((warehouse: any) => (
                <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                  {warehouseName(warehouse)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[210px] space-y-1.5">
          <Label>{copy.filters.status}</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{copy.statuses.all}</SelectItem>
              <SelectItem value="normal">{copy.statuses.normal}</SelectItem>
              <SelectItem value="low">{copy.statuses.low}</SelectItem>
              <SelectItem value="zero">{copy.statuses.zero}</SelectItem>
              <SelectItem value="negative">{copy.statuses.negative}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </ReportFiltersBar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.summary.results}</p><p className="mt-1 text-2xl font-bold">{report?.summary.rows ?? "—"}</p></div><PackageSearch className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.statuses.normal}</p><p className="mt-1 text-2xl font-bold">{report?.summary.normal ?? "—"}</p></div><CircleCheck className="h-5 w-5 text-emerald-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.statuses.low}</p><p className="mt-1 text-2xl font-bold">{report?.summary.low ?? "—"}</p></div><AlertTriangle className="h-5 w-5 text-amber-600" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.statuses.zero}</p><p className="mt-1 text-2xl font-bold">{report?.summary.zero ?? "—"}</p></div><Boxes className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
        <Card className={(report?.summary.negative || 0) > 0 ? "border-destructive/50" : ""}><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.statuses.negative}</p><p className="mt-1 text-2xl font-bold">{report?.summary.negative ?? "—"}</p></div><AlertTriangle className="h-5 w-5 text-destructive" /></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">{copy.table.title}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {copy.summary.lotTracked}: {report?.summary.lotTracked ?? "—"}
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {reportQuery.isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">{copy.messages.loading}</div>
          ) : reportQuery.error ? (
            <div className="p-10 text-center">
              <p className="font-medium text-destructive">{copy.messages.loadFailed}</p>
              <p className="mt-1 text-sm text-muted-foreground">{reportQuery.error.message}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">{copy.table.empty}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{copy.table.item}</TableHead>
                      <TableHead>{copy.table.code}</TableHead>
                      <TableHead>{copy.table.warehouse}</TableHead>
                      <TableHead className="text-center">{copy.table.quantity}</TableHead>
                      <TableHead>{copy.table.unit}</TableHead>
                      <TableHead className="text-center">{copy.table.averageCost}</TableHead>
                      <TableHead className="text-center">{copy.table.value}</TableHead>
                      <TableHead className="text-center">{copy.table.minimum}</TableHead>
                      <TableHead>{copy.table.status}</TableHead>
                      <TableHead className="text-center">{copy.table.lots}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.map((row: any) => {
                      const expanded = expandedInventoryId === row.inventoryId;
                      return (
                        <Fragment key={row.inventoryId}>
                          <TableRow>
                            <TableCell className="min-w-[230px] font-medium">{row.itemName}</TableCell>
                            <TableCell><span dir="ltr" className="font-mono text-xs">{row.internalCode || "—"}</span></TableCell>
                            <TableCell className="min-w-[190px]">{rowWarehouseName(row)}</TableCell>
                            <TableCell className="text-center font-semibold">{numberFormat.format(row.quantity)}</TableCell>
                            <TableCell>{row.unit || "—"}</TableCell>
                            <TableCell className="text-center tabular-nums">{costFormat.format(row.averageCost)}</TableCell>
                            <TableCell className="text-center tabular-nums">{valueFormat.format(row.totalCostValue)}</TableCell>
                            <TableCell className="text-center tabular-nums">{numberFormat.format(row.minQuantity)}</TableCell>
                            <TableCell>{statusBadge(row.status)}</TableCell>
                            <TableCell className="text-center">
                              {row.lots.length > 0 ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => setExpandedInventoryId(expanded ? null : row.inventoryId)}
                                >
                                  {row.lots.length} {copy.table.lotCountSuffix}
                                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>

                          {expanded && row.lots.length > 0 && (
                            <TableRow className="bg-muted/20 hover:bg-muted/20">
                              <TableCell colSpan={10} className="p-0">
                                <div className="m-3 rounded-lg border bg-background p-3">
                                  <p className="mb-2 text-xs font-semibold text-muted-foreground">{copy.lotDetails.title}</p>
                                  <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px] text-sm">
                                      <thead className="text-xs text-muted-foreground">
                                        <tr className="border-b">
                                          <th className="px-2 py-2 text-start">{copy.lotDetails.lotCode}</th>
                                          <th className="px-2 py-2 text-center">{copy.lotDetails.warehouseBalance}</th>
                                          <th className="px-2 py-2 text-center">{copy.lotDetails.globalRemaining}</th>
                                          <th className="px-2 py-2 text-start">{copy.lotDetails.expiry}</th>
                                          <th className="px-2 py-2 text-start">{copy.lotDetails.qr}</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {row.lots.map((lot: any) => (
                                          <tr key={lot.lotId} className="border-b last:border-0">
                                            <td className="px-2 py-2 font-mono text-xs" dir="ltr">{lot.lotCode}</td>
                                            <td className="px-2 py-2 text-center">{numberFormat.format(lot.balanceQuantity)}</td>
                                            <td className="px-2 py-2 text-center">{numberFormat.format(lot.remainingQuantity)}</td>
                                            <td className="px-2 py-2">{lot.expiryDate || "—"}</td>
                                            <td className="max-w-[340px] truncate px-2 py-2 font-mono text-xs" dir="ltr" title={lot.trackingToken}>{lot.trackingToken}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{copy.table.showing.replace("{from}", String((safePage - 1) * PAGE_SIZE + 1)).replace("{to}", String(Math.min(safePage * PAGE_SIZE, rows.length))).replace("{total}", String(rows.length))}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{copy.table.previous}</Button>
                  <span>{copy.table.page.replace("{page}", String(safePage)).replace("{pages}", String(totalPages))}</span>
                  <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{copy.table.next}</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs leading-5 text-muted-foreground">{copy.footerNotice}</p>
    </div>
  );
}
