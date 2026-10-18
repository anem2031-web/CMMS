import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const materialSourceLabels = { ticket_named: "بلاغ بالاسم", ticket_team: "بلاغ فريق", pmv2: "PMV2", independent: "صرف مستقل", operational: "صرف تشغيلي" };
export function MaterialCostRows({ rows }: { rows: any[] }) {
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground">
    {["المستند / المرجع", "الحركة / التاريخ", "الصنف / اللوت", "الكمية", "المصروف باللوت", "المرتجع باللوت", "الصافي", "قيمة الحركة بالمتوسط", "الفرق"].map(title => <th key={title} className="p-2 text-start whitespace-nowrap">{title}</th>)}
  </tr></thead><tbody>{rows.map(row => <tr key={row.eventKey} className="border-b">
    <td className="p-2"><div>{row.sourceNumber || "صرف مستقل"}</div><small>{materialSourceLabels[row.source as keyof typeof materialSourceLabels]}</small></td>
    <td className="p-2"><div>{row.eventNumber}</div><small>{row.eventDate}</small></td>
    <td className="p-2"><div>{row.itemName}</div><small>{row.lotCode} · {row.deliveryNumber}</small></td>
    <td className="p-2">{Number(row.quantity)} {row.unit}</td>
    <td className="p-2">{row.issued.toFixed(2)}</td><td className="p-2">{row.returned.toFixed(2)}</td>
    <td className="p-2">{row.incomplete ? "تكلفة غير مكتملة" : row.net.toFixed(2)}</td>
    <td className="p-2">{row.financialNet == null ? "غير مكتملة" : row.financialNet.toFixed(2)}</td>
    <td className="p-2">{row.difference == null ? "غير مكتمل" : row.difference.toFixed(2)}</td>
  </tr>)}</tbody></table>{!rows.length && <p className="p-3 text-muted-foreground">لا توجد حركات ضمن الطبقة الجديدة.</p>}</div>;
}
export function MaterialCostTotals({ summary }: { summary: any }) {
  return <div className="grid grid-cols-2 md:grid-cols-5 gap-3">{[
    ["المصروف حسب اللوت", summary.issued], ["المرتجع حسب اللوت", summary.returned], ["صافي تكلفة المواد", summary.net],
    ["صافي الحركات بالمتوسط", summary.financialNet], ["فرق أساس التكلفة", summary.difference],
  ].map(([name, amount]) => <div key={String(name)} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{name}</p><p className="font-semibold mt-1">{amount == null ? "غير مكتمل" : Number(amount).toFixed(2)} ر.س</p></div>)}
    {summary.incomplete > 0 && <p className="col-span-full text-sm text-destructive">عدد الحركات ناقصة التكلفة: {summary.incomplete}. الإجمالي المتاح ليس تكلفة مكتملة لجميع الحركات.</p>}
  </div>;
}
export function MaterialCostPanel({ source, id }: { source: "ticket" | "pmv2"; id: number }) {
  const { language } = useLanguage();
  const query = trpc.materialCosts.document.useQuery({ source, id }, { enabled: id > 0, retry: false });
  if (!query.data?.enabled && !query.error) return null;
  return <Card dir={language === "ar" || language === "ur" ? "rtl" : "ltr"}><CardHeader><CardTitle className="text-base flex justify-between items-center">صافي تكلفة مواد التنفيذ حسب اللوت<Button size="sm" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>تحديث</Button></CardTitle></CardHeader><CardContent className="space-y-3">
    {query.error ? <p className="text-sm text-destructive">{query.error.message}</p> : query.data && <>
      <MaterialCostTotals summary={query.data.summary} />
      <p className="text-xs text-muted-foreground">المصدر هو الصرف والمرتجع الفعليان. المشتريات لا تُضاف مرة ثانية. قيمة حركة المخزون بالمتوسط معروضة للمقارنة فقط. السجلات السابقة للتفعيل خارج هذا الكشف.</p>
      <details><summary className="cursor-pointer text-sm text-primary">المواد والمستندات ({query.data.rows.length})</summary><MaterialCostRows rows={query.data.rows} /></details>
    </>}
  </CardContent></Card>;
}
