import { inventoryReadProcedure, router } from "../_shared/procedures";
import { runInventoryReconciliation } from "../../services/inventory-reconciliation";

/**
 * Main Phase 5.4.2 — read-only reconciliation API.
 * No mutations and no repair actions are exposed from this router.
 */
export const reconciliationRouter = router({
  run: inventoryReadProcedure.query(async () => {
    return runInventoryReconciliation();
  }),
});
