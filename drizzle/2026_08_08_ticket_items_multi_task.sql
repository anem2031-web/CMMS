-- ============================================================
-- بنود البلاغ (مهام متعددة داخل البلاغ الواحد) — الخطوة 1: الأساس
-- Date: 2026-08-08
--
-- ترحيل إضافي بالكامل (Additive):
--   - لا يحذف أي عمود أو جدول قائم.
--   - لا يغيّر سلوك أي بلاغ حالي.
--   - كل بلاغ قائم يُحوَّل تلقائيًا إلى "بلاغ ببند واحد" حتى يصبح
--     البلاغ الأحادي والبلاغ المتعدد نفس المسار البرمجي بلا فرعين.
--
-- ملاحظة معمارية: أعمدة البلاغ الحالية (maintenancePath, status,
-- repairNotes, ...) تبقى كما هي ولا تُلمس — تُعامَل بعد هذا الترحيل
-- كـ"ملخص" للبلاغ، بينما تفاصيل كل مهمة تُحفظ هنا. هذا يضمن أن أي
-- شاشة أو تقرير أو مستند لم يُحدَّث بعد يستمر بالعمل دون كسر.
--
-- TiDB: العبارات مفصولة عمدًا لأن عمودًا مُضافًا حديثًا لا يمكن دائمًا
-- الإشارة إليه بـ AFTER داخل نفس عبارة ALTER TABLE.
-- ============================================================

