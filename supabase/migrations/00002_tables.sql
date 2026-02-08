-- ============================================================================
-- X-Course v2 - Migration 00002: Tables
-- ============================================================================
-- All 30 tables with constraints and foreign keys.
-- Organized into: Core, Shared Content, Assignment/Linking, Tenant-Scoped Data.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 3.1 Core: Tenants
-- --------------------------------------------------------------------------

CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  is_master   boolean NOT NULL DEFAULT false,
  domain      text UNIQUE,
  settings    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Enforce only one master tenant
CREATE UNIQUE INDEX idx_tenants_single_master
  ON tenants (is_master) WHERE is_master = true;

-- --------------------------------------------------------------------------
-- 3.2 Users: Profiles
-- --------------------------------------------------------------------------

CREATE TABLE profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  tenant_id         uuid NOT NULL REFERENCES tenants ON DELETE RESTRICT,
  email             text NOT NULL,
  full_name         text,
  avatar_url        text,
  is_tenant_admin   boolean NOT NULL DEFAULT false,
  is_platform_admin boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------------------------
-- 3.3 Shared Content Tables (no tenant_id)
-- --------------------------------------------------------------------------

CREATE TABLE courses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  thumbnail_url   text,
  enrollment_type enrollment_type NOT NULL DEFAULT 'invite_only',
  password_hash   text, -- for password_protected enrollment
  staleness_threshold_days integer DEFAULT 180, -- configurable per course
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES profiles ON DELETE SET NULL,
  updated_by      uuid REFERENCES profiles ON DELETE SET NULL
);

CREATE TABLE lectures (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES courses ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES profiles ON DELETE SET NULL,
  updated_by  uuid REFERENCES profiles ON DELETE SET NULL
);

CREATE TABLE modules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lecture_id            uuid NOT NULL REFERENCES lectures ON DELETE CASCADE,
  course_id             uuid NOT NULL REFERENCES courses ON DELETE CASCADE, -- denormalized for RLS performance
  title                 text NOT NULL,
  description           text,
  module_type           module_type NOT NULL,
  sort_order            integer NOT NULL DEFAULT 0,
  significant_update_at timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES profiles ON DELETE SET NULL,
  updated_by            uuid REFERENCES profiles ON DELETE SET NULL
);

CREATE TABLE module_videos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     uuid NOT NULL UNIQUE REFERENCES modules ON DELETE CASCADE,
  video_url     text NOT NULL,
  thumbnail_url text,
  duration      integer -- seconds
);

CREATE TABLE module_pdfs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   uuid NOT NULL UNIQUE REFERENCES modules ON DELETE CASCADE,
  file_url    text NOT NULL,
  file_name   text NOT NULL,
  page_count  integer
);

CREATE TABLE module_markdown (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL UNIQUE REFERENCES modules ON DELETE CASCADE,
  content   text NOT NULL
);

-- Multiple files per module (for markdown downloadable files)
CREATE TABLE module_files (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES modules ON DELETE CASCADE,
  file_url  text NOT NULL,
  file_name text NOT NULL,
  file_size bigint
);

CREATE TABLE quizzes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id             uuid NOT NULL UNIQUE REFERENCES modules ON DELETE CASCADE,
  title                 text NOT NULL,
  description           text,
  time_limit            integer, -- seconds, nullable = no limit
  passing_score         numeric NOT NULL,
  max_attempts          integer, -- nullable = unlimited
  show_correct_answers  boolean NOT NULL DEFAULT true,
  randomize_questions   boolean NOT NULL DEFAULT true,
  randomize_answers     boolean NOT NULL DEFAULT true
);

CREATE TABLE quiz_questions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         uuid NOT NULL REFERENCES quizzes ON DELETE CASCADE,
  question_text   text NOT NULL,
  question_type   quiz_question_type NOT NULL,
  points          numeric NOT NULL DEFAULT 1,
  correct_answer  text, -- for fill_blank, short_answer
  sort_order      integer NOT NULL DEFAULT 0
);

CREATE TABLE quiz_question_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES quiz_questions ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct  boolean NOT NULL DEFAULT false,
  sort_order  integer NOT NULL DEFAULT 0
);

CREATE TABLE exams (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id         uuid NOT NULL UNIQUE REFERENCES modules ON DELETE CASCADE,
  title             text NOT NULL,
  description       text,
  duration_minutes  integer NOT NULL,
  passing_score     numeric NOT NULL,
  max_file_size     bigint DEFAULT 52428800, -- 50MB default
  allowed_file_types text[] DEFAULT ARRAY['application/pdf', 'application/zip'],
  exam_file_url     text
);

