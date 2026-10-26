import { describe, expect, it } from "vitest";
import {
  authRetryDelay,
  getAuthFailureKind,
  isRecoverableAuthFailure,
  shouldRetryAuthQuery,
} from "../../client/src/lib/auth-query-policy";

describe("auth query recovery policy", () => {
  it("classifies rate limits from HTTP metadata without treating them as logout", () => {
    const error = { meta: { response: { status: 429 } }, message: "request failed" };
    expect(getAuthFailureKind(error)).toBe("rate_limit");
    expect(isRecoverableAuthFailure(error)).toBe(true);
  });

  it("retries temporary network/server failures but never access denials", () => {
    expect(shouldRetryAuthQuery(0, { data: { httpStatus: 503 } })).toBe(true);
    expect(shouldRetryAuthQuery(0, { message: "Failed to fetch" })).toBe(true);
    expect(shouldRetryAuthQuery(0, { data: { httpStatus: 401, code: "UNAUTHORIZED" } })).toBe(false);
    expect(shouldRetryAuthQuery(0, { data: { httpStatus: 403, code: "FORBIDDEN" } })).toBe(false);
    expect(shouldRetryAuthQuery(2, { data: { httpStatus: 503 } })).toBe(true);
    expect(shouldRetryAuthQuery(3, { data: { httpStatus: 503 } })).toBe(false);
  });

  it("uses 5s, 10s and 20s recovery attempts before the bounded 30s interval", () => {
    expect(authRetryDelay(0)).toBe(5_000);
    expect(authRetryDelay(1)).toBe(10_000);
    expect(authRetryDelay(2)).toBe(20_000);
    expect(authRetryDelay(3)).toBe(30_000);
    expect(authRetryDelay(10)).toBe(30_000);
  });
});
