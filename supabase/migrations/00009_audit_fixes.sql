-- ============================================================================
-- X-Course v2 - Migration 00009: Audit Fixes
-- ============================================================================
-- Addresses findings from docs/SQL_AUDIT.md deep assessments (Sections 8-9).
-- Creates: safe views, RPC functions, CHECK constraints, indexes, triggers.
-- Modifies: 10 notification triggers, 4 RLS policies, 1 storage policy.
-- ============================================================================

-- ============================================================================
-- SECTION 1: QUIZ ANSWER EXPOSURE FIX (Audit Section 8A — CRITICAL)
-- ============================================================================
-- Problem: quiz_questions.correct_answer and quiz_question_options.is_correct
-- are readable by any tenant user via direct Supabase queries.
-- Fix: Safe views for learners, server-side grading RPC, score tamper protection.

-- --------------------------------------------------------------------------
-- 1A. Safe views (strip answer columns for learner-facing queries)
-- --------------------------------------------------------------------------

CREATE VIEW quiz_questions_safe AS
  SELECT id, quiz_id, question_text, question_type, points, sort_order
  FROM quiz_questions;

CREATE VIEW quiz_question_options_safe AS
  SELECT id, question_id, option_text, sort_order
  FROM quiz_question_options;

GRANT SELECT ON quiz_questions_safe TO authenticated;
GRANT SELECT ON quiz_question_options_safe TO authenticated;

-- --------------------------------------------------------------------------
-- 1B. Server-side auto-grading function
-- --------------------------------------------------------------------------
-- Replaces client-side grading. Calculates score from quiz_attempt_answers
-- vs correct answers, sets quiz_attempts.score and .passed.

CREATE OR REPLACE FUNCTION grade_quiz_attempt(p_attempt_id uuid)
RETURNS jsonb AS $$
DECLARE
  _attempt record;
  _quiz record;
  _total_points numeric := 0;
  _earned_points numeric := 0;
  _question record;
  _user_answer text;
  _correct boolean;
  _score numeric;
  _passed boolean;
BEGIN
  -- Verify attempt belongs to caller and hasn't been graded yet
  SELECT qa.*, q.passing_score, q.id AS quiz_id_val
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
        -- User answer is the option_id; check if that option is_correct
        IF _user_answer IS NOT NULL THEN
          SELECT qo.is_correct INTO _correct
          FROM quiz_question_options qo
          WHERE qo.id = _user_answer::uuid;
        END IF;

      WHEN 'multiple_choice' THEN
        -- User answer is comma-separated option_ids
        -- Correct if selected options exactly match correct options
        IF _user_answer IS NOT NULL THEN
          _correct := (
            SELECT array_agg(qo.id ORDER BY qo.id) =
                   array_agg(CASE WHEN qo.is_correct THEN qo.id END ORDER BY qo.id)
                   FILTER (WHERE qo.is_correct)
            FROM quiz_question_options qo
            WHERE qo.question_id = _question.id
              AND (qo.is_correct = true
                   OR qo.id = ANY(string_to_array(_user_answer, ',')::uuid[]))
          );
          -- Simpler approach: check if user's set = correct set
          _correct := (
            SELECT
              (SELECT array_agg(x ORDER BY x) FROM unnest(string_to_array(_user_answer, ',')::uuid[]) x) =
              (SELECT array_agg(qo.id ORDER BY qo.id) FROM quiz_question_options qo
               WHERE qo.question_id = _question.id AND qo.is_correct = true)
          );
        END IF;

      WHEN 'fill_blank', 'short_answer' THEN
        -- Compare against correct_answer (case-insensitive, trimmed)
        IF _user_answer IS NOT NULL AND _question.correct_answer IS NOT NULL THEN
          _correct := lower(trim(_user_answer)) = lower(trim(_question.correct_answer));
        END IF;

      WHEN 'matching' THEN
        -- Matching stored as JSON in correct_answer; user_answer same format
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

