-- Manual installation only. No data migration, backfill or changes to existing tables.
CREATE TABLE material_execution_cost_contexts (
  inventoryTransactionId INT NOT NULL,
  executionSource VARCHAR(20) NOT NULL,
  executionId INT NULL,
  executionItemId INT NULL,
  executionNumber VARCHAR(100) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (inventoryTransactionId),
  KEY idx_material_execution_source (executionSource, executionId),
  CONSTRAINT fk_material_execution_movement
    FOREIGN KEY (inventoryTransactionId) REFERENCES inventory_transactions(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
