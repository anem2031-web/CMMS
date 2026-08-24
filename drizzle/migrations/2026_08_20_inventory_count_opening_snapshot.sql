-- Main Phase 3 / Step 1 — freeze periodic-count quantity + actual moving average cost at operation opening.
-- No FK/UNIQUE rollout is included here; relationship hardening remains deferred to final integrity closure.
CREATE TABLE IF NOT EXISTS `inventory_count_snapshots` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `operationId` INT NOT NULL,
  `inventoryId` INT NOT NULL,
  `lotId` INT NULL,
  `systemQuantity` DECIMAL(12,3) NOT NULL,
  `averageCostSnapshot` DECIMAL(12,4) NOT NULL,
  `expiryDate` DATE NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `inventory_count_snapshots_operation_idx` (`operationId`),
  KEY `inventory_count_snapshots_inventory_idx` (`inventoryId`),
  KEY `inventory_count_snapshots_lot_idx` (`lotId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
