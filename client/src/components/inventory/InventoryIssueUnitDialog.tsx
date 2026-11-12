import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type InventoryIssueUnitItem = {
  id: number;
  itemName: string;
  quantity: number | string;
  unit?: string | null;
  issueUnit?: string | null;
  issueUnitApprovedAt?: string | Date | null;
  linkedItemId?: number | null;
  catalogUnit?: string | null;
  isFrozen?: number | boolean | null;
};

type IssueUnitInput = {
  inventoryId: number;
  issueUnit: string;
  factor: number;
};

type Preview = Awaited<
  ReturnType<
    ReturnType<
      typeof trpc.useUtils
    >["client"]["inventory"]["previewIssueUnitConversion"]["query"]
  >
>;

const requestLabels = {
  ticket: "طلب مواد للبلاغ",
  pmv2: "طلب مواد للصيانة المجدولة",
  operational: "طلب صرف تشغيلي",
  purchase: "طلب شراء",
} as const;

function formatQuantity(quantity: string | number, unit?: string | null) {
  return `${Number(quantity).toLocaleString("ar-SA", { maximumFractionDigits: 3 })} ${unit || "وحدة غير محددة"}`;
}

export function InventoryIssueUnitDialog({
  item,
  mode,
  onClose,
}: {
  item: InventoryIssueUnitItem;
  mode: "approve" | "match";
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [issueUnit, setIssueUnit] = useState("");
  const [factorText, setFactorText] = useState("");
  const [preview, setPreview] = useState<{
    input: IssueUnitInput;
    result: Preview;
  } | null>(null);
  const [pending, setPending] = useState<"preview" | "confirm" | null>(null);
  const [error, setError] = useState("");
  const units = trpc.catalog.units.list.useQuery(undefined, {
    enabled: mode === "approve",
  });
  const approve = trpc.inventory.approveIssueUnitConversion.useMutation();
  const match = trpc.inventory.matchCatalogIssueUnit.useMutation();
  const currentUnit = item.issueUnit?.trim() || item.unit?.trim();
  const factor = Number(factorText);
  const isPending = pending !== null;

  const resetPreview = () => {
    setPreview(null);
    setError("");
  };

  const loadPreview = async () => {
    const input = { inventoryId: item.id, issueUnit, factor };
    resetPreview();
    setPending("preview");
    try {
      const result =
        await utils.client.inventory.previewIssueUnitConversion.query(input);
      setPreview({ input, result });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "تعذّرت معاينة التحويل."
      );
    } finally {
      setPending(null);
    }
  };

  const confirm = async () => {
    if (
      isPending ||
      (mode === "approve" &&
        (!preview?.result.confirmationToken || preview.result.blockers.length))
    )
      return;
    setError("");
    setPending("confirm");
    try {
      if (mode === "match") {
        await match.mutateAsync({
          inventoryId: item.id,
          expectedCatalogUnit: item.catalogUnit ?? null,
        });
        await Promise.all([
          utils.inventory.invalidate(),
          utils.catalog.items.invalidate(),
        ]);
        toast.success("تم تحديث وحدة الكتالوج");
      } else {
        if (
          !preview ||
          preview.result.blockers.length ||
          !preview.result.confirmationToken
        )
          return;
        await approve.mutateAsync({
          ...preview.input,
          confirmationToken: preview.result.confirmationToken,
        });
        await Promise.all([
          utils.inventory.invalidate(),
          utils.inventoryCount.invalidate(),
        ]);
        toast.success("تم اعتماد وحدة الصرف");
      }
      onClose();
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "تعذّر حفظ التغيير.");
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent
        dir="rtl"
        className="max-h-[90vh] overflow-y-auto"
        showCloseButton={!isPending}
      >
        <DialogHeader className="sm:text-right">
          <DialogTitle>
            {mode === "approve" ? "اعتماد وحدة الصرف" : "تحديث وحدة الكتالوج"}
          </DialogTitle>
          <DialogDescription>{item.itemName}</DialogDescription>
        </DialogHeader>
        {mode === "match" ? (
          <p className="text-sm">
            ستتغير وحدة الكتالوج من{" "}
            <strong>{item.catalogUnit?.trim() || "غير محددة"}</strong> إلى{" "}
            <strong>{currentUnit}</strong>.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              الرصيد الحالي{" "}
              <strong>{formatQuantity(item.quantity, currentUnit)}</strong>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="inventory-issue-unit">وحدة الصرف</Label>
                <Select
                  value={issueUnit}
                  onValueChange={value => {
                    setIssueUnit(value);
                    resetPreview();
                  }}
                  disabled={isPending || units.isLoading}
                >
                  <SelectTrigger id="inventory-issue-unit">
                    <SelectValue placeholder="اختر الوحدة" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.data?.map(unit => (
                      <SelectItem key={unit.id} value={unit.nameAr}>
                        {unit.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventory-issue-factor">معامل التحويل</Label>
                <Input
                  id="inventory-issue-factor"
                  type="number"
                  min="0"
                  step="any"
                  value={factorText}
                  disabled={isPending}
                  onChange={event => {
                    setFactorText(event.target.value);
                    resetPreview();
                  }}
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              أدخل عدد وحدات الصرف في كل {currentUnit || "وحدة حالية"}. استخدم 1
              إذا بقيت الوحدة نفسها.
            </p>
            {units.error && (
              <p role="alert" className="text-sm text-destructive">
                تعذّر تحميل وحدات الصرف.
              </p>
            )}
            {preview && (
              <div className="space-y-3 rounded-md border p-3 text-sm">
                <p>
                  الرصيد قبل التحويل{" "}
                  <strong>
                    {formatQuantity(
                      preview.result.before.quantity,
                      preview.result.before.unit
                    )}
                  </strong>
                </p>
                <p>
                  الرصيد بعد التحويل{" "}
                  <strong>
                    {formatQuantity(
                      preview.result.after.quantity,
                      preview.result.after.unit
                    )}
                  </strong>
                </p>
                {preview.result.requests.length > 0 && (
                  <div>
                    <p className="font-medium">المتبقي في الطلبات المرتبطة</p>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      {preview.result.requests.map((request, index) => (
                        <li
                          key={`${request.kind}:${request.reference}:${index}`}
                        >
                          {requestLabels[request.kind]}{" "}
                          <bdi>{request.reference}</bdi> من{" "}
                          {formatQuantity(
                            request.beforeQuantity,
                            preview.result.before.unit
                          )}{" "}
                          إلى{" "}
                          {formatQuantity(
                            request.afterQuantity,
                            preview.result.after.unit
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {preview.result.blockers.length > 0 && (
                  <ul
                    role="alert"
                    className="list-inside list-disc space-y-1 text-destructive"
                  >
                    {preview.result.blockers.map((message, index) => (
                      <li key={index}>{message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onClose}
          >
            إلغاء
          </Button>
          {mode === "approve" && (
            <Button
              type="button"
              variant="secondary"
              disabled={
                isPending ||
                !!units.error ||
                !issueUnit ||
                !Number.isFinite(factor) ||
                factor <= 0
              }
              onClick={loadPreview}
            >
              {pending === "preview"
                ? "جارٍ تحميل المعاينة…"
                : "معاينة التحويل"}
            </Button>
          )}
          <Button
            type="button"
            disabled={
              isPending ||
              (mode === "approve" &&
                (!preview?.result.confirmationToken ||
                  !!preview.result.blockers.length))
            }
            onClick={confirm}
          >
            {mode === "approve"
              ? "تأكيد اعتماد وحدة الصرف"
              : "تأكيد تحديث الكتالوج"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
