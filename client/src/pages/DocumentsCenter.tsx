// ============================================================
// مركز المستندات — /documents
// صفحة تجميع وقراءة فقط لستة أنواع مستندات موجودة أصلاً بالنظام:
// طلب شراء، سند استلام، سند تسليم، سند مرتجع، عملية استبعاد،
// عملية جرد، تسوية جرد.
//
// مبدأ أساسي: هذه الصفحة لا تُنشئ أي منطق طباعة أو صلاحيات جديد.
// تستخدم بالضبط نفس استعلامات tRPC التي تستخدمها الصفحات الأصلية
// لكل نوع (نفس نطاق الرؤية والأدوار)، وتستدعي نفس قوالب الطباعة
// المشتركة (client/src/lib/print*.ts) التي استُخرجت من تلك الصفحات
// بلا أي تعديل. لا جداول جديدة، لا أرقام تسلسلية جديدة، لا Workflow.
// ============================================================
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileStack, Search, RefreshCw, Printer, ShoppingCart, PackageCheck,
  Truck, RotateCcw, Trash2, ClipboardCheck, Scale, Eye, Download,
} from "lucide-react";
import { toast } from "sonner";
import { buildReceiptHtml } from "@/lib/printReceiptDocument";
import { buildDeliveryReceiptHtml } from "@/lib/printDeliveryDocument";
import { buildReturnDocumentHtml } from "@/lib/printReturnDocument";
import {
  buildDisposalHtml, buildCountHtml, buildSettlementHtml,
} from "@/lib/printInventoryOperationDocuments";
import { viewDocumentAsPdf, downloadDocumentAsPdf } from "@/lib/exportHtmlToPdf";

type DocType = "purchase_order" | "receipt" | "delivery" | "return" | "disposal" | "count" | "settlement";

type DocRow = {
  type: DocType;
  id: number;
  documentNumber: string;
  date: string | Date;
  referenceLabel: string;
  printCount: number | null;
};

