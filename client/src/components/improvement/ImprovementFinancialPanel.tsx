import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/contexts/LanguageContext";
import { useStaticLabels } from "@/hooks/useContentTranslation";

const labels = {
  ar: { title: "متابعة التنفيذ والتكاليف", estimate: "التقديرية", actual: "الفعلية المسجلة", remaining: "الفرق لصالح الميزانية", excess: "تجاوز الميزانية", partial: "الإجمالي غير مكتمل؛ يلزم استكمال قيم التكلفة أو تسوية إجمالي التذكرة قبل الإغلاق.", missing: "أحد مستندات التنفيذ المرتبطة غير موجود.", pending: "التنفيذ لم يكتمل بعد.", ready: "اكتملت المستندات وبيانات التكلفة؛ يمكن توثيق النتائج والإغلاق.", issue: "صرف مخزون", returned: "مرتجع مخزون", remainder: "بقية تكلفة الصيانة", refresh: "تحديث", empty: "لا توجد تكاليف فعلية مسجلة بعد." },
  en: { title: "Execution and costs", estimate: "Estimated", actual: "Recorded actual", remaining: "Under budget", excess: "Over budget", partial: "The total is incomplete. Complete cost values or reconcile the ticket total before closing.", missing: "A linked execution document is missing.", pending: "Execution is still in progress.", ready: "Documents and costs are complete. Record results to close.", issue: "Stock issue", returned: "Stock return", remainder: "Remaining maintenance cost", refresh: "Refresh", empty: "No actual costs recorded yet." },
  ur: { title: "عمل درآمد اور اخراجات", estimate: "تخمینہ", actual: "درج شدہ اصل لاگت", remaining: "بجٹ کی بچت", excess: "بجٹ سے زیادہ", partial: "کل لاگت نامکمل ہے۔ بند کرنے سے پہلے لاگت کی معلومات مکمل کریں۔", missing: "منسلک دستاویز موجود نہیں۔", pending: "کام ابھی جاری ہے۔", ready: "دستاویزات اور اخراجات مکمل ہیں۔ نتائج درج کرکے بند کریں۔", issue: "اسٹاک اجرا", returned: "اسٹاک واپسی", remainder: "باقی مرمت کی لاگت", refresh: "تازہ کریں", empty: "ابھی کوئی اصل لاگت درج نہیں۔" },
};
export function ImprovementFinancialPanel({ ideaId }: { ideaId: number }) {
  const { language, t } = useTranslation();
  const w = labels[language as keyof typeof labels] || labels.ar;
  const { getStatusLabel, getPOStatusLabel } = useStaticLabels();
  const [, navigate] = useLocation();
  const query = trpc.improvementIdeas.executionSummary.useQuery({ id: ideaId });
  const money = (value: number) => new Intl.NumberFormat(language, { style: "currency", currency: "SAR" }).format(value);
  if (query.isLoading) return <Skeleton className="h-24" />;
  if (!query.data) return <p className="text-sm text-destructive">{query.error?.message}</p>;
  const data = query.data;
  return <Card><CardContent className="p-3 space-y-3 text-sm">
    <div className="flex items-center justify-between"><b>{w.title}</b><Button size="sm" variant="outline" disabled={query.isFetching} onClick={() => query.refetch()}>{w.refresh}</Button></div>
    <div className="flex flex-wrap gap-4"><span>{w.estimate}: {money(data.estimatedTotal)}</span><span>{w.actual}: {money(data.total)}</span><span>{data.budgetRemaining >= 0 ? w.remaining : w.excess}: {money(Math.abs(data.budgetRemaining))}</span></div>
    {!data.complete && <p className="text-destructive">{w.partial}</p>}
    {data.missingDocument && <p className="text-destructive">{w.missing}</p>}
    <p className="text-muted-foreground">{data.executionDone && data.complete ? w.ready : w.pending}</p>
    {data.issues.map((issue, index) => <p key={index} className="text-destructive font-mono">{issue.number}</p>)}
    <div className="divide-y">{data.lines.map(line => <div key={line.key} className="py-2 flex justify-between gap-3 flex-wrap">
      <div><span className="font-mono">{line.number}</span> — {line.description === "stock_issue" ? w.issue : line.description === "stock_return" ? w.returned : line.description === "maintenance_remainder" ? w.remainder : line.description}
        {line.documentKind !== "inventory" && <Button variant="link" size="sm" onClick={() => navigate(`/${line.documentKind === "ticket" ? "tickets" : "purchase-orders"}/${line.documentId}`)}>{t.improvementIdeas.goToLinked}</Button>}
      </div><span>{money(line.amount)}</span>
    </div>)}</div>
    {!data.lines.length && <p className="text-muted-foreground">{w.empty}</p>}
    <div className="flex flex-wrap gap-2">{data.tickets.map(ticket => <Button key={`t${ticket.id}`} variant="outline" size="sm" onClick={() => navigate(`/tickets/${ticket.id}`)}>{ticket.ticketNumber} — {getStatusLabel(ticket.status)}</Button>)}{data.orders.map(order => <Button key={`p${order.id}`} variant="outline" size="sm" onClick={() => navigate(`/purchase-orders/${order.id}`)}>{order.poNumber} — {getPOStatusLabel(order.status)}</Button>)}</div>
  </CardContent></Card>;
}
