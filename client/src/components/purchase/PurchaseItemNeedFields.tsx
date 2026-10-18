import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/contexts/LanguageContext";
import { MAX_PURCHASE_DELIVERY_DAYS, purchaseRequiredDateFromSubmission, validPurchaseDeliveryDays } from "@shared/purchaseItemNeedDate";
import { cn } from "@/lib/utils";

export function PurchaseItemNeedFields({ index, deliveryLeadDays, legacyRequiredDate, error, onChange, now = new Date() }: {
  index: number;
  deliveryLeadDays: number | null;
  legacyRequiredDate?: string;
  error?: string;
  onChange: (days: number | null) => void;
  now?: Date;
}) {
  const { t } = useTranslation();
  const date = validPurchaseDeliveryDays(deliveryLeadDays)
    ? purchaseRequiredDateFromSubmission(deliveryLeadDays, now) : legacyRequiredDate || "";
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
          onChange={event => onChange(event.target.value === "" ? null : Number(event.target.value))}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <p className="text-[11px] text-muted-foreground">{t.purchaseOrders.deliveryLeadDaysHint}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`purchase-item-${index}-requiredDate`}>{t.purchaseOrders.requiredDate}</Label>
        <Input id={`purchase-item-${index}-requiredDate`} type="date" value={date} readOnly className="bg-muted/40" />
        <p className="text-[11px] text-muted-foreground">
          {deliveryLeadDays == null && legacyRequiredDate ? t.purchaseOrders.legacyRequiredDateHint : t.purchaseOrders.requiredDateSubmissionHint}
        </p>
      </div>
    </div>
  );
}
