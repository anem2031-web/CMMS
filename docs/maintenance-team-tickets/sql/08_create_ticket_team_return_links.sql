-- MANUAL EXECUTION ONLY. Purpose: تسجيل تأكيد المستودع للمرتجع وربطه بالسند الأصلي وسند المرتجع القائم
CREATE TABLE ticket_team_return_links (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  deliveryLinkId INT NOT NULL,
  sourceDeliveryDocumentId INT NOT NULL,
  warehouseReturnId INT NOT NULL,
  returnNumber VARCHAR(100) NOT NULL,
  quantity INT NOT NULL,
  actorId INT NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ticket_team_return_source (warehouseReturnId),
  KEY idx_ticket_team_return_delivery (deliveryLinkId),
  CONSTRAINT fk_mtt_return_delivery FOREIGN KEY (deliveryLinkId) REFERENCES ticket_team_delivery_links(id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

