-- Center Categories transition for purchase orders + NEW maintenance tickets.
-- IMPORTANT: this migration intentionally does NOT update any historical tickets.
-- tickets.category remains untouched and categoryId stays NULL for all existing rows.

-- 1) Promote the purchase-only master table to the shared Center Categories table.
RENAME TABLE `purchase_categories` TO `center_categories`;

-- 2) Add the internal system behavior key. Ordinary categories keep NULL.
ALTER TABLE `center_categories`
  ADD COLUMN `systemKey` varchar(50) NULL AFTER `name`;

-- Keep index names aligned with the new shared purpose.
ALTER TABLE `center_categories`
  RENAME INDEX `purchase_categories_name_uq` TO `center_categories_name_uq`,
  RENAME INDEX `purchase_categories_active_idx` TO `center_categories_active_idx`;

-- If the Arabic IT category already exists, mark it as the protected IT system category.
UPDATE `center_categories`
SET `systemKey` = 'it', `isActive` = 1
WHERE `name` = 'تقنية المعلومات' AND `systemKey` IS NULL;

-- Otherwise create the protected IT category. This does not touch historical tickets.
INSERT INTO `center_categories` (`name`, `systemKey`, `isActive`)
SELECT 'تقنية المعلومات', 'it', 1
WHERE NOT EXISTS (
  SELECT 1 FROM `center_categories` WHERE `systemKey` = 'it'
)
AND NOT EXISTS (
  SELECT 1 FROM `center_categories` WHERE `name` = 'تقنية المعلومات'
);

ALTER TABLE `center_categories`
  ADD UNIQUE KEY `center_categories_system_key_uq` (`systemKey`);

-- 3) Add the new nullable category link to maintenance tickets.
-- Existing tickets are deliberately left with categoryId = NULL.
ALTER TABLE `tickets`
  ADD COLUMN `categoryId` int NULL AFTER `category`,
  ADD KEY `idx_tickets_categoryId` (`categoryId`),
  ADD CONSTRAINT `fk_tickets_center_category`
    FOREIGN KEY (`categoryId`) REFERENCES `center_categories` (`id`) ON DELETE RESTRICT;
