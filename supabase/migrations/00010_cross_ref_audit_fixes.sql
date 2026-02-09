-- ============================================================================
-- X-Courses v2 - Migration 00010: Cross-Reference Audit Fixes
-- ============================================================================
-- Addresses findings from docs/CROSS_REFERENCE_AUDIT.md.
-- Fixes: C1 (quiz base table exposure), C2 (course-files storage leak),
--        I1 (completion bypass), I2 (internal_notes exposure),
--        I5 (tenant_courses orphaned data), time-limit enforcement.
-- ============================================================================


-- ============================================================================
-- FIX 1: C1 — QUIZ ANSWERS EXPOSED VIA BASE TABLES (CRITICAL)
-- ============================================================================
-- Problem: quiz_questions_select_tenant and quiz_options_select_tenant grant
-- SELECT on all columns (including correct_answer and is_correct) to any
-- tenant user. The safe views from 00009 are additive, not restrictive.
--
-- Fix: DROP the tenant SELECT policies. Learners use safe views (already
-- GRANTed to authenticated in 00009). SECURITY DEFINER functions
-- (grade_quiz_attempt, get_quiz_results) bypass RLS and still work.
-- Platform admin and lecturer SELECT policies remain untouched.

DROP POLICY "quiz_questions_select_tenant" ON quiz_questions;
DROP POLICY "quiz_options_select_tenant" ON quiz_question_options;


-- ============================================================================
-- FIX 2: C2 — COURSE-FILES STORAGE CROSS-TENANT LEAK (CRITICAL)
-- ============================================================================
-- Problem: course_files_select_authenticated only checks auth.uid() IS NOT NULL.
-- Any authenticated user from any tenant can read all course files.
--
-- Fix: Path convention {course_id}/filename. Replace the permissive SELECT with
-- 4 role-specific policies. Update INSERT/UPDATE/DELETE to enforce path convention.

-- --------------------------------------------------------------------------
-- 2A. Replace SELECT policy with role-specific versions
-- --------------------------------------------------------------------------

DROP POLICY "course_files_select_authenticated" ON storage.objects;

-- Tenant users: can only read files for courses assigned to their tenant
CREATE POLICY "course_files_select_tenant" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'course-files'
    AND EXISTS (
      SELECT 1 FROM tenant_courses tc
      WHERE tc.course_id = (storage.foldername(name))[1]::uuid
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

-- Platform admins: can read all course files
CREATE POLICY "course_files_select_platform_admin" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'course-files'
    AND public.jwt_claim('is_platform_admin') = 'true'
  );

-- Lecturers: can read files for their assigned courses
CREATE POLICY "course_files_select_lecturer" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'course-files'
    AND (storage.foldername(name))[1] = ANY(
      public.jwt_claim_array('lecturer_course_ids')
    )
  );

-- CSMs: can read files for courses assigned to their tenants
CREATE POLICY "course_files_select_csm" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'course-files'
    AND EXISTS (
      SELECT 1 FROM tenant_courses tc
      WHERE tc.course_id = (storage.foldername(name))[1]::uuid
        AND tc.tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 2B. Update INSERT policy to enforce path convention
-- --------------------------------------------------------------------------

DROP POLICY "course_files_insert_admin" ON storage.objects;

CREATE POLICY "course_files_insert_admin" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'course-files'
    AND (
      public.jwt_claim('is_platform_admin') = 'true'
      OR (storage.foldername(name))[1] = ANY(
        public.jwt_claim_array('lecturer_can_edit_course_ids')
      )
    )
  );

-- --------------------------------------------------------------------------
-- 2C. Update UPDATE policy for consistency
-- --------------------------------------------------------------------------

DROP POLICY "course_files_update_admin" ON storage.objects;

CREATE POLICY "course_files_update_admin" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'course-files'
    AND (
      public.jwt_claim('is_platform_admin') = 'true'
      OR (storage.foldername(name))[1] = ANY(
        public.jwt_claim_array('lecturer_can_edit_course_ids')
      )
    )
  );

-- --------------------------------------------------------------------------
-- 2D. Update DELETE policy for consistency
-- --------------------------------------------------------------------------

DROP POLICY "course_files_delete_admin" ON storage.objects;

CREATE POLICY "course_files_delete_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'course-files'
    AND (
      public.jwt_claim('is_platform_admin') = 'true'
      OR (storage.foldername(name))[1] = ANY(
        public.jwt_claim_array('lecturer_can_edit_course_ids')
      )
    )
  );


