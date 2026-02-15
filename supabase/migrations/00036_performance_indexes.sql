-- Migration 00036: Performance Indexes
-- Adds missing indexes identified during Phase 10C RLS query audit

-- CRITICAL: Used in ext_quiz_results_select_lecturer RLS policy + auto_mark_external_quiz trigger (00030)
-- Currently causes sequential scan on external_quiz_references for lecturer reads
CREATE INDEX IF NOT EXISTS idx_ext_quiz_refs_external_quiz_id
  ON external_quiz_references (external_quiz_id);

-- MODERATE: Used in 3 RLS policies (profiles_select_lecturer, reminder_history_insert/select_lecturer)
-- Existing indexes have wrong column order: (user_id, tenant_id) and (tenant_id, course_id)
-- This covers the (user_id, course_id) pattern used by lecturer access checks
CREATE INDEX IF NOT EXISTS idx_enrollments_user_course
  ON course_enrollments (user_id, course_id);

-- LOW: module_files is the only subtable without an index on module_id
-- All other subtables (module_videos, module_pdfs, module_markdown, quizzes, exams, external_quiz_references)
-- have UNIQUE on module_id which serves as an index
CREATE INDEX IF NOT EXISTS idx_module_files_module_id
  ON module_files (module_id);

-- LOW: "My issues" page filters by user_id via issues_select_own RLS policy
-- Existing indexes: idx_issues_tenant (tenant_id), idx_issues_course (course_id) — no user_id
CREATE INDEX IF NOT EXISTS idx_issues_user_id
  ON issues (user_id);

-- LOW: "Own comment" UPDATE/DELETE policies filter by user_id
-- Existing index: idx_comments_tenant_module (tenant_id, module_id) — no user_id
CREATE INDEX IF NOT EXISTS idx_comments_user_id
  ON comments (user_id);
