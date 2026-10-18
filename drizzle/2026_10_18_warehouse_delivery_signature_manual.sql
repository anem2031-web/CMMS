-- MANUAL ONLY; not executed by the developer.
-- Select copycmms and check first. Run ALTER only if the column is absent.
SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'delivery_documents'
  AND COLUMN_NAME = 'deliveredBySignatureSnapshot';

-- Freeze the actual warehouse issuer's name/id/signature reference (or absence)
-- with the delivery. WIS reuses its linked DLV snapshot; no WIS column needed.
ALTER TABLE `delivery_documents`
  ADD COLUMN `deliveredBySignatureSnapshot` TEXT NULL;

-- Deploy the code only after adding this column. No backfill of historical DLVs.
