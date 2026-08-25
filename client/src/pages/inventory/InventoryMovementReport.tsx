import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  Boxes,
  FileClock,
  Search,
  ShieldCheck,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { downloadReportFile, openReportPrintView } from "@/lib/reportExport";
import { filterStockCardItems, resolveStockCardItemFromSearch } from "@/lib/stockCardItemSearch";
import { trpc } from "@/lib/trpc";

const PAGE_SIZE = 50;

type ReportMode = "movements" | "stockCard";
type MovementType = "all" | "purchase" | "return" | "delivery" | "adjustment" | "disposal" | "transfer";
type Direction = "all" | "in" | "out";

function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function InventoryMovementReport() {
  const { t, dir, language } = useLanguage();
  const [, setLocation] = useLocation();
  const copy = t.inventoryReports.movements;

  const [mode, setMode] = useState<ReportMode>("movements");
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("all");
  const [movementType, setMovementType] = useState<MovementType>("all");
  const [direction, setDirection] = useState<Direction>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [itemKey, setItemKey] = useState("");
  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exportState, setExportState] = useState<ReportExportState>(null);

  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const metaQuery = trpc.inventoryReports.movementMeta.useQuery(undefined, { refetchOnWindowFocus: false });

  const queryInput = useMemo(() => ({
    search: debouncedSearch || undefined,
    warehouseId: warehouseId === "all" ? undefined : Number(warehouseId),
    movementType,
    direction,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    itemKey: mode === "stockCard" && itemKey ? itemKey : undefined,
  }), [debouncedSearch, warehouseId, movementType, direction, dateFrom, dateTo, mode, itemKey]);

  const canRunReport = mode === "movements" || Boolean(itemKey);
  const reportQuery = trpc.inventoryReports.movements.useQuery(queryInput, {
    enabled: canRunReport,
    refetchOnWindowFocus: false,
  });

  useEffect(() => { setPage(1); }, [mode, debouncedSearch, warehouseId, movementType, direction, dateFrom, dateTo, itemKey]);

  const report = reportQuery.data;
  const rows = report?.rows || [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const locale = language === "ar" ? "ar-SA-u-nu-latn" : language === "ur" ? "ur-PK-u-nu-latn" : "en-US";
  const quantityFormat = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }), [locale]);
  const costFormat = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }), [locale]);
  const valueFormat = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [locale]);
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }), [locale]);

  const warehouseName = (warehouse: any) => {
    const name = language === "en" ? (warehouse.nameEn || warehouse.nameAr) : warehouse.nameAr;
    return `${warehouse.code} - ${name}`;
  };
  const rowWarehouseName = (row: any) => {
    const name = language === "en" ? (row.warehouseNameEn || row.warehouseNameAr) : (row.warehouseNameAr || row.warehouseNameEn);
    return [row.warehouseCode, name].filter(Boolean).join(" - ") || copy.noWarehouse;
  };
  const allItems = metaQuery.data?.items || [];
  const selectedItem = allItems.find((item: any) => item.key === itemKey);
  const stockCardItemOptions = useMemo(
    () => mode === "stockCard" ? filterStockCardItems(allItems, debouncedSearch) : allItems,
    [allItems, mode, debouncedSearch],
  );

  useEffect(() => {
    if (mode !== "stockCard" || itemKey || !debouncedSearch) return;
    const resolvedItem = resolveStockCardItemFromSearch(allItems, debouncedSearch);
    if (resolvedItem) setItemKey(resolvedItem.key);
  }, [mode, itemKey, debouncedSearch, allItems]);

  const exportParams = {
    lang: language,
    search: debouncedSearch || undefined,
    warehouseId: warehouseId === "all" ? undefined : warehouseId,
    movementType,
    direction,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    itemKey: mode === "stockCard" && itemKey ? itemKey : undefined,
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const jobs: Promise<any>[] = [metaQuery.refetch()];
      if (canRunReport) jobs.push(reportQuery.refetch());
      const results = await Promise.all(jobs);
      const error = results.find((result: any) => result.error)?.error;
      if (error) throw error;
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
    setMovementType("all");
    setDirection("all");
    setDateFrom("");
    setDateTo("");
    setItemKey("");
    setPage(1);
    toast.success(copy.messages.filtersReset);
  };

  const handlePrint = () => {
    if (!canRunReport) return toast.info(copy.messages.selectItemFirst);
    openReportPrintView("/api/reports/inventory/movements/print", exportParams);
  };

  const handleExport = async (format: "excel" | "pdf") => {
    if (!canRunReport) return toast.info(copy.messages.selectItemFirst);
    setExportState(format);
    try {
      await downloadReportFile({
        endpoint: format === "excel" ? "/api/reports/inventory/movements.xlsx" : "/api/reports/inventory/movements.pdf",
        fallbackFilename: format === "excel" ? "inventory-movements.xlsx" : "inventory-movements.pdf",
        params: exportParams,
      });
      toast.success(format === "excel" ? copy.messages.excelReady : copy.messages.pdfReady);
    } catch (error: any) {
      toast.error(t.inventoryReports.toolbar.exportFailed, { description: error?.message });
    } finally {
      setExportState(null);
    }
  };

  const movementBadge = (type: MovementType) => {
    if (type === "purchase") return <Badge variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-800">{copy.types.purchase}</Badge>;
    if (type === "delivery") return <Badge variant="secondary" className="border-blue-200 bg-blue-50 text-blue-800">{copy.types.delivery}</Badge>;
    if (type === "return") return <Badge variant="secondary" className="border-violet-200 bg-violet-50 text-violet-800">{copy.types.return}</Badge>;
    if (type === "transfer") return <Badge variant="secondary" className="border-cyan-200 bg-cyan-50 text-cyan-800">{copy.types.transfer}</Badge>;
    if (type === "disposal") return <Badge variant="secondary" className="border-rose-200 bg-rose-50 text-rose-800">{copy.types.disposal}</Badge>;
    return <Badge variant="outline">{copy.types.adjustment}</Badge>;
  };

  const directionBadge = (value: "in" | "out") => value === "in"
    ? <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-700"><ArrowDownToLine className="h-3.5 w-3.5" />{copy.directions.in}</Badge>
    : <Badge variant="outline" className="gap-1 border-rose-200 text-rose-700"><ArrowUpFromLine className="h-3.5 w-3.5" />{copy.directions.out}</Badge>;

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
            <Badge variant="outline" className="gap-1"><ShieldCheck className="h-3.5 w-3.5" />{copy.readOnly}</Badge>
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
            isRefreshing={isRefreshing || reportQuery.isFetching || metaQuery.isFetching}
            exportState={exportState}
            disabled={mode === "stockCard" && !itemKey}
          />
          <ReportGeneratedAt value={report?.generatedAt} />
        </div>
      </div>

      <Tabs value={mode} onValueChange={(value) => setMode(value as ReportMode)}>
        <TabsList className="grid w-full max-w-lg grid-cols-2">
          <TabsTrigger value="movements"><FileClock className="h-4 w-4" />{copy.tabs.movements}</TabsTrigger>
          <TabsTrigger value="stockCard"><Boxes className="h-4 w-4" />{copy.tabs.stockCard}</TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="mt-4">
          <Card className="border-primary/20 bg-primary/[0.03]"><CardContent className="p-4 text-sm leading-6 text-muted-foreground">{copy.tabs.movementsHint}</CardContent></Card>
        </TabsContent>
        <TabsContent value="stockCard" className="mt-4">
          <Card className="border-primary/20 bg-primary/[0.03]"><CardContent className="p-4 text-sm leading-6 text-muted-foreground">{copy.tabs.stockCardHint}</CardContent></Card>
        </TabsContent>
      </Tabs>

      <ReportFiltersBar title={copy.filters.title}>
        {mode === "stockCard" && (
          <div className="min-w-[320px] flex-1 space-y-1.5">
            <Label>{copy.filters.item}</Label>
            <Select value={itemKey || "none"} onValueChange={(value) => setItemKey(value === "none" ? "" : value)}>
              <SelectTrigger><SelectValue placeholder={copy.filters.selectItem} /></SelectTrigger>
              <SelectContent className="max-h-[360px]">
                <SelectItem value="none">{copy.filters.selectItem}</SelectItem>
                {stockCardItemOptions.map((item: any) => (
                  <SelectItem key={item.key} value={item.key}>
                    {[item.internalCode, item.itemName].filter(Boolean).join(" - ")} ({quantityFormat.format(item.currentQuantity)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="min-w-[260px] flex-1 space-y-1.5">
          <Label htmlFor="inventory-movement-search">{copy.filters.search}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="inventory-movement-search" value={search} onChange={(event) => setSearch(event.target.value)} className="ps-9" placeholder={copy.filters.searchPlaceholder} />
          </div>
        </div>

        <div className="min-w-[220px] space-y-1.5">
          <Label>{copy.filters.warehouse}</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{copy.filters.allWarehouses}</SelectItem>
              {(metaQuery.data?.warehouses || []).map((warehouse: any) => <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouseName(warehouse)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[190px] space-y-1.5">
          <Label>{copy.filters.movementType}</Label>
          <Select value={movementType} onValueChange={(value) => setMovementType(value as MovementType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{copy.types.all}</SelectItem>
              <SelectItem value="purchase">{copy.types.purchase}</SelectItem>
              <SelectItem value="delivery">{copy.types.delivery}</SelectItem>
              <SelectItem value="return">{copy.types.return}</SelectItem>
              <SelectItem value="transfer">{copy.types.transfer}</SelectItem>
              <SelectItem value="disposal">{copy.types.disposal}</SelectItem>
              <SelectItem value="adjustment">{copy.types.adjustment}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[165px] space-y-1.5">
          <Label>{copy.filters.direction}</Label>
          <Select value={direction} onValueChange={(value) => setDirection(value as Direction)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{copy.directions.all}</SelectItem>
              <SelectItem value="in">{copy.directions.in}</SelectItem>
              <SelectItem value="out">{copy.directions.out}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[155px] space-y-1.5"><Label>{copy.filters.dateFrom}</Label><Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></div>
        <div className="min-w-[155px] space-y-1.5"><Label>{copy.filters.dateTo}</Label><Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></div>
      </ReportFiltersBar>

      {mode === "stockCard" && !itemKey ? (
        <Card><CardContent className="p-12 text-center"><Boxes className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-semibold">{copy.messages.selectItemFirst}</p><p className="mt-1 text-sm text-muted-foreground">{copy.messages.selectItemHint}</p></CardContent></Card>
      ) : (
        <>
          {mode === "stockCard" && selectedItem && (
            <Card className="border-primary/20">
              <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">{copy.card.item}</p><p className="mt-1 font-semibold">{selectedItem.itemName}</p></div>
                <div><p className="text-xs text-muted-foreground">{copy.card.currentQuantity}</p><p className="mt-1 text-xl font-bold">{quantityFormat.format(selectedItem.currentQuantity)}</p></div>
                <div><p className="text-xs text-muted-foreground">{copy.card.currentValue}</p><p className="mt-1 text-xl font-bold">{valueFormat.format(selectedItem.currentValue)}</p></div>
                <div><p className="text-xs text-muted-foreground">{copy.card.warehouses}</p><p className="mt-1 text-xl font-bold">{selectedItem.warehouseCount}</p></div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.summary.movements}</p><p className="mt-1 text-2xl font-bold">{report?.summary.rows ?? "—"}</p></div><FileClock className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.summary.inQuantity}</p><p className="mt-1 text-2xl font-bold">{report ? quantityFormat.format(report.summary.inQuantity) : "—"}</p></div><ArrowDownToLine className="h-5 w-5 text-emerald-600" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{copy.summary.outQuantity}</p><p className="mt-1 text-2xl font-bold">{report ? quantityFormat.format(report.summary.outQuantity) : "—"}</p></div><ArrowUpFromLine className="h-5 w-5 text-rose-600" /></CardContent></Card>
            <Card><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs text-muted-foreground">{mode === "stockCard" ? copy.summary.currentBalance : copy.summary.distinctItems}</p><p className="mt-1 text-2xl font-bold">{mode === "stockCard" ? (report?.summary.currentQuantity == null ? "—" : quantityFormat.format(report.summary.currentQuantity)) : (report?.summary.distinctItems ?? "—")}</p></div><Warehouse className="h-5 w-5 text-muted-foreground" /></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">{mode === "stockCard" ? copy.table.stockCardTitle : copy.table.movementsTitle}</CardTitle></CardHeader>
            <CardContent className="p-0">
              {reportQuery.isLoading ? <div className="p-10 text-center text-sm text-muted-foreground">{copy.messages.loading}</div>
                : reportQuery.error ? <div className="p-10 text-center"><p className="font-medium text-destructive">{copy.messages.loadFailed}</p><p className="mt-1 text-sm text-muted-foreground">{reportQuery.error.message}</p></div>
                : rows.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">{copy.table.empty}</div>
                : <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>{copy.table.date}</TableHead><TableHead>{copy.table.item}</TableHead><TableHead>{copy.table.warehouse}</TableHead><TableHead>{copy.table.type}</TableHead><TableHead>{copy.table.direction}</TableHead><TableHead>{copy.table.lot}</TableHead><TableHead className="text-center">{copy.table.quantity}</TableHead><TableHead className="text-center">{copy.table.unitCost}</TableHead><TableHead className="text-center">{copy.table.totalCost}</TableHead><TableHead>{copy.table.reference}</TableHead><TableHead>{copy.table.reason}</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>{visibleRows.map((row: any) => <TableRow key={row.transactionId}>
                          <TableCell className="min-w-[170px] whitespace-nowrap">{dateFormat.format(new Date(row.createdAt))}</TableCell>
                          <TableCell className="min-w-[230px]"><p className="font-medium">{row.itemName}</p><p className="font-mono text-[11px] text-muted-foreground" dir="ltr">{row.internalCode || "—"}</p></TableCell>
                          <TableCell className="min-w-[180px]">{rowWarehouseName(row)}</TableCell>
                          <TableCell>{movementBadge(row.transactionType)}</TableCell>
                          <TableCell>{directionBadge(row.direction)}</TableCell>
                          <TableCell><span dir="ltr" className="font-mono text-xs">{row.lotCode || "—"}</span></TableCell>
                          <TableCell className="text-center font-semibold">{quantityFormat.format(row.quantity)} {row.unit || ""}</TableCell>
                          <TableCell className="text-center tabular-nums">{row.unitCost == null ? "—" : costFormat.format(row.unitCost)}</TableCell>
                          <TableCell className="text-center tabular-nums">{row.totalCost == null ? "—" : valueFormat.format(row.totalCost)}</TableCell>
                          <TableCell><span dir="ltr" className="font-mono text-xs">{row.reference || "—"}</span></TableCell>
                          <TableCell className="max-w-[320px]"><span className="line-clamp-2" title={row.reason || ""}>{row.reason || "—"}</span></TableCell>
                        </TableRow>)}</TableBody>
                      </Table>
                    </div>
                    <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                      <span>{copy.table.showing.replace("{from}", String((safePage - 1) * PAGE_SIZE + 1)).replace("{to}", String(Math.min(safePage * PAGE_SIZE, rows.length))).replace("{total}", String(rows.length))}</span>
                      <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{copy.table.previous}</Button><span>{copy.table.page.replace("{page}", String(safePage)).replace("{pages}", String(totalPages))}</span><Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>{copy.table.next}</Button></div>
                    </div>
                  </>}
            </CardContent>
          </Card>
          <p className="text-xs leading-5 text-muted-foreground">{copy.footerNotice}</p>
        </>
      )}
    </div>
  );
}
