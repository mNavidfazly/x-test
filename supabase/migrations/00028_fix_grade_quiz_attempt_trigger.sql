-- Migration 00028: Fix grade_quiz_attempt — protect_quiz_score trigger conflict
--
-- Problem: The protect_quiz_attempt_score() BEFORE UPDATE trigger silently
-- reverts score/passed to NULL when a learner calls grade_quiz_attempt().
-- Even though grade_quiz_attempt is SECURITY DEFINER, SECURITY DEFINER only
-- changes the PostgreSQL role — it does NOT change the JWT session claims.
-- The trigger reads JWT claims to check for platform_admin/lecturer, finds
-- neither (because the caller is a learner), and reverts the UPDATE.
--
-- Fix: grade_quiz_attempt sets a transaction-local config variable
-- (app.grading_in_progress) before the UPDATE. The trigger checks this
-- variable and allows the UPDATE when set.
-- ============================================================================

-- 1. Update protect_quiz_attempt_score to allow grading context
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

  -- Allow updates from grade_quiz_attempt SECURITY DEFINER function
  IF current_setting('app.grading_in_progress', true) = 'true' THEN
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

-- 2. Update grade_quiz_attempt to signal grading context before UPDATE
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

  -- Time-limit enforcement (time_limit is in SECONDS per 00002:123)
  IF _attempt.time_limit IS NOT NULL THEN
    IF (now() - _attempt.started_at) > (_attempt.time_limit * interval '1 second') THEN
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

  -- Signal grading context so protect_quiz_attempt_score trigger allows the UPDATE
  PERFORM set_config('app.grading_in_progress', 'true', true);

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
