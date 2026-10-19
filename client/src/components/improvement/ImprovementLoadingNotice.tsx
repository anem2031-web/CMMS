import { useTranslation } from "@/contexts/LanguageContext";
import { IMPROVEMENT_UI_LABELS } from "./improvement-ui";

/** Show when fetching rather than presenting old/empty rows as the final result. */
export function ImprovementLoadingNotice({
  children,
}: {
  children?: React.ReactNode;
}) {
  const { language } = useTranslation();
  return (
    <div role="status" className="space-y-2 text-sm text-muted-foreground">
      <p>{IMPROVEMENT_UI_LABELS[language].loading}</p>
      {children}
    </div>
  );
}
