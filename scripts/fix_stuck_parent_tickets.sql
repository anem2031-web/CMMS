-- ============================================================
-- تصحيح البلاغات الرئيسية العالقة (department_tasks) بعد إضافة closeParentTicket
-- التنفيذ: بعد نشر الكود الجديد، وبعد أخذ نسخة احتياطية.
-- ============================================================

-- (1) معاينة قبل أي تعديل — نفّذ هذا أولًا وتأكد من الصفوف
SELECT p.id, p.ticketNumber, p.status, COUNT(c.id) AS children,
       SUM(c.status IN ('closed','requester_confirmed')) AS finished
FROM tickets p
JOIN tickets c ON c.parentTicketId = p.id AND c.workflowModel = 'sub_ticket'
WHERE p.workflowModel = 'department_tasks'
  AND p.status NOT IN ('closed','requester_confirmed')
GROUP BY p.id, p.ticketNumber, p.status
HAVING finished = children;

-- ⚠️ الأفضل: بدل التنفيذ اليدوي أدناه، افتح كل بلاغ ظهر أعلاه من الواجهة
-- واضغط "إغلاق البلاغ الرئيسي" — فيُسجَّل من أغلقه في سجل التدقيق والحالات.
-- استخدم ما بعده فقط إذا أردت تصحيحًا جماعيًا صامتًا.

-- (2) إغلاق الرؤوس المكتملة  (بدّل 1 برقم مستخدم الإغلاق الفعلي)
SET @actor := 1;

CREATE TEMPORARY TABLE tmp_closable_parents AS
SELECT p.id
FROM tickets p
JOIN tickets c ON c.parentTicketId = p.id AND c.workflowModel = 'sub_ticket'
WHERE p.workflowModel = 'department_tasks'
  AND p.status NOT IN ('closed','requester_confirmed')
GROUP BY p.id
HAVING COUNT(c.id) = SUM(c.status IN ('closed','requester_confirmed'));

INSERT INTO ticket_status_history (ticketId, fromStatus, toStatus, changedById, notes, createdAt)
SELECT t.id, t.status, 'closed', @actor,
       'تصحيح إداري: إغلاق بلاغ رئيسي كانت كل فروعه منتهية قبل إتاحة زر الإغلاق', NOW()
FROM tickets t JOIN tmp_closable_parents x ON x.id = t.id;

UPDATE tickets t JOIN tmp_closable_parents x ON x.id = t.id
SET t.status = 'closed', t.closedAt = NOW();

UPDATE ticket_items i JOIN tmp_closable_parents x ON x.id = i.ticketId
SET i.status = 'closed', i.closedAt = NOW()
WHERE i.status NOT IN ('closed','verified','requester_confirmed');

UPDATE ticket_departments d JOIN tmp_closable_parents x ON x.id = d.ticketId
SET d.status = 'completed' WHERE d.status <> 'completed';

UPDATE ticket_tasks tk JOIN tmp_closable_parents x ON x.id = tk.ticketId
SET tk.status = 'completed' WHERE tk.status = 'promoted';

DROP TEMPORARY TABLE tmp_closable_parents;

-- (3) تحقق بعد التنفيذ
SELECT id, ticketNumber, status, closedAt FROM tickets
WHERE workflowModel = 'department_tasks' ORDER BY id;
