/**
 * RouteLoadingFallback
 * Shown as a Suspense fallback while a lazily-loaded route chunk is downloading.
 * Designed to be visually neutral and match the DashboardLayout content area.
 */
export default function RouteLoadingFallback() {
  return (
    <div className="flex flex-col gap-4 p-6 w-full animate-pulse">
      {/* Page header skeleton */}
      <div className="h-8 w-48 rounded-md bg-muted" />

      {/* Stats cards row skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-muted" />
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="flex flex-col gap-3 mt-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    </div>
  );
}
