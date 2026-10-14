-- 01: READ ONLY. The owner executes this manually and shares the result.
-- Inspect existing workflow v3 columns and executionTrackingVersion before any DDL.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'improvement_ideas'
ORDER BY ORDINAL_POSITION;
