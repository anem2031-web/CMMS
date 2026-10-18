-- MANUAL ONLY. The agent must never execute this file.
-- Apply to copycmms before deploying code that reads deliveryLeadDays.
-- Run each numbered statement separately. No historical UPDATE/backfill.

-- 01: Check the column. If it exists, skip 02 and verify its definition.
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'copycmms' AND TABLE_NAME = 'purchase_order_items'
  AND COLUMN_NAME = 'deliveryLeadDays';

-- 02: Only if 01 returns no rows. Old items retain NULL and their original dates.
ALTER TABLE `copycmms`.`purchase_order_items`
  ADD COLUMN `deliveryLeadDays` INT NULL DEFAULT NULL AFTER `requiredDate`;

-- 03: Confirm INT, nullable YES, default NULL.
SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'copycmms' AND TABLE_NAME = 'purchase_order_items'
  AND COLUMN_NAME = 'deliveryLeadDays';
