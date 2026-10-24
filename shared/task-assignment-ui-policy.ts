/**
 * Temporary UI switch. Keep the named-assignment workflow intact for existing
 * records while new maintenance/construction tasks are assigned by team only.
 * Set to true to restore the selector without changing stored data or APIs.
 */
export const SHOW_DIRECT_NAMED_TASK_ASSIGNMENT = false;

export type TaskAssignmentUiMode = "name" | "team";

export function initialTaskAssignmentUiMode(): TaskAssignmentUiMode {
  return SHOW_DIRECT_NAMED_TASK_ASSIGNMENT ? "name" : "team";
}

export function showNamedAssignmentEditor(mode: TaskAssignmentUiMode, hasNamedAssignment: boolean) {
  return hasNamedAssignment || (SHOW_DIRECT_NAMED_TASK_ASSIGNMENT && mode === "name");
}
