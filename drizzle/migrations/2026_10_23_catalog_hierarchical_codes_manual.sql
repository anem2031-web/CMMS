-- نفّذ هذا الأمر يدويًا على كل قاعدة قبل نشر كود الترقيم الهرمي.
-- توسيع العمود فقط؛ لا يغيّر أي كود أو سجل حالي.
ALTER TABLE `catalog_nodes`
  MODIFY COLUMN `code` VARCHAR(50) NULL;

-- يحتفظ بالأكواد السابقة عند نقل تصنيف أو إعادة ترقيم فرع كامل.
-- لا يغيّر السجلات الحالية، ويمنع إعادة استخدام كود تاريخي لكيان مختلف.
CREATE TABLE IF NOT EXISTS `catalog_code_aliases` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `entityType` ENUM('node', 'item') NOT NULL,
  `entityId` INT NOT NULL,
  `oldCode` VARCHAR(100) NOT NULL,
  `newCode` VARCHAR(100) NOT NULL,
  `createdById` INT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_catalog_code_alias_entity_id_old` (`entityType`, `entityId`, `oldCode`),
  KEY `idx_catalog_code_alias_entity_id` (`entityType`, `entityId`)
);

-- فحص بعد التنفيذ:
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'catalog_nodes'
  AND COLUMN_NAME = 'code';

SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'catalog_code_aliases';
