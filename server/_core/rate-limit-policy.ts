const SESSION_CHECK_PATH = "/api/trpc/auth.me";

/**
 * auth.me is a read-only session probe used before the application can render.
 * It receives its own limiter so ordinary API traffic cannot make a valid
 * session look unavailable. A tRPC batch that contains any other procedure is
 * deliberately excluded and remains subject to the general API limiter.
 */
export function isDedicatedSessionCheckRequest(method: string, originalUrl: string) {
  if (method.toUpperCase() !== "GET") return false;
  const pathname = originalUrl.split("?", 1)[0].replace(/\/$/, "");
  return pathname === SESSION_CHECK_PATH;
}

export const API_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 500,
} as const;

export const SESSION_CHECK_RATE_LIMIT = {
  windowMs: 15 * 60 * 1000,
  max: 300,
} as const;
