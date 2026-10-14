export const TECHNICIAN_BUCKETS = [
  "execution",
  "materials",
  "manager",
  "done",
] as const;
export type TechnicianBucket = (typeof TECHNICIAN_BUCKETS)[number];
export function teamTicketBucket(
  items: Array<{ stage: string; hasOpenVisit?: boolean }>
): TechnicianBucket {
  if (
    !items.length ||
    items.some(
      item =>
        ["action_required", "ready_to_repair", "reinstall_required"].includes(
          item.stage
        ) || item.hasOpenVisit !== false
    )
  )
    return "execution";
  if (items.some(item => item.stage === "waiting_material")) return "materials";
  if (
    items.some(item =>
      ["blocked", "external_requested", "external_in_progress"].includes(
        item.stage
      )
    )
  )
    return "manager";
  return items.every(item => ["awaiting_review", "closed"].includes(item.stage))
    ? "done"
    : "execution";
}
export function scheduledTaskBucket(task: {
  status: string;
  hasOpenVisit?: boolean;
  activeItemCount?: number;
  waitingMaterialCount?: number;
  waitingTicketCount?: number;
  itemCount?: number;
  completedItemCount?: number;
}): TechnicianBucket {
  if (task.hasOpenVisit !== false) return "execution";
  if (Number(task.activeItemCount ?? 0) > 0) return "execution";
  if (Number(task.waitingMaterialCount ?? 0) > 0) return "materials";
  if (Number(task.waitingTicketCount ?? 0) > 0) return "manager";
  if (
    task.status === "completed" &&
    task.hasOpenVisit === false &&
    Number(task.itemCount ?? 0) > 0 &&
    Number(task.completedItemCount ?? 0) === Number(task.itemCount)
  )
    return "done";
  // An open/unknown visit still requires attention before archival.
  if (task.hasOpenVisit !== false) return "execution";
  if (task.status === "waiting_material") return "materials";
  if (task.status === "waiting_ticket") return "manager";
  return "execution";
}
export function namedTicketBucket(ticket: {
  status: string;
  inspectionWorkflowStatus?: string | null;
}): TechnicianBucket {
  if (["closed", "requester_confirmed"].includes(ticket.status)) return "done";
  if (
    ticket.inspectionWorkflowStatus ===
    "maintenance_inspection_returned_for_correction"
  )
    return "execution";
  if (
    ticket.inspectionWorkflowStatus ===
    "maintenance_inspection_submitted_for_review"
  )
    return "manager";
  if (
    ["under_inspection", "work_approved", "assigned", "in_progress"].includes(
      ticket.status
    )
  )
    return "execution";
  if (
    [
      "ready_for_closure",
      "repaired",
      "verified",
      "closed",
      "requester_confirmed",
    ].includes(ticket.status)
  )
    return "done";
  if (
    ticket.inspectionWorkflowStatus ===
      "maintenance_inspection_submitted_for_review" ||
    ticket.status === "out_for_repair"
  )
    return "manager";
  if (
    [
      "needs_purchase",
      "purchase_pending_estimate",
      "purchase_pending_accounting",
      "purchase_pending_management",
      "purchase_approved",
      "partial_purchase",
      "purchased",
      "received_warehouse",
    ].includes(ticket.status)
  )
    return "materials";
  return "manager";
}
export function bucketCounts<T>(
  items: T[],
  classify: (item: T) => TechnicianBucket
): Record<TechnicianBucket, number> {
  const counts = { execution: 0, materials: 0, manager: 0, done: 0 };
  for (const item of items) counts[classify(item)]++;
  return counts;
}
