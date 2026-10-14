-- 02: Run manually. This SELECT prints a proposed ALTER; it DOES NOT execute it.
-- Existing role values, nullability, default, collation and comment are preserved.
SELECT
  COLUMN_TYPE AS current_type,
  CASE
    WHEN DATA_TYPE = 'enum' AND LOCATE('''observer''', COLUMN_TYPE) > 0
      THEN 'observer already exists; no ALTER required'
    WHEN DATA_TYPE IN ('varchar','text')
      THEN 'string role column; no enum ALTER required'
    WHEN DATA_TYPE = 'enum' AND EXTRA = ''
      THEN CONCAT(
        'ALTER TABLE `users` MODIFY COLUMN `role` ',
        LEFT(COLUMN_TYPE, CHAR_LENGTH(COLUMN_TYPE) - 1), ',''observer'')',
        IF(CHARACTER_SET_NAME IS NULL, '', CONCAT(' CHARACTER SET ', CHARACTER_SET_NAME)),
        IF(COLLATION_NAME IS NULL, '', CONCAT(' COLLATE ', COLLATION_NAME)),
        IF(IS_NULLABLE = 'YES', ' NULL', ' NOT NULL'),
        IF(COLUMN_DEFAULT IS NULL, IF(IS_NULLABLE = 'YES', ' DEFAULT NULL', ''), CONCAT(' DEFAULT ', QUOTE(COLUMN_DEFAULT))),
        ' COMMENT ', QUOTE(COLUMN_COMMENT), ';'
      )
    ELSE 'unsupported role definition; send this result for review before changing anything'
  END AS next_command
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role';
-- Copy only the ALTER printed in next_command and run it manually if produced.
-- No UPDATE to existing users, no renaming of roles, no DROP and no backfill.
