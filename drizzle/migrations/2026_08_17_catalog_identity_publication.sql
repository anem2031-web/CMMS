-- 2B-7 — Publish Catalog identity to operational references without touching
-- quantity, cost, invoice snapshots, or receiving history.
-- The production DB was applied manually one SQL command at a time during UAT.

ALTER TABLE warehouse_receipt_items
  ADD COLUMN IF NOT EXISTS catalogItemId INT NULL AFTER purchaseOrderItemId;

CREATE INDEX IF NOT EXISTS idx_receipt_items_catalogItemId
  ON warehouse_receipt_items (catalogItemId);
