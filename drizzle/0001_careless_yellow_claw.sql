CREATE TABLE `attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`uploadedById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(100) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int,
	`oldValues` json,
	`newValues` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`itemName` varchar(300) NOT NULL,
	`description` text,
	`quantity` int NOT NULL DEFAULT 0,
	`unit` varchar(50),
	`minQuantity` int DEFAULT 0,
	`location` varchar(200),
	`siteId` int,
	`lastRestockedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventoryId` int NOT NULL,
	`type` enum('in','out') NOT NULL,
	`quantity` int NOT NULL,
	`reason` text,
	`ticketId` int,
	`purchaseOrderItemId` int,
	`performedById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventory_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`message` text NOT NULL,
	`type` enum('info','warning','error','success') NOT NULL DEFAULT 'info',
	`relatedTicketId` int,
	`relatedPOId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`itemName` varchar(300) NOT NULL,
	`description` text,
	`quantity` int NOT NULL DEFAULT 1,
	`unit` varchar(50),
	`photoUrl` text,
	`notes` text,
	`delegateId` int,
	`estimatedUnitCost` decimal(12,2),
	`estimatedTotalCost` decimal(12,2),
	`actualUnitCost` decimal(12,2),
	`actualTotalCost` decimal(12,2),
	`supplierName` varchar(300),
	`invoicePhotoUrl` text,
	`purchasedPhotoUrl` text,
	`status` enum('pending','estimated','approved','purchased','received') NOT NULL DEFAULT 'pending',
	`purchasedAt` timestamp,
	`receivedAt` timestamp,
	`receivedById` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`poNumber` varchar(20) NOT NULL,
	`ticketId` int,
	`requestedById` int NOT NULL,
	`status` enum('draft','pending_estimate','pending_accounting','pending_management','approved','partial_purchase','purchased','received','closed','rejected') NOT NULL DEFAULT 'draft',
	`totalEstimatedCost` decimal(12,2),
	`totalActualCost` decimal(12,2),
	`totalEstimatedText` varchar(500),
	`accountingApprovedById` int,
	`accountingApprovedAt` timestamp,
	`accountingNotes` text,
	`managementApprovedById` int,
	`managementApprovedAt` timestamp,
	`managementNotes` text,
	`rejectedById` int,
	`rejectedAt` timestamp,
	`rejectionReason` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchase_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchase_orders_poNumber_unique` UNIQUE(`poNumber`)
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`address` text,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`fromStatus` varchar(50),
	`toStatus` varchar(50) NOT NULL,
	`changedById` int NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketNumber` varchar(20) NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text,
	`status` enum('new','approved','assigned','in_progress','needs_purchase','purchase_pending_estimate','purchase_pending_accounting','purchase_pending_management','purchase_approved','partial_purchase','purchased','received_warehouse','repaired','verified','closed') NOT NULL DEFAULT 'new',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`category` enum('electrical','plumbing','hvac','structural','mechanical','general','safety','cleaning') NOT NULL DEFAULT 'general',
	`siteId` int,
	`locationDetail` varchar(300),
	`reportedById` int NOT NULL,
	`assignedToId` int,
	`approvedById` int,
	`beforePhotoUrl` text,
	`afterPhotoUrl` text,
	`repairNotes` text,
	`materialsUsed` text,
	`estimatedCost` decimal(12,2),
	`actualCost` decimal(12,2),
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `tickets_ticketNumber_unique` UNIQUE(`ticketNumber`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','operator','technician','maintenance_manager','purchase_manager','delegate','accountant','senior_management','warehouse','owner') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `department` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;