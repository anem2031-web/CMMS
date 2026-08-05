-- ============================================================
-- توجيه بلاغات الصيانة إلى الصيانة العامة أو قسم الإنشاءات
-- Date: 2026-08-02
-- Additive migration: لا يغيّر البلاغات القديمة ولا يعيّن لها جهة تلقائياً
-- ============================================================

ALTER TABLE tickets
  ADD COLUMN maintenanceResponsibleDepartment ENUM(
    'maintenance_report_department_general',
    'maintenance_report_department_construction'
  ) NULL AFTER assignedAt,
  ADD COLUMN maintenanceResponsibleManagerId INT NULL AFTER maintenanceResponsibleDepartment,
  ADD COLUMN maintenanceRoutedById INT NULL AFTER maintenanceResponsibleManagerId,
  ADD COLUMN maintenanceRoutedAt TIMESTAMP NULL AFTER maintenanceRoutedById,
  ADD COLUMN maintenanceRoutingNote TEXT NULL AFTER maintenanceRoutedAt;

CREATE INDEX idx_tickets_responsible_department
  ON tickets (maintenanceResponsibleDepartment);

CREATE INDEX idx_tickets_responsible_manager
  ON tickets (maintenanceResponsibleManagerId);

-- Rollback (عند الحاجة، بعد التأكد من عدم الاعتماد على بيانات التوجيه):
-- DROP INDEX idx_tickets_responsible_manager ON tickets;
-- DROP INDEX idx_tickets_responsible_department ON tickets;
-- ALTER TABLE tickets
--   DROP COLUMN maintenanceRoutingNote,
--   DROP COLUMN maintenanceRoutedAt,
--   DROP COLUMN maintenanceRoutedById,
--   DROP COLUMN maintenanceResponsibleManagerId,
--   DROP COLUMN maintenanceResponsibleDepartment;
