ALTER TABLE `assets` ADD `description_ar` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `description_en` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `description_ur` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `notes_ar` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `notes_en` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `notes_ur` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `originalLanguage` enum('ar','en','ur') DEFAULT 'ar' NOT NULL;--> statement-breakpoint
ALTER TABLE `pm_work_orders` ADD `technicianNotes_ar` text;--> statement-breakpoint
ALTER TABLE `pm_work_orders` ADD `technicianNotes_en` text;--> statement-breakpoint
ALTER TABLE `pm_work_orders` ADD `technicianNotes_ur` text;--> statement-breakpoint
ALTER TABLE `pm_work_orders` ADD `originalLanguage` enum('ar','en','ur') DEFAULT 'ar' NOT NULL;--> statement-breakpoint
ALTER TABLE `tickets` ADD `title_ar` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `title_en` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `title_ur` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `description_ar` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `description_en` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `description_ur` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `repairNotes_ar` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `repairNotes_en` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `repairNotes_ur` text;