-- Read-only. Expected: zero rows. STOP if any proposed table already exists.
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN (
  'maintenance_teams',
  'maintenance_team_members',
  'ticket_team_assignments',
  'ticket_team_actions',
  'ticket_team_material_needs',
  'ticket_team_supply_links',
  'ticket_team_delivery_links',
  'ticket_team_return_links',
  'ticket_team_operations'
  );

