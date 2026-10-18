-- MANUAL ONLY: each numbered statement is executed separately by the owner.
-- copycmms only. This file is not imported or run by the application.
-- 01: inspect. Continue to 02 only if no row exists.
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA='copycmms' AND TABLE_NAME='operational_issue_purchase_links';

-- 02: link operational requirements to existing purchase drafts/items.
-- No inventory mutation, no historical data change, no new purchase workflow.
-- Purchase refs intentionally have no delete-restrict FK: normal draft editing/deletion stays available.
-- The application checks both live PO and item and their parent/catalog/context before using the link.
CREATE TABLE `copycmms`.`operational_issue_purchase_links` (
  orderItemId INT NOT NULL PRIMARY KEY,
  purchaseOrderId INT NOT NULL,
  purchaseOrderItemId INT NOT NULL,
  quantity INT NOT NULL,
  unit VARCHAR(50) NOT NULL,
  createdById INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_operational_purchase_item (purchaseOrderItemId),
  KEY idx_operational_purchase_order (purchaseOrderId),
  CONSTRAINT fk_operational_purchase_source FOREIGN KEY (orderItemId)
    REFERENCES `copycmms`.`operational_issue_items`(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 03: verify (expected: the table and its columns).
SHOW COLUMNS FROM `copycmms`.`operational_issue_purchase_links`;
