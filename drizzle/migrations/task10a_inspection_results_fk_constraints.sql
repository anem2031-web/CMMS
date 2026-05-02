-- ============================================================
-- Migration: task10a_inspection_results_fk_constraints.sql
-- Description: Add FK constraints to inspection_results table
-- Date: 2026-05-02
-- Rules: NO data modification, NO table structure changes beyond constraints
-- ============================================================

ALTER TABLE `inspection_results`
  ADD CONSTRAINT `fk_ir_ticketId`
    FOREIGN KEY (`ticketId`) REFERENCES `tickets`(`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ir_assetId`
    FOREIGN KEY (`assetId`) REFERENCES `assets`(`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ir_inspectorId`
    FOREIGN KEY (`inspectorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT;

-- ============================================================
-- ROLLBACK (run if needed):
-- ALTER TABLE `inspection_results`
--   DROP FOREIGN KEY `fk_ir_ticketId`,
--   DROP FOREIGN KEY `fk_ir_assetId`,
--   DROP FOREIGN KEY `fk_ir_inspectorId`;
-- ============================================================
