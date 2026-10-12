-- MANUAL EXECUTION ONLY. Purpose: أصناف الاحتياج؛ تحفظ الوصف الأصلي للصنف غير المدرج ودورة الطلب
CREATE TABLE ticket_team_material_needs (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  assignmentId INT NOT NULL,
  materialRound INT NOT NULL,
  catalogItemId INT NULL,
  itemNameSnapshot VARCHAR(250) NOT NULL,
  originalItemName VARCHAR(250) NOT NULL,
  unitSnapshot VARCHAR(50) NOT NULL,
  requestedQuantity INT NOT NULL,
  usedQuantity INT NULL,
  requestedById INT NOT NULL,
  warehouseId INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ticket_team_need_catalog (assignmentId, materialRound, catalogItemId),
  KEY idx_ticket_team_need_round (assignmentId, materialRound),
  CONSTRAINT fk_mtt_need_assignment FOREIGN KEY (assignmentId) REFERENCES ticket_team_assignments(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

