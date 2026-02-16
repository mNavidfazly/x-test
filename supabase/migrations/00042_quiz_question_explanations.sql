-- Phase 12C: Per-Question Explanations
-- Adds an optional explanation text field to quiz questions.
-- Lecturers fill it in via the quiz builder.
-- Learners see it after submission (only when show_correct_answers = true).

-- A) Add explanation column
ALTER TABLE quiz_questions ADD COLUMN explanation text;

-- B) quiz_questions_safe view — no change needed.
--    It only selects: id, quiz_id, question_text, question_type, points, sort_order
--    The new 'explanation' column is automatically excluded (same as correct_answer).

-- C) Must DROP first — PostgreSQL cannot change return type with CREATE OR REPLACE
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
  explanation text
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
      NULL::text AS explanation
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
      qq.explanation
    FROM quiz_questions qq
    LEFT JOIN quiz_attempt_answers qaa ON qaa.question_id = qq.id AND qaa.attempt_id = p_attempt_id
    WHERE qq.quiz_id = _attempt.quiz_id
    ORDER BY qq.sort_order;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
