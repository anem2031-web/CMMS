-- البند 7 (العصف الذهني): مخازن فرعية مرتبطة بتصنيف المستوى الأول من الكتالوج
-- + تفعيل التحويل الفعلي بين المخازن (كان الراوتر مسجَّلاً بالخادم لكن بلا أي
-- تطبيق حقيقي بطبقة قاعدة البيانات — راجع docs/CHANGELOG_TECHNICAL.md).
-- كل ALTER مستقل لتوافق TiDB وعدم الاعتماد على عمود أضيف في نفس العبارة.

-- ── 1) ربط كل مخزن بتصنيف واحد (اختياري للمخزن الرئيسي، إلزامي بالتحقق
--       البرمجي فقط للمخازن الفرعية — لا نفرضه NOT NULL هنا حتى لا ينكسر أي
--       صف رئيسي موجود مسبقاً) ──────────────────────────────────────────
ALTER TABLE `warehouses`
  ADD COLUMN `catalogNodeId` INT NULL;

-- وصف اختياري للمخزن (يُعرض بشاشة إدارة المخازن الجديدة)
ALTER TABLE `warehouses`
  ADD COLUMN `description` TEXT NULL;

-- فهرس فريد: يمنع ربط أكثر من مخزن بنفس تصنيف المستوى الأول على مستوى
-- قاعدة البيانات نفسها (حماية مزدوجة مع التحقق البرمجي في الراوتر).
-- ملاحظة: NULL لا يخالف UNIQUE في MySQL/TiDB (يمكن تكرار NULL)، وهذا مقصود
-- لأن المخزن الرئيسي قد لا يكون مربوطاً بأي تصنيف.
CREATE UNIQUE INDEX `idx_warehouses_catalog_node_unique`
  ON `warehouses` (`catalogNodeId`);

ALTER TABLE `warehouses`
  ADD CONSTRAINT `fk_warehouses_catalog_node`
  FOREIGN KEY (`catalogNodeId`) REFERENCES `catalog_nodes`(`id`)
  ON DELETE SET NULL;

-- ── 2) إضافة نوع حركة "تحويل" لجدول حركات المخزون ────────────────────────
ALTER TABLE `inventory_transactions`
  MODIFY COLUMN `transactionType`
  ENUM('purchase','return','delivery','adjustment','disposal','transfer')
  NOT NULL DEFAULT 'adjustment';

-- ── 3) جدول رأسي لتوثيق كل عملية تحويل بين المخازن (Audit Trail مستقل،
--       بنفس نمط inventory_count_operations / disposal_operations) ───────
CREATE TABLE `warehouse_transfers` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `transferNumber`    VARCHAR(30) NOT NULL,
  `fromWarehouseId`   INT NOT NULL,
  `toWarehouseId`     INT NOT NULL,
  `fromInventoryId`   INT NOT NULL,
  `toInventoryId`     INT NOT NULL,
  `quantity`          DECIMAL(12,3) NOT NULL,
  `categoryMismatch`  TINYINT NOT NULL DEFAULT 0,
  `notes`             TEXT NULL,
  `createdById`       INT NOT NULL,
  `createdAt`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX `idx_warehouse_transfers_number_unique`
  ON `warehouse_transfers` (`transferNumber`);

CREATE INDEX `idx_warehouse_transfers_from_warehouse`
  ON `warehouse_transfers` (`fromWarehouseId`);

CREATE INDEX `idx_warehouse_transfers_to_warehouse`
  ON `warehouse_transfers` (`toWarehouseId`);

ALTER TABLE `warehouse_transfers`
  ADD CONSTRAINT `fk_warehouse_transfers_from_warehouse`
  FOREIGN KEY (`fromWarehouseId`) REFERENCES `warehouses`(`id`)
  ON DELETE RESTRICT;

ALTER TABLE `warehouse_transfers`
  ADD CONSTRAINT `fk_warehouse_transfers_to_warehouse`
  FOREIGN KEY (`toWarehouseId`) REFERENCES `warehouses`(`id`)
  ON DELETE RESTRICT;

ALTER TABLE `warehouse_transfers`
  ADD CONSTRAINT `fk_warehouse_transfers_from_inventory`
  FOREIGN KEY (`fromInventoryId`) REFERENCES `inventory`(`id`)
  ON DELETE RESTRICT;

ALTER TABLE `warehouse_transfers`
  ADD CONSTRAINT `fk_warehouse_transfers_to_inventory`
  FOREIGN KEY (`toInventoryId`) REFERENCES `inventory`(`id`)
  ON DELETE RESTRICT;

-- عداد رقم التحويل (نفس نمط inventory_count_number_counter)
CREATE TABLE `warehouse_transfer_number_counter` (
  `id`   INT AUTO_INCREMENT PRIMARY KEY,
  `year` INT NOT NULL
);
