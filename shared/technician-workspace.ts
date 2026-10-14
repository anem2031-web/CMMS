/** UI workspace policy; task authorization remains in the existing scoped APIs. */
export const TECHNICIAN_WORKSPACE_PATH = "/scheduled-maintenance/my-tasks";
export type ExecutionStep = {
  id: number;
  title: string;
  status: string;
  recorded: boolean;
  working?: boolean;
};
export function currentExecutionStep<T extends ExecutionStep>(
  steps: T[],
  selectedId: number | null
): T | undefined {
  const selected = steps.find(step => step.id === selectedId);
  if (selected && !selected.recorded) return selected;
  return (
    steps.find(step => step.working && !step.recorded) ??
    steps.find(step => !step.recorded)
  );
}
export function nextExecutionStep<T extends ExecutionStep>(
  steps: T[],
  currentId: number
): T | undefined {
  const index = steps.findIndex(step => step.id === currentId);
  return [...steps.slice(index + 1), ...steps.slice(0, index)].find(
    step => !step.recorded
  );
}
/** Recorded technician outcome is not final closure of the ticket. */
export function ticketStepRecorded(stage: string): boolean {
  return [
    "awaiting_review",
    "closed",
    "blocked",
    "external_requested",
    "external_in_progress",
  ].includes(stage);
}
