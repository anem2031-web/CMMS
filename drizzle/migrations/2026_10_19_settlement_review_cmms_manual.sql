-- MANUAL ONLY. Execute each numbered statement separately against cmms.
-- Creates new review/audit tables only. No stock posting, UPDATE, backfill or existing-table alteration.
-- Install and verify all three tables manually BEFORE deploying the new code. No new environment flag.

-- 1. One review draft per finalized count.
CREATE TABLE IF NOT EXISTS `cmms`.`inventory_settlement_drafts` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sourceCountOperationId` INT NOT NULL,
  `status` ENUM('draft','pending_review','returned','applied','no_adjustment') NOT NULL DEFAULT 'draft',
  `version` INT NOT NULL DEFAULT 1,
  `reason` TEXT NOT NULL,
  `reference` VARCHAR(255) NULL,
  `preparedById` INT NOT NULL,
  `lastSubmittedById` INT NULL,
  `submittedVersion` INT NULL,
  `sourceFingerprint` VARCHAR(64) NULL,
  `submittedSnapshot` JSON NULL,
  `returnedReason` TEXT NULL,
  `appliedSettlementId` INT NULL,
  `correctsSettlementId` INT NULL,
  `approvedById` INT NULL,
  `submittedAt` TIMESTAMP NULL,
  `appliedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settlement_draft_count` (`sourceCountOperationId`),
  KEY `idx_settlement_draft_status` (`status`,`updatedAt`),
  KEY `idx_settlement_draft_preparer` (`preparedById`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Immutable event/version snapshots.
CREATE TABLE IF NOT EXISTS `cmms`.`inventory_settlement_draft_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `draftId` INT NOT NULL,
  `version` INT NOT NULL,
  `action` VARCHAR(40) NOT NULL,
  `actorId` INT NOT NULL,
  `reason` TEXT NULL,
  `payload` JSON NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_settlement_event_version` (`draftId`,`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Reviewer-authorized corrections retain original/final count facts.
CREATE TABLE IF NOT EXISTS `cmms`.`inventory_count_corrections` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `draftId` INT NOT NULL,
  `operationId` INT NOT NULL,
  `status` ENUM('pending','corrected') NOT NULL DEFAULT 'pending',
  `requestedById` INT NOT NULL,
  `requestedReason` TEXT NOT NULL,
  `allowedCountItemIds` JSON NOT NULL,
  `sourceFingerprint` VARCHAR(64) NOT NULL,
  `beforeSnapshot` JSON NOT NULL,
  `afterSnapshot` JSON NULL,
  `correctedById` INT NULL,
  `correctionReason` TEXT NULL,
  `correctedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_count_correction_draft_status` (`draftId`,`status`),
  KEY `idx_count_correction_operation` (`operationId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Read-only verification: expect exactly the three table names.
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'cmms' AND TABLE_NAME IN (
  'inventory_settlement_drafts','inventory_settlement_draft_events','inventory_count_corrections'
) ORDER BY TABLE_NAME;

-- 5. Read-only column verification; compare against CREATE definitions above before activation.
SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA='cmms' AND TABLE_NAME IN (
  'inventory_settlement_drafts','inventory_settlement_draft_events','inventory_count_corrections'
) ORDER BY TABLE_NAME,ORDINAL_POSITION;
