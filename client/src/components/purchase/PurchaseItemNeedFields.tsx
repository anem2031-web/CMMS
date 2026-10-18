import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/contexts/LanguageContext";
import { MAX_PURCHASE_DELIVERY_DAYS, purchaseNeedTimingFromDate, purchaseNeedTimingFromDays, type PurchaseItemNeedTiming } from "@shared/purchaseItemNeedDate";
import { cn } from "@/lib/utils";

export function PurchaseItemNeedFields({ index, deliveryLeadDays, requiredDate, error, onChange, now = new Date() }: {
  index: number;
  deliveryLeadDays: number | null;
  requiredDate: string;
  error?: string;
  onChange: (timing: PurchaseItemNeedTiming) => void;
  now?: Date;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor={`purchase-item-${index}-deliveryLeadDays`}>{t.purchaseOrders.deliveryLeadDays} *</Label>
        <Input
          id={`purchase-item-${index}-deliveryLeadDays`}
          type="number" min={0} max={MAX_PURCHASE_DELIVERY_DAYS} step={1}
          value={deliveryLeadDays ?? ""}
          aria-invalid={Boolean(error)}
          className={cn(error && "border-destructive focus-visible:ring-destructive")}
          onChange={event => onChange(purchaseNeedTimingFromDays(event.target.value === "" ? null : Number(event.target.value), now))}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <p className="text-[11px] text-muted-foreground">{t.purchaseOrders.deliveryLeadDaysHint}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`purchase-item-${index}-requiredDate`}>{t.purchaseOrders.requiredDate}</Label>
        <Input id={`purchase-item-${index}-requiredDate`} type="date" value={requiredDate} aria-invalid={Boolean(error)}
          className={cn(error && "border-destructive focus-visible:ring-destructive")}
          onChange={event => onChange(purchaseNeedTimingFromDate(event.target.value, now))} />
        <p className="text-[11px] text-muted-foreground">
          {t.purchaseOrders.requiredDateSubmissionHint}
        </p>
      </div>
    </div>
  );
}
