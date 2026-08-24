-- المرحلة 2B-2 — Supplier Master Resolution
-- يضيف هوية المورد المركزية، الأسماء البديلة، ومرشحي الموردين الجدد.
-- لا يغير Workflow الاستلام: المورد الجديد يستمر تشغيلياً كمرشح Master Data.

ALTER TABLE catalog_suppliers
  ADD COLUMN taxNumber VARCHAR(50) NULL AFTER address,
  ADD COLUMN commercialRegistration VARCHAR(100) NULL AFTER taxNumber;

CREATE INDEX idx_catalog_suppliers_tax_number ON catalog_suppliers (taxNumber);
CREATE INDEX idx_catalog_suppliers_cr ON catalog_suppliers (commercialRegistration);

CREATE TABLE catalog_supplier_aliases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplierId INT NOT NULL,
  aliasName VARCHAR(300) NOT NULL,
  normalizedAlias VARCHAR(300) NOT NULL,
  source ENUM('invoice','manual','import') NOT NULL DEFAULT 'invoice',
  createdById INT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_catalog_supplier_alias (supplierId, normalizedAlias),
  KEY idx_catalog_supplier_alias_normalized (normalizedAlias)
);

CREATE TABLE catalog_supplier_candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receiptId INT NULL,
  purchaseOrderId INT NULL,
  invoiceNumber VARCHAR(100) NULL,
  invoicePhotoUrl TEXT NULL,
  extractedName VARCHAR(300) NOT NULL,
  extractedNameEn VARCHAR(300) NULL,
  taxNumber VARCHAR(50) NULL,
  commercialRegistration VARCHAR(100) NULL,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  address TEXT NULL,
  status ENUM('pending','linked_existing','approved_new','rejected') NOT NULL DEFAULT 'pending',
  resolvedSupplierId INT NULL,
  createdById INT NOT NULL,
  resolvedById INT NULL,
  resolvedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_catalog_supplier_candidates_status (status),
  KEY idx_catalog_supplier_candidates_receipt (receiptId),
  KEY idx_catalog_supplier_candidates_po (purchaseOrderId)
);

ALTER TABLE warehouse_receipts
  ADD COLUMN catalogSupplierId INT NULL AFTER vendorTaxNumber,
  ADD COLUMN supplierCandidateId INT NULL AFTER catalogSupplierId;

CREATE INDEX idx_warehouse_receipts_catalog_supplier ON warehouse_receipts (catalogSupplierId);
CREATE INDEX idx_warehouse_receipts_supplier_candidate ON warehouse_receipts (supplierCandidateId);
