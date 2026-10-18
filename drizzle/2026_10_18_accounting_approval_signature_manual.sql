-- MANUAL ONLY. The developer did not execute this file.
-- Run against the selected test database copycmms before deploying the code.
-- Check first; execute an ALTER only if its column is absent.
SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('purchase_orders', 'po_pricing_batches', 'purchase_package_submissions')
  AND COLUMN_NAME = 'accountingSignatureSnapshot'
ORDER BY TABLE_NAME;

-- 1. Ordinary purchase-order accounting approval: approver name/signature reference.
ALTER TABLE `purchase_orders`
  ADD COLUMN `accountingSignatureSnapshot` TEXT NULL;

-- 2. Accounting approval of one delegate's pricing batch.
ALTER TABLE `po_pricing_batches`
  ADD COLUMN `accountingSignatureSnapshot` TEXT NULL;

-- 3. Accounting approval of the submitted package and its financial document.
ALTER TABLE `purchase_package_submissions`
  ADD COLUMN `accountingSignatureSnapshot` TEXT NULL;

-- No backfill: historical approvals without a snapshot retain a blank signature.
