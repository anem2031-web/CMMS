-- Execute each statement separately on an existing installation.
-- Legacy codes 11, 711 and 712 are shared by different catalog nodes.

-- 1) Preflight: the result must not contain duplicate rows for the same entity.
SELECT `entityType`, `entityId`, `oldCode`, COUNT(*) AS `duplicateCount`
FROM `catalog_code_aliases`
GROUP BY `entityType`, `entityId`, `oldCode`
HAVING COUNT(*) > 1;

-- 2) Inspect the current index before changing it.
SHOW INDEX FROM `catalog_code_aliases`;

-- 3) Replace the old global historical-code uniqueness rule.
ALTER TABLE `catalog_code_aliases`
  DROP INDEX `uq_catalog_code_alias_entity_old`;

-- 4) Preserve uniqueness per actual entity while allowing ambiguous legacy codes.
ALTER TABLE `catalog_code_aliases`
  ADD UNIQUE KEY `uq_catalog_code_alias_entity_id_old` (`entityType`, `entityId`, `oldCode`);

-- 5) Verification: only uq_catalog_code_alias_entity_id_old should be unique
-- for aliases (besides PRIMARY).
SHOW INDEX FROM `catalog_code_aliases`;
