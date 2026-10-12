-- MANUAL EXECUTION ONLY. Purpose: عضوية الفنيين وتفعيلها وتعطيلها دون حذف تاريخ الارتباط
CREATE TABLE maintenance_team_members (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  teamId INT NOT NULL,
  userId INT NOT NULL,
  isActive TINYINT NOT NULL DEFAULT 1,
  joinedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  leftAt TIMESTAMP NULL,
  updatedById INT NOT NULL,
  UNIQUE KEY uq_maintenance_team_member (teamId, userId),
  KEY idx_maintenance_member_user (userId, isActive),
  CONSTRAINT fk_mtt_member_team FOREIGN KEY (teamId) REFERENCES maintenance_teams(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

