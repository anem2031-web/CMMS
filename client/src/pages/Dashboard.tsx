import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  // Fetch all assets to get their IDs
  const { data: assets = [], isLoading: assetsLoading } = trpc.assets.list.useQuery({});

  // Fetch inspection results for each asset using individual queries
  const assetIds = assets.map((a: any) => a.id);

  // Use a single query per asset — collect all via parallel hooks
  // Since hooks can't be called in loops, we fetch all via listByAsset for each asset
  // Strategy: fetch all assets first, then use a combined approach via existing API
  // We use listByTicket is per-ticket; listByAsset is per-asset — we'll call listByAsset for each asset
  // To avoid dynamic hook calls, we use a helper component pattern via useMemo + enabled flag

  // Aggregate all inspection results from all assets
  const allResults: any[] = [];

  // Per-asset queries (static max — we render metrics only when assets loaded)
  const q0  = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[0]  ?? 0 }, { enabled: !!assetIds[0]  });
  const q1  = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[1]  ?? 0 }, { enabled: !!assetIds[1]  });
  const q2  = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[2]  ?? 0 }, { enabled: !!assetIds[2]  });
  const q3  = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[3]  ?? 0 }, { enabled: !!assetIds[3]  });
  const q4  = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[4]  ?? 0 }, { enabled: !!assetIds[4]  });
  const q5  = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[5]  ?? 0 }, { enabled: !!assetIds[5]  });
  const q6  = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[6]  ?? 0 }, { enabled: !!assetIds[6]  });
  const q7  = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[7]  ?? 0 }, { enabled: !!assetIds[7]  });
  const q8  = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[8]  ?? 0 }, { enabled: !!assetIds[8]  });
  const q9  = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[9]  ?? 0 }, { enabled: !!assetIds[9]  });
  const q10 = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[10] ?? 0 }, { enabled: !!assetIds[10] });
  const q11 = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[11] ?? 0 }, { enabled: !!assetIds[11] });
  const q12 = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[12] ?? 0 }, { enabled: !!assetIds[12] });
  const q13 = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[13] ?? 0 }, { enabled: !!assetIds[13] });
  const q14 = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[14] ?? 0 }, { enabled: !!assetIds[14] });
  const q15 = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[15] ?? 0 }, { enabled: !!assetIds[15] });
  const q16 = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[16] ?? 0 }, { enabled: !!assetIds[16] });
  const q17 = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[17] ?? 0 }, { enabled: !!assetIds[17] });
  const q18 = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[18] ?? 0 }, { enabled: !!assetIds[18] });
  const q19 = trpc.inspectionResults.listByAsset.useQuery({ assetId: assetIds[19] ?? 0 }, { enabled: !!assetIds[19] });

  const queries = [q0,q1,q2,q3,q4,q5,q6,q7,q8,q9,q10,q11,q12,q13,q14,q15,q16,q17,q18,q19];
  const isLoadingResults = queries.some(q => q.isLoading && q.fetchStatus !== "idle");

  // Aggregate all results
  for (let i = 0; i < queries.length; i++) {
    const data = queries[i].data;
    if (data && data.length > 0) {
      for (const r of data) {
        allResults.push({ ...r, _assetId: assetIds[i] });
      }
    }
  }

  // ── Calculations ──────────────────────────────────────────
  const severityOrder = ["low", "medium", "high", "critical"];

  const totalInspections = allResults.length;

  const rootCauseCounts: Record<string, number> = {};
  for (const r of allResults) {
    if (r.rootCause) rootCauseCounts[r.rootCause] = (rootCauseCounts[r.rootCause] || 0) + 1;
  }
  const mostFrequentRootCause =
    Object.entries(rootCauseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";

  const highestSeverity = allResults.reduce((max, r) => {
    return severityOrder.indexOf(r.severity) > severityOrder.indexOf(max) ? r.severity : max;
  }, "low" as string);

  const assetCounts: Record<number, number> = {};
  for (const r of allResults) {
    if (r._assetId) assetCounts[r._assetId] = (assetCounts[r._assetId] || 0) + 1;
  }
  const mostInspectedAssetId =
    Object.entries(assetCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const mostInspectedAsset = mostInspectedAssetId
    ? assets.find((a: any) => a.id === Number(mostInspectedAssetId))
    : null;
  const mostInspectedAssetName = mostInspectedAsset
    ? (mostInspectedAsset.name || `Asset #${mostInspectedAssetId}`)
    : "-";

  const severityColorClass: Record<string, string> = {
    low: "text-green-600",
    medium: "text-yellow-600",
    high: "text-orange-600",
    critical: "text-red-600",
  };

  // ── Render ────────────────────────────────────────────────
  if (assetsLoading || isLoadingResults) {
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
            <p className="text-base font-bold break-words">{mostInspectedAssetName}</p>
            {mostInspectedAssetId && (
              <p className="text-xs text-muted-foreground mt-1">
                {assetCounts[Number(mostInspectedAssetId)]} فحص
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
