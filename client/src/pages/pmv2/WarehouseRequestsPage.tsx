import { useLocation, useSearch } from "wouter";
import { useTranslation } from "@/contexts/LanguageContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  WAREHOUSE_REQUESTS_PATH,
  warehouseRequestsLink,
  warehouseRequestsSelection,
} from "@shared/maintenance-team-tickets/warehouse-navigation";
import Pmv2WarehouseQueue from "./Pmv2WarehouseQueue";
import TicketWarehouseRequests from "../maintenance-teams/TicketWarehouseRequests";

export default function WarehouseRequestsPage() {
  const { language, dir } = useTranslation();
  const search = useSearch();
  const [, navigate] = useLocation();
  const { source, ticketId } = warehouseRequestsSelection(search);
  return (
    <Tabs
      value={source}
      dir={dir}
      className="space-y-4"
      onValueChange={value =>
        navigate(
          value === "tickets"
            ? warehouseRequestsLink()
            : WAREHOUSE_REQUESTS_PATH
        )
      }
    >
      <TabsList
        aria-label={
          language === "ar"
            ? "مصدر طلبات المستودع"
            : language === "ur"
              ? "گودام کی درخواست کا ماخذ"
              : "Warehouse request source"
        }
      >
        <TabsTrigger value="pmv2">PMV2</TabsTrigger>
        <TabsTrigger value="tickets">
          {language === "ar"
            ? "تذاكر الصيانة"
            : language === "ur"
              ? "مرمت کے ٹکٹ"
              : "Maintenance Tickets"}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="pmv2">
        {source === "pmv2" && <Pmv2WarehouseQueue />}
      </TabsContent>
      <TabsContent value="tickets">
        {source === "tickets" && (
          <TicketWarehouseRequests ticketId={ticketId} />
        )}
      </TabsContent>
    </Tabs>
  );
}
