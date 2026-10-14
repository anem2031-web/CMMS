import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAX_TICKET_PURCHASE_QUANTITY,
  validWarehouseExtra,
} from "@shared/maintenance-team-tickets/purchase-quantities";

export function WarehousePurchaseQuantities({
  id,
  technicianQuantity,
  purchaseQuantity,
  extra,
  unit,
  language,
  disabled,
  onExtraChange,
}: {
  id: string;
  technicianQuantity: number;
  purchaseQuantity: number | null;
  extra: string;
  unit: string;
  language: string;
  disabled?: boolean;
  onExtraChange: (value: string) => void;
}) {
  const l = (ar: string, en: string, ur: string) =>
    language === "ar" ? ar : language === "ur" ? ur : en;
  const value = extra.trim() === "" ? 0 : Number(extra);
  const valid =
    validWarehouseExtra(value) &&
    technicianQuantity + value <= MAX_TICKET_PURCHASE_QUANTITY;
  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/20">
          <Label
            htmlFor={`${id}-technician`}
            className="text-blue-800 dark:text-blue-200"
          >
            {l("كمية الفني", "Technician quantity", "ٹیکنیشن کی مقدار")}
          </Label>
          <Input
            id={`${id}-technician`}
            readOnly
            value={technicianQuantity}
            dir="ltr"
            className="border-blue-300 bg-background text-blue-900 dark:text-blue-100"
          />
          <p className="text-xs text-muted-foreground">{unit}</p>
        </div>
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <Label
            htmlFor={`${id}-warehouse`}
            className="text-amber-800 dark:text-amber-200"
          >
            {l(
              "إضافة المستودع للتخزين",
              "Extra warehouse stock",
              "گودام کے لیے اضافی اسٹاک"
            )}
          </Label>
          <Input
            id={`${id}-warehouse`}
            type="number"
            min={0}
            max={MAX_TICKET_PURCHASE_QUANTITY}
            step={1}
            value={extra}
            disabled={disabled}
            aria-invalid={!valid}
            onChange={e => onExtraChange(e.target.value)}
            dir="ltr"
            className="border-amber-300 bg-background text-amber-900 dark:text-amber-100"
          />
          <p className="text-xs text-muted-foreground">{unit}</p>
        </div>
        <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
          <Label
            htmlFor={`${id}-total`}
            className="text-emerald-800 dark:text-emerald-200"
          >
            {l(
              "الإجمالي — الفني + إضافة المستودع",
              "Total — technician + warehouse extra",
              "کل — ٹیکنیشن + گودام کا اضافہ"
            )}
          </Label>
          <Input
            id={`${id}-total`}
            readOnly
            value={valid ? technicianQuantity + value : "—"}
            dir="ltr"
            className="border-emerald-300 bg-background font-semibold text-emerald-900 dark:text-emerald-100"
          />
          <p className="text-xs text-muted-foreground">{unit}</p>
        </div>
      </div>
      {purchaseQuantity != null && purchaseQuantity !== technicianQuantity && (
        <p className="text-xs text-muted-foreground">
          {l(
            `عجز الشراء للتذكرة بعد خصم الرصيد والتوفير المعلق: ${purchaseQuantity} ${unit}؛ كمية الشراء الفعلية مع الإضافة: ${valid ? purchaseQuantity + value : "—"} ${unit}.`,
            `Ticket purchase shortage after stock and pending supply: ${purchaseQuantity} ${unit}; actual purchase including extra: ${valid ? purchaseQuantity + value : "—"} ${unit}.`,
            `اسٹاک اور زیر التوا فراہمی کے بعد ٹکٹ کی خریداری کی کمی: ${purchaseQuantity} ${unit}؛ اضافے سمیت اصل خریداری: ${valid ? purchaseQuantity + value : "—"} ${unit}۔`
          )}
        </p>
      )}
      {!valid && (
        <p role="alert" className="text-xs text-destructive">
          {l(
            "أدخل كمية إضافية صحيحة وغير سالبة ضمن الحد المسموح.",
            "Enter a non-negative whole quantity within the allowed limit.",
            "مقررہ حد کے اندر غیر منفی صحیح مقدار درج کریں۔"
          )}
        </p>
      )}
    </div>
  );
}
