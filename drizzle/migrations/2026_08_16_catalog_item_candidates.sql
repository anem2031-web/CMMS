-- 2B-5: Non-blocking Catalog Item Candidate queue.
-- Operational receiving/inventory continues immediately; Master Data review happens later.
-- One candidate per unresolved inventory identity prevents duplicate queue rows across receipts.

CREATE TABLE catalog_item_candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  inventoryId INT NOT NULL,
  sourceReceiptId INT NOT NULL,
  sourceReceiptItemId INT NOT NULL,
  purchaseOrderId INT NULL,
  purchaseOrderItemId INT NULL,
  catalogSupplierId INT NULL,
  supplierCandidateId INT NULL,
  invoiceNumber VARCHAR(100) NULL,
  itemName VARCHAR(300) NOT NULL,
  itemNameAr TEXT NULL,
  itemNameEn TEXT NULL,
  supplierItemCode VARCHAR(100) NULL,
  purchaseUnit VARCHAR(50) NULL,
  manufacturerBarcode VARCHAR(200) NULL,
  status ENUM('pending','linked_existing','approved_new','rejected') NOT NULL DEFAULT 'pending',
  resolvedCatalogItemId INT NULL,
  createdById INT NOT NULL,
  resolvedById INT NULL,
  resolvedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_catalog_item_candidates_inventory (inventoryId),
  KEY idx_catalog_item_candidates_status (status),
  KEY idx_catalog_item_candidates_receipt (sourceReceiptId),
  KEY idx_catalog_item_candidates_receipt_item (sourceReceiptItemId),
  KEY idx_catalog_item_candidates_po (purchaseOrderId),
  KEY idx_catalog_item_candidates_supplier (catalogSupplierId),
  KEY idx_catalog_item_candidates_resolved_item (resolvedCatalogItemId)
);
