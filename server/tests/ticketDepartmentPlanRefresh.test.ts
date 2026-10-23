import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("department task plan refresh", () => {
  it("invalidates stale plan data before awaiting both affected reads", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/tickets/TicketDetail.tsx"), "utf8");
    const start = page.indexOf("const refreshDepartmentPlan = async () =>");
    const end = page.indexOf("const createDepartmentTaskMut", start);
    const block = page.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(block.indexOf("await utils.tickets.departmentPlan.invalidate({ ticketId })")).toBeLessThan(block.indexOf("await Promise.all([refetch(), refetchDepartmentPlan()])"));
  });
});
