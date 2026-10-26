export type AuthFailureKind = "rate_limit" | "server" | "network" | "access" | "unknown";

function numericStatus(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getAuthFailureKind(error: unknown): AuthFailureKind | null {
  if (!error) return null;
  const candidate = error as {
    message?: unknown;
    data?: { httpStatus?: unknown; code?: unknown };
    shape?: { data?: { httpStatus?: unknown; code?: unknown } };
    meta?: { response?: { status?: unknown } };
  };
  const status = numericStatus(candidate.data?.httpStatus)
    ?? numericStatus(candidate.shape?.data?.httpStatus)
    ?? numericStatus(candidate.meta?.response?.status);
  const code = String(candidate.data?.code ?? candidate.shape?.data?.code ?? "").toUpperCase();
  const message = String(candidate.message ?? "").toLowerCase();

  if (status === 429 || code === "TOO_MANY_REQUESTS" || message.includes("429") || message.includes("الحد الأقصى للطلبات")) {
    return "rate_limit";
  }
  if (status === 401 || status === 403 || code === "UNAUTHORIZED" || code === "FORBIDDEN") {
    return "access";
  }
  if (status !== undefined && status >= 500) return "server";
  if (
    message.includes("failed to fetch")
    || message.includes("networkerror")
    || message.includes("network request failed")
    || message.includes("load failed")
  ) {
    return "network";
  }
  return "unknown";
}

export function isRecoverableAuthFailure(error: unknown) {
  const kind = getAuthFailureKind(error);
  return kind === "rate_limit" || kind === "server" || kind === "network";
}

export function shouldRetryAuthQuery(failureCount: number, error: unknown) {
  return failureCount < 3 && isRecoverableAuthFailure(error);
}

export function authRetryDelay(attemptIndex: number) {
  return [5_000, 10_000, 20_000][attemptIndex] ?? 30_000;
}

export const AUTH_RECOVERY_INTERVAL_MS = 30_000;
