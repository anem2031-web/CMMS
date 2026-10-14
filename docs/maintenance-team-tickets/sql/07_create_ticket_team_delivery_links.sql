-- MANUAL EXECUTION ONLY. Purpose: حفظ سندات الصرف الأصلية؛ استخدامها النهائي يتحدد بعد توزيع المستودع للمرتجع، دون ترحيل مخزون مستقل
CREATE TABLE ticket_team_delivery_links (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  needId INT NOT NULL,
  deliveryDocumentId INT NOT NULL,
  deliveryNumber VARCHAR(100) NOT NULL,
  lotId INT NOT NULL,
  inventoryTransactionId INT NOT NULL,
  issuedQuantity INT NOT NULL,
  receivedById INT NOT NULL,
  usedQuantity INT NULL,
  returnedQuantity INT NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ticket_team_delivery_source (deliveryDocumentId),
  CONSTRAINT fk_mtt_delivery_need FOREIGN KEY (needId) REFERENCES ticket_team_material_needs(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

