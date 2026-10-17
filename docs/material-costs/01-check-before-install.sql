-- Run manually, one statement. If the table already exists, inspect its definition before step 02.
SELECT COLUMN_TYPE AS movementIdType, COLUMN_KEY AS movementIdKey,
  EXISTS (SELECT 1 FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'material_execution_cost_contexts') AS contextTableExists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_transactions' AND COLUMN_NAME = 'id';
