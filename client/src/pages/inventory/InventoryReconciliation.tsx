import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileDown,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

const EXCEPTION_LABELS: Record<string, string> = {
  INVENTORY_LOT_QUANTITY_MISMATCH: "فرق كمية المخزون عن أرصدة الدفعات",
  LOT_GLOBAL_BALANCE_MISMATCH: "فرق إجمالي الدفعة عن توزيعها",
  NEGATIVE_INVENTORY_QUANTITY: "رصيد مخزون سالب",
  NEGATIVE_LOT_BALANCE: "رصيد دفعة سالب",
  NEGATIVE_LOT_REMAINING: "إجمالي دفعة متبقٍ سالب",
  INVENTORY_VALUE_MISMATCH: "فرق في قيمة المخزون",
  ORPHAN_INVENTORY_REFERENCE: "مرجع Inventory غير موجود",
  ORPHAN_LOT_REFERENCE: "مرجع Lot غير موجود",
  INVENTORY_WITHOUT_WAREHOUSE: "Inventory بدون مخزن",
  ORPHAN_WAREHOUSE_REFERENCE: "مرجع مخزن غير موجود",
  DUPLICATE_LOT_WITHIN_WAREHOUSE: "تكرار الدفعة داخل نفس المخزن",
};

function formatNumber(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString("ar-SA-u-nu-latn", { maximumFractionDigits: 4 });
}

