import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaterialCostRows, MaterialCostTotals } from "@/components/inventory/MaterialCostPanel";

export default function MaterialExecutionCostReport() {
  const { language } = useLanguage();
  const [source, setSource] = useState<"all" | "ticket" | "pmv2" | "independent" | "operational">("all");
  const [groupBy, setGroupBy] = useState<"site" | "section" | "asset" | "document">("site");
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [page, setPage] = useState(1);
  const [siteId, setSite] = useState(""), [sectionId, setSection] = useState(""), [assetId, setAsset] = useState("");
  const sites = trpc.sites.list.useQuery(); const sections = trpc.sections.list.useQuery(undefined); const assets = trpc.assets.list.useQuery({});
  const invalidPeriod = !!from && !!to && from > to;
  const query = trpc.materialCosts.report.useQuery({ source, groupBy, from: from || undefined, to: to || undefined, page,
    siteId: siteId ? Number(siteId) : undefined, sectionId: sectionId ? Number(sectionId) : undefined, assetId: assetId ? Number(assetId) : undefined }, { enabled: !invalidPeriod, retry: false });
  return <div className="space-y-4" dir={language === "ar" || language === "ur" ? "rtl" : "ltr"}>
    <Card><CardHeader><CardTitle className="flex items-center justify-between">صافي تكلفة مواد التنفيذ حسب اللوت<Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching || invalidPeriod}>تحديث</Button></CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">بلاغات بالاسم والفريق ومهام PMV2. كل حركة تُحسب مرة واحدة، دون إضافة قيمة الشراء. هذا كشف تكلفة مواد، ويعرض فرقها عن حركات المخزون بالمتوسط.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Select value={source} onValueChange={value => { setSource(value as typeof source); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل المصادر</SelectItem><SelectItem value="ticket">بلاغات الصيانة</SelectItem><SelectItem value="pmv2">مهام PMV2</SelectItem><SelectItem value="independent">الصرف المستقل</SelectItem><SelectItem value="operational">الصرف التشغيلي</SelectItem></SelectContent></Select>
        <Select value={groupBy} onValueChange={value => { setGroupBy(value as typeof groupBy); setPage(1); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="site">حسب الموقع</SelectItem><SelectItem value="section">حسب القسم</SelectItem><SelectItem value="asset">حسب الأصل</SelectItem><SelectItem value="document">حسب البلاغ / المهمة</SelectItem></SelectContent></Select>
        <Input aria-label="من تاريخ" type="date" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} /><Input aria-label="إلى تاريخ" type="date" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} />
        <Select value={siteId || "all"} onValueChange={value => { setSite(value === "all" ? "" : value); setSection(""); setAsset(""); setPage(1); }}><SelectTrigger><SelectValue placeholder="الموقع" /></SelectTrigger><SelectContent><SelectItem value="all">كل المواقع</SelectItem>{(sites.data || []).map((site: any) => <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>)}</SelectContent></Select>
        <Select value={sectionId || "all"} onValueChange={value => { setSection(value === "all" ? "" : value); setAsset(""); setPage(1); }}><SelectTrigger><SelectValue placeholder="القسم" /></SelectTrigger><SelectContent><SelectItem value="all">كل الأقسام</SelectItem>{(sections.data || []).filter((section: any) => !siteId || Number(section.siteId) === Number(siteId)).map((section: any) => <SelectItem key={section.id} value={String(section.id)}>{section.name}</SelectItem>)}</SelectContent></Select>
        <Select value={assetId || "all"} onValueChange={value => { setAsset(value === "all" ? "" : value); setPage(1); }}><SelectTrigger><SelectValue placeholder="الأصل" /></SelectTrigger><SelectContent><SelectItem value="all">كل الأصول</SelectItem>{(assets.data || []).filter((asset: any) => (!siteId || Number(asset.siteId) === Number(siteId)) && (!sectionId || Number(asset.sectionId) === Number(sectionId))).map((asset: any) => <SelectItem key={asset.id} value={String(asset.id)}>{asset.name}</SelectItem>)}</SelectContent></Select>
      </div>
      {invalidPeriod && <p className="text-destructive">بداية الفترة بعد نهايتها.</p>}
      {query.isFetching && <p role="status">جارٍ قراءة حركات التكلفة…</p>}
      {query.error && <p role="alert" className="text-destructive">{query.error.message}</p>}
      {query.data?.enabled === false && <p>طبقة التكلفة غير مفعّلة. يلزم تنفيذ أوامر القاعدة يدويًا ثم تفعيل الإعداد الموضح في تقرير التسليم.</p>}
      <p className="text-xs text-muted-foreground">الفترة حسب تاريخ كل حركة صرف أو مرتجع، وليس تاريخ إنشاء البلاغ. السجلات القديمة مؤجلة وخارج هذا الكشف.</p>
    </CardContent></Card>
    {query.data?.enabled && <>
      <MaterialCostTotals summary={query.data.summary} />
      <Card><CardHeader><CardTitle className="text-base">التجميع حسب الجهة المستفيدة</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["الجهة / المرجع", "الموقع", "القسم", "المصروف", "المرتجع", "الصافي", "بالـمتوسط", "الفرق"].map(title => <th key={title} className="p-2 text-start">{title}</th>)}</tr></thead><tbody>{query.data.groups.map(group => <tr key={group.id} className="border-b"><td className="p-2">{group.name}{group.incomplete > 0 && <small className="block text-destructive">تكلفة غير مكتملة</small>}</td><td>{group.siteName}</td><td>{group.sectionName}</td><td>{group.issued.toFixed(2)}</td><td>{group.returned.toFixed(2)}</td><td>{group.net.toFixed(2)}</td><td>{group.financialNet?.toFixed(2) ?? "غير مكتملة"}</td><td>{group.difference?.toFixed(2) ?? "غير مكتمل"}</td></tr>)}</tbody></table></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">حركات الصرف والمرتجع ({query.data.total})</CardTitle></CardHeader><CardContent><MaterialCostRows rows={query.data.rows} /><div className="flex gap-2 items-center mt-3"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button><span>{page} / {Math.max(1, Math.ceil(query.data.total / 50))}</span><Button variant="outline" disabled={page * 50 >= query.data.total} onClick={() => setPage(page + 1)}>التالي</Button></div></CardContent></Card>
    </>}
  </div>;
}
