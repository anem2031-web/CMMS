-- MANUAL EXECUTION ONLY. Purpose: سجل إجراءات التنفيذ والمراجعة مع المنفذ وسبب الإجراء
CREATE TABLE ticket_team_actions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assignmentId INT NOT NULL,
  actorId INT NOT NULL,
  kind VARCHAR(50) NOT NULL,
  note TEXT NOT NULL,
  revision INT NOT NULL,
  operationKey VARCHAR(120) COLLATE utf8mb4_bin NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ticket_team_action_revision (assignmentId, revision),
  UNIQUE KEY uq_ticket_team_action_key (operationKey),
  CONSTRAINT fk_mtt_action_assignment FOREIGN KEY (assignmentId) REFERENCES ticket_team_assignments(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

