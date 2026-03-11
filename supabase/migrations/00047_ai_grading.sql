-- Migration 00047: AI Grading for free-text quiz questions
--
-- Adds AI-based semantic checking for fill_blank and short_answer questions.
-- After exact-match grading (grade_quiz_attempt), a FastAPI endpoint calls Claude Haiku
-- to check text answers that scored 0. If AI accepts the answer, it marks ai_accepted=true
-- and updates the quiz attempt score.
--
-- Changes:
--   A) Add ai_accepted column to quiz_attempt_answers
--   B) Create update_quiz_score() SECURITY DEFINER RPC (bypasses protect_quiz_attempt_score trigger)
--   C) Update get_quiz_results() to include ai_accepted in return columns
-- ============================================================================

-- A) Add ai_accepted column
ALTER TABLE quiz_attempt_answers ADD COLUMN ai_accepted boolean NOT NULL DEFAULT false;

-- B) SECURITY DEFINER RPC to update quiz attempt score
-- Needed because protect_quiz_attempt_score trigger silently reverts score changes
-- from non-admin users. This function uses set_config to bypass the trigger.
CREATE FUNCTION update_quiz_score(p_attempt_id uuid, p_score numeric, p_passed boolean)
RETURNS void AS $$
BEGIN
  -- Verify the attempt exists and has been graded
  IF NOT EXISTS (
    SELECT 1 FROM quiz_attempts
    WHERE id = p_attempt_id
      AND submitted_at IS NOT NULL
      AND score IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Attempt not found or not yet graded';
  END IF;

  -- Signal grading context so protect_quiz_attempt_score trigger allows the UPDATE
  PERFORM set_config('app.grading_in_progress', 'true', true);

  UPDATE quiz_attempts
  SET score = p_score, passed = p_passed
  WHERE id = p_attempt_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- C) Update get_quiz_results to include ai_accepted
-- Must DROP first — PostgreSQL cannot change return type with CREATE OR REPLACE
DROP FUNCTION IF EXISTS get_quiz_results(uuid);

CREATE FUNCTION get_quiz_results(p_attempt_id uuid)
RETURNS TABLE (
  question_id uuid,
  question_text text,
  question_type quiz_question_type,
  points numeric,
  correct_answer text,
  user_answer text,
  options jsonb,
  explanation text,
  ai_accepted boolean
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
    -- Return questions without correct answers or explanations
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
      ) AS options,
      NULL::text AS explanation,
      COALESCE(qaa.ai_accepted, false) AS ai_accepted
    FROM quiz_questions qq
    LEFT JOIN quiz_attempt_answers qaa ON qaa.question_id = qq.id AND qaa.attempt_id = p_attempt_id
    WHERE qq.quiz_id = _attempt.quiz_id
    ORDER BY qq.sort_order;
  ELSE
    -- Return full results with correct answers and explanations
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
      ) AS options,
      qq.explanation,
      COALESCE(qaa.ai_accepted, false) AS ai_accepted
    FROM quiz_questions qq
    LEFT JOIN quiz_attempt_answers qaa ON qaa.question_id = qq.id AND qaa.attempt_id = p_attempt_id
    WHERE qq.quiz_id = _attempt.quiz_id
    ORDER BY qq.sort_order;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
