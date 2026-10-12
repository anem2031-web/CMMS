-- Read-only. Expected: exactly nine rows. This verifies structure, not runtime integration.
SELECT TABLE_NAME, ENGINE, TABLE_COLLATION
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
  )
ORDER BY TABLE_NAME;

