-- MANUAL EXECUTION ONLY. Purpose: تعريف فرق الصيانة المستقلة وربط كل فريق بمستودع قائم
CREATE TABLE maintenance_teams (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  warehouseId INT NOT NULL,
  isActive TINYINT NOT NULL DEFAULT 1,
  createdById INT NOT NULL,
  updatedById INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_maintenance_teams_name (name),
  KEY idx_maintenance_teams_warehouse (warehouseId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