-- ============================================================================
-- FIX 3: I1 — MANUAL COMPLETION BYPASS FOR QUIZ/EXAM MODULES
-- ============================================================================
-- Problem: Learners can INSERT user_progress with status = 'completed' for
-- quiz or exam modules without actually passing.
--
-- Fix: BEFORE INSERT OR UPDATE trigger that validates:
-- - video/pdf/markdown: no restriction (user self-marks)
-- - quiz: requires quiz_attempts.passed = true for that user+quiz
-- - exam: requires graded exam_submissions with score >= passing_score
-- - marked_by = 'admin': bypasses check (admin override)

CREATE OR REPLACE FUNCTION enforce_quiz_exam_completion()
RETURNS TRIGGER AS $$
DECLARE
  _module_type module_type;
  _has_passing boolean;
BEGIN
  -- Only enforce when status is being set to 'completed'
  IF NEW.status != 'completed' THEN
    RETURN NEW;
  END IF;

  -- Allow admin overrides
  IF NEW.marked_by = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Look up the module type
  SELECT m.module_type INTO _module_type
  FROM modules m
  WHERE m.id = NEW.module_id;

  -- If module not found, let the FK constraint handle it
  IF _module_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- For video, pdf, markdown: no restriction (user self-marks)
  IF _module_type IN ('video', 'pdf', 'markdown') THEN
    RETURN NEW;
  END IF;

  -- For quiz modules: check for a passing quiz_attempt
  IF _module_type = 'quiz' THEN
    SELECT EXISTS (
      SELECT 1 FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      WHERE q.module_id = NEW.module_id
        AND qa.user_id = NEW.user_id
        AND qa.passed = true
    ) INTO _has_passing;

    IF NOT _has_passing THEN
      RAISE EXCEPTION 'Cannot mark quiz module as completed without a passing quiz attempt';
    END IF;

    RETURN NEW;
  END IF;

  -- For exam modules: check for a graded+passing exam_submission
  IF _module_type = 'exam' THEN
    SELECT EXISTS (
      SELECT 1 FROM exam_submissions es
      JOIN exams e ON e.id = es.exam_id
      WHERE e.module_id = NEW.module_id
        AND es.user_id = NEW.user_id
        AND es.score IS NOT NULL
        AND es.score >= e.passing_score
    ) INTO _has_passing;

    IF NOT _has_passing THEN
      RAISE EXCEPTION 'Cannot mark exam module as completed without a passing graded exam submission';
    END IF;

    RETURN NEW;
  END IF;

  -- Unknown module type: allow (future-proof)
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_quiz_exam_progress
  BEFORE INSERT OR UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION enforce_quiz_exam_completion();


-- ============================================================================
-- FIX 4: I2 — INTERNAL NOTES EXPOSED TO ISSUE REPORTERS
-- ============================================================================
-- Problem: internal_notes column on issues is visible to learners and tenant
-- admins via issues_select_own and issues_select_tenant_admin policies.
-- RLS is row-level, not column-level.
--
-- Fix: Create issues_safe view (excludes internal_notes) with built-in row
-- filtering for learners (own issues) and tenant admins (tenant issues).
-- DROP those two base table SELECT policies. CSM, Lecturer, Platform Admin
-- retain base table access (they are Calypso staff who should see internal_notes).

CREATE VIEW issues_safe AS
  SELECT
    id, user_id, tenant_id, course_id, module_id,
    issue_type, description, status,
    resolved_at, resolved_by,
    created_at, updated_at
    -- internal_notes deliberately excluded
  FROM issues
  WHERE
    -- Learner: own issues only
    user_id = auth.uid()
    -- Tenant admin: all issues in their tenant
    OR (
      tenant_id = public.jwt_claim('tenant_id')::uuid
      AND public.jwt_claim('is_tenant_admin') = 'true'
    );

GRANT SELECT ON issues_safe TO authenticated;

-- Drop learner and tenant admin SELECT from base table.
-- They now read through the safe view.
-- CSM, Lecturer, Platform Admin policies remain (they see internal_notes).
DROP POLICY "issues_select_own" ON issues;
DROP POLICY "issues_select_tenant_admin" ON issues;


-- ============================================================================
-- FIX 5: I5 — ORPHANED DATA ON TENANT-COURSES DELETION
-- ============================================================================
-- Problem: DELETE from tenant_courses (unassigning a course from a tenant)
-- leaves orphaned course_enrollments and user_progress rows. No FK exists
-- between these tables and tenant_courses.
--
-- Fix: AFTER DELETE trigger that cleans up enrollments and progress for the
-- affected (tenant_id, course_id) pair. Historical records (quiz_attempts,
-- exam_submissions, comments, issues) preserved for audit purposes.

