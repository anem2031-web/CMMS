-- ============================================================
-- 0048_signature_snapshots.sql
-- إصلاح: التوقيع كان يُقرأ حيًّا من users.signatureUrl لحظة كل
-- طباعة، فأي استبدال لتوقيع مستخدم كان يغيّر شكل الوثائق القديمة
-- بأثر رجعي. الحل: تجميد التوقيع (snapshot) أول مرة تُصدر فيها
-- الوثيقة لكل طلب/دفعة، ثم يُقرأ من هذا التجميد دائمًا بعدها —
-- من الحالي للمستقبل فقط، بلا تعديل على أي وثيقة صادرة مسبقًا.
-- ============================================================

ALTER TABLE `purchase_orders`
  ADD COLUMN `requesterSignatureSnapshot` varchar(500) NULL COMMENT 'نسخة مجمَّدة من توقيع مقدّم الطلب لحظة أول إصدار للوثيقة',
  ADD COLUMN `reviewerSignatureSnapshot`  varchar(500) NULL COMMENT 'نسخة مجمَّدة من توقيع مراجع الطلب لحظة أول إصدار للوثيقة';

ALTER TABLE `po_pricing_batches`
  ADD COLUMN `delegateSignatureSnapshot` varchar(500) NULL COMMENT 'نسخة مجمَّدة من توقيع مستلم العهدة (المندوب) لحظة أول إصدار للوثيقة لهذه الدفعة';
