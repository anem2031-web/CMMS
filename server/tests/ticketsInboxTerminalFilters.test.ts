import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("tickets inbox terminal-status filters", () => {
  it("excludes every terminal ticket status from critical and stale follow-up", () => {
    const source = readFileSync(resolve(process.cwd(), "server/_core/db/tickets.ts"), "utf8");
    expect(source).toContain('const TERMINAL_TICKET_STATUSES = ["closed", "requester_confirmed", "cancelled", "rejected"]');
    expect(source).toContain('case "critical":');
    expect(source).toContain('return and(openCondition(), eq(tickets.priority, "critical" as any));');
    expect(source).toContain('return notInArray(tickets.status, [...TERMINAL_TICKET_STATUSES] as any);');
    expect(source).toContain('if (filters.priority === "critical") conditions.push(openCondition());');
  });
});
