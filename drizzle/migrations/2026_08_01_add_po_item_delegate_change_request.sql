-- ============================================================
-- طلب تغيير مندوب الصنف قبل التسعير
-- Date: 2026-08-01
-- Additive migration: لا يغيّر أي بيانات أو حالات قائمة
-- ============================================================

ALTER TABLE purchase_order_items
  ADD COLUMN delegateChangeRequestedById INT NULL AFTER delegateId,
  ADD COLUMN delegateChangeReason TEXT NULL AFTER delegateChangeRequestedById,
  ADD COLUMN delegateChangeRequestedAt TIMESTAMP NULL AFTER delegateChangeReason;

-- Rollback (عند الحاجة):
-- ALTER TABLE purchase_order_items
--   DROP COLUMN delegateChangeRequestedAt,
--   DROP COLUMN delegateChangeReason,
--   DROP COLUMN delegateChangeRequestedById;
