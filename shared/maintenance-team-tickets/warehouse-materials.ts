import {
  issued,
  remainingReturn,
  type Snapshot,
  type MaterialNeed,
} from "./model";
import { materialSupplyRemaining } from "./material-routing";
export type WarehouseSection = "waiting" | "ready" | "returns";
export function materialSection(
  state: Snapshot,
  need: MaterialNeed,
  branch: number | undefined
): WarehouseSection | null {
  if (remainingReturn(state, need.id) > 0) return "returns";
  const a = state.assignments.find(a => a.id === need.assignmentId);
  if (
    !a ||
    a.stage !== "waiting_material" ||
    need.round !== a.materialRound ||
    issued(state, need.id) >= need.requested
  )
    return null;
  return need.catalogItemId !== null &&
    (materialSupplyRemaining(state, need) ?? 0) === 0 &&
    branch !== undefined &&
    branch >= need.requested - issued(state, need.id)
    ? "ready"
    : "waiting";
}