CREATE TABLE external_quiz_references (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id         uuid NOT NULL UNIQUE REFERENCES modules ON DELETE CASCADE,
  external_quiz_id  text NOT NULL,
  external_quiz_url text NOT NULL,
  passing_score     numeric
);

-- --------------------------------------------------------------------------
-- 3.4 Assignment / Linking Tables
-- --------------------------------------------------------------------------

CREATE TABLE csm_tenant_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES profiles ON DELETE SET NULL,
  UNIQUE (user_id, tenant_id)
);

CREATE TABLE lecturer_course_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses ON DELETE CASCADE,
  can_edit    boolean NOT NULL DEFAULT false,
  can_grade   boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES profiles ON DELETE SET NULL,
  UNIQUE (user_id, course_id)
);

CREATE TABLE tenant_courses (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses ON DELETE CASCADE,
  UNIQUE (tenant_id, course_id)
);

-- --------------------------------------------------------------------------
-- 3.5 Tenant-Scoped Data Tables (have tenant_id)
-- --------------------------------------------------------------------------

CREATE TABLE course_enrollments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES courses ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, course_id)
);

CREATE TABLE user_progress (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  course_id    uuid NOT NULL REFERENCES courses ON DELETE CASCADE,
  lecture_id   uuid NOT NULL REFERENCES lectures ON DELETE CASCADE,
  module_id    uuid NOT NULL REFERENCES modules ON DELETE CASCADE,
  status       progress_status NOT NULL DEFAULT 'not_started',
  completed_at timestamptz,
  marked_by    marked_by_type,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, module_id)
);

CREATE TABLE comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  module_id  uuid NOT NULL REFERENCES modules ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE comment_replies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expert_questions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  course_id      uuid NOT NULL REFERENCES courses ON DELETE CASCADE,
  module_id      uuid REFERENCES modules ON DELETE SET NULL,
  question_text  text NOT NULL,
  status         expert_question_status NOT NULL DEFAULT 'pending',
  response_text  text,
  responded_by   uuid REFERENCES profiles ON DELETE SET NULL,
  responded_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE issues (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  course_id      uuid NOT NULL REFERENCES courses ON DELETE CASCADE,
  module_id      uuid REFERENCES modules ON DELETE SET NULL,
  issue_type     issue_type NOT NULL,
  description    text NOT NULL,
  status         issue_status NOT NULL DEFAULT 'open',
  internal_notes text,
  resolved_at    timestamptz,
  resolved_by    uuid REFERENCES profiles ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE quiz_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id       uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  quiz_id         uuid NOT NULL REFERENCES quizzes ON DELETE CASCADE,
  attempt_number  integer NOT NULL,
  started_at      timestamptz NOT NULL DEFAULT now(),
  submitted_at    timestamptz,
  score           numeric,
  passed          boolean,
  UNIQUE (user_id, tenant_id, quiz_id, attempt_number)
);

CREATE TABLE quiz_attempt_answers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id  uuid NOT NULL REFERENCES quiz_attempts ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES quiz_questions ON DELETE CASCADE,
  user_answer text
);

CREATE TABLE exam_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id    uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  exam_id      uuid NOT NULL REFERENCES exams ON DELETE CASCADE,
  course_id    uuid NOT NULL REFERENCES courses ON DELETE CASCADE,
  file_url     text NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  deadline     timestamptz NOT NULL,
  score        numeric,
  feedback     text,
  graded_by    uuid REFERENCES profiles ON DELETE SET NULL,
  graded_at    timestamptz,
  UNIQUE (user_id, exam_id)
);

CREATE TABLE external_quiz_results (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  external_quiz_id text NOT NULL,
  score            numeric,
  passed           boolean,
  completed_at     timestamptz,
  raw_response     jsonb
);

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  type       notification_type NOT NULL,
  title      text NOT NULL,
  body       text,
  data       jsonb NOT NULL DEFAULT '{}',
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reminder_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by    uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  sent_to    uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenants ON DELETE CASCADE,
  course_id  uuid REFERENCES courses ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE access_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  domain      text,
  tenant_id   uuid REFERENCES tenants ON DELETE SET NULL,
  status      access_request_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES profiles ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- SEED DATA: Master Tenant
-- ============================================================================
INSERT INTO tenants (name, is_master, domain)
VALUES ('Calypso', true, 'calypso-commodities.com');
