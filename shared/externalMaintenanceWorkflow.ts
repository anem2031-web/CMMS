export const EXTERNAL_MAINTENANCE_STATUS = {
  WAITING_WAREHOUSE_PREPARATION: "waiting_warehouse_preparation",
  WAITING_GATE_EXIT: "waiting_gate_exit",
  PURCHASE_CYCLE: "purchase_cycle",
  WAITING_GATE_ENTRY: "waiting_gate_entry",
  WAITING_WAREHOUSE_RECEIPT: "waiting_warehouse_receipt",
  WAITING_TECHNICIAN_HANDOVER: "waiting_technician_handover",
  DELIVERED_FOR_REINSTALL: "delivered_for_reinstall",
  REINSTALL_IN_PROGRESS: "reinstall_in_progress",
  READY_FOR_CLOSURE: "ready_for_closure",
  CLOSED: "closed",
} as const;

export type ExternalMaintenanceStatus =
  typeof EXTERNAL_MAINTENANCE_STATUS[keyof typeof EXTERNAL_MAINTENANCE_STATUS];

export function canWarehousePrepareExternalAsset(status?: string | null): boolean {
  return !status || status === EXTERNAL_MAINTENANCE_STATUS.WAITING_WAREHOUSE_PREPARATION;
}

export function canGateApproveExternalExit(status?: string | null): boolean {
  return status === EXTERNAL_MAINTENANCE_STATUS.WAITING_GATE_EXIT;
}

export function canDelegateWorkExternalPurchaseCycle(status?: string | null): boolean {
  return status === EXTERNAL_MAINTENANCE_STATUS.PURCHASE_CYCLE;
}

export function canGateApproveExternalEntry(status?: string | null): boolean {
  return status === EXTERNAL_MAINTENANCE_STATUS.WAITING_GATE_ENTRY;
}

export function canWarehouseReceiveExternalAsset(status?: string | null): boolean {
  return status === EXTERNAL_MAINTENANCE_STATUS.WAITING_WAREHOUSE_RECEIPT;
}

export function canWarehouseHandOverExternalAsset(status?: string | null): boolean {
  return status === EXTERNAL_MAINTENANCE_STATUS.WAITING_TECHNICIAN_HANDOVER;
}

export function canStartExternalReinstall(status?: string | null): boolean {
  return status === EXTERNAL_MAINTENANCE_STATUS.DELIVERED_FOR_REINSTALL;
}

export function isExternalMaintenancePurchaseItem(ticketPath?: string | null): boolean {
  return ticketPath === "C";
}
