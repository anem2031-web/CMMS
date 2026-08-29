-- تجميد يدوي للأصناف القديمة (بدون Lot) — إخفاء بسيط من قائمة المخزون الرئيسية.
-- لا صلاحيات جديدة ولا شاشة إدارة: القيمة تُضبط يدوياً مباشرة في القاعدة عند الحاجة.
-- التفاصيل الكاملة والاستعلامات الجاهزة: docs/CMMS_INVENTORY_FROZEN_ITEMS_2026-08-29.md
ALTER TABLE inventory
  ADD COLUMN IF NOT EXISTS isFrozen TINYINT NOT NULL DEFAULT 0;
