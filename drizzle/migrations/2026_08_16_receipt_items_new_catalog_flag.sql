-- 2B-4 — حفظ قرار "صنف جديد" مع سطر استلام الفاتورة.
-- لا ينشئ Catalog Item ولا Candidate؛ 2B-5 ستبني مسار المراجعة غير المعطل.
ALTER TABLE warehouse_receipt_items
  ADD COLUMN isNewCatalogItem TINYINT NOT NULL DEFAULT 0 AFTER itemName_en;