-- --------------------------------------------------------------------------
-- 1C. Post-submission results function (respects show_correct_answers)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_quiz_results(p_attempt_id uuid)
RETURNS TABLE (
  question_id uuid,
  question_text text,
  question_type quiz_question_type,
  points numeric,
  correct_answer text,
  user_answer text,
  options jsonb
) AS $$
DECLARE
  _attempt record;
  _quiz record;
BEGIN
  -- Verify attempt belongs to caller and has been submitted
  SELECT qa.* INTO _attempt
  FROM quiz_attempts qa
  WHERE qa.id = p_attempt_id
    AND qa.user_id = auth.uid()
    AND qa.submitted_at IS NOT NULL;

  IF _attempt IS NULL THEN
    RAISE EXCEPTION 'Attempt not found, does not belong to you, or not yet submitted';
  END IF;

  SELECT q.* INTO _quiz
  FROM quizzes q WHERE q.id = _attempt.quiz_id;

  IF NOT _quiz.show_correct_answers THEN
    -- Return questions without correct answers
    RETURN QUERY
    SELECT
      qq.id,
      qq.question_text,
      qq.question_type,
      qq.points,
      NULL::text AS correct_answer,
      qaa.user_answer,
      (SELECT jsonb_agg(jsonb_build_object(
        'id', qo.id,
        'option_text', qo.option_text,
        'is_correct', NULL
      ) ORDER BY qo.sort_order)
       FROM quiz_question_options qo WHERE qo.question_id = qq.id
      ) AS options
    FROM quiz_questions qq
    LEFT JOIN quiz_attempt_answers qaa ON qaa.question_id = qq.id AND qaa.attempt_id = p_attempt_id
    WHERE qq.quiz_id = _attempt.quiz_id
    ORDER BY qq.sort_order;
  ELSE
    -- Return full results with correct answers
    RETURN QUERY
    SELECT
      qq.id,
      qq.question_text,
      qq.question_type,
      qq.points,
      qq.correct_answer,
      qaa.user_answer,
      (SELECT jsonb_agg(jsonb_build_object(
        'id', qo.id,
        'option_text', qo.option_text,
        'is_correct', qo.is_correct
      ) ORDER BY qo.sort_order)
       FROM quiz_question_options qo WHERE qo.question_id = qq.id
      ) AS options
    FROM quiz_questions qq
    LEFT JOIN quiz_attempt_answers qaa ON qaa.question_id = qq.id AND qaa.attempt_id = p_attempt_id
    WHERE qq.quiz_id = _attempt.quiz_id
    ORDER BY qq.sort_order;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --------------------------------------------------------------------------
-- 1D. Protect quiz_attempts from score/passed tampering
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION protect_quiz_attempt_score()
RETURNS TRIGGER AS $$
DECLARE
  _is_platform_admin boolean;
  _is_lecturer boolean;
BEGIN
  -- Allow if score/passed aren't changing
  IF NOT (OLD.score IS DISTINCT FROM NEW.score OR OLD.passed IS DISTINCT FROM NEW.passed) THEN
    RETURN NEW;
  END IF;

  -- Check if caller is platform admin
  _is_platform_admin := coalesce(public.jwt_claim('is_platform_admin'), '') = 'true';
  IF _is_platform_admin THEN
    RETURN NEW;
  END IF;

  -- Check if caller is a lecturer for this quiz's course
  SELECT EXISTS (
    SELECT 1 FROM quizzes q
    JOIN modules m ON m.id = q.module_id
    WHERE q.id = NEW.quiz_id
      AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  ) INTO _is_lecturer;

  IF _is_lecturer THEN
    RETURN NEW;
  END IF;

  -- Block: revert score and passed to old values
  NEW.score := OLD.score;
  NEW.passed := OLD.passed;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_quiz_score
  BEFORE UPDATE ON quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION protect_quiz_attempt_score();


