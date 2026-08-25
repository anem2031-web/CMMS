import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Download, FileSpreadsheet, Loader2, Upload, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type PreviewRow = {
  rowNumber: number;
  itemCode: string;
  quantity: number | null;
  unitCost: number | null;
  expiryDate: string | null;
  valid: boolean;
  errors: string[];
  itemName: string | null;
  unit: string | null;
  lineValue: number | null;
};

type PreviewResult = {
  valid: boolean;
  operation: {
    operationNumber: string;
    warehouseName: string;
  };
  rows: PreviewRow[];
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    totalQuantity: number;
    totalValue: number;
  };
};

function downloadBase64Xlsx(base64: string, fileName: string) {
  const bytes = atob(base64);
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function OpeningBalanceBulkExcel({
  operationId,
  canImport,
  onImported,
}: {
  operationId: number;
  canImport: boolean;
  onImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [fileBase64, setFileBase64] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const templateMutation = trpc.inventoryCount.openingBalanceTemplate.useMutation();
  const previewMutation = trpc.inventoryCount.openingBalanceImportPreview.useMutation();
  const commitMutation = trpc.inventoryCount.openingBalanceImportCommit.useMutation();
  const exportMutation = trpc.inventoryCount.openingBalanceExport.useMutation();

  const busy = templateMutation.isPending || previewMutation.isPending || commitMutation.isPending || exportMutation.isPending;

  async function handleTemplate() {
    try {
      const result = await templateMutation.mutateAsync();
      downloadBase64Xlsx(result.buffer, result.fileName);
      toast.success("تم تنزيل قالب المخزون الافتتاحي");
    } catch (error: any) {
      toast.error(error?.message || "تعذر تنزيل القالب");
    }
  }

  async function handleExport() {
    try {
      const result = await exportMutation.mutateAsync({ operationId });
      downloadBase64Xlsx(result.buffer, result.fileName);
      toast.success(`تم تصدير ${result.rowCount} صف`);
    } catch (error: any) {
      toast.error(error?.message || "تعذر تصدير الرصيد الافتتاحي");
    }
  }

  function handleChooseFile() {
    if (!canImport) {
      toast.error("عملية الرصيد الافتتاحي محفوظة نهائياً ولا يمكن الاستيراد إليها");
      return;
    }
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("يرجى اختيار ملف Excel بصيغة .xlsx");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
      if (!base64) {
        toast.error("تعذر قراءة ملف Excel");
        return;
      }
      try {
        setFileBase64(base64);
        setPreviewOpen(true);
        setPreview(null);
        const result = await previewMutation.mutateAsync({ operationId, fileBase64: base64 });
        setPreview(result as PreviewResult);
      } catch (error: any) {
        setPreviewOpen(false);
        setFileBase64("");
        toast.error(error?.message || "تعذر تحليل ملف المخزون الافتتاحي");
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleCommit() {
    if (!fileBase64 || !preview?.valid) return;
    try {
      const result = await commitMutation.mutateAsync({ operationId, fileBase64 });
      toast.success(`تم اعتماد استيراد ${result.importedRows} صنف للرصد الافتتاحي`);
      setPreviewOpen(false);
      setPreview(null);
      setFileBase64("");
      onImported();
    } catch (error: any) {
      toast.error(error?.message || "تعذر اعتماد الاستيراد");
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleTemplate} disabled={busy}>
          {templateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          تنزيل القالب
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleChooseFile} disabled={busy || !canImport}>
          {previewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          استيراد Excel
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={handleExport} disabled={busy}>
          {exportMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          تصدير الرصيد
        </Button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileChange}
      />

      <Dialog open={previewOpen} onOpenChange={(open) => {
        if (commitMutation.isPending) return;
        setPreviewOpen(open);
        if (!open) {
          setPreview(null);
          setFileBase64("");
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
          <DialogHeader>
            <DialogTitle>معاينة استيراد المخزون الافتتاحي</DialogTitle>
          </DialogHeader>

          {previewMutation.isPending && !preview ? (
            <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>جاري فحص الملف ومطابقته مع الكتالوج والمستودع...</p>
            </div>
          ) : preview ? (
            <div className="space-y-4 min-h-0 overflow-y-auto pl-1">
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <span className="font-medium">العملية:</span> {preview.operation.operationNumber}
                <span className="mx-2">•</span>
                <span className="font-medium">المستودع:</span> {preview.operation.warehouseName}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className="border rounded-md p-2 text-center"><div className="font-bold text-lg">{preview.summary.totalRows}</div><div className="text-xs text-muted-foreground">إجمالي الصفوف</div></div>
                <div className="border rounded-md p-2 text-center"><div className="font-bold text-lg text-emerald-700">{preview.summary.validRows}</div><div className="text-xs text-muted-foreground">صحيح</div></div>
                <div className="border rounded-md p-2 text-center"><div className="font-bold text-lg text-red-700">{preview.summary.errorRows}</div><div className="text-xs text-muted-foreground">به أخطاء</div></div>
                <div className="border rounded-md p-2 text-center"><div className="font-bold text-lg" dir="ltr">{preview.summary.totalQuantity.toLocaleString("en-US", { maximumFractionDigits: 3 })}</div><div className="text-xs text-muted-foreground">إجمالي الكمية</div></div>
                <div className="border rounded-md p-2 text-center"><div className="font-bold text-lg" dir="ltr">{preview.summary.totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div className="text-xs text-muted-foreground">إجمالي القيمة</div></div>
              </div>

              <div className={`rounded-md border p-3 text-sm flex items-start gap-2 ${preview.valid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
                {preview.valid ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
                <div>
                  {preview.valid
                    ? "الملف صحيح بالكامل. اعتماد الاستيراد سيضيف الصفوف للرصد الافتتاحي فقط؛ لن تتغير كميات المخزون حتى حفظ العملية وتطبيق التسوية الحالية."
                    : "لن يتم اعتماد أي صف حتى تصبح جميع الصفوف صحيحة. صحح الأخطاء في Excel ثم أعد رفع الملف."}
                </div>
              </div>

              <div className="border rounded-lg overflow-auto max-h-[44vh]">
                <table className="w-full text-xs min-w-[850px]">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="p-2 text-right">السطر</th>
                      <th className="p-2 text-right">كود الصنف</th>
                      <th className="p-2 text-right">الصنف</th>
                      <th className="p-2 text-right">الكمية</th>
                      <th className="p-2 text-right">تكلفة الوحدة</th>
                      <th className="p-2 text-right">الإجمالي</th>
                      <th className="p-2 text-right">الانتهاء</th>
                      <th className="p-2 text-right">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map(row => (
                      <tr key={row.rowNumber} className="border-t align-top">
                        <td className="p-2 font-mono">{row.rowNumber}</td>
                        <td className="p-2 font-mono" dir="ltr">{row.itemCode || "—"}</td>
                        <td className="p-2">{row.itemName || "—"}{row.unit ? <div className="text-[10px] text-muted-foreground">{row.unit}</div> : null}</td>
                        <td className="p-2 font-mono" dir="ltr">{row.quantity ?? "—"}</td>
                        <td className="p-2 font-mono" dir="ltr">{row.unitCost != null ? row.unitCost.toFixed(4) : "—"}</td>
                        <td className="p-2 font-mono" dir="ltr">{row.lineValue != null ? row.lineValue.toFixed(2) : "—"}</td>
                        <td className="p-2 font-mono" dir="ltr">{row.expiryDate || "—"}</td>
                        <td className="p-2">
                          {row.valid ? (
                            <Badge variant="outline" className="border-emerald-300 text-emerald-700">جاهز</Badge>
                          ) : (
                            <div className="space-y-1">
                              <Badge variant="destructive">خطأ</Badge>
                              {row.errors.map((error, index) => <div key={index} className="text-[11px] text-red-700">• {error}</div>)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewOpen(false)} disabled={commitMutation.isPending}>إغلاق</Button>
            {preview?.valid && (
              <Button onClick={handleCommit} disabled={commitMutation.isPending} className="gap-1.5">
                {commitMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                اعتماد الاستيراد
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
