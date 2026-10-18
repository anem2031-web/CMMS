import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTranslation } from "@/contexts/LanguageContext";
export const branchTransferText = {
  ar: { title: "تأكيد التحويل بين مخزنين فرعيين", warning: "تنبيه: سيتم خصم الكميات من المخزن المصدر وإضافتها إلى المخزن الفرعي الهدف. تأكد من اختيار المخزنين واللوتات والكميات الصحيحة قبل المتابعة.", confirm: "تأكيد وتنفيذ التحويل", cancel: "إلغاء" },
  en: { title: "Confirm transfer between branch warehouses", warning: "Warning: quantities will be deducted from the source and added to the destination branch warehouse. Check warehouses, lots and quantities before continuing.", confirm: "Confirm and transfer", cancel: "Cancel" },
  ur: { title: "ذیلی گوداموں کے درمیان منتقلی کی تصدیق", warning: "انتباہ: مقدار ماخذ گودام سے کم اور ہدف ذیلی گودام میں شامل ہوگی۔ جاری رکھنے سے پہلے گودام، لاٹ اور مقدار چیک کریں۔", confirm: "تصدیق اور منتقلی", cancel: "منسوخ" },
};
export function BranchTransferConfirmation({ open, sourceName, targetName, onOpenChange, onConfirm }: {
  open: boolean; sourceName: string; targetName: string; onOpenChange(open: boolean): void; onConfirm(): void;
}) {
  const { language, dir } = useTranslation(); const text = branchTransferText[language];
  return <AlertDialog open={open} onOpenChange={onOpenChange}><AlertDialogContent dir={dir} className="border-destructive/50">
    <AlertDialogHeader><AlertDialogTitle className="text-destructive">{text.title}</AlertDialogTitle>
      <AlertDialogDescription className="text-destructive">{text.warning}<br />{sourceName} ← {targetName}</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter><AlertDialogCancel>{text.cancel}</AlertDialogCancel>
      <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>{text.confirm}</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent></AlertDialog>;
}
