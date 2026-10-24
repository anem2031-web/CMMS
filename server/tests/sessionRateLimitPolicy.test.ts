import { describe, expect, it } from "vitest";
import {
  API_RATE_LIMIT,
  SESSION_CHECK_RATE_LIMIT,
  isDedicatedSessionCheckRequest,
} from "../_core/rate-limit-policy";

describe("session rate-limit policy", () => {
  it("recognizes only the standalone read-only auth.me probe", () => {
    expect(isDedicatedSessionCheckRequest("GET", "/api/trpc/auth.me?batch=1&input=x")).toBe(true);
    expect(isDedicatedSessionCheckRequest("GET", "/api/trpc/auth.me/")).toBe(true);
    expect(isDedicatedSessionCheckRequest("POST", "/api/trpc/auth.me")).toBe(false);
  });

  it("keeps mixed tRPC batches and lookalike paths under the general limiter", () => {
    expect(isDedicatedSessionCheckRequest("GET", "/api/trpc/auth.me,notifications.list?batch=1")).toBe(false);
    expect(isDedicatedSessionCheckRequest("GET", "/api/trpc/auth.me.extra")).toBe(false);
    expect(isDedicatedSessionCheckRequest("GET", "/api/trpc/notifications.list")).toBe(false);
  });

  it("retains finite abuse limits for both traffic classes", () => {
    expect(API_RATE_LIMIT).toEqual({ windowMs: 900_000, max: 500 });
    expect(SESSION_CHECK_RATE_LIMIT.windowMs).toBe(API_RATE_LIMIT.windowMs);
    expect(SESSION_CHECK_RATE_LIMIT.max).toBeGreaterThan(0);
  });
});
