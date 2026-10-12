ALTER TABLE `purchase_order_items`
  ADD COLUMN `requiredDate` date NULL AFTER `delegateId`,
  ADD COLUMN `delegateAssignedAt` timestamp NULL AFTER `requiredDate`;
