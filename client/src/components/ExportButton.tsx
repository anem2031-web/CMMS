import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "@/contexts/LanguageContext";

interface ExportButtonProps {
  endpoint: string;
  filename: string;
  label?: string;
  params?: Record<string, string>;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButton({ endpoint, filename, label, params, variant = "outline", size = "sm" }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleExport = async () => {
    setLoading(true);
    let url: string | null = null;
    const linkElem = document.createElement("a");
    try {
      const queryStr = params ? "?" + new URLSearchParams(params).toString() : "";
      const response = await fetch(`/api/export/${endpoint}${queryStr}`);
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      url = window.URL.createObjectURL(blob);
      linkElem.href = url;
      linkElem.download = `${filename}-${new Date().toISOString().split("T")[0]}.xlsx`;
      document.body.appendChild(linkElem);
      linkElem.click();
      // OPTIMIZATION: Delay revoke to ensure download starts (Phase 1)
      setTimeout(() => {
        if (url) window.URL.revokeObjectURL(url);
        if (linkElem?.parentNode) linkElem.parentNode.removeChild(linkElem);
      }, 100);
      toast.success(t.common.savedSuccessfully);
    } catch (error) {
      toast.error(t.common.close);
      // Cleanup on error
      if (url) window.URL.revokeObjectURL(url);
      if (linkElem?.parentNode) linkElem.parentNode.removeChild(linkElem);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant={variant} size={size} onClick={handleExport} disabled={loading} className="gap-1.5">
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {label || t.common.export || "تصدير Excel"}
    </Button>
  );
}
