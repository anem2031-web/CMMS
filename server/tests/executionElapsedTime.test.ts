import { describe, expect, it } from "vitest";
import { formatExecutionElapsedTime } from "../../shared/executionElapsedTime";

const now = Date.parse("2026-10-17T07:15:10Z");

describe(`Visit duration in ${process.env.TZ || "host timezone"}`, () => {
  it("starts at zero and counts actual seconds from a UTC database timestamp", () => {
    expect(formatExecutionElapsedTime("2026-10-17 07:15:10", null, now)).toBe("00:00:00");
    expect(formatExecutionElapsedTime("2026-10-17 07:15:05", null, now)).toBe("00:00:05");
  });

  it.each([
    "2026-10-17 07:15:05",
    "2026-10-17T07:15:05",
    "2026-10-17T07:15:05Z",
    "2026-10-17T10:15:05+03:00",
    "2026-10-17T03:15:05-04:00",
    new Date("2026-10-17T07:15:05Z"),
  ])("preserves the same instant across supported timestamp forms: %s", startedAt => {
    expect(formatExecutionElapsedTime(startedAt, null, now)).toBe("00:00:05");
  });

  it("stops at the recorded end time even if only one boundary has an offset", () => {
    expect(formatExecutionElapsedTime("2026-10-17 07:15:05", "2026-10-17T07:15:40Z", now + 86400000)).toBe("00:00:35");
    expect(formatExecutionElapsedTime("2026-10-17T07:15:05Z", "2026-10-17 07:15:40", now + 86400000)).toBe("00:00:35");
  });

  it("keeps MySQL fractional seconds accurate", () => {
    expect(formatExecutionElapsedTime("2026-10-17 07:15:05.500000", null, now)).toBe("00:00:04");
    expect(formatExecutionElapsedTime("2026-10-17 07:15:05.5", "2026-10-17 07:15:06.500000", now)).toBe("00:00:01");
  });

  it("handles midnight and visits longer than 24 hours without resetting hours", () => {
    expect(formatExecutionElapsedTime("2026-10-16 23:59:59", "2026-10-17 00:00:05", now)).toBe("00:00:06");
    expect(formatExecutionElapsedTime("2026-10-15 06:15:05", null, now)).toBe("49:00:05");
  });

  it("does not show negative or invalid durations", () => {
    expect(formatExecutionElapsedTime("2026-10-17 07:15:11", null, now)).toBe("00:00:00");
    expect(formatExecutionElapsedTime(null, null, now)).toBe("00:00:00");
    expect(formatExecutionElapsedTime("invalid", null, now)).toBe("00:00:00");
    expect(formatExecutionElapsedTime("2026-10-17 07:15:05", "invalid", now)).toBe("00:00:00");
  });
});
