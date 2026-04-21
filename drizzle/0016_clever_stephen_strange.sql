CREATE TABLE `sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`siteId` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `assets` ADD `sectionId` int;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `siteId` int;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `sectionId` int;--> statement-breakpoint
ALTER TABLE `tickets` ADD `sectionId` int;