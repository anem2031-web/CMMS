-- MANUAL ONLY. Purpose: distinguish new fully tracked ideas from all existing ideas.
-- Requires the existing improvement workflow v3 columns; inspect them first.
-- Existing ideas retain 0. Only newly created ideas use 1. No historical backfill.
ALTER TABLE improvement_ideas ADD COLUMN executionTrackingVersion TINYINT NOT NULL DEFAULT 0;
