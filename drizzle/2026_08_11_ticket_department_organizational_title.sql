-- 2026-08-11 — عنوان تنظيمي مستقل لجهة الإنشاءات في البلاغ متعدد الجهات.
-- TiDB: نفّذ العبارة منفردة على قاعدة البيانات المشتركة قبل تشغيل الكود المعدّل.

ALTER TABLE `ticket_departments`
  ADD COLUMN `organizationalTitle` VARCHAR(300) NULL AFTER `routingNote`;
