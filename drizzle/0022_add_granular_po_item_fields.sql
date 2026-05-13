-- إضافة حقل reviewReason إلى جدول purchase_order_items
ALTER TABLE `purchase_order_items` ADD COLUMN `reviewReason` text;

-- تحديث حالات الأصناف لتشمل pending_review و cancelled
ALTER TABLE `purchase_order_items` MODIFY COLUMN `status` enum('pending','estimated','approved','rejected','funded','purchased','delivered_to_warehouse','delivered_to_requester','pending_review','cancelled') NOT NULL DEFAULT 'pending';
