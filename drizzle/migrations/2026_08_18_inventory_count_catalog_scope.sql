-- 2B-9: persist optional Catalog taxonomy scope on inventory counts.
-- Applied manually to the current DB on 2026-08-18; do not re-run blindly.
ALTER TABLE inventory_count_operations ADD COLUMN catalogNodeId INT NULL AFTER countType;
