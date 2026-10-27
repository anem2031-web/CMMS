import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { independentReadOptions } from "@/lib/read-transport";
import { useTranslation } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateOnly } from "@/lib/purchaseItemTiming";

export const completedLabels = {
  ar: { title: "المكتملة", search: "اسم الصنف أو رقم طلب الشراء", find: "بحث", item: "الصنف", order: "طلب الشراء", quantity: "الكمية", received: "تاريخ استلام المستودع", empty: "لا توجد أصناف مكتملة مطابقة", loading: "جارٍ التحميل…", previous: "السابق", next: "التالي", details: "التفاصيل", refresh: "تحديث" },
  en: { title: "Completed", search: "Item name or purchase request number", find: "Search", item: "Item", order: "Purchase request", quantity: "Quantity", received: "Warehouse receipt date", empty: "No matching completed items", loading: "Loading…", previous: "Previous", next: "Next", details: "Details", refresh: "Refresh" },
  ur: { title: "مکمل شدہ", search: "آئٹم کا نام یا خریداری درخواست نمبر", find: "تلاش", item: "آئٹم", order: "خریداری درخواست", quantity: "مقدار", received: "گودام وصولی کی تاریخ", empty: "کوئی مکمل شدہ آئٹم نہیں", loading: "لوڈ ہو رہا ہے…", previous: "پچھلا", next: "اگلا", details: "تفصیلات", refresh: "تازہ کریں" },
};
export function DelegateCompletedItems() {
  const { language } = useTranslation(); const text = completedLabels[language];
  const [search, setSearch] = useState(""); const [draft, setDraft] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => {
    const nextSearch = draft.trim();
    if (nextSearch === search) return;
    const timer = setTimeout(() => {
      setPage(1);
      setSearch(nextSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, search]);
  const query = trpc.purchaseOrders.completedItems.useQuery({ page, pageSize: 20, search }, independentReadOptions);
  const total = query.data?.total ?? 0;
  return <section className="space-y-4">
    <div className="flex gap-2">
      <Input aria-label={text.search} placeholder={text.search} value={draft} maxLength={200} onChange={e => setDraft(e.target.value)} />
      <Button type="button" variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>{text.refresh}</Button>
    </div>
    {query.error ? <p role="alert" className="text-destructive">{query.error.message}</p> : query.isLoading ? <p>{text.loading}</p> : !query.data?.items.length ? <p>{text.empty}</p> :
      <div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead><tr>{[text.item,text.order,text.quantity,text.received,text.details].map(label => <th key={label} className="p-3 text-start">{label}</th>)}</tr></thead>
        <tbody>{query.data.items.map(item => <tr key={item.id} className="border-t">
          <td className="p-3">{item.itemName}</td><td className="p-3" dir="ltr">{item.poNumber}</td><td className="p-3">{item.quantity} {item.unit}</td>
          <td className="p-3">{item.receivedAt ? formatDateOnly(item.receivedAt, language === "ar" ? "ar-SA" : language === "ur" ? "ur-PK" : "en-US") : "—"}</td>
          <td className="p-3"><Link className="text-primary underline" href={`/purchase-orders/${item.purchaseOrderId}?itemId=${item.id}&source=supply`}>{text.details}</Link></td>
        </tr>)}</tbody></table></div>}
    <div className="flex items-center gap-3">
      <Button variant="outline" disabled={page === 1 || query.isFetching} onClick={() => setPage(p => p-1)}>{text.previous}</Button>
      <span>{page} / {Math.max(1, Math.ceil(total/20))}</span>
      <Button variant="outline" disabled={page*20 >= total || query.isFetching || !!query.error} onClick={() => setPage(p => p+1)}>{text.next}</Button>
    </div>
  </section>;
}
