ALTER TABLE `purchase_order_items` MODIFY COLUMN `status` enum('pending','estimated','approved','funded','purchased','delivered_to_warehouse','delivered_to_requester') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `purchasedById` int;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `supplierItemName` varchar(300);--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `warehousePhotoUrl` text;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `deliveredAt` timestamp;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `deliveredById` int;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `deliveredToId` int;