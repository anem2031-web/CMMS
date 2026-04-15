ALTER TABLE `assets` ADD `rfidTag` varchar(100);--> statement-breakpoint
ALTER TABLE `assets` ADD CONSTRAINT `assets_rfidTag_unique` UNIQUE(`rfidTag`);