-- ============================================================
-- Migration: phase2_inspection_results_table.sql
-- Description: Create inspection_results table
-- Date: 2026-05-02
-- Rules: NO triggers, NO existing table modifications, NO data population
-- ============================================================

CREATE TABLE IF NOT EXISTS `inspection_results` (
  `id`                INT          NOT NULL AUTO_INCREMENT,
  `ticketId`          INT          NOT NULL,
  `assetId`           INT          NULL,
  `inspectorId`       INT          NOT NULL,
  `inspectionType`    ENUM('triage','detailed') NOT NULL,
  `severity`          ENUM('low','medium','high','critical') NOT NULL,
  `rootCause`         VARCHAR(500) NULL,
  `findings`          TEXT         NULL,
  `recommendedAction` TEXT         NULL,
  `createdAt`         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_inspection_results_ticketId`   (`ticketId`),
  INDEX `idx_inspection_results_assetId`    (`assetId`),
  INDEX `idx_inspection_results_inspectorId`(`inspectorId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- ROLLBACK (run if needed):
-- DROP TABLE IF EXISTS `inspection_results`;
-- ============================================================