CREATE TABLE IF NOT EXISTS `ticket_items` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `ticketId`               INT NOT NULL,

  -- ترتيب البند داخل البلاغ (1، 2، 3...) — يُعرض للمستخدم كرقم المهمة
  `itemNumber`             INT NOT NULL DEFAULT 1,

  -- وصف المهمة والمطلوب تنفيذه فيها
  `title`                  VARCHAR(300) NULL,
  `description`            TEXT NULL,
  `description_ar`         TEXT NULL,
  `description_en`         TEXT NULL,
  `description_ur`         TEXT NULL,

  -- الأصل المرتبط بهذه المهمة تحديدًا (قد يختلف عن بند لآخر داخل نفس البلاغ)
  `assetId`                INT NULL,

  -- الجهة المسؤولة عن هذا البند (من الفرز المتعدد). نفس قيم
  -- tickets.maintenanceResponsibleDepartment حرفيًا لضمان توافق
  -- منطق الصلاحيات في tickets.access.ts دون أي تحويل قيم.
  `responsibleDepartment`  ENUM(
                             'maintenance_report_department_general',
                             'maintenance_report_department_construction'
                           ) NULL,
  `responsibleManagerId`   INT NULL,
  `routedById`             INT NULL,
  `routedAt`               TIMESTAMP NULL DEFAULT NULL,
  `routingNote`            TEXT NULL,

  -- مسار التنفيذ الخاص بهذا البند وحده (مباشر / شراء / خارجي)
  `maintenancePath`        ENUM('A','B','C') NULL,
  `justification`          TEXT NULL,
  `approvedById`           INT NULL,
  `approvedAt`             TIMESTAMP NULL DEFAULT NULL,

  -- حالة البند — نفس قائمة حالات البلاغ حرفيًا (tickets.status) حتى
  -- يمكن نسخ حالة البلاغ القديم كما هي بلا تحويل، وحتى يبقى منطق
  -- الاشتقاق في shared/pathBPurchaseWorkflow.ts صالحًا كما هو.
  `status`                 ENUM(
                             'new','pending_triage','under_inspection','work_approved',
                             'ready_for_closure','approved','assigned','in_progress',
                             'needs_purchase','purchase_pending_estimate',
                             'purchase_pending_accounting','purchase_pending_management',
                             'purchase_approved','partial_purchase','purchased',
                             'received_warehouse','out_for_repair','repaired',
                             'verified','closed','requester_confirmed'
                           ) NOT NULL DEFAULT 'pending_triage',

  -- التنفيذ الفعلي لهذا البند
  `assignedToId`           INT NULL,
  `assignedTechnicianId`   INT NULL,
  `assignedAt`             TIMESTAMP NULL DEFAULT NULL,
  `repairNotes`            TEXT NULL,
  `afterPhotoUrl`          TEXT NULL,
  `materialsUsed`          TEXT NULL,
  `estimatedCost`          DECIMAL(12,2) NULL,
  `actualCost`             DECIMAL(12,2) NULL,
  `closedAt`               TIMESTAMP NULL DEFAULT NULL,

  -- علامة السجلات المُرحَّلة تلقائيًا من بلاغات ما قبل هذه الميزة.
  -- تُميّز "بند أُنشئ بالترحيل" عن "بند أنشأه المستخدم فعلًا".
  `isLegacySingleItem`     TINYINT NOT NULL DEFAULT 0,

  `createdById`            INT NULL,
  `createdAt`              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ticket_items_ticket`
    FOREIGN KEY (`ticketId`) REFERENCES `tickets` (`id`) ON DELETE RESTRICT
);

-- بند واحد فقط بكل رقم داخل نفس البلاغ (يمنع تكرار "المهمة رقم 2" مرتين)
CREATE UNIQUE INDEX `uq_ticket_items_ticket_number`
  ON `ticket_items` (`ticketId`, `itemNumber`);

CREATE INDEX `idx_ticket_items_ticket`
  ON `ticket_items` (`ticketId`);

CREATE INDEX `idx_ticket_items_status`
  ON `ticket_items` (`status`);

CREATE INDEX `idx_ticket_items_department`
  ON `ticket_items` (`responsibleDepartment`);

CREATE INDEX `idx_ticket_items_manager`
  ON `ticket_items` (`responsibleManagerId`);

CREATE INDEX `idx_ticket_items_assigned`
  ON `ticket_items` (`assignedToId`);

-- ============================================================
-- ترحيل البلاغات القائمة: كل بلاغ يصبح "بلاغ ببند واحد"
--
-- WHERE NOT EXISTS: الترحيل قابل لإعادة التشغيل بأمان (idempotent)،
-- ولا يُنشئ بندًا ثانيًا لبلاغ سبق ترحيله.
-- ============================================================
INSERT INTO `ticket_items` (
  `ticketId`, `itemNumber`, `title`, `description`,
  `description_ar`, `description_en`, `description_ur`,
  `assetId`,
  `responsibleDepartment`, `responsibleManagerId`, `routedById`, `routedAt`, `routingNote`,
  `maintenancePath`, `justification`, `approvedById`,
  `status`,
  `assignedToId`, `assignedTechnicianId`, `assignedAt`,
  `repairNotes`, `afterPhotoUrl`, `materialsUsed`,
  `estimatedCost`, `actualCost`, `closedAt`,
  `isLegacySingleItem`, `createdById`, `createdAt`
)
SELECT
  t.`id`, 1, t.`title`, t.`description`,
  t.`description_ar`, t.`description_en`, t.`description_ur`,
  t.`assetId`,
  t.`maintenanceResponsibleDepartment`, t.`maintenanceResponsibleManagerId`,
  t.`maintenanceRoutedById`, t.`maintenanceRoutedAt`, t.`maintenanceRoutingNote`,
  t.`maintenancePath`, t.`justification`, t.`approvedById`,
  t.`status`,
  t.`assignedToId`, t.`assignedTechnicianId`, t.`assignedAt`,
  t.`repairNotes`, t.`afterPhotoUrl`, t.`materialsUsed`,
  t.`estimatedCost`, t.`actualCost`, t.`closedAt`,
  1, t.`reportedById`, t.`createdAt`
FROM `tickets` t
WHERE NOT EXISTS (
  SELECT 1 FROM `ticket_items` ti WHERE ti.`ticketId` = t.`id`
);

-- ============================================================
-- التراجع (Rollback) — عند الحاجة فقط، وبعد التأكد من عدم وجود أي
-- بند أنشأه المستخدم فعلًا (isLegacySingleItem = 0):
--
--   SELECT COUNT(*) FROM ticket_items WHERE isLegacySingleItem = 0;
--   -- يجب أن تكون النتيجة 0 قبل التراجع، وإلا ستُفقد بيانات حقيقية
--
--   DROP TABLE `ticket_items`;
-- ============================================================
