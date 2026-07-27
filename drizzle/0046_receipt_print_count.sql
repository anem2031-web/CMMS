-- ============================================================
-- 0046_receipt_print_count.sql
-- إغلاق فجوة: سند الاستلام (RCV) لم يكن له مستند طباعة رسمي.
-- إضافة عدّاد طباعة لسند الاستلام، بنفس نمط باقي المستندات
-- (delivery_documents.printCount / return_documents.printCount)
-- ============================================================

ALTER TABLE `warehouse_receipts`
  ADD COLUMN `printCount` int NOT NULL DEFAULT 0 COMMENT 'عدد مرات طباعة مستند سند استلام المشتريات';
