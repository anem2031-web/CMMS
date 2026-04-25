CREATE TABLE `pm_checklist_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`orderIndex` int NOT NULL DEFAULT 0,
	`text` text NOT NULL,
	`text_ar` text,
	`text_en` text,
	`isRequired` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pm_checklist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pm_execution_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workOrderId` int NOT NULL,
	`checklistItemId` int NOT NULL,
	`status` enum('ok','fixed','issue') NOT NULL,
	`fixNotes` text,
	`photoUrl` text,
	`linkedTicketId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pm_execution_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pm_execution_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workOrderId` int NOT NULL,
	`technicianId` int NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`durationSeconds` int,
	`totalItems` int NOT NULL DEFAULT 0,
	`okCount` int NOT NULL DEFAULT 0,
	`fixedCount` int NOT NULL DEFAULT 0,
	`issueCount` int NOT NULL DEFAULT 0,
	`generalNotes` text,
	`status` enum('in_progress','completed','paused') NOT NULL DEFAULT 'in_progress',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pm_execution_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `pm_execution_sessions_workOrderId_unique` UNIQUE(`workOrderId`)
);
