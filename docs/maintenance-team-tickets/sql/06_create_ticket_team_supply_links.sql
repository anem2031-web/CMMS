-- MANUAL EXECUTION ONLY. Purpose: ربط الاحتياج ببند شراء أو تحويل حقيقي وتسجيل كمية التغطية
CREATE TABLE ticket_team_supply_links (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  needId INT NOT NULL,
  sourceKind ENUM('purchase','transfer') NOT NULL,
  sourceId INT NOT NULL,
  sourceNumber VARCHAR(100) NOT NULL,
  linkedQuantity INT NOT NULL,
  status ENUM('pending','received','cancelled') NOT NULL DEFAULT 'pending',
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ticket_team_supply_source (sourceKind, sourceId),
  KEY idx_ticket_team_supply_need (needId, status),
  CONSTRAINT fk_mtt_supply_need FOREIGN KEY (needId) REFERENCES ticket_team_material_needs(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

