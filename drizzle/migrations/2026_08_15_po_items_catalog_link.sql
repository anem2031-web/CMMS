-- المرحلة 2B-1: حفظ هوية صنف الكتالوج على بند طلب الشراء.
-- Nullable للحفاظ على مسار الإدخال اليدوي الحالي.
-- لا يتم إضافة FK في هذه الخطوة؛ تقوية القيود المركزية مؤجلة إلى 2B-10 بعد مراجعة البيانات.
ALTER TABLE purchase_order_items
  ADD COLUMN catalogItemId INT NULL AFTER purchaseOrderId;

CREATE INDEX idx_poi_catalogItemId
  ON purchase_order_items (catalogItemId);
