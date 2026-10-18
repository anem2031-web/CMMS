-- Manual execution only, after code development. Do not enable the feature before all checks pass.
-- Target: copycmms. No changes or backfill to existing accounting / purchase tables.
SELECT DATABASE() AS database_name;
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='copycmms' AND TABLE_NAME IN
('delegate_pricing_bundles','delegate_pricing_bundle_items','delegate_pricing_bundle_batches');

CREATE TABLE `copycmms`.`delegate_pricing_bundles` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `bundleNumber` VARCHAR(40) NULL,
  `delegateId` INT NOT NULL,
  `openDelegateId` INT NULL,
  `status` ENUM('open','sent','archived') NOT NULL DEFAULT 'open',
  `revision` INT NOT NULL DEFAULT 0,
  `snapshotJson` MEDIUMTEXT NULL,
  `pdfContent` MEDIUMBLOB NULL,
  `effectsDone` TINYINT NOT NULL DEFAULT 0,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `sentAt` TIMESTAMP NULL,
  UNIQUE KEY `uq_dpb_number` (`bundleNumber`),
  UNIQUE KEY `uq_dpb_open_delegate` (`openDelegateId`),
  KEY `idx_dpb_delegate_status` (`delegateId`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `copycmms`.`delegate_pricing_bundle_items` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `bundleId` INT NOT NULL,
  `purchaseOrderItemId` INT NOT NULL,
  `reservedItemId` INT NULL,
  `addedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `removedAt` TIMESTAMP NULL,
  UNIQUE KEY `uq_dpb_reserved_item` (`reservedItemId`),
  KEY `idx_dpb_items` (`bundleId`,`removedAt`),
  KEY `idx_dpb_source_item` (`purchaseOrderItemId`),
  CONSTRAINT `fk_dpb_item_bundle` FOREIGN KEY (`bundleId`) REFERENCES `copycmms`.`delegate_pricing_bundles` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `copycmms`.`delegate_pricing_bundle_batches` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `bundleId` INT NOT NULL,
  `purchaseOrderId` INT NOT NULL,
  `pricingBatchId` INT NOT NULL,
  `purchasePackageSubmissionId` INT NULL,
  `effectsDone` TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY `uq_dpb_batch` (`pricingBatchId`),
  UNIQUE KEY `uq_dpb_po` (`bundleId`,`purchaseOrderId`),
  CONSTRAINT `fk_dpb_batch_bundle` FOREIGN KEY (`bundleId`) REFERENCES `copycmms`.`delegate_pricing_bundles` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SHOW CREATE TABLE `copycmms`.`delegate_pricing_bundles`;
SHOW CREATE TABLE `copycmms`.`delegate_pricing_bundle_items`;
SHOW CREATE TABLE `copycmms`.`delegate_pricing_bundle_batches`;
-- After deploying code and validating these tables manually:
-- DELEGATE_PRICING_BUNDLES_ENABLED=true
-- Safe stop: set flag false. Retain all tables/history; existing accounting batches continue normally.
