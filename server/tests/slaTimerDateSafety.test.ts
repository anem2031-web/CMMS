import { describe, expect, it, vi } from "vitest";
import { getElapsed } from "../../client/src/components/tickets/SLATimer";

describe("ticket SLA date safety", () => {
  it("accepts serialized API dates without producing NaN", () => {
    vi.setSystemTime(new Date("2026-10-23T12:00:00.000Z"));
    expect(getElapsed("2026-10-23T10:30:00.000Z")).toEqual({
      hours: 1,
      minutes: 30,
      totalHours: 1.5,
      valid: true,
    });
    vi.useRealTimers();
  });

  it("marks an absent or malformed serialized date invalid", () => {
    expect(getElapsed("")).toEqual({ hours: 0, minutes: 0, totalHours: 0, valid: false });
    expect(getElapsed("not-a-date")).toEqual({ hours: 0, minutes: 0, totalHours: 0, valid: false });
  });

  it("clamps small future clock skew to zero", () => {
    vi.setSystemTime(new Date("2026-10-23T12:00:00.000Z"));
    expect(getElapsed("2026-10-23T12:01:00.000Z")).toMatchObject({ hours: 0, minutes: 0, totalHours: 0, valid: true });
    vi.useRealTimers();
  });
});