const TYPE_META: Record<DocType, { label: string; icon: any; color: string }> = {
  purchase_order: { label: "طلب شراء",      icon: ShoppingCart,   color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  receipt:        { label: "سند استلام",    icon: PackageCheck,   color: "bg-green-100 text-green-700 border-green-200" },
  delivery:       { label: "سند تسليم",     icon: Truck,          color: "bg-blue-100 text-blue-700 border-blue-200" },
  return:         { label: "سند مرتجع",     icon: RotateCcw,      color: "bg-orange-100 text-orange-700 border-orange-200" },
  disposal:       { label: "عملية استبعاد", icon: Trash2,         color: "bg-red-100 text-red-700 border-red-200" },
  count:          { label: "عملية جرد",     icon: ClipboardCheck, color: "bg-teal-100 text-teal-700 border-teal-200" },
  settlement:     { label: "تسوية جرد",     icon: Scale,          color: "bg-purple-100 text-purple-700 border-purple-200" },
};

function relativeOrDate(d: any) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

export default function DocumentsCenter() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocType | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [printingKey, setPrintingKey] = useState<string | null>(null);
  const [viewingKey, setViewingKey] = useState<string | null>(null);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);

  // ── نفس الاستعلامات المستخدمة أصلاً في كل صفحة (نفس الصلاحيات والنطاق) ──
  const poQ       = trpc.purchaseOrders.list.useQuery({});
  const receiptsQ = trpc.warehouseReceipts.list.useQuery();
  const deliveryQ = trpc.deliveryDocuments.list.useQuery();
  const returnQ   = trpc.returnDocuments.list.useQuery();
  const disposalQ = trpc.disposal.list.useQuery();
  const countQ    = trpc.inventoryCount.listOperations.useQuery();
  const settleQ   = trpc.inventoryCount.listSettlements.useQuery();

  const isLoading = poQ.isLoading || receiptsQ.isLoading || deliveryQ.isLoading ||
    returnQ.isLoading || disposalQ.isLoading || countQ.isLoading || settleQ.isLoading;

  const refresh = () => {
    poQ.refetch(); receiptsQ.refetch(); deliveryQ.refetch();
    returnQ.refetch(); disposalQ.refetch(); countQ.refetch(); settleQ.refetch();
  };

  // ── تطبيع كل الأنواع لشكل صف موحّد للعرض فقط (لا تُستخدم للطباعة) ──
  const rows: DocRow[] = useMemo(() => {
    const out: DocRow[] = [];
    (poQ.data as any[] || []).forEach(po => out.push({
      type: "purchase_order", id: po.id, documentNumber: po.poNumber,
      date: po.createdAt, referenceLabel: po.requestedByName || "—", printCount: null,
    }));
    (receiptsQ.data as any[] || []).forEach(r => out.push({
      type: "receipt", id: r.id, documentNumber: r.receiptNumber,
      date: r.receivedAt || r.createdAt, referenceLabel: r.vendorName || "استلام مستقل", printCount: r.printCount ?? 0,
    }));
    (deliveryQ.data as any[] || []).forEach(d => out.push({
      type: "delivery", id: d.id, documentNumber: d.deliveryNumber,
      date: d.createdAt, referenceLabel: d.deliveredToName || "—", printCount: d.printCount ?? 0,
    }));
    (returnQ.data as any[] || []).forEach(r => out.push({
      type: "return", id: r.id, documentNumber: r.returnNumber,
      date: r.createdAt, referenceLabel: r.returnedByName || "—", printCount: r.printCount ?? 0,
    }));
    (disposalQ.data as any[] || []).forEach(op => out.push({
      type: "disposal", id: op.id, documentNumber: op.operationNumber,
      date: op.operationDate || op.createdAt, referenceLabel: op.notes || "—", printCount: null,
    }));
    (countQ.data as any[] || []).forEach(op => out.push({
      type: "count", id: op.id, documentNumber: op.operationNumber,
      date: op.operationDate || op.createdAt, referenceLabel: op.operationTitle || (op.scope === "full" ? "جرد شامل" : "جرد جزئي"), printCount: null,
    }));
    (settleQ.data as any[] || []).forEach(s => out.push({
      type: "settlement", id: s.id, documentNumber: s.settlementNumber,
      date: s.appliedAt || s.createdAt, referenceLabel: s.reason || "—", printCount: null,
    }));
    return out;
  }, [poQ.data, receiptsQ.data, deliveryQ.data, returnQ.data, disposalQ.data, countQ.data, settleQ.data]);

  // ── الفلترة والبحث والترتيب — على القائمة المجمَّعة كاملة ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const to   = dateTo   ? new Date(`${dateTo}T23:59:59.999`) : null;
    let list = rows.filter(r => {
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      const d = r.date ? new Date(r.date) : null;
      if (from && (!d || d < from)) return false;
      if (to && (!d || d > to)) return false;
      if (q) {
        const hay = `${r.documentNumber} ${r.referenceLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      const da = a.date ? new Date(a.date).getTime() : 0;
      const db = b.date ? new Date(b.date).getTime() : 0;
      return sort === "newest" ? db - da : da - db;
    });
    return list;
  }, [rows, search, typeFilter, dateFrom, dateTo, sort]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    (Object.keys(TYPE_META) as DocType[]).forEach(t => { c[t] = rows.filter(r => r.type === t).length; });
    return c;
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const utils = trpc.useUtils();
  const incrementDeliveryPrintMut = trpc.deliveryDocuments.incrementPrint.useMutation();
  const incrementReturnPrintMut   = trpc.returnDocuments.incrementPrint.useMutation();
  const incrementReceiptPrintMut  = trpc.warehouseReceipts.incrementPrint.useMutation();

  // يبني بيانات وثيقة التسليم من صف القائمة (نفس الحقول التي يتوقعها القالب)
  const buildDeliveryData = (row: DocRow) => {
    const full = (deliveryQ.data as any[] || []).find(d => d.id === row.id);
    if (!full) throw new Error("تعذر إيجاد بيانات سند التسليم");
    return {
      itemName: full.itemName, quantity: full.quantity, unit: full.unit,
      supplierName: full.supplierName, actualUnitCost: full.actualUnitCost,
      warehousePhotoUrl: full.warehousePhotoUrl, deliveredByName: full.deliveredByName,
      deliveredToName: full.deliveredToName, notes: full.notes, poNumber: full.poNumber,
      deliveryNumber: full.deliveryNumber,
      deliveredAt: relativeOrDate(full.createdAt),
      itemId: full.poItemId, initialPrintCount: full.printCount,
    };
  };

  // يبني نص HTML الموحّد للأنواع الستة غير طلب الشراء (نفس القوالب حرفيًا)
  // يُستخدم من الطباعة المباشرة ومن عرض/تنزيل PDF الحقيقي، بلا أي تكرار منطق
  const buildHtmlForRow = async (row: DocRow): Promise<string> => {
    switch (row.type) {
      case "receipt": {
        const receipt = await utils.warehouseReceipts.getForPrint.fetch({ id: row.id });
        return buildReceiptHtml(receipt);
      }
      case "delivery":
        return buildDeliveryReceiptHtml(buildDeliveryData(row));
      case "return": {
        const full = (returnQ.data as any[] || []).find(r => r.id === row.id);
        if (!full) throw new Error("تعذر إيجاد بيانات سند المرتجع");
        return buildReturnDocumentHtml(full);
      }
      case "disposal": {
        const op = await utils.disposal.getById.fetch({ id: row.id });
        return buildDisposalHtml(op);
      }
      case "count": {
        const data = await utils.inventoryCount.operationDetails.fetch({ operationId: row.id });
        return buildCountHtml(data as any);
      }
      case "settlement": {
        const data = await utils.inventoryCount.settlementDetails.fetch({ settlementId: row.id });
        return buildSettlementHtml(data as any);
      }
      default:
        throw new Error("نوع غير مدعوم");
    }
  };

  // عدّاد الطباعة الخاص بالنوع (إن وُجد) — يُستدعى فقط عند الطباعة الفعلية
  const incrementPrintForRow = (row: DocRow) => {
    if (row.type === "receipt") incrementReceiptPrintMut.mutate({ id: row.id });
    else if (row.type === "delivery") incrementDeliveryPrintMut.mutate({ id: row.id });
    else if (row.type === "return") incrementReturnPrintMut.mutate({ id: row.id });
  };

  // ── الطباعة: كل نوع يستدعي بالضبط نفس القالب المستخدم بصفحته الأصلية ──
  const handlePrint = async (row: DocRow) => {
    const key = `${row.type}-${row.id}`;
    setPrintingKey(key);
    try {
      if (row.type === "purchase_order") {
        const res = await fetch(`/api/export/po/${row.id}/pdf`, { credentials: "include" });
        if (!res.ok) throw new Error("تعذر تجهيز ملف طلب الشراء");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const win = window.open(url, "_blank");
        if (!win) { const a = document.createElement("a"); a.href = url; a.download = `${row.documentNumber}.pdf`; a.click(); }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const html = await buildHtmlForRow(row);
        const win = window.open("", "_blank", "width=900,height=800");
        if (win) { win.document.write(html); win.document.close(); }
        incrementPrintForRow(row);
      }
    } catch (e: any) {
      toast.error(e.message || "تعذرت الطباعة");
    } finally {
      setPrintingKey(null);
    }
  };

  // ── عرض/تنزيل PDF حقيقي — يبني نفس HTML أعلاه ويحوّله عبر الخادم (Puppeteer) ──
  const handleViewPdf = async (row: DocRow) => {
    const key = `${row.type}-${row.id}`;
    setViewingKey(key);
    try {
      if (row.type === "purchase_order") {
        const res = await fetch(`/api/export/po/${row.id}/pdf`, { credentials: "include" });
        if (!res.ok) throw new Error("تعذر تجهيز ملف طلب الشراء");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const html = await buildHtmlForRow(row);
        await viewDocumentAsPdf(html, row.documentNumber);
      }
    } catch (e: any) {
      toast.error(e.message || "تعذر عرض الملف");
    } finally {
      setViewingKey(null);
    }
  };

  const handleDownloadPdf = async (row: DocRow) => {
    const key = `${row.type}-${row.id}`;
    setDownloadingKey(key);
    try {
      if (row.type === "purchase_order") {
        const res = await fetch(`/api/export/po/${row.id}/pdf`, { credentials: "include" });
        if (!res.ok) throw new Error("تعذر تجهيز ملف طلب الشراء");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${row.documentNumber}.pdf`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const html = await buildHtmlForRow(row);
        await downloadDocumentAsPdf(html, row.documentNumber);
      }
    } catch (e: any) {
      toast.error(e.message || "تعذر تنزيل الملف");
    } finally {
      setDownloadingKey(null);
    }
  };


  const quickFilters: { key: DocType | "all"; label: string }[] = [
    { key: "all", label: "الكل" },
    ...(Object.keys(TYPE_META) as DocType[]).map(t => ({ key: t, label: TYPE_META[t].label })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileStack className="w-6 h-6 text-primary" />
            مركز المستندات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            كل مستندات الشراء والمخزون في مكان واحد — للاطلاع وإعادة الطباعة
          </p>
        </div>
        <Button variant="outline" onClick={refresh} className="gap-2" disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          تحديث البيانات
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="ابحث برقم المستند أو الجهة..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="pr-10"
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {quickFilters.map(f => (
          <Button
            key={f.key}
            size="sm"
            variant={typeFilter === f.key ? "default" : "outline"}
            className="gap-2 h-8"
            onClick={() => { setTypeFilter(f.key); setPage(1); }}
          >
            {f.label}
            <Badge
              variant="secondary"
              className={`text-[11px] px-1.5 min-w-5 justify-center ${typeFilter === f.key ? "bg-primary-foreground/20 text-primary-foreground" : ""}`}
            >
              {counts[f.key] ?? 0}
            </Badge>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">من تاريخ</span>
          <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="w-[150px]" max={dateTo || undefined} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">إلى تاريخ</span>
          <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="w-[150px]" min={dateFrom || undefined} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">الترتيب</span>
          <Select value={sort} onValueChange={v => setSort(v as any)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">الأحدث أولًا</SelectItem>
              <SelectItem value="oldest">الأقدم أولًا</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(search || typeFilter !== "all" || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearch(""); setTypeFilter("all"); setDateFrom(""); setDateTo(""); setPage(1); }}>
            مسح الفلاتر
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : pageRows.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">لا توجد مستندات مطابقة</CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">النوع</TableHead>
                <TableHead className="text-start">رقم المستند</TableHead>
                <TableHead className="text-start">التاريخ</TableHead>
                <TableHead className="text-start">المرجع</TableHead>
                <TableHead className="text-start">مرات الطباعة</TableHead>
                <TableHead className="text-start">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map(row => {
                const meta = TYPE_META[row.type];
                const Icon = meta.icon;
                const key = `${row.type}-${row.id}`;
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1.5 ${meta.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{row.documentNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{relativeOrDate(row.date)}</TableCell>
                    <TableCell className="text-sm max-w-[220px] truncate">{row.referenceLabel}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.printCount ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm" variant="outline" className="gap-1.5"
                          disabled={printingKey === key}
                          onClick={() => handlePrint(row)}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          {printingKey === key ? "..." : "طباعة"}
                        </Button>
                        <Button
                          size="sm" variant="outline" className="gap-1.5 px-2"
                          disabled={viewingKey === key}
                          title="عرض PDF"
                          onClick={() => handleViewPdf(row)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="outline" className="gap-1.5 px-2"
                          disabled={downloadingKey === key}
                          title="تنزيل PDF"
                          onClick={() => handleDownloadPdf(row)}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {!isLoading && filtered.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">النتائج: {filtered.length}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</Button>
            <span className="text-xs text-muted-foreground self-center">{page} / {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>التالي</Button>
          </div>
        </div>
      )}
    </div>
  );
}
