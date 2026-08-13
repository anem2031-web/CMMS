-- 2026-08-11 — إعادة هيكلة البلاغات متعددة الجهات
-- بلاغ رئيسي → جهات → مسؤول جهة → مهام → فنيون متعددون → بلاغ فرعي اختياري.
-- TiDB: نفّذ كل عبارة منفردة (CLAUDE.md القاعدة #13).

ALTER TABLE `tickets`
  MODIFY COLUMN `status` ENUM(
    'new','pending_triage','department_planning','under_inspection','work_approved','ready_for_closure',
    'approved','assigned','in_progress','needs_purchase','purchase_pending_estimate','purchase_pending_accounting',
    'purchase_pending_management','purchase_approved','partial_purchase','purchased','received_warehouse',
    'out_for_repair','repaired','verified','closed','requester_confirmed'
  ) NOT NULL DEFAULT 'new';

ALTER TABLE `ticket_items`
  MODIFY COLUMN `status` ENUM(
    'new','pending_triage','department_planning','under_inspection','work_approved','ready_for_closure',
    'approved','assigned','in_progress','needs_purchase','purchase_pending_estimate','purchase_pending_accounting',
    'purchase_pending_management','purchase_approved','partial_purchase','purchased','received_warehouse',
    'out_for_repair','repaired','verified','closed','requester_confirmed'
  ) NOT NULL DEFAULT 'pending_triage';

ALTER TABLE `tickets`
  ADD COLUMN `workflowModel` ENUM('legacy','department_tasks','sub_ticket') NOT NULL DEFAULT 'legacy';

ALTER TABLE `tickets`
  ADD COLUMN `parentTicketId` INT NULL;

ALTER TABLE `tickets`
  ADD COLUMN `sourceTaskId` INT NULL;

ALTER TABLE `tickets`
  ADD COLUMN `subTicketSequence` INT NULL;

ALTER TABLE `tickets`
  ADD COLUMN `subTicketCounter` INT NOT NULL DEFAULT 0;

CREATE INDEX `idx_tickets_parent` ON `tickets` (`parentTicketId`);

CREATE UNIQUE INDEX `uq_tickets_source_task` ON `tickets` (`sourceTaskId`);

CREATE UNIQUE INDEX `uq_tickets_parent_sub_sequence`
  ON `tickets` (`parentTicketId`, `subTicketSequence`);

CREATE TABLE `ticket_departments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ticketId` INT NOT NULL,
  `department` ENUM(
    'maintenance_report_department_general',
    'maintenance_report_department_construction'
  ) NOT NULL,
  `responsibleManagerId` INT NOT NULL,
  `routedById` INT NOT NULL,
  `routedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `routingNote` TEXT NULL,
  `status` ENUM('planning','active','completed') NOT NULL DEFAULT 'planning',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `ticket_departments_ticket_fk`
    FOREIGN KEY (`ticketId`) REFERENCES `tickets` (`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uq_ticket_departments_ticket_department` (`ticketId`, `department`),
  KEY `idx_ticket_departments_ticket` (`ticketId`),
  KEY `idx_ticket_departments_manager` (`responsibleManagerId`)
);

CREATE TABLE `ticket_tasks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `ticketId` INT NOT NULL,
  `ticketDepartmentId` INT NOT NULL,
  `taskNumber` INT NOT NULL,
  `title` VARCHAR(300) NULL,
  `description` TEXT NOT NULL,
  `status` ENUM('pending_assignment','assigned','promoted','completed','cancelled') NOT NULL DEFAULT 'pending_assignment',
  `convertedTicketId` INT NULL,
  `createdById` INT NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `ticket_tasks_department_fk`
    FOREIGN KEY (`ticketDepartmentId`) REFERENCES `ticket_departments` (`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uq_ticket_tasks_department_number` (`ticketDepartmentId`, `taskNumber`),
  KEY `idx_ticket_tasks_ticket` (`ticketId`),
  KEY `idx_ticket_tasks_department` (`ticketDepartmentId`),
  KEY `idx_ticket_tasks_converted` (`convertedTicketId`)
);

CREATE TABLE `ticket_task_assignees` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `taskId` INT NOT NULL,
  `userId` INT NOT NULL,
  `assignedById` INT NOT NULL,
  `assignedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `ticket_task_assignees_task_fk`
    FOREIGN KEY (`taskId`) REFERENCES `ticket_tasks` (`id`) ON DELETE RESTRICT,
  UNIQUE KEY `uq_ticket_task_assignees_task_user` (`taskId`, `userId`),
  KEY `idx_ticket_task_assignees_user` (`userId`)
);
