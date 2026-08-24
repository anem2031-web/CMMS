import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";
import {
  ArrowLeftRight,
  Boxes,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";

function ReportCard({
  icon: Icon,
  title,
  description,
  onClick,
  actionLabel,
  className = "",
}: {
  icon: typeof Boxes;
  title: string;
  description: string;
  onClick: () => void;
  actionLabel: string;
  className?: string;
}) {
  return (
    <Card
      className={`group cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${className}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <CardHeader className="h-full gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border bg-muted/30">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-1 flex-col">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription className="mt-2 max-w-2xl leading-6">{description}</CardDescription>
          <p className="mt-4 text-sm font-medium text-primary group-hover:underline">{actionLabel}</p>
        </div>
      </CardHeader>
    </Card>
  );
}

export default function InventoryReportsCenter() {
  const { t, dir } = useLanguage();
  const [, setLocation] = useLocation();
  const copy = t.inventoryReports;

  return (
    <div className="space-y-6 p-4 md:p-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{copy.description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportCard
          icon={Boxes}
          title={copy.sections.balanceStatus}
          description={copy.sections.balanceStatusDesc}
          onClick={() => setLocation("/inventory/reports/stock-balance")}
          actionLabel={copy.stockBalance.openReport}
        />
        <ReportCard
          icon={ArrowLeftRight}
          title={copy.sections.movementTracking}
          description={copy.sections.movementTrackingDesc}
          onClick={() => setLocation("/inventory/reports/movements")}
          actionLabel={copy.movements.openReport}
        />
        <ReportCard
          icon={WalletCards}
          title={copy.sections.valuationAccounting}
          description={copy.sections.valuationAccountingDesc}
          onClick={() => setLocation("/inventory/reports/valuation")}
          actionLabel={copy.valuation.openReport}
        />
        <ReportCard
          icon={TrendingUp}
          title={copy.sections.analyticsPlanning}
          description={copy.sections.analyticsPlanningDesc}
          onClick={() => setLocation("/inventory/reports/analytics")}
          actionLabel={copy.analytics.openReport}
        />

        <ReportCard
          icon={ShieldCheck}
          title={copy.reconciliation.title}
          description={copy.reconciliation.description}
          onClick={() => setLocation("/inventory/reconciliation")}
          actionLabel={copy.reconciliation.open}
          className="md:col-span-2 xl:col-span-4"
        />
      </div>
    </div>
  );
}
