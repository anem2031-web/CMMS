export type InventoryAnalyticsView = "slow" | "dead" | "abc" | "aging" | "turnover";

export interface InventoryAnalyticsFilters {
  search?: string;
  warehouseId?: number;
  category?: string;
  slowDays?: number;
  deadDays?: number;
  turnoverDays?: number;
}

export interface NormalizedInventoryAnalyticsFilters {
  search: string;
  warehouseId?: number;
  category: string;
  slowDays: number;
  deadDays: number;
  turnoverDays: number;
}

export type MovementVelocityStatus = "active" | "slow" | "dead" | "no_outbound_history";
export type AgingBucket = "0_30" | "31_90" | "91_180" | "181_365" | "365_plus" | "unknown";
export type AbcClass = "A" | "B" | "C";

const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
};

export function normalizeInventoryAnalyticsFilters(filters: InventoryAnalyticsFilters = {}): NormalizedInventoryAnalyticsFilters {
  const slowDays = clampInt(filters.slowDays, 90, 1, 3650);
  const requestedDeadDays = clampInt(filters.deadDays, 180, 2, 3650);
  const deadDays = Math.max(slowDays + 1, requestedDeadDays);
  return {
    search: String(filters.search || "").trim().slice(0, 200),
    warehouseId: Number(filters.warehouseId || 0) > 0 ? Number(filters.warehouseId) : undefined,
    category: String(filters.category || "all").trim().slice(0, 120) || "all",
    slowDays,
    deadDays,
    turnoverDays: clampInt(filters.turnoverDays, 365, 1, 3650),
  };
}

export function daysBetween(now: Date, value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diff = now.getTime() - date.getTime();
  return Math.max(0, Math.floor(diff / 86_400_000));
}

export function classifyMovementVelocity(daysSinceLastOutbound: number | null, slowDays: number, deadDays: number): MovementVelocityStatus {
  if (daysSinceLastOutbound == null) return "no_outbound_history";
  if (daysSinceLastOutbound >= deadDays) return "dead";
  if (daysSinceLastOutbound >= slowDays) return "slow";
  return "active";
}

export function classifyAgingBucket(ageDays: number | null): AgingBucket {
  if (ageDays == null) return "unknown";
  if (ageDays <= 30) return "0_30";
  if (ageDays <= 90) return "31_90";
  if (ageDays <= 180) return "91_180";
  if (ageDays <= 365) return "181_365";
  return "365_plus";
}

export interface AbcInputRow {
  key: string;
  value: number;
}

export interface AbcResultRow extends AbcInputRow {
  sharePercent: number | null;
  cumulativePercent: number | null;
  abcClass: AbcClass;
}

export function buildAbcClassification(rows: AbcInputRow[]): AbcResultRow[] {
  const normalized = rows
    .map((row) => ({ ...row, value: Number.isFinite(Number(row.value)) ? Math.max(0, Number(row.value)) : 0 }))
    .sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
  const total = normalized.reduce((sum, row) => sum + row.value, 0);
  let cumulative = 0;
  return normalized.map((row) => {
    const sharePercent = total > 0 ? (row.value / total) * 100 : null;
    const previousCumulative = cumulative;
    if (sharePercent != null) cumulative += sharePercent;
    // Keep the row that crosses a boundary inside the higher-priority class.
    const abcClass: AbcClass = total <= 0 ? "C" : previousCumulative < 80 ? "A" : previousCumulative < 95 ? "B" : "C";
    return {
      ...row,
      sharePercent: sharePercent == null ? null : Number(sharePercent.toFixed(2)),
      cumulativePercent: sharePercent == null ? null : Number(Math.min(100, cumulative).toFixed(2)),
      abcClass,
    };
  });
}

export function calculateTurnoverIndicator(recordedOutboundValue: number, currentStoredValue: number): number | null {
  const numerator = Number(recordedOutboundValue);
  const denominator = Number(currentStoredValue);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || numerator < 0 || denominator <= 0) return null;
  return Number((numerator / denominator).toFixed(4));
}
