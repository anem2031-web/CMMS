import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { ExecutionElapsedTime } from "../../client/src/components/maintenance/TechnicianExecutionWindow";

afterEach(() => vi.useRealTimers());

it("renders five seconds, not three hours, for an open visit under Riyadh timezone", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-17T07:15:10Z"));
  const html = renderToStaticMarkup(<ExecutionElapsedTime language="ar" startedAt="2026-10-17 07:15:05" />);
  expect(html).toContain("00:00:05");
  expect(html).not.toContain("03:00:05");
  expect(html).toContain("وقت الزيارة");
});

it("renders the completed visit duration independently of the current clock", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-18T07:15:10Z"));
  const html = renderToStaticMarkup(<ExecutionElapsedTime language="en" startedAt="2026-10-17 07:15:05" endedAt="2026-10-17T07:15:40Z" />);
  expect(html).toContain("00:00:35");
  expect(html).toContain("Visit time");
});
