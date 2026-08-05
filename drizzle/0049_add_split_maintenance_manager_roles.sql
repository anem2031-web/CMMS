-- Split the legacy maintenance_manager role into two derived operational roles.
-- Existing maintenance_manager users are not changed automatically.
ALTER TABLE `users` MODIFY COLUMN `role` enum(
  'user',
  'admin',
  'operator',
  'technician',
  'maintenance_manager',
  'general_maintenance_manager',
  'construction_procurement_manager',
  'supervisor',
  'purchase_manager',
  'purchase_requester',
  'delegate',
  'accountant',
  'senior_management',
  'executive_director',
  'warehouse',
  'gate_security',
  'owner',
  'food_warehouse_manager',
  'food_warehouse_assistant'
) NOT NULL DEFAULT 'user';