CREATE OR REPLACE FUNCTION cleanup_tenant_course_removal()
RETURNS TRIGGER AS $$
BEGIN
  -- Remove enrollments for this tenant+course pair
  DELETE FROM course_enrollments
  WHERE tenant_id = OLD.tenant_id
    AND course_id = OLD.course_id;

  -- Remove progress for this tenant+course pair
  DELETE FROM user_progress
  WHERE tenant_id = OLD.tenant_id
    AND course_id = OLD.course_id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_tenant_course_removal
  AFTER DELETE ON tenant_courses
  FOR EACH ROW EXECUTE FUNCTION cleanup_tenant_course_removal();


-- ============================================================================
-- FIX 6: TIME-LIMIT ENFORCEMENT IN grade_quiz_attempt()
-- ============================================================================
-- Problem: No DB-level check prevents grading a quiz after the time limit
-- has expired. A user can bypass the frontend timer.
--
-- Fix: Redefine grade_quiz_attempt() with a time-limit check after fetching
-- the quiz. If time_limit is set and elapsed time exceeds it, reject grading.

CREATE OR REPLACE FUNCTION grade_quiz_attempt(p_attempt_id uuid)
RETURNS jsonb AS $$
DECLARE
  _attempt record;
  _total_points numeric := 0;
  _earned_points numeric := 0;
  _question record;
  _user_answer text;
  _correct boolean;
  _score numeric;
  _passed boolean;
BEGIN
  -- Verify attempt belongs to caller and hasn't been graded yet
  SELECT qa.*, q.passing_score, q.time_limit, q.id AS quiz_id_val
  INTO _attempt
  FROM quiz_attempts qa
  JOIN quizzes q ON q.id = qa.quiz_id
  WHERE qa.id = p_attempt_id
    AND qa.user_id = auth.uid();

  IF _attempt IS NULL THEN
    RAISE EXCEPTION 'Attempt not found or does not belong to you';
  END IF;

  IF _attempt.score IS NOT NULL THEN
    RAISE EXCEPTION 'Attempt has already been graded';
  END IF;

  IF _attempt.submitted_at IS NULL THEN
    RAISE EXCEPTION 'Attempt has not been submitted yet';
  END IF;

  -- *** NEW: Time-limit enforcement ***
  IF _attempt.time_limit IS NOT NULL THEN
    IF (now() - _attempt.started_at) > (_attempt.time_limit * interval '1 minute') THEN
      RAISE EXCEPTION 'Quiz time limit exceeded';
    END IF;
  END IF;

  -- Grade each question
  FOR _question IN
    SELECT qq.id, qq.question_type, qq.correct_answer, qq.points
    FROM quiz_questions qq
    WHERE qq.quiz_id = _attempt.quiz_id
  LOOP
    _total_points := _total_points + _question.points;
    _correct := false;

    -- Get user's answer
    SELECT qaa.user_answer INTO _user_answer
    FROM quiz_attempt_answers qaa
    WHERE qaa.attempt_id = p_attempt_id
      AND qaa.question_id = _question.id;

    CASE _question.question_type
      WHEN 'single_choice', 'true_false' THEN
        IF _user_answer IS NOT NULL THEN
          SELECT qo.is_correct INTO _correct
          FROM quiz_question_options qo
          WHERE qo.id = _user_answer::uuid;
        END IF;

      WHEN 'multiple_choice' THEN
        IF _user_answer IS NOT NULL THEN
          _correct := (
            SELECT
              (SELECT array_agg(x ORDER BY x) FROM unnest(string_to_array(_user_answer, ',')::uuid[]) x) =
              (SELECT array_agg(qo.id ORDER BY qo.id) FROM quiz_question_options qo
               WHERE qo.question_id = _question.id AND qo.is_correct = true)
          );
        END IF;

      WHEN 'fill_blank', 'short_answer' THEN
        IF _user_answer IS NOT NULL AND _question.correct_answer IS NOT NULL THEN
          _correct := lower(trim(_user_answer)) = lower(trim(_question.correct_answer));
        END IF;

      WHEN 'matching' THEN
        IF _user_answer IS NOT NULL AND _question.correct_answer IS NOT NULL THEN
          _correct := _user_answer::jsonb = _question.correct_answer::jsonb;
        END IF;

      ELSE
        _correct := false;
    END CASE;

    IF _correct THEN
      _earned_points := _earned_points + _question.points;
    END IF;
  END LOOP;

  -- Calculate percentage score
  IF _total_points > 0 THEN
    _score := round((_earned_points / _total_points) * 100, 2);
  ELSE
    _score := 0;
  END IF;

  _passed := _score >= _attempt.passing_score;

  -- Update the attempt
  UPDATE quiz_attempts
  SET score = _score, passed = _passed
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'score', _score,
    'passed', _passed,
    'earned_points', _earned_points,
    'total_points', _total_points
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
