import { useTranslation } from "@/contexts/LanguageContext";
import { operationalIssueText } from "@/i18n/operationalIssues";
import { OperationalIssueQueue } from "./OperationalIssueQueue";
export default function OperationalWarehouseRequests() {
  const { language } = useTranslation();
  return <div className="space-y-4"><h2 className="text-xl font-bold">{operationalIssueText[language].title}</h2><OperationalIssueQueue process /></div>;
}
