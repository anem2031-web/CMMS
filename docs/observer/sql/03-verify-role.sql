-- 03: Run manually after adding observer (if ALTER was needed).
SHOW FULL COLUMNS FROM users LIKE 'role';
-- Verify existing accounts/roles remain; contains no credentials.
SELECT role, COUNT(*) AS accounts FROM users GROUP BY role ORDER BY role;
-- Afterwards, create or assign an Observer account through the existing admin UI.
