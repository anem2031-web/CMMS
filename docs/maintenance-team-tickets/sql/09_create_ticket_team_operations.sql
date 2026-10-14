-- MANUAL EXECUTION ONLY. Purpose: حفظ نتيجة العملية وبصمتها لاستعادة المحاولات ومنع تكرار التنفيذ
CREATE TABLE ticket_team_operations (
  operationKey VARCHAR(120) COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
  assignmentId INT NOT NULL,
  actorId INT NOT NULL,
  fingerprint TEXT NOT NULL,
  resultJson JSON NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ticket_team_operation_assignment (assignmentId),
  CONSTRAINT fk_mtt_operation_assignment FOREIGN KEY (assignmentId) REFERENCES ticket_team_assignments(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

