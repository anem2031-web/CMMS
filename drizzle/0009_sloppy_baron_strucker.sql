CREATE TABLE `asset_metrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`totalTickets` int NOT NULL DEFAULT 0,
	`closedTickets` int NOT NULL DEFAULT 0,
	`totalDowntime` int NOT NULL DEFAULT 0,
	`mttr` decimal(10,2) NOT NULL DEFAULT '0',
	`mtbf` decimal(10,2) NOT NULL DEFAULT '0',
	`availability` decimal(5,2) NOT NULL DEFAULT '100',
	`lastFailureDate` timestamp,
	`lastRepairDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asset_metrics_id` PRIMARY KEY(`id`),
	CONSTRAINT `asset_metrics_assetId_unique` UNIQUE(`assetId`)
);
--> statement-breakpoint
CREATE TABLE `asset_spare_parts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assetId` int NOT NULL,
	`inventoryItemId` int NOT NULL,
	`minStockLevel` int NOT NULL DEFAULT 5,
	`preferredQuantity` int NOT NULL DEFAULT 10,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asset_spare_parts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pm_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`assetId` int NOT NULL,
	`ticketId` int,
	`dueDate` timestamp NOT NULL,
	`executedDate` timestamp,
	`status` enum('pending','executed','skipped','overdue') NOT NULL DEFAULT 'pending',
	`autoCreatedTicket` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pm_jobs_id` PRIMARY KEY(`id`)
);
