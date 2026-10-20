import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value);
});
/** Optional on existing list RPCs: old consumers keep their array contract. */
export const documentListPageInput = z.object({
  page: z.number().int().min(1).max(100000),
  pageSize: z.number().int().min(1).max(50).default(20),
  search: z.string().trim().max(200).default(""),
  dateFrom: day.optional(),
  dateTo: day.optional(),
  delegateId: z.number().int().positive().optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});
export type DocumentListPageInput = z.infer<typeof documentListPageInput>;

export function documentDayBoundary(day: string, end = false) {
  const date = new Date(`${day}T00:00:00+03:00`);
  if (end) date.setTime(date.getTime() + 86400000);
  return date.toISOString().slice(0, 19).replace("T", " ");
}
export const documentSearchPattern = (value: string) => `%${value.replace(/[=%_]/g, "=$&")}%`;
