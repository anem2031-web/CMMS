-- MANUAL ONLY: owner executes each statement separately in copycmms.
-- Check before creation; do not run migrations or change historical rows.
-- 00: expected no rows for a new installation.
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='copycmms' AND TABLE_NAME IN
('operational_issue_orders','operational_issue_items','operational_issue_deliveries','operational_issue_return_operations');

-- 01: request header, creator, beneficiary and designated collector.
CREATE TABLE `copycmms`.`operational_issue_orders` (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  orderNumber VARCHAR(40) NULL,
  createdById INT NOT NULL, collectorId INT NOT NULL, siteId INT NOT NULL, sectionId INT NOT NULL,
  reason TEXT NOT NULL, status ENUM('pending','approved','completed') NOT NULL DEFAULT 'pending',
  revision INT NOT NULL DEFAULT 0, approvedById INT NULL,
  operationKey VARCHAR(120) COLLATE utf8mb4_bin NOT NULL,
  requestFingerprint CHAR(64) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_operational_order_number (orderNumber), UNIQUE KEY uq_operational_order_key (operationKey),
  KEY idx_operational_creator (createdById,id), KEY idx_operational_queue (status,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 02: approved quantities and stable catalog identity; no stock is changed here.
CREATE TABLE `copycmms`.`operational_issue_items` (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, orderId INT NOT NULL, catalogItemId INT NOT NULL,
  itemName VARCHAR(300) NOT NULL, unit VARCHAR(50) NOT NULL, quantity DECIMAL(15,3) NOT NULL,
  UNIQUE KEY uq_operational_order_catalog (orderId,catalogItemId),
  CONSTRAINT fk_operational_item_order FOREIGN KEY (orderId) REFERENCES `copycmms`.`operational_issue_orders`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 03: link to existing physical delivery/movement and immutable lot cost.
CREATE TABLE `copycmms`.`operational_issue_deliveries` (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, orderItemId INT NOT NULL, deliveryDocumentId INT NOT NULL,
  inventoryTransactionId INT NOT NULL, quantity DECIMAL(15,3) NOT NULL,
  lotUnitCost DECIMAL(16,4) NOT NULL, cost DECIMAL(16,2) NOT NULL,
  operationKey VARCHAR(120) COLLATE utf8mb4_bin NOT NULL, issuedById INT NOT NULL,
  requestFingerprint CHAR(64) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_operational_delivery (deliveryDocumentId), UNIQUE KEY uq_operational_movement (inventoryTransactionId),
  UNIQUE KEY uq_operational_issue_key (operationKey), KEY idx_operational_delivery_item (orderItemId),
  CONSTRAINT fk_operational_delivery_item FOREIGN KEY (orderItemId) REFERENCES `copycmms`.`operational_issue_items`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 04: retry protection for existing recipient-return procedure.
CREATE TABLE `copycmms`.`operational_issue_return_operations` (
  operationKey VARCHAR(120) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  orderId INT NOT NULL, deliveryDocumentId INT NOT NULL, quantity DECIMAL(15,3) NOT NULL,
  reason TEXT NOT NULL, resultJson JSON NOT NULL, createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_operational_return_order (orderId),
  CONSTRAINT fk_operational_return_order FOREIGN KEY (orderId) REFERENCES `copycmms`.`operational_issue_orders`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 05: verify all four tables, then deploy code and set OPERATIONAL_ISSUES_ENABLED=true.
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='copycmms' AND TABLE_NAME IN
('operational_issue_orders','operational_issue_items','operational_issue_deliveries','operational_issue_return_operations');
