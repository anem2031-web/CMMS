import type { MaterialNeed, Snapshot } from "./model";

export function materialRouteNote(
  need: MaterialNeed,
  shortage: number,
  message: string
): string {
  return JSON.stringify({
    version: 1,
    type: "ticket_material_need",
    round: need.round,
    originalName: need.originalName,
    catalogItemId: need.catalogItemId,
    shortage,
    message,
  });
}
function parse(note: string) {
  try {
    const value = JSON.parse(note);
    return value?.type === "ticket_material_need" &&
      value.version === 1 &&
      Number.isSafeInteger(value.round) &&
      typeof value.originalName === "string" &&
      Number.isSafeInteger(value.shortage) &&
      value.shortage >= 0 &&
      typeof value.message === "string"
      ? (value as {
          round: number;
          originalName: string;
          catalogItemId: number | null;
          shortage: number;
          message: string;
        })
      : null;
  } catch {
    return null;
  }
}
/** null preserves old needs that predate individual routing; no backfill is required. */
export function materialSupplyRemaining(
  state: Snapshot,
  need: MaterialNeed
): number | null {
  const actions = state.actions
    .filter(
      a =>
        a.assignmentId === need.assignmentId &&
        (a.kind === "needs_material" || a.kind === "material_resolved")
    )
    .sort((a, b) => b.revision - a.revision);
  for (const action of actions) {
    const route = parse(action.note);
    if (
      !route ||
      route.round !== need.round ||
      route.originalName !== need.originalName ||
      (route.catalogItemId !== null &&
        route.catalogItemId !== need.catalogItemId)
    )
      continue;
    const transferred = state.supplies
      .filter(
        s =>
          s.needId === need.id &&
          s.kind === "transfer" &&
          s.status === "received"
      )
      .reduce((sum, s) => sum + s.quantity, 0);
    return Math.max(0, route.shortage - transferred);
  }
  return null;
}
export const materialActionMessage = (note: string): string =>
  parse(note)?.message ?? note;
