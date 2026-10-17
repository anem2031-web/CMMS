import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { INVALID_CONVERSION_MESSAGE, receiptConversionPreview } from "@shared/receipt-conversion";

export function ReceiptConversionFields({ item, onChange }: {
  item: { purchaseUnit: string; issueUnit?: string; conversionFactor: number; receivedQuantity: number; unitCost: string };
  onChange: (patch: { issueUnit?: string; conversionFactor?: number }) => void;
}) {
  const units = trpc.catalog.units.list.useQuery();
  const preview = receiptConversionPreview(item.receivedQuantity, Number(item.unitCost), item.conversionFactor);
  return <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1"><Label>وحدة الصرف *</Label>
        <Select value={item.issueUnit || ""} onValueChange={issueUnit => onChange({ issueUnit })}>
          <SelectTrigger><SelectValue placeholder="اختر وحدة الصرف" /></SelectTrigger>
          <SelectContent>{(units.data || []).filter((u: any) => Number(u.isActive ?? 1) !== 0).map((u: any) => <SelectItem key={u.id} value={u.nameAr}>{u.nameAr}</SelectItem>)}</SelectContent>
        </Select>
        {units.error && <p className="text-xs text-destructive">تعذر تحميل الوحدات. أعد المحاولة قبل الاعتماد.</p>}
      </div>
      <div className="space-y-1"><Label>معامل التحويل *</Label>
        <Input type="number" min="0" step="0.001" value={item.conversionFactor} onChange={e => onChange({ conversionFactor: Number(e.target.value) || 0 })} aria-invalid={!(item.conversionFactor > 0)} />
        <p className="text-xs text-muted-foreground">عدد وحدات الصرف داخل كل {item.purchaseUnit || "وحدة استلام"}. أدخل 1 إذا كانت الوحدة نفسها.</p>
      </div>
    </div>
    {item.conversionFactor <= 0 && <p className="text-xs text-destructive">{INVALID_CONVERSION_MESSAGE}</p>}
    {preview && item.issueUnit && <p className="text-sm">سيُضاف عند الاعتماد: <strong>{preview.stockQuantity} {item.issueUnit}</strong> — تكلفة وحدة الصرف في اللوت: <strong>{preview.issueUnitCost.toFixed(4)} ر.س</strong> (من سعر الوحدة قبل الضريبة).</p>}
    <p className="text-xs text-muted-foreground">بيانات الاستلام الفعلية مستقلة عن وحدة الطلب. إدخال المعامل يعرض معاينة فقط؛ لا يتغير الرصيد قبل الاعتماد.</p>
  </div>;
}
