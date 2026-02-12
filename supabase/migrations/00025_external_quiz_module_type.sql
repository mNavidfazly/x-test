-- Phase 3E: Add 'external_quiz' to the module_type enum.
-- The external_quiz_references table already exists (migration 00002)
-- with RLS policies (migration 00004).
ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'external_quiz';
