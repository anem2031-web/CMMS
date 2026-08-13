-- ============================================================
-- الشراء المستقل لكل بند — الخطوة 4 من ميزة البلاغ متعدد الجهات
-- Date: 2026-08-08
--
-- ترحيل إضافي بالكامل (Additive):
--   - عمود جديد فقط، NULL افتراضيًا. لا يمس أي طلب شراء قائم.
--   - بلا مفتاح خارجي فعلي، بنفس اتفاقية purchase_orders.ticketId ذاته
--     (غير مفروض بقاعدة البيانات في هذا المشروع أصلًا).
-- ============================================================

ALTER TABLE `purchase_orders`
  ADD COLUMN `ticketItemId` INT NULL AFTER `ticketId`;

CREATE INDEX `idx_purchase_orders_ticket_item`
  ON `purchase_orders` (`ticketItemId`);

-- ============================================================
-- التراجع (Rollback) — عند الحاجة فقط:
--   DROP INDEX `idx_purchase_orders_ticket_item` ON `purchase_orders`;
--   ALTER TABLE `purchase_orders` DROP COLUMN `ticketItemId`;
-- ============================================================
