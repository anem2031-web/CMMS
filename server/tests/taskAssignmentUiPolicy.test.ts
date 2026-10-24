import { describe, expect, it } from "vitest";
import {
  SHOW_DIRECT_NAMED_TASK_ASSIGNMENT,
  initialTaskAssignmentUiMode,
  showNamedAssignmentEditor,
} from "../../shared/task-assignment-ui-policy";

describe("temporary task assignment UI policy", () => {
  it("starts new maintenance and construction tasks in team mode", () => {
    expect(SHOW_DIRECT_NAMED_TASK_ASSIGNMENT).toBe(false);
    expect(initialTaskAssignmentUiMode()).toBe("team");
    expect(showNamedAssignmentEditor("team", false)).toBe(false);
    expect(showNamedAssignmentEditor("name", false)).toBe(false);
  });

  it("keeps the existing named-assignment editor available for saved records", () => {
    expect(showNamedAssignmentEditor("team", true)).toBe(true);
  });
});
