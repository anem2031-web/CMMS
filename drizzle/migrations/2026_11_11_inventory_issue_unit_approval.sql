-- Manual schema change for the selected database, before deploying the feature.
-- Confirm the selected database first and run only the statements for missing columns.
-- These statements add nullable columns; they do not convert stock or approve any unit.
ALTER TABLE `inventory` ADD COLUMN `issueUnitApprovedAt` DATETIME(3) NULL;
ALTER TABLE `inventory_count_snapshots` ADD COLUMN `unitSnapshot` VARCHAR(50) NULL;
ALTER TABLE `inventory_count_items` ADD COLUMN `unitSnapshot` VARCHAR(50) NULL;
ALTER TABLE `inventory_settlement_items` ADD COLUMN `unitSnapshot` VARCHAR(50) NULL;
ALTER TABLE `inventory_transactions` ADD COLUMN `unitSnapshot` VARCHAR(50) NULL;