-- ============================================================================
-- SECTION 2: ENROLLMENT TYPE ENFORCEMENT (Audit Section 8B)
-- ============================================================================
-- Problem: enrollments_insert_self allows enrollment in invite_only/password courses.
-- Fix: Restrict self-enrollment to open courses. Add password RPC.

-- --------------------------------------------------------------------------
-- 2A. Restrict self-enrollment to open courses only
-- --------------------------------------------------------------------------

DROP POLICY "enrollments_insert_self" ON course_enrollments;
CREATE POLICY "enrollments_insert_self" ON course_enrollments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.jwt_claim('tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM courses c
      JOIN tenant_courses tc ON tc.course_id = c.id
      WHERE c.id = course_enrollments.course_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
        AND c.enrollment_type = 'open'
    )
  );

-- --------------------------------------------------------------------------
-- 2B. Password-protected enrollment via SECURITY DEFINER RPC
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enroll_with_password(p_course_id uuid, p_password text)
RETURNS uuid AS $$
DECLARE
  _course record;
  _tenant_id uuid;
  _enrollment_id uuid;
BEGIN
  _tenant_id := public.jwt_claim('tenant_id')::uuid;

  -- Verify course exists, is password_protected, and assigned to user's tenant
  SELECT c.* INTO _course
  FROM courses c
  JOIN tenant_courses tc ON tc.course_id = c.id
  WHERE c.id = p_course_id
    AND tc.tenant_id = _tenant_id
    AND c.enrollment_type = 'password_protected';

  IF _course IS NULL THEN
    RAISE EXCEPTION 'Course not found, not password-protected, or not available to your tenant';
  END IF;

  -- Validate password
  IF _course.password_hash IS NULL OR _course.password_hash != crypt(p_password, _course.password_hash) THEN
    RAISE EXCEPTION 'Invalid course password';
  END IF;

  -- Check if already enrolled
  IF EXISTS (
    SELECT 1 FROM course_enrollments
    WHERE user_id = auth.uid()
      AND course_id = p_course_id
      AND tenant_id = _tenant_id
  ) THEN
    RAISE EXCEPTION 'You are already enrolled in this course';
  END IF;

  -- Create enrollment
  INSERT INTO course_enrollments (user_id, tenant_id, course_id)
  VALUES (auth.uid(), _tenant_id, p_course_id)
  RETURNING id INTO _enrollment_id;

  RETURN _enrollment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================================
-- SECTION 3: NOTIFICATION TRIGGER HARDENING (Audit Section 8C)
-- ============================================================================
-- Problem: All 10 notification triggers lack exception handlers.
-- Fix: Rewrite all with BEGIN...EXCEPTION wrappers and SET search_path.
-- Also: Replace notify_new_module loop with INSERT...SELECT.
-- Also: Add deduplication to notify_new_access_request.

-- --------------------------------------------------------------------------
-- 3.1 notify_course_assigned — add exception handler
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_course_assigned()
RETURNS TRIGGER AS $$
DECLARE
  _course_title text;
