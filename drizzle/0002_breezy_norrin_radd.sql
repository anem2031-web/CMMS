CREATE TABLE `entity_translations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int NOT NULL,
	`fieldName` varchar(100) NOT NULL,
	`languageCode` enum('ar','en','ur') NOT NULL,
	`translatedText` text,
	`translationStatus` enum('pending','processing','completed','failed','approved') NOT NULL DEFAULT 'pending',
	`versionNumber` int NOT NULL DEFAULT 1,
	`translationJobId` int,
	`lastAttemptAt` timestamp,
	`errorMessage` text,
	`approvedById` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entity_translations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `translation_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int NOT NULL,
	`fieldName` varchar(100) NOT NULL,
	`sourceLanguage` enum('ar','en','ur') NOT NULL,
	`targetLanguage` enum('ar','en','ur') NOT NULL,
	`sourceText` text NOT NULL,
	`translatedText` text,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`retryCount` int NOT NULL DEFAULT 0,
	`maxRetries` int NOT NULL DEFAULT 3,
	`errorMessage` text,
	`previousTextHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `translation_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `translation_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityTranslationId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`translatedText` text,
	`translationStatus` varchar(20) NOT NULL,
	`changedById` int,
	`changeReason` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `translation_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `originalLanguage` enum('ar','en','ur') DEFAULT 'ar' NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `originalLanguage` enum('ar','en','ur') DEFAULT 'ar' NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `originalLanguage` enum('ar','en','ur') DEFAULT 'ar' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `preferredLanguage` enum('ar','en','ur') DEFAULT 'ar' NOT NULL;