-- المرحلة 2A: توحيد دقة كميات المخزون إلى ثلاث منازل عشرية.
-- لا يغير Workflow ولا أسماء الأصناف ولا القيم؛ يحوّل الأعمدة الأساسية فقط من INT إلى DECIMAL(12,3).
-- TiDB يدعم ALTER TABLE ... MODIFY COLUMN لتغيير نوع وخصائص العمود.

ALTER TABLE `inventory`
  MODIFY COLUMN `quantity` DECIMAL(12,3) NOT NULL DEFAULT 0;

ALTER TABLE `inventory`
  MODIFY COLUMN `minQuantity` DECIMAL(12,3) NULL DEFAULT 0;

ALTER TABLE `inventory_transactions`
  MODIFY COLUMN `quantity` DECIMAL(12,3) NOT NULL;
