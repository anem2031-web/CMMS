import { useTranslation } from "@/contexts/LanguageContext";
import { Clock3 } from "lucide-react";

interface ReportGeneratedAtProps {
  value?: Date | string | number | null;
  className?: string;
}

function localeFor(language: "ar" | "en" | "ur") {
  if (language === "ar") return "ar-SA";
  if (language === "ur") return "ur-PK";
  return "en-US";
}

export function formatReportGeneratedAt(value: Date | string | number, language: "ar" | "en" | "ur") {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(localeFor(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ReportGeneratedAt({ value, className = "" }: ReportGeneratedAtProps) {
  const { t, language, dir } = useTranslation();
  const display = value ? formatReportGeneratedAt(value, language) : "—";

  return (
    <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`} dir={dir}>
      <Clock3 className="h-3.5 w-3.5" />
      <span>{t.inventoryReports.toolbar.generatedAt}:</span>
      <time>{display}</time>
    </div>
  );
}
