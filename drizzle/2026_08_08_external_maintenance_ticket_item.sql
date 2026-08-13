-- ============================================================
-- الصيانة الخارجية المستقلة لكل بند — الخطوة 5 من ميزة البلاغ متعدد الجهات
-- Date: 2026-08-08
--
-- ترحيل إضافي بالكامل (Additive)، لكن بخطوة حساسة: استبدال فهرس فريد قائم.
-- نفّذ العبارات بالترتيب المرقّم أدناه، كل عبارة لوحدها، وتحقق بعد كل خطوة.
-- ============================================================

-- 1) عمود جديد
ALTER TABLE `external_maintenance_jobs`
  ADD COLUMN `ticketItemId` INT NULL AFTER `ticketId`;

-- 2) تعبئة رجعية: كل سجل قائم يُربط ببند البلاغ الأول (itemNumber = 1) الخاص
--    ببلاغه — نفس مبدأ "البند الأول يمثّل الجهة الرئيسية" المعتمد بالخطوات السابقة.
UPDATE `external_maintenance_jobs` j
JOIN `ticket_items` ti
  ON ti.`ticketId` = j.`ticketId` AND ti.`itemNumber` = 1
SET j.`ticketItemId` = ti.`id`
WHERE j.`ticketItemId` IS NULL;

-- ============================================================
-- تحقق إلزامي قبل المتابعة للخطوة 3 — يجب أن تكون النتيجة صفرًا:
--   SELECT COUNT(*) FROM external_maintenance_jobs WHERE ticketItemId IS NULL;
-- إن لم تكن صفرًا، توقف ولا تنفّذ الخطوتين 3 و4 أدناه — أرسل النتيجة أولًا.
-- ============================================================

-- 3) حذف الفهرس الفريد القديم (على ticketId وحده — كان يمنع أكثر من سجل
--    صيانة خارجية واحد لكل بلاغ كامل)
ALTER TABLE `external_maintenance_jobs`
  DROP INDEX `uq_external_maintenance_ticket`;

-- 4) الفهرس الفريد الجديد (على ticketItemId — يمنع أكثر من سجل واحد لكل
--    بند، ويسمح لبلاغ متعدد البنود بأكثر من سجل صيانة خارجية معًا)
CREATE UNIQUE INDEX `uq_external_maintenance_ticket_item`
  ON `external_maintenance_jobs` (`ticketItemId`);

-- 5) فهرس عادي على ticketId (لم يعد فريدًا، لكنه لا يزال يُستخدم للبحث
--    والعرض بكثرة — راجع listExternalMaintenanceJobs وغيرها)
CREATE INDEX `idx_external_maintenance_ticket`
  ON `external_maintenance_jobs` (`ticketId`);

-- ============================================================
-- التراجع (Rollback) — عند الحاجة فقط، وبالترتيب العكسي:
--   DROP INDEX `idx_external_maintenance_ticket` ON `external_maintenance_jobs`;
--   DROP INDEX `uq_external_maintenance_ticket_item` ON `external_maintenance_jobs`;
--   CREATE UNIQUE INDEX `uq_external_maintenance_ticket` ON `external_maintenance_jobs` (`ticketId`);
--   -- ⚠️ الأمر أعلاه يفشل إن وُجد أكثر من سجل صيانة خارجية لنفس ticketId
--   --    (أي أن ميزة تعدد السجلات استُخدمت فعليًا) — تحقق أولًا:
--   --    SELECT ticketId, COUNT(*) FROM external_maintenance_jobs GROUP BY ticketId HAVING COUNT(*) > 1;
--   ALTER TABLE `external_maintenance_jobs` DROP COLUMN `ticketItemId`;
-- ============================================================
