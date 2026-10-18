type VisitTimestamp = string | Date | null | undefined;

function visitEpoch(value: VisitTimestamp): number {
  if (value instanceof Date) return value.getTime();
  if (!value) return NaN;
  const timestamp = value.trim();
  // Visit TIMESTAMPs arrive from MySQL/Drizzle as UTC strings without an
  // offset. Date(string) otherwise treats them as the browser's local time.
  const sqlTimestamp = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?$/.exec(timestamp);
  if (sqlTimestamp) {
    const fraction = sqlTimestamp[3] ? `.${sqlTimestamp[3].slice(0, 3).padEnd(3, "0")}` : "";
    return Date.parse(`${sqlTimestamp[1]}T${sqlTimestamp[2]}${fraction}Z`);
  }
  // Preserve instants that already carry Z/an offset; never subtract a fixed
  // number of hours from them.
  return Date.parse(timestamp);
}

export function formatExecutionElapsedTime(
  startedAt: VisitTimestamp,
  endedAt: VisitTimestamp,
  now: number,
): string {
  const start = visitEpoch(startedAt);
  const end = endedAt ? visitEpoch(endedAt) : now;
  const seconds = Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, Math.floor((end - start) / 1000))
    : 0;
  return [Math.floor(seconds / 3600), Math.floor((seconds / 60) % 60), seconds % 60]
    .map(part => part.toString().padStart(2, "0"))
    .join(":");
}
