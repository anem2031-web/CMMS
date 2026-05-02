import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  // Single optimized API call — replaces N+1 assets.list + listByAsset loop
  const { data, isLoading } = trpc.inspectionResults.dashboardStats.useQuery();

  const severityColorClass: Record<string, string> = {
    low: "text-green-600",
    medium: "text-yellow-600",
    high: "text-orange-600",
    critical: "text-red-600",
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h2 className="text-xl font-bold">📊 التقارير</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  const totalInspections     = data?.totalInspections ?? 0;
  const mostFrequentRootCause = data?.mostFrequentRootCause ?? "-";
  const highestSeverity       = data?.highestSeverity ?? "low";
  const mostInspectedAsset    = data?.mostInspectedAsset ?? null;

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-bold">📊 التقارير</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Card 1 — Total Inspections */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">عدد الفحوصات</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalInspections}</p>
          </CardContent>
        </Card>

        {/* Card 2 — Most Frequent Root Cause */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">أكثر سبب تكراراً</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-bold break-words">{mostFrequentRootCause}</p>
          </CardContent>
        </Card>

        {/* Card 3 — Highest Severity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">أعلى خطورة</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${severityColorClass[highestSeverity] || ""}`}>
              {highestSeverity}
            </p>
          </CardContent>
        </Card>

        {/* Card 4 — Most Inspected Asset */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">أكثر أصل تم فحصه</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base font-bold break-words">
              {mostInspectedAsset ? `Asset #${mostInspectedAsset.assetId}` : "-"}
            </p>
            {mostInspectedAsset && (
              <p className="text-xs text-muted-foreground mt-1">
                {mostInspectedAsset.count} فحص
              </p>
            )}
          </CardContent>
        </Card>

      </div>

      {totalInspections === 0 && (
        <p className="text-center text-muted-foreground text-sm pt-4">لا توجد بيانات فحص متاحة</p>
      )}
    </div>
  );
}
