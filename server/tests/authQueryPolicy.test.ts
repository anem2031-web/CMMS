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
    expect(shouldRetryAuthQuery(2, { data: { httpStatus: 503 } })).toBe(false);
  });

  it("uses a bounded retry delay", () => {
    expect(authRetryDelay(0)).toBe(1_500);
    expect(authRetryDelay(10)).toBe(6_000);
  });
});
