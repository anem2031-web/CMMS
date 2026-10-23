-- نفّذ كل عبارة منفردة على copycmms، ثم كررها على cmms بعد التحقق.
-- لا يشترط تعبئة السجلات القديمة؛ الكود يستخدم سياق رأس الطلب كقيمة بديلة.

ALTER TABLE `purchase_order_items` ADD COLUMN `siteId` INT NULL;
ALTER TABLE `purchase_order_items` ADD COLUMN `sectionId` INT NULL;
ALTER TABLE `purchase_order_items` ADD COLUMN `assetId` INT NULL;
ALTER TABLE `purchase_order_items` ADD COLUMN `categoryId` INT NULL;

CREATE INDEX `idx_poi_siteId` ON `purchase_order_items` (`siteId`);
CREATE INDEX `idx_poi_sectionId` ON `purchase_order_items` (`sectionId`);
CREATE INDEX `idx_poi_assetId` ON `purchase_order_items` (`assetId`);
CREATE INDEX `idx_poi_categoryId` ON `purchase_order_items` (`categoryId`);

-- فحص بعد التنفيذ:
SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'purchase_order_items'
  AND COLUMN_NAME IN ('siteId', 'sectionId', 'assetId', 'categoryId')
ORDER BY COLUMN_NAME;
