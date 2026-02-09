-- ============================================================================
-- X-Courses v2 - Migration 00001: Extensions, Types & Helper Functions
-- ============================================================================
-- Extensions (uuid-ossp, pgcrypto), 10 custom enum types, and JWT helper
-- functions needed before RLS policies.
-- ============================================================================

-- ============================================================================
-- SECTION 0: EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- pg_cron must be enabled via Supabase dashboard (Database > Extensions)
-- CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ============================================================================
-- SECTION 1: CUSTOM ENUM TYPES
-- ============================================================================

CREATE TYPE module_type AS ENUM ('video', 'pdf', 'markdown', 'quiz', 'exam');

CREATE TYPE enrollment_type AS ENUM ('invite_only', 'password_protected', 'open');

CREATE TYPE progress_status AS ENUM ('not_started', 'in_progress', 'completed');

CREATE TYPE marked_by_type AS ENUM ('user', 'system', 'admin');

CREATE TYPE expert_question_status AS ENUM ('pending', 'answered', 'closed');

CREATE TYPE issue_type AS ENUM ('content_error', 'technical', 'accessibility', 'other');

CREATE TYPE issue_status AS ENUM ('open', 'investigating', 'resolved', 'closed');

CREATE TYPE notification_type AS ENUM (
  'course_assigned',
  'new_module',
  'progress_reset',
  'exam_graded',
  'question_answered',
  'reminder',
  'exam_deadline',
  'new_expert_question',
  'new_exam_submission',
  'new_issue',
  'content_staleness',
  'new_access_request'
);

CREATE TYPE access_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE quiz_question_type AS ENUM (
  'single_choice',
  'multiple_choice',
  'true_false',
  'fill_blank',
  'matching',
  'short_answer'
);

-- ============================================================================
-- SECTION 2: HELPER FUNCTIONS (needed before RLS policies)
-- ============================================================================

-- Extract a scalar claim from the JWT
CREATE OR REPLACE FUNCTION public.jwt_claim(claim text)
RETURNS text AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::json ->> claim,
    ''
  );
$$ LANGUAGE sql STABLE;

-- Extract an array claim from the JWT
CREATE OR REPLACE FUNCTION public.jwt_claim_array(claim text)
RETURNS text[] AS $$
  SELECT coalesce(
    array(
      SELECT jsonb_array_elements_text(
        coalesce(
          current_setting('request.jwt.claims', true)::jsonb -> claim,
          '[]'::jsonb
        )
      )
    ),
    '{}'::text[]
  );
$$ LANGUAGE sql STABLE;
