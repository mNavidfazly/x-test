-- =============================================================================
-- Migration 00038: Add estimated_duration_minutes to modules
-- =============================================================================
-- Every module gets a required time estimation field (in minutes).
-- Existing modules default to 15 minutes. Content editors should update these.
-- No new RLS policies needed — existing module policies cover this column.
-- =============================================================================

ALTER TABLE modules
  ADD COLUMN estimated_duration_minutes INTEGER NOT NULL DEFAULT 15;

COMMENT ON COLUMN modules.estimated_duration_minutes IS
  'Estimated time to complete this module, in minutes.';