BEGIN
  SELECT title INTO _course_title FROM courses WHERE id = NEW.course_id;

  BEGIN
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      NEW.tenant_id,
      'course_assigned',
      'New course assigned',
      'You have been enrolled in: ' || coalesce(_course_title, 'a course'),
      jsonb_build_object('course_id', NEW.course_id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_course_assigned failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --------------------------------------------------------------------------
-- 3.2 notify_new_module — replace loop with INSERT...SELECT + exception
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_new_module()
RETURNS TRIGGER AS $$
DECLARE
  _course_title text;
BEGIN
  SELECT title INTO _course_title FROM courses WHERE id = NEW.course_id;

  BEGIN
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    SELECT
      ce.user_id,
      ce.tenant_id,
      'new_module',
      'New content available',
      'A new module "' || NEW.title || '" has been added to ' || coalesce(_course_title, 'your course'),
      jsonb_build_object(
        'course_id', NEW.course_id,
        'module_id', NEW.id
      )
    FROM course_enrollments ce
    WHERE ce.course_id = NEW.course_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_new_module failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --------------------------------------------------------------------------
-- 3.3 notify_progress_reset — add exception handler
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_progress_reset()
RETURNS TRIGGER AS $$
DECLARE
  _module_title text;
  _course_title text;
BEGIN
  IF NEW.status = 'not_started' AND OLD.status != 'not_started' THEN
    SELECT m.title, c.title
    INTO _module_title, _course_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
    WHERE m.id = NEW.module_id;

    BEGIN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        NEW.user_id,
        NEW.tenant_id,
        'progress_reset',
        'Module content updated',
        'Module "' || coalesce(_module_title, '') || '" in "' || coalesce(_course_title, '') || '" has been updated. Please review the new content.',
        jsonb_build_object(
          'course_id', NEW.course_id,
          'module_id', NEW.module_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_progress_reset failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --------------------------------------------------------------------------
-- 3.4 notify_exam_graded — add exception handler
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_exam_graded()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.score IS NULL AND NEW.score IS NOT NULL THEN
    BEGIN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        NEW.user_id,
        NEW.tenant_id,
        'exam_graded',
        'Your exam has been graded',
        'Your exam submission has been reviewed. Click to see your results.',
        jsonb_build_object(
          'submission_id', NEW.id,
          'course_id', NEW.course_id,
          'exam_id', NEW.exam_id,
          'score', NEW.score
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_exam_graded failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --------------------------------------------------------------------------
-- 3.5 notify_question_answered — add exception handler
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_question_answered()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.response_text IS NULL AND NEW.response_text IS NOT NULL THEN
    BEGIN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        NEW.user_id,
        NEW.tenant_id,
        'question_answered',
        'Your question has been answered',
        'An expert has responded to your question. Click to see the answer.',
        jsonb_build_object(
          'question_id', NEW.id,
          'course_id', NEW.course_id,
          'module_id', NEW.module_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_question_answered failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --------------------------------------------------------------------------
-- 3.6 notify_reminder_sent — add exception handler
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_reminder_sent()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    VALUES (
      NEW.sent_to,
      NEW.tenant_id,
      'reminder',
      'Continue your learning',
      'You have incomplete courses. Continue learning to stay on track!',
      jsonb_build_object('course_id', NEW.course_id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_reminder_sent failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --------------------------------------------------------------------------
-- 3.7 notify_new_expert_question — add exception handler to each INSERT
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_new_expert_question()
RETURNS TRIGGER AS $$
DECLARE
  _lecturer record;
  _csm record;
  _learner_name text;
BEGIN
  SELECT full_name INTO _learner_name FROM profiles WHERE id = NEW.user_id;

  FOR _lecturer IN
    SELECT lca.user_id, p.tenant_id
    FROM lecturer_course_assignments lca
    JOIN profiles p ON p.id = lca.user_id
    WHERE lca.course_id = NEW.course_id
  LOOP
    BEGIN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        _lecturer.user_id,
        _lecturer.tenant_id,
        'new_expert_question',
        'New question from a learner',
        coalesce(_learner_name, 'A learner') || ' asked a question on your course.',
        jsonb_build_object(
          'question_id', NEW.id,
          'course_id', NEW.course_id,
          'module_id', NEW.module_id,
          'asker_tenant_id', NEW.tenant_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_new_expert_question (lecturer) failed: %', SQLERRM;
    END;
  END LOOP;

  FOR _csm IN
    SELECT cta.user_id, p.tenant_id
    FROM csm_tenant_assignments cta
    JOIN profiles p ON p.id = cta.user_id
    WHERE cta.tenant_id = NEW.tenant_id
  LOOP
    BEGIN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        _csm.user_id,
        _csm.tenant_id,
        'new_expert_question',
        'New question from a learner',
        coalesce(_learner_name, 'A learner') || ' asked a question on a course in your assigned tenant.',
        jsonb_build_object(
          'question_id', NEW.id,
          'course_id', NEW.course_id,
          'module_id', NEW.module_id,
          'asker_tenant_id', NEW.tenant_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_new_expert_question (csm) failed: %', SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --------------------------------------------------------------------------
-- 3.8 notify_new_exam_submission — add exception handler
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_new_exam_submission()
RETURNS TRIGGER AS $$
DECLARE
  _lecturer record;
  _learner_name text;
BEGIN
  SELECT full_name INTO _learner_name FROM profiles WHERE id = NEW.user_id;

  FOR _lecturer IN
    SELECT lca.user_id, p.tenant_id
    FROM lecturer_course_assignments lca
    JOIN profiles p ON p.id = lca.user_id
    WHERE lca.course_id = NEW.course_id
      AND lca.can_grade = true
  LOOP
    BEGIN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        _lecturer.user_id,
        _lecturer.tenant_id,
        'new_exam_submission',
        'New exam submission to grade',
        coalesce(_learner_name, 'A learner') || ' submitted an exam for grading.',
        jsonb_build_object(
          'submission_id', NEW.id,
          'course_id', NEW.course_id,
          'exam_id', NEW.exam_id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_new_exam_submission failed: %', SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --------------------------------------------------------------------------
-- 3.9 notify_new_issue — add exception handler (dedup already exists)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_new_issue()
RETURNS TRIGGER AS $$
DECLARE
  _recipient record;
  _reporter_name text;
  _notified_ids uuid[] := '{}';
BEGIN
  SELECT full_name INTO _reporter_name FROM profiles WHERE id = NEW.user_id;

  FOR _recipient IN
    SELECT lca.user_id, p.tenant_id
    FROM lecturer_course_assignments lca
    JOIN profiles p ON p.id = lca.user_id
    WHERE lca.course_id = NEW.course_id
  LOOP
    IF NOT _recipient.user_id = ANY(_notified_ids) THEN
      BEGIN
        INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
        VALUES (
          _recipient.user_id,
          _recipient.tenant_id,
          'new_issue',
          'New issue reported',
          coalesce(_reporter_name, 'A user') || ' reported an issue: ' || NEW.issue_type::text,
          jsonb_build_object(
            'issue_id', NEW.id,
            'course_id', NEW.course_id,
            'module_id', NEW.module_id,
            'issue_type', NEW.issue_type
          )
        );
        _notified_ids := _notified_ids || _recipient.user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_new_issue (lecturer) failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  FOR _recipient IN
    SELECT cta.user_id, p.tenant_id
    FROM csm_tenant_assignments cta
    JOIN profiles p ON p.id = cta.user_id
    WHERE cta.tenant_id = NEW.tenant_id
  LOOP
    IF NOT _recipient.user_id = ANY(_notified_ids) THEN
      BEGIN
        INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
        VALUES (
          _recipient.user_id,
          _recipient.tenant_id,
          'new_issue',
          'New issue reported',
          coalesce(_reporter_name, 'A user') || ' reported an issue: ' || NEW.issue_type::text,
          jsonb_build_object(
            'issue_id', NEW.id,
            'course_id', NEW.course_id,
            'module_id', NEW.module_id,
            'issue_type', NEW.issue_type
          )
        );
        _notified_ids := _notified_ids || _recipient.user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_new_issue (csm) failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  FOR _recipient IN
    SELECT id AS user_id, tenant_id
    FROM profiles
    WHERE is_platform_admin = true
  LOOP
    IF NOT _recipient.user_id = ANY(_notified_ids) THEN
      BEGIN
        INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
        VALUES (
          _recipient.user_id,
          _recipient.tenant_id,
          'new_issue',
          'New issue reported',
          coalesce(_reporter_name, 'A user') || ' reported an issue: ' || NEW.issue_type::text,
          jsonb_build_object(
            'issue_id', NEW.id,
            'course_id', NEW.course_id,
            'module_id', NEW.module_id,
            'issue_type', NEW.issue_type
          )
        );
        _notified_ids := _notified_ids || _recipient.user_id;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_new_issue (admin) failed: %', SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- --------------------------------------------------------------------------
-- 3.10 notify_new_access_request — add exception handler + deduplication
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_new_access_request()
RETURNS TRIGGER AS $$
DECLARE
  _recipient record;
  _notified_ids uuid[] := '{}';
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    -- Known domain: notify tenant admins of that tenant
    FOR _recipient IN
      SELECT id AS user_id, tenant_id
      FROM profiles
      WHERE tenant_id = NEW.tenant_id AND is_tenant_admin = true
    LOOP
      IF NOT _recipient.user_id = ANY(_notified_ids) THEN
        BEGIN
          INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
          VALUES (
            _recipient.user_id,
            _recipient.tenant_id,
            'new_access_request',
            'New access request',
            NEW.email || ' has requested access.',
            jsonb_build_object('request_id', NEW.id, 'email', NEW.email)
          );
          _notified_ids := _notified_ids || _recipient.user_id;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'notify_new_access_request (tenant_admin) failed: %', SQLERRM;
        END;
      END IF;
    END LOOP;

    -- Also notify platform admins for visibility (with dedup)
    FOR _recipient IN
      SELECT id AS user_id, tenant_id
      FROM profiles
      WHERE is_platform_admin = true
    LOOP
      IF NOT _recipient.user_id = ANY(_notified_ids) THEN
        BEGIN
          INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
          VALUES (
            _recipient.user_id,
            _recipient.tenant_id,
            'new_access_request',
            'New access request',
            NEW.email || ' has requested access (domain matched to a tenant).',
            jsonb_build_object('request_id', NEW.id, 'email', NEW.email)
          );
          _notified_ids := _notified_ids || _recipient.user_id;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'notify_new_access_request (platform_admin) failed: %', SQLERRM;
        END;
      END IF;
    END LOOP;
  ELSE
    -- Unknown domain: notify platform admins
    FOR _recipient IN
      SELECT id AS user_id, tenant_id
      FROM profiles
      WHERE is_platform_admin = true
    LOOP
      IF NOT _recipient.user_id = ANY(_notified_ids) THEN
        BEGIN
          INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
          VALUES (
            _recipient.user_id,
            _recipient.tenant_id,
            'new_access_request',
            'New access request (unknown domain)',
            NEW.email || ' has requested access from an unrecognized domain.',
            jsonb_build_object('request_id', NEW.id, 'email', NEW.email, 'domain', NEW.domain)
          );
          _notified_ids := _notified_ids || _recipient.user_id;
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'notify_new_access_request (platform_admin unknown) failed: %', SQLERRM;
        END;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================================
-- SECTION 4: LECTURER REMINDER POLICY FIX (Audit Section 8G — bug)
-- ============================================================================
-- Problem: Checks user_progress instead of course_enrollments, excluding
-- enrolled users who haven't started any modules.

DROP POLICY "reminder_history_insert_lecturer" ON reminder_history;
CREATE POLICY "reminder_history_insert_lecturer" ON reminder_history
  FOR INSERT WITH CHECK (
    sent_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM course_enrollments ce
      WHERE ce.user_id = reminder_history.sent_to
        AND ce.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );


-- ============================================================================
-- SECTION 5: MISSING QUIZ FK INDEXES (Audit Section 8G)
-- ============================================================================
-- PostgreSQL does NOT auto-create indexes on FK columns.
-- These are hit on every quiz render and RLS policy chain.

CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX idx_quiz_options_question ON quiz_question_options(question_id);
CREATE INDEX idx_quiz_attempt_answers_attempt ON quiz_attempt_answers(attempt_id);


-- ============================================================================
-- SECTION 6: CHECK CONSTRAINTS (Audit Section 8E)
-- ============================================================================

ALTER TABLE quizzes ADD CONSTRAINT chk_quizzes_passing_score
  CHECK (passing_score >= 0 AND passing_score <= 100);
ALTER TABLE quizzes ADD CONSTRAINT chk_quizzes_max_attempts
  CHECK (max_attempts IS NULL OR max_attempts > 0);
ALTER TABLE quizzes ADD CONSTRAINT chk_quizzes_time_limit
  CHECK (time_limit IS NULL OR time_limit > 0);

ALTER TABLE exams ADD CONSTRAINT chk_exams_passing_score
  CHECK (passing_score >= 0 AND passing_score <= 100);
ALTER TABLE exams ADD CONSTRAINT chk_exams_duration
  CHECK (duration_minutes > 0);

ALTER TABLE quiz_questions ADD CONSTRAINT chk_questions_points
  CHECK (points > 0);

ALTER TABLE quiz_attempts ADD CONSTRAINT chk_attempts_score
  CHECK (score IS NULL OR score >= 0);
ALTER TABLE quiz_attempts ADD CONSTRAINT chk_attempts_number
  CHECK (attempt_number > 0);

ALTER TABLE exam_submissions ADD CONSTRAINT chk_exam_sub_score
  CHECK (score IS NULL OR score >= 0);

ALTER TABLE external_quiz_results ADD CONSTRAINT chk_ext_quiz_score
  CHECK (score IS NULL OR score >= 0);

ALTER TABLE courses ADD CONSTRAINT chk_staleness_threshold
  CHECK (staleness_threshold_days IS NULL OR staleness_threshold_days > 0);


-- ============================================================================
-- SECTION 7: TIMESTAMPS ON QUIZZES AND EXAMS (Audit Section 8E)
-- ============================================================================

ALTER TABLE quizzes
  ADD COLUMN created_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN created_by  uuid REFERENCES profiles ON DELETE SET NULL,
  ADD COLUMN updated_by  uuid REFERENCES profiles ON DELETE SET NULL;

ALTER TABLE exams
  ADD COLUMN created_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at  timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN created_by  uuid REFERENCES profiles ON DELETE SET NULL,
  ADD COLUMN updated_by  uuid REFERENCES profiles ON DELETE SET NULL;

CREATE TRIGGER set_quizzes_updated_at
  BEFORE UPDATE ON quizzes
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_exams_updated_at
  BEFORE UPDATE ON exams
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();


-- ============================================================================
-- SECTION 8: ACCESS REQUESTS SPAM PROTECTION (Audit Section 8F)
-- ============================================================================
-- Prevent duplicate pending requests from the same email.

CREATE UNIQUE INDEX idx_access_requests_email_pending
  ON access_requests(email) WHERE status = 'pending';


-- ============================================================================
-- SECTION 9: EXAM-SUBMISSIONS STORAGE POLICY FIX (Audit Section 8F)
-- ============================================================================
-- Problem: Lecturer policy checks "has any grading assignment" not "grades
-- THIS course." Fix: Use course_id from storage path.
-- Convention: exam-submissions/{course_id}/{user_id}/filename

DROP POLICY "exam_sub_select_lecturer" ON storage.objects;
CREATE POLICY "exam_sub_select_lecturer" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exam-submissions'
    AND (storage.foldername(name))[1] = ANY(
      public.jwt_claim_array('lecturer_can_grade_course_ids')
    )
  );

-- Also fix the delete policy for consistency
DROP POLICY "exam_sub_delete_admin" ON storage.objects;
CREATE POLICY "exam_sub_delete_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'exam-submissions'
    AND (
      public.jwt_claim('is_platform_admin') = 'true'
      OR (storage.foldername(name))[1] = ANY(
        public.jwt_claim_array('lecturer_can_grade_course_ids')
      )
    )
  );

-- Update INSERT policy to enforce path convention
DROP POLICY "exam_sub_insert_own" ON storage.objects;
CREATE POLICY "exam_sub_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exam-submissions'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[2] = auth.uid()::text
  );


-- ============================================================================
-- SECTION 10: TENANT ADMIN ENROLLMENT COURSE CHECK (Audit Section 8G)
-- ============================================================================

DROP POLICY "enrollments_insert_tenant_admin" ON course_enrollments;
CREATE POLICY "enrollments_insert_tenant_admin" ON course_enrollments
  FOR INSERT WITH CHECK (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
    AND EXISTS (
      SELECT 1 FROM tenant_courses tc
      WHERE tc.course_id = course_enrollments.course_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );


-- ============================================================================
-- SECTION 11: MISSING NOTIFICATION TRIGGERS (Audit Section 8C)
-- ============================================================================

-- --------------------------------------------------------------------------
-- 11A. Add missing enum values
-- --------------------------------------------------------------------------
-- Note: ALTER TYPE ... ADD VALUE cannot run inside a transaction in PG < 12.
-- In PG 12+ and Supabase (PG 15), this works fine.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'issue_resolved';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'exam_reset';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'access_request_reviewed';

-- --------------------------------------------------------------------------
-- 11B. notify_issue_resolved — when issue status changes to resolved
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_issue_resolved()
RETURNS TRIGGER AS $$
DECLARE
  _resolver_name text;
BEGIN
  IF NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
    SELECT full_name INTO _resolver_name FROM profiles WHERE id = NEW.resolved_by;

    BEGIN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        NEW.user_id,
        NEW.tenant_id,
        'issue_resolved',
        'Your issue has been resolved',
        'Your reported issue has been resolved by ' || coalesce(_resolver_name, 'an admin') || '.',
        jsonb_build_object(
          'issue_id', NEW.id,
          'course_id', NEW.course_id,
          'issue_type', NEW.issue_type
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_issue_resolved failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_issue_resolved
  AFTER UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION notify_issue_resolved();

-- --------------------------------------------------------------------------
-- 11C. notify_exam_reset — when exam submission is deleted (reset)
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_exam_reset()
RETURNS TRIGGER AS $$
DECLARE
  _exam_title text;
BEGIN
  SELECT e.title INTO _exam_title
  FROM exams e WHERE e.id = OLD.exam_id;

  BEGIN
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    VALUES (
      OLD.user_id,
      OLD.tenant_id,
      'exam_reset',
      'Your exam has been reset',
      'Your submission for "' || coalesce(_exam_title, 'an exam') || '" has been reset. You may resubmit.',
      jsonb_build_object(
        'course_id', OLD.course_id,
        'exam_id', OLD.exam_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_exam_reset failed: %', SQLERRM;
  END;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_exam_reset
  AFTER DELETE ON exam_submissions
  FOR EACH ROW EXECUTE FUNCTION notify_exam_reset();

-- --------------------------------------------------------------------------
-- 11D. notify_access_request_reviewed — when request is approved/rejected
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_access_request_reviewed()
RETURNS TRIGGER AS $$
DECLARE
  _reviewer_name text;
  _user_profile record;
BEGIN
  IF NEW.status != 'pending' AND OLD.status = 'pending' THEN
    SELECT full_name INTO _reviewer_name FROM profiles WHERE id = NEW.reviewed_by;

    -- Try to find a profile with this email to notify
    SELECT id, tenant_id INTO _user_profile
    FROM profiles
    WHERE email = NEW.email
    LIMIT 1;

    IF _user_profile.id IS NOT NULL THEN
      BEGIN
        INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
        VALUES (
          _user_profile.id,
          _user_profile.tenant_id,
          'access_request_reviewed',
          CASE NEW.status
            WHEN 'approved' THEN 'Access request approved'
            WHEN 'rejected' THEN 'Access request denied'
            ELSE 'Access request updated'
          END,
          CASE NEW.status
            WHEN 'approved' THEN 'Your access request has been approved. Welcome!'
            WHEN 'rejected' THEN 'Your access request has been denied.'
            ELSE 'Your access request status has been updated.'
          END,
          jsonb_build_object(
            'request_id', NEW.id,
            'status', NEW.status
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_access_request_reviewed failed: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_access_request_reviewed
  AFTER UPDATE ON access_requests
  FOR EACH ROW EXECUTE FUNCTION notify_access_request_reviewed();
