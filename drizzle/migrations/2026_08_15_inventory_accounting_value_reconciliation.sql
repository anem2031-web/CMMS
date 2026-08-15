-- ============================================================
-- 2026-08-15 — Inventory accounting foundation / value reconciliation
-- Data-only migration: no schema or workflow changes.
--
-- Purpose:
--   Reconcile historical inventory.totalCostValue with the accounting rule
--   used by the application: current quantity × moving average cost.
--
-- Safety:
--   - Does NOT change quantity.
--   - Does NOT change averageCost.
--   - Does NOT alter transaction/history rows.
--   - Updates only rows whose stored value differs by more than 0.01.
-- ============================================================

UPDATE `inventory`
SET `totalCostValue` = ROUND(`quantity` * `averageCost`, 2)
WHERE ABS(
  COALESCE(`totalCostValue`, 0) - ROUND(`quantity` * `averageCost`, 2)
) > 0.01;
