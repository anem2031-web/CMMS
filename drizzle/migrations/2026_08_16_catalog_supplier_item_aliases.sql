-- 2B-3: Supplier Item Aliases / Supplier SKU ↔ Catalog Item
-- ذاكرة مستقلة عن جدول أسعار الموردين، وتسمح بعدة أسماء/أكواد للصنف نفسه.
CREATE TABLE catalog_supplier_item_aliases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplierId INT NOT NULL,
  catalogItemId INT NOT NULL,
  supplierItemName VARCHAR(300) NOT NULL,
  normalizedName VARCHAR(300) NOT NULL,
  supplierItemCode VARCHAR(100) NULL,
  normalizedItemCode VARCHAR(100) NULL,
  normalizedMeasurements JSON NULL,
  source ENUM('invoice','manual','import') NOT NULL DEFAULT 'invoice',
  confirmationCount INT NOT NULL DEFAULT 1,
  lastConfirmedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdById INT NULL,
  isActive TINYINT NOT NULL DEFAULT 1,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_supplier_item_alias_supplier (supplierId),
  KEY idx_supplier_item_alias_catalog_item (catalogItemId),
  KEY idx_supplier_item_alias_name (supplierId, normalizedName),
  KEY idx_supplier_item_alias_code (supplierId, normalizedItemCode)
);
