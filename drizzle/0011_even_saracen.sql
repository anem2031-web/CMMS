ALTER TABLE `tickets` MODIFY COLUMN `status` enum('new','pending_triage','under_inspection','work_approved','ready_for_closure','approved','assigned','in_progress','needs_purchase','purchase_pending_estimate','purchase_pending_accounting','purchase_pending_management','purchase_approved','partial_purchase','purchased','received_warehouse','out_for_repair','repaired','verified','closed') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','operator','technician','maintenance_manager','supervisor','purchase_manager','delegate','accountant','senior_management','warehouse','gate_security','owner') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `tickets` ADD `maintenancePath` enum('A','B','C');--> statement-breakpoint
ALTER TABLE `tickets` ADD `ticketType` enum('internal','external','procurement');--> statement-breakpoint
ALTER TABLE `tickets` ADD `supervisorId` int;--> statement-breakpoint
ALTER TABLE `tickets` ADD `inspectionNotes` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `justification` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `triageNotes` text;--> statement-breakpoint
ALTER TABLE `tickets` ADD `gateExitApprovedById` int;--> statement-breakpoint
ALTER TABLE `tickets` ADD `gateExitApprovedAt` timestamp;--> statement-breakpoint
ALTER TABLE `tickets` ADD `gateEntryApprovedById` int;--> statement-breakpoint
ALTER TABLE `tickets` ADD `gateEntryApprovedAt` timestamp;--> statement-breakpoint
ALTER TABLE `tickets` ADD `externalRepairCompletedAt` timestamp;--> statement-breakpoint
ALTER TABLE `tickets` ADD `externalRepairCompletedById` int;