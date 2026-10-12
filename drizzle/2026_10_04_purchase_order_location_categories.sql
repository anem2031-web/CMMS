-- Purchase-order context + dynamic purchase categories.
-- Existing orders remain valid because the new purchase_order fields are nullable.

CREATE TABLE `purchase_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `purchase_categories_name_uq` (`name`),
  KEY `purchase_categories_active_idx` (`isActive`)
);

ALTER TABLE `purchase_orders`
  ADD COLUMN `assetId` int NULL AFTER `sectionId`,
  ADD COLUMN `categoryId` int NULL AFTER `assetId`,
  ADD KEY `idx_purchase_orders_assetId` (`assetId`),
  ADD KEY `idx_purchase_orders_categoryId` (`categoryId`),
  ADD CONSTRAINT `fk_purchase_orders_purchase_category`
    FOREIGN KEY (`categoryId`) REFERENCES `purchase_categories` (`id`) ON DELETE RESTRICT;
