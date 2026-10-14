-- MANUAL EXECUTION ONLY. Purpose: إسناد تنفيذ بند التذكرة إلى فريق، مع الحالة والنسخة ودورة المواد
CREATE TABLE ticket_team_assignments (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticketId INT NOT NULL,
  ticketItemId INT NOT NULL,
  ticketNumber VARCHAR(100) NOT NULL,
  titleSnapshot VARCHAR(250) NOT NULL,
  teamId INT NOT NULL,
  warehouseId INT NOT NULL,
  responsibleManagerId INT NOT NULL,
  siteId INT NOT NULL,
  sectionId INT NOT NULL,
  assetId INT NULL,
  stage ENUM('action_required','waiting_material','ready_to_repair','awaiting_review','blocked','external_requested','external_in_progress','reinstall_required','closed') NOT NULL DEFAULT 'action_required',
  outcome ENUM('ok','fixed','needs_material','blocked','external') NULL,
  revision INT NOT NULL DEFAULT 0,
  materialRound INT NOT NULL DEFAULT 1,
  assignedById INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ticket_team_execution_item (ticketItemId),
  KEY idx_ticket_team_ticket (ticketId),
  KEY idx_ticket_team_queue (teamId, stage),
  KEY idx_ticket_team_manager (responsibleManagerId, stage),
  CONSTRAINT fk_mtt_assignment_team FOREIGN KEY (teamId) REFERENCES maintenance_teams(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