export default function InventoryReconciliation() {
  const [search, setSearch] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const reconciliation = trpc.inventoryReconciliation.run.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const warehouses = trpc.warehouse.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const result = reconciliation.data;
  const warehouseById = useMemo(() => {
    const map = new Map<number, string>();
    for (const warehouse of (warehouses.data || []) as any[]) {
      map.set(Number(warehouse.id), warehouse.nameAr || warehouse.nameEn || `#${warehouse.id}`);
    }
    return map;
  }, [warehouses.data]);

  const exceptionTypes = useMemo(
    () => Object.keys(result?.summary.exceptionsByCode || {}),
    [result?.summary.exceptionsByCode],
  );

  const filteredExceptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return (result?.exceptions || []).filter((row) => {
      if (warehouseFilter !== "all" && String(row.warehouseId ?? "") !== warehouseFilter) return false;
      if (typeFilter !== "all" && row.code !== typeFilter) return false;
      if (!normalizedSearch) return true;
      const warehouseName = row.warehouseId == null ? "" : warehouseById.get(Number(row.warehouseId)) || "";
      const haystack = [
        row.itemName,
        row.lotCode,
        row.code,
        EXCEPTION_LABELS[row.code],
        row.message,
        row.inventoryId,
        row.lotId,
        warehouseName,
      ].join(" ").toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [result?.exceptions, search, warehouseFilter, typeFilter, warehouseById]);

  const refresh = async () => {
    await Promise.all([reconciliation.refetch(), warehouses.refetch()]);
  };

  if (reconciliation.isLoading) {
    return (
      <div className="p-6" dir="rtl">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            جاري تشغيل فحص مطابقة المخزون...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (reconciliation.error || !result) {
    return (
      <div className="p-6" dir="rtl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>تعذر تشغيل تقرير المطابقة</AlertTitle>
          <AlertDescription className="mt-2">
            {reconciliation.error?.message || "لم يتم استلام نتيجة من محرك المطابقة."}
          </AlertDescription>
        </Alert>
        <Button className="mt-4" variant="outline" onClick={() => reconciliation.refetch()}>
          <RefreshCw className="ms-2 h-4 w-4" /> إعادة المحاولة
        </Button>
      </div>
    );
  }

  const allPassed = result.summary.exceptionChecks === 0;

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShieldCheck className="h-6 w-6" /> تقرير مطابقة المخزون
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            عرض رقابي Read-only لنتائج محرك Inventory Reconciliation. لا توجد أي إجراءات إصلاح أو تعديل بيانات في هذه الشاشة.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a
              href="/guides/inventory-reconciliation-guide-ar.pdf"
              download="inventory-reconciliation-guide-ar.pdf"
            >
              <FileDown className="ms-2 h-4 w-4" />
              تحميل دليل تقرير مطابقة المخزون (PDF)
            </a>
          </Button>
          <Button variant="outline" onClick={refresh} disabled={reconciliation.isFetching}>
            <RefreshCw className={`ms-2 h-4 w-4 ${reconciliation.isFetching ? "animate-spin" : ""}`} />
            تحديث الفحص
          </Button>
        </div>
      </div>

      <Alert className={allPassed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
        {allPassed ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        <AlertTitle>{allPassed ? "جميع فحوص المطابقة ناجحة" : "توجد استثناءات تحتاج مراجعة"}</AlertTitle>
        <AlertDescription>
          {allPassed
            ? `تم تنفيذ ${result.summary.checksPerformed} فحصًا بدون أي استثناءات.`
            : `تم اكتشاف ${result.summary.exceptionChecks} استثناء/استثناءات. التقرير للعرض والمراجعة فقط ولا ينفذ أي Auto-fix.`}
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>إجمالي الفحوص</CardDescription><CardTitle>{result.summary.checksPerformed}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>فحوص ناجحة</CardDescription><CardTitle>{result.summary.passedChecks}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>الاستثناءات</CardDescription><CardTitle>{result.summary.exceptionChecks}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Inventory ضمن Lot Tracking</CardDescription><CardTitle>{result.scope.trackedInventoryRows}</CardTitle></CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">نطاق الفحص</CardTitle>
          <CardDescription>
            البيانات القديمة خارج Lot Tracking لا تُعامل كفشل تاريخي، ولا يتم إجراء Historical Reconstruction أو Auto-fix.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border p-3"><span className="text-muted-foreground">إجمالي Inventory</span><div className="mt-1 font-semibold">{result.scope.inventoryRows}</div></div>
          <div className="rounded-md border p-3"><span className="text-muted-foreground">خارج Lot-tracked scope</span><div className="mt-1 font-semibold">{result.scope.inventoryRowsOutsideLotTrackedScope}</div></div>
          <div className="rounded-md border p-3"><span className="text-muted-foreground">Lots</span><div className="mt-1 font-semibold">{result.scope.lotRows}</div></div>
          <div className="rounded-md border p-3"><span className="text-muted-foreground">Lot Balances</span><div className="mt-1 font-semibold">{result.scope.lotBalanceRows}</div></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">استثناءات المطابقة</CardTitle>
          <CardDescription>استخدم الفلاتر للمراجعة. لا تحتوي هذه الصفحة على أي إجراء تعديل أو إصلاح.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pr-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالصنف أو الدفعة أو الرسالة..." />
            </div>
            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger><SelectValue placeholder="كل المخازن" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المخازن</SelectItem>
                {((warehouses.data || []) as any[]).map((warehouse) => (
                  <SelectItem key={warehouse.id} value={String(warehouse.id)}>{warehouse.nameAr || warehouse.nameEn || `#${warehouse.id}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="كل أنواع الاستثناءات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل أنواع الاستثناءات</SelectItem>
                {exceptionTypes.map((code) => (
                  <SelectItem key={code} value={code}>{EXCEPTION_LABELS[code] || code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredExceptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-600" />
              <p className="font-semibold">لا توجد استثناءات مطابقة للعرض</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.exceptions.length === 0 ? "الحالة الحالية اجتازت جميع فحوص Reconciliation." : "غيّر الفلاتر لعرض الاستثناءات الأخرى."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">نوع الاستثناء</TableHead>
                    <TableHead className="text-right">الصنف / Inventory</TableHead>
                    <TableHead className="text-right">المخزن</TableHead>
                    <TableHead className="text-right">الدفعة</TableHead>
                    <TableHead className="text-right">الحالي</TableHead>
                    <TableHead className="text-right">المتوقع</TableHead>
                    <TableHead className="text-right">الفرق</TableHead>
                    <TableHead className="text-right">التفصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExceptions.map((row, index) => (
                    <TableRow key={`${row.code}-${row.entityType}-${row.inventoryId}-${row.lotId}-${index}`}>
                      <TableCell><Badge variant="outline">{EXCEPTION_LABELS[row.code] || row.code}</Badge></TableCell>
                      <TableCell>
                        <div className="font-medium">{row.itemName || "—"}</div>
                        {row.inventoryId != null && <div className="text-xs text-muted-foreground">Inventory #{row.inventoryId}</div>}
                      </TableCell>
                      <TableCell>{row.warehouseId == null ? "—" : (warehouseById.get(Number(row.warehouseId)) || `#${row.warehouseId}`)}</TableCell>
                      <TableCell>{row.lotCode || (row.lotId != null ? `Lot #${row.lotId}` : "—")}</TableCell>
                      <TableCell>{formatNumber(row.currentValue)}</TableCell>
                      <TableCell>{formatNumber(row.expectedValue)}</TableCell>
                      <TableCell>{formatNumber(row.difference)}</TableCell>
                      <TableCell className="min-w-64 text-sm">{row.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Database className="h-4 w-4" />
        آخر فحص: {new Date(result.generatedAt).toLocaleString("ar-SA-u-nu-latn")} · Read-only: نعم · Auto-fix: غير مفعّل
      </div>
    </div>
  );
}
