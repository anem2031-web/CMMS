import { useEffect, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useTranslation } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList, CheckCircle2, AlertTriangle, Package, ShoppingCart, DollarSign, Truck, Clock, RefreshCw, Maximize2, Minimize2, ArrowUpRight } from "lucide-react";
import { dashboardCopy, dashboardStageLabel } from "./copy";
import { dashboardPeriod, type DashboardFilters, type DashboardMetric, type DashboardRow, type DashboardManagerBucket } from "@shared/dashboard-overview";

const DEFAULT_FILTERS: DashboardFilters = { period: "month", department: "all" };
const ROLE_REDIRECTS: Record<string, string> = {
  maintenance_manager: "/tickets", general_maintenance_manager: "/tickets", construction_procurement_manager: "/tickets?tab=construction",
  supervisor: "/tickets", technician: "/tickets", it_manager: "/tickets", it_member: "/tickets", operator: "/tickets",
  accountant: "/purchase-orders", warehouse: "/inventory", delegate: "/purchase-orders", procurement_officer: "/purchase-orders",
  senior_management: "/reports", executive_director: "/reports", gate_security: "/gate-security",
  food_warehouse_manager: "/purchase-orders", food_warehouse_assistant: "/purchase-orders",
};
const PRIMARY: { metric: DashboardMetric; icon: typeof Clock; color: string }[] = [
  { metric: "new_reports", icon: ClipboardList, color: "text-blue-600 bg-blue-500/10" },
  { metric: "open_execution", icon: Clock, color: "text-indigo-600 bg-indigo-500/10" },
  { metric: "completed_execution", icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10" },
  { metric: "aged_execution", icon: AlertTriangle, color: "text-red-600 bg-red-500/10" },
  { metric: "waiting_material", icon: Package, color: "text-amber-600 bg-amber-500/10" },
  { metric: "purchase_pending", icon: ShoppingCart, color: "text-teal-600 bg-teal-500/10" },
  { metric: "purchase_in_transit", icon: Truck, color: "text-sky-600 bg-sky-500/10" },
  { metric: "received_value", icon: DollarSign, color: "text-violet-600 bg-violet-500/10" },
];
const SECONDARY: DashboardMetric[] = ["critical_execution", "pending_triage", "under_inspection", "awaiting_confirmation", "organizing_reports", "purchase_received"];

export default function FollowupDashboard() {
  const { user, authenticatedUser, loading } = useAuth();
  const { t, language } = useTranslation();
  const [, navigate] = useLocation();
  const copy = dashboardCopy(language);
  const locale = language === "en" ? "en-US" : language === "ur" ? "ur-PK" : "ar-SA";
  const allowed = user?.role === "admin" || user?.role === "owner";
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [monitor, setMonitor] = useState(false);
  const [selection, setSelection] = useState<{ metric: DashboardMetric; managerKey?: string; managerBucket?: DashboardManagerBucket } | null>(null);
  const [page, setPage] = useState(1);
  let validFilters = true;
  try { dashboardPeriod(filters, Date.now()); } catch { validFilters = false; }
  const overview = trpc.dashboard.overview.useQuery(filters, {
    enabled: !!allowed && validFilters,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    retry: 1,
  });
  const details = trpc.dashboard.details.useQuery({
    ...filters, metric: selection?.metric ?? "open_execution", page,
    managerKey: selection?.managerKey, managerBucket: selection?.managerBucket ?? "all",
    snapshotId: overview.data?.snapshotId,
  }, {
    enabled: !!allowed && validFilters && !!selection && !overview.isPlaceholderData && !overview.error,
    placeholderData: keepPreviousData, staleTime: 60_000, refetchOnWindowFocus: false, retry: 1,
  });

  useEffect(() => {
    if (!loading && user && !allowed) navigate(ROLE_REDIRECTS[user.role] ?? "/tickets");
  }, [loading, user, allowed, navigate]);
  useEffect(() => { setSelection(null); setPage(1); }, [filters]);

  if (!allowed) return null;
  const data = overview.data;
  const busy = overview.isLoading || overview.isPlaceholderData;
  const available = validFilters && !overview.error && !!data && !busy;
  const number = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 });
  const money = (value: number) => value.toLocaleString(locale, { style: "currency", currency: "SAR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const date = (value: number | null) => value == null ? copy.notRecorded : new Intl.DateTimeFormat(locale, { timeZone: "Asia/Riyadh", calendar: "gregory", dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  const title = (row: DashboardRow) => language === "en" ? row.titleEn || row.title : language === "ur" ? row.titleUr || row.title : row.titleAr || row.title;
  const owner = (row: DashboardRow) => row.waitOwner === "purchase" ? copy.purchaseOwner : copy[row.waitOwner];
  const status = (row: DashboardRow) => row.kind === "purchase" ? (t.poItemStatus as Record<string, string> | undefined)?.[row.status] ?? row.status : (t.ticketStatus as Record<string, string> | undefined)?.[row.status] ?? row.status;
  const open = (metric: DashboardMetric, managerKey?: string, managerBucket?: DashboardManagerBucket) => { setPage(1); setSelection({ metric, managerKey, managerBucket }); };
  const refresh = () => { void overview.refetch(); if (selection) void details.refetch(); };
  const change = (next: Partial<DashboardFilters>) => setFilters(current => ({ ...current, ...next }));
  const link = (row: DashboardRow) => row.kind === "purchase" ? `/purchase-orders/${row.orderId}` : `/tickets/${row.id}`;
  const detailButton = (value: number, metric: DashboardMetric, managerKey: string, bucket: DashboardManagerBucket = "all") => value ? (
    <button type="button" data-observer-navigation="true" className="underline underline-offset-4 hover:text-primary font-medium" onClick={() => open(metric, managerKey, bucket)} aria-label={`${copy.details} ${copy[metric]} ${number(value)}`}>{number(value)}</button>
  ) : <span className="text-muted-foreground">0</span>;

  return <div className={monitor ? "fixed inset-0 z-40 bg-background overflow-auto p-4 md:p-8" : "space-y-6"} dir={language === "en" ? "ltr" : "rtl"}>
    <div className={monitor ? "max-w-7xl mx-auto space-y-6" : "space-y-6"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.dashboard.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{user?.name} — {(t.roles as Record<string, string>)[authenticatedUser?.role ?? user?.role ?? ""]} — {copy.followup}</p>
        </div>
        <div className="flex gap-2">
          <Button data-observer-navigation="true" variant="outline" size="sm" onClick={refresh} disabled={!validFilters || overview.isFetching}><RefreshCw className={`h-4 w-4 ${overview.isFetching ? "animate-spin" : ""}`} />{overview.isFetching ? copy.refreshing : copy.refresh}</Button>
          <Button data-observer-navigation="true" variant="outline" size="sm" onClick={() => setMonitor(!monitor)}>{monitor ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}{monitor ? copy.exitMonitor : copy.monitor}</Button>
        </div>
      </div>

      <Card className="py-0"><CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="space-y-1 text-xs"><span className="block text-muted-foreground">{copy.period}</span><select aria-label={copy.period} className="h-9 rounded-md border bg-background px-3 text-sm" value={filters.period} onChange={event => change({ period: event.target.value as DashboardFilters["period"] })}>
            <option value="month">{copy.month}</option><option value="year">{copy.year}</option><option value="all">{copy.allTime}</option><option value="custom">{copy.custom}</option>
          </select></label>
          {filters.period === "custom" && <><label className="space-y-1 text-xs"><span className="block text-muted-foreground">{copy.from}</span><Input aria-label={copy.from} type="date" value={filters.dateFrom ?? ""} onChange={event => change({ dateFrom: event.target.value })} /></label><label className="space-y-1 text-xs"><span className="block text-muted-foreground">{copy.to}</span><Input aria-label={copy.to} type="date" value={filters.dateTo ?? ""} onChange={event => change({ dateTo: event.target.value })} /></label></>}
          <label className="space-y-1 text-xs"><span className="block text-muted-foreground">{copy.site}</span><select aria-label={copy.site} className="h-9 max-w-64 rounded-md border bg-background px-3 text-sm" value={filters.siteId ?? "all"} onChange={event => change({ siteId: event.target.value === "all" ? undefined : Number(event.target.value) })}>
            <option value="all">{copy.all}</option>{data?.sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
          </select></label>
          <label className="space-y-1 text-xs"><span className="block text-muted-foreground">{copy.department}</span><select aria-label={copy.department} className="h-9 rounded-md border bg-background px-3 text-sm" value={filters.department} onChange={event => change({ department: event.target.value as DashboardFilters["department"] })}>
            {(["all", "general", "construction", "it", "unclassified"] as const).map(key => <option key={key} value={key}>{copy[key]}</option>)}
          </select></label>
          <Button data-observer-navigation="true" variant="ghost" size="sm" onClick={() => setFilters({ ...DEFAULT_FILTERS })}>{copy.reset}</Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{copy.periodHint}</p>
        {available && <p className="text-xs text-muted-foreground">{copy.lastUpdated}: {date(data!.generatedAt)}</p>}
      </CardContent></Card>

      {!validFilters && <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">{copy.dateError}</div>}
      {overview.error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">{copy.loadError}</div>}
      {validFilters && !overview.error && <>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {PRIMARY.map(({ metric, icon: Icon, color }) => <button key={metric} type="button" data-observer-navigation="true" className="text-start rounded-xl focus-visible:outline-2 focus-visible:outline-primary" disabled={!available} onClick={() => open(metric)} aria-label={`${copy.details} ${copy[metric]}`}>
            <Card className="py-0 h-full hover:shadow-md transition-shadow"><CardContent className="p-5">
              <div className="flex justify-between items-start gap-2 mb-3"><span className="text-xs font-medium text-muted-foreground">{copy[metric]}</span><span className={`rounded-xl p-2 ${color}`}><Icon className="h-4 w-4" /></span></div>
              {!available ? <Skeleton className="h-9 w-24" /> : <p className="text-2xl font-bold tabular-nums">{metric === "received_value" ? money(data!.receivedValue) : number(data!.counts[metric])}</p>}
              {metric === "received_value" && available && <p className="text-xs text-muted-foreground mt-2">{copy.purchase_received}: {number(data!.counts.purchase_received)}{data!.missingCosts > 0 && <span className="block text-amber-700 mt-1">{copy.knownValue} · {number(data!.missingCosts)} {copy.missingCosts}</span>}</p>}
            </CardContent></Card>
          </button>)}
        </div>
        {available && <>
          <div className="flex flex-wrap gap-2">{SECONDARY.map(metric => <Button key={metric} data-observer-navigation="true" size="sm" variant="outline" onClick={() => open(metric)}>{copy[metric]}<Badge variant="secondary">{number(data!.counts[metric])}</Badge></Button>)}</div>
          {(data!.missingCosts > 0 || data!.missingClosedDates > 0 || data!.missingReceiptDates > 0) && <div role="status" className="rounded-md border border-amber-300 bg-amber-50/50 p-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">{copy.incomplete}</p>
            {data!.missingCosts > 0 && <p>{number(data!.missingCosts)} {copy.missingCosts}</p>}
            {data!.missingClosedDates > 0 && <p>{number(data!.missingClosedDates)} {copy.missingClosedDates}</p>}
            {data!.missingReceiptDates > 0 && <p>{number(data!.missingReceiptDates)} {copy.missingReceiptDates}</p>}
          </div>}
        </>}
        <p className="text-xs text-muted-foreground leading-relaxed">{copy.countHint} {copy.costHint}</p>

        <Card className="py-0"><CardContent className="p-4 space-y-3">
          <h2 className="font-semibold">{copy.managerTitle}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">{copy.ageHint} {copy.managerHint}</p>
          {!available ? <Skeleton className="h-24 w-full" /> : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b text-xs text-muted-foreground">{[copy.department, copy.manager, copy.open, copy.completed, copy.waitingElsewhere, copy.agedInside, copy.unknownWait].map(text => <th key={text} className="p-3 text-start font-medium whitespace-nowrap">{text}</th>)}</tr></thead>
            <tbody>{data!.managers.map(manager => <tr key={manager.key} className="border-b last:border-0 hover:bg-muted/30">
              <td className="p-3 whitespace-nowrap">{copy[manager.department]}</td><td className="p-3 whitespace-nowrap">{manager.name || copy.unassigned}</td>
              <td className="p-3">{detailButton(manager.open, "open_execution", manager.key)}</td><td className="p-3 text-emerald-600">{detailButton(manager.completed, "completed_execution", manager.key)}</td>
              <td className="p-3 text-amber-700">{detailButton(manager.waitingElsewhere, "open_execution", manager.key, "waiting_elsewhere")}</td><td className="p-3 text-red-600">{detailButton(manager.agedInside, "open_execution", manager.key, "aged_inside")}</td>
              <td className="p-3">{detailButton(manager.unknownWait, "open_execution", manager.key, "unknown_wait")}</td>
            </tr>)}</tbody>
          </table>{!data!.managers.length && <p className="text-center p-6 text-muted-foreground">{copy.noData}</p>}</div>}
        </CardContent></Card>

        <Card className="py-0"><CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2"><div><h2 className="font-semibold">{copy.materialAlert}</h2><p className="text-xs text-muted-foreground mt-1">{copy.followupHint}</p></div><Button data-observer-navigation="true" size="sm" variant="outline" disabled={!available} onClick={() => open("aged_execution")}>{copy.details}</Button></div>
          {!available ? <Skeleton className="h-20 w-full" /> : data!.followupRows.length ? <div className="divide-y">{data!.followupRows.map(row => <div key={row.key} className="py-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><button type="button" data-observer-navigation="true" className="text-primary text-xs font-mono hover:underline" onClick={() => navigate(link(row))}>{row.number}</button><p className="text-sm font-medium mt-1">{title(row)}</p><p className="text-xs text-muted-foreground mt-1">{row.siteName || copy.notRecorded} · {owner(row)} · {row.managerNames.join("، ") || copy.unassigned}</p>{row.actorNames.length > 0 && <p className="text-xs text-muted-foreground mt-1">{copy.person}: {row.actorNames.join("، ")}</p>}<p className="text-xs text-muted-foreground mt-1">{dashboardStageLabel(language, row.actionStage) || status(row)}</p>{row.note && <p className="text-xs mt-1 whitespace-pre-wrap">{row.note}</p>}</div>
            <div className="text-xs text-muted-foreground text-end"><p>{copy.ageHours}: {row.ageHours == null ? copy.notRecorded : number(row.ageHours)}</p><p className="mt-1">{copy.waitSince}: {date(row.currentSince)}</p></div>
          </div>)}</div> : <p className="py-6 text-center text-sm text-muted-foreground">{copy.noFollowup}</p>}
        </CardContent></Card>
      </>}
    </div>

    <Dialog open={!!selection} onOpenChange={value => { if (!value) setSelection(null); }}><DialogContent showCloseButton={false} className="w-[calc(100vw-2rem)] max-w-none sm:max-w-[calc(100vw-2rem)] xl:max-w-7xl max-h-[90vh] overflow-hidden p-0 gap-0 flex flex-col" dir={language === "en" ? "ltr" : "rtl"}>
      <div className="flex items-center justify-between gap-4 border-b px-4 py-3 md:px-6 shrink-0">
        <DialogHeader className="text-start sm:text-start"><DialogTitle>{selection ? copy[selection.metric] : copy.details}</DialogTitle></DialogHeader>
        <div className="flex items-center gap-2 shrink-0">
          <Button data-observer-navigation="true" variant="outline" size="sm" disabled={!validFilters || overview.isFetching} onClick={refresh}><RefreshCw className={`h-4 w-4 ${overview.isFetching ? "animate-spin" : ""}`} />{copy.refresh}</Button>
          <Button data-observer-navigation="true" variant="outline" size="sm" onClick={() => setSelection(null)}>{copy.close}</Button>
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto p-4 md:p-6 space-y-4">
      {details.error ? <div role="alert" className="space-y-3"><p className="text-destructive text-sm">{copy.loadError}</p><Button data-observer-navigation="true" variant="outline" size="sm" onClick={() => void details.refetch()}>{copy.refresh}</Button></div> : details.isLoading || details.isPlaceholderData || !details.data ? <div role="status" aria-live="polite" className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />{copy.loading}</div> : <>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{number(details.data.total)} {selection?.metric.startsWith("purchase_") || selection?.metric === "received_value" ? copy.item : copy.ticket}</span><span>{copy.lastUpdated}: {date(details.data.generatedAt)}</span></div>
        {selection?.metric === "received_value" && <div className="rounded-md bg-muted p-3 text-sm"><strong>{money(details.data.receivedValue)}</strong><p className="text-xs text-muted-foreground mt-1">{copy.costHint}</p>{details.data.missingCosts > 0 && <p className="text-xs text-amber-700 mt-1">{number(details.data.missingCosts)} {copy.missingCosts}</p>}</div>}
        <p className="text-xs text-muted-foreground lg:hidden">{copy.scrollColumns}</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[56rem] text-sm">
          <thead><tr className="border-b text-muted-foreground">{[copy.number, copy.title, copy.site, copy.status, selection?.metric === "received_value" ? copy.amount : copy.owner, copy.date, copy.details].map((text, index) => <th key={index} className="text-start p-2 font-medium whitespace-nowrap">{text}</th>)}</tr></thead>
          <tbody>{details.data.rows.map(row => <tr key={row.key} className="border-b last:border-0">
            <td className="p-2 align-top whitespace-nowrap font-mono"><a href={link(row)} data-observer-navigation="true" className="text-primary underline underline-offset-4 hover:no-underline" onClick={event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); setSelection(null); navigate(link(row)); } }}>{row.number}</a>{row.kind === "purchase" && <span className="block text-muted-foreground">#{row.id}</span>}</td>
            <td className="p-2 align-top min-w-40 max-w-72 whitespace-normal break-words"><p>{title(row) || copy.notRecorded}</p>{row.quantity != null && <p className="text-muted-foreground mt-1">{copy.quantity}: {number(row.quantity)} {row.unit}</p>}{row.childTotal != null && <p className="text-muted-foreground mt-1">{copy.childProgress}: {row.childCompleted}/{row.childTotal}</p>}</td>
            <td className="p-2 align-top min-w-28 max-w-48 whitespace-normal break-words">{row.siteName || copy.notRecorded}</td><td className="p-2 align-top min-w-32"><p>{status(row)}</p>{dashboardStageLabel(language, row.actionStage) && <p className="text-muted-foreground mt-1">{dashboardStageLabel(language, row.actionStage)}</p>}</td>
            <td className="p-2 min-w-40">{selection?.metric === "received_value" ? row.amount == null ? copy.notRecorded : money(row.amount) : <><p>{owner(row)}</p>{row.actorNames.length > 0 && <p className="text-muted-foreground mt-1">{row.actorNames.join("، ")}</p>}{row.kind === "ticket" && row.waitOwner !== "finished" && <p className="text-muted-foreground mt-1">{copy.waitHours}: {row.waitHours == null ? copy.notRecorded : number(row.waitHours)}</p>}</>}</td>
            <td className="p-2 whitespace-nowrap">{date(row.date)}</td><td className="p-2"><Button data-observer-navigation="true" variant="ghost" size="sm" onClick={() => navigate(link(row))} aria-label={`${copy.openDocument} ${row.number}`}><ArrowUpRight className="h-4 w-4" />{copy.openDocument}</Button></td>
          </tr>)}</tbody>
        </table>{!details.data.rows.length && <p className="p-6 text-center text-muted-foreground">{copy.noData}</p>}</div>
        <div className="flex justify-between items-center gap-2"><Button data-observer-navigation="true" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>{copy.previous}</Button><span className="text-xs text-muted-foreground">{number(page)} / {number(Math.max(1, Math.ceil(details.data.total / details.data.pageSize)))}</span><Button data-observer-navigation="true" variant="outline" size="sm" disabled={page * details.data.pageSize >= details.data.total} onClick={() => setPage(value => value + 1)}>{copy.next}</Button></div>
      </>}
      </div>
    </DialogContent></Dialog>
  </div>;
}
