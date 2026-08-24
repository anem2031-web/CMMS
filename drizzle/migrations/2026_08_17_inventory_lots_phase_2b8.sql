-- 2B-8 — Inventory Lots / Receipt Lot + QR traceability foundation
-- IMPORTANT: On the production DB used during UAT, these commands were applied
-- manually one-by-one on 2026-08-17. Do not re-run this file there as-is.

CREATE TABLE inventory_lots (
    id INT NOT NULL AUTO_INCREMENT,
    lotCode VARCHAR(50) NOT NULL,
    trackingToken VARCHAR(100) NOT NULL,
    sourceType ENUM('receipt', 'opening_balance') NOT NULL,
    catalogItemId INT NULL,
    receiptId INT NULL,
    receiptItemId INT NULL,
    purchaseOrderId INT NULL,
    purchaseOrderItemId INT NULL,
    catalogSupplierId INT NULL,
    supplierCandidateId INT NULL,
    sourceCountOperationId INT NULL,
    sourceSettlementId INT NULL,
    sourceSettlementItemId INT NULL,
    originalQuantity DECIMAL(12,3) NOT NULL,
    remainingQuantity DECIMAL(12,3) NOT NULL,
    purchaseUnit VARCHAR(50) NULL,
    issueUnit VARCHAR(50) NULL,
    conversionFactor DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
    purchaseUnitCost DECIMAL(12,4) NULL,
    issueUnitCost DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    supplierItemName VARCHAR(300) NULL,
    supplierItemCode VARCHAR(100) NULL,
    batchNumber VARCHAR(100) NULL,
    expiryDate DATE NULL,
    createdById INT NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_lots_lotCode (lotCode),
    UNIQUE KEY uq_inventory_lots_trackingToken (trackingToken),
    KEY idx_inventory_lots_catalogItemId (catalogItemId),
    KEY idx_inventory_lots_receiptId (receiptId),
    KEY idx_inventory_lots_receiptItemId (receiptItemId),
    KEY idx_inventory_lots_purchaseOrderItemId (purchaseOrderItemId),
    KEY idx_inventory_lots_catalogSupplierId (catalogSupplierId),
    KEY idx_inventory_lots_sourceCountOperationId (sourceCountOperationId),
    KEY idx_inventory_lots_sourceSettlementId (sourceSettlementId)
);

CREATE TABLE inventory_lot_balances (
    id INT NOT NULL AUTO_INCREMENT,
    lotId INT NOT NULL,
    inventoryId INT NOT NULL,
    quantity DECIMAL(12,3) NOT NULL DEFAULT 0.000,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_inventory_lot_balances_lot_inventory (lotId, inventoryId),
    KEY idx_inventory_lot_balances_inventoryId (inventoryId),
    KEY idx_inventory_lot_balances_lotId (lotId)
);

ALTER TABLE inventory_transactions ADD COLUMN lotId INT NULL AFTER inventoryId;
ALTER TABLE inventory_transactions ADD INDEX idx_inventory_transactions_lotId (lotId);
ALTER TABLE delivery_documents ADD COLUMN lotId INT NULL AFTER inventoryId;
ALTER TABLE delivery_documents ADD INDEX idx_delivery_documents_lotId (lotId);
ALTER TABLE delivery_documents ADD COLUMN inventoryTransactionId INT NULL AFTER lotId;
ALTER TABLE delivery_documents ADD INDEX idx_delivery_documents_inventoryTransactionId (inventoryTransactionId);
ALTER TABLE warehouse_returns ADD COLUMN lotId INT NULL AFTER inventoryId;
ALTER TABLE warehouse_returns ADD INDEX idx_warehouse_returns_lotId (lotId);
ALTER TABLE warehouse_transfers ADD COLUMN lotId INT NULL AFTER toInventoryId;
ALTER TABLE warehouse_transfers ADD INDEX idx_warehouse_transfers_lotId (lotId);
ALTER TABLE disposal_items ADD COLUMN lotId INT NULL AFTER inventoryId;
ALTER TABLE disposal_items ADD INDEX idx_disposal_items_lotId (lotId);
ALTER TABLE inventory_count_items ADD COLUMN lotId INT NULL AFTER inventoryId;
ALTER TABLE inventory_count_items ADD INDEX idx_inventory_count_items_lotId (lotId);
ALTER TABLE inventory_settlement_items ADD COLUMN lotId INT NULL AFTER inventoryId;
ALTER TABLE inventory_settlement_items ADD INDEX idx_inventory_settlement_items_lotId (lotId);
ALTER TABLE inventory_count_operations ADD COLUMN countType ENUM('periodic','opening_balance') NOT NULL DEFAULT 'periodic' AFTER scope;
