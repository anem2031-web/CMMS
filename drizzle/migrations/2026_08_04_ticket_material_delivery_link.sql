-- توثيق الربط بين صرف المخزون وبلاغ المسار B مع الفصل بين الفني المسند والمستلم الفعلي.
-- كل ALTER مستقل لتوافق TiDB وعدم الاعتماد على عمود أضيف في نفس العبارة.

ALTER TABLE `delivery_documents`
  ADD COLUMN `inventoryId` INT NULL;

ALTER TABLE `delivery_documents`
  ADD COLUMN `ticketId` INT NULL;

ALTER TABLE `delivery_documents`
  ADD COLUMN `ticketNumber` VARCHAR(50) NULL;

ALTER TABLE `delivery_documents`
  ADD COLUMN `assignedTechnicianId` INT NULL;

ALTER TABLE `delivery_documents`
  ADD COLUMN `assignedTechnicianName` VARCHAR(200) NULL;

ALTER TABLE `delivery_documents`
  ADD COLUMN `deliveredToId` INT NULL;

CREATE INDEX `idx_delivery_documents_inventory`
  ON `delivery_documents` (`inventoryId`);

CREATE INDEX `idx_delivery_documents_ticket`
  ON `delivery_documents` (`ticketId`);
