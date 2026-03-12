-- Migration 00048: Replace update_quiz_score with recalculate_quiz_score
--
-- Eliminates score divergence between grade_quiz_attempt() (PostgreSQL) and
-- the Python AI grading endpoint. The new function reuses the same grading
-- loop from grade_quiz_attempt (migration 00045) but also checks the
-- ai_accepted flag on quiz_attempt_answers for fill_blank/short_answer.
--
-- Score direction guard: only updates if new score > current score (AI is additive only).
--
-- Changes:
--   A) Drop old update_quiz_score (thin wrapper) — replaced by full recalculation
--   B) Create recalculate_quiz_score() SECURITY DEFINER RPC
-- ============================================================================

-- A) Drop old thin wrapper
DROP FUNCTION IF EXISTS update_quiz_score(uuid, numeric, boolean);

-- B) Full recalculation RPC with ai_accepted support
CREATE FUNCTION recalculate_quiz_score(p_attempt_id uuid)
RETURNS jsonb AS $$
DECLARE
  _attempt record;
  _total_points numeric := 0;
  _earned_points numeric := 0;
  _question record;
  _user_answer text;
  _question_earned numeric;
  _score numeric;
  _passed boolean;
  -- multiple_choice partial credit
  _total_correct integer;
  _correct_selected integer;
  _incorrect_selected integer;
  _user_ids uuid[];
  -- matching partial credit
  _user_pairs jsonb;
  _correct_pairs jsonb;
  _total_pairs integer;
  _correct_count integer;
  _i integer;
  -- single_choice/true_false helper
  _is_correct boolean;
BEGIN
  -- Fetch attempt + quiz passing_score
  -- No auth.uid() check — called by backend service account after ownership verification
  SELECT qa.*, q.passing_score
  INTO _attempt
  FROM quiz_attempts qa
  JOIN quizzes q ON q.id = qa.quiz_id
  WHERE qa.id = p_attempt_id;

  IF _attempt IS NULL THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;

  IF _attempt.submitted_at IS NULL OR _attempt.score IS NULL THEN
    RAISE EXCEPTION 'Attempt not yet graded';
  END IF;

  -- Grade each question (same logic as grade_quiz_attempt from migration 00045,
  -- with ai_accepted check added for fill_blank/short_answer)
  FOR _question IN
    SELECT qq.id, qq.question_type, qq.correct_answer, qq.points
    FROM quiz_questions qq
    WHERE qq.quiz_id = _attempt.quiz_id
  LOOP
    _total_points := _total_points + _question.points;
    _question_earned := 0;

    -- Get user's answer
    SELECT qaa.user_answer INTO _user_answer
    FROM quiz_attempt_answers qaa
    WHERE qaa.attempt_id = p_attempt_id
      AND qaa.question_id = _question.id;

    CASE _question.question_type
      WHEN 'single_choice', 'true_false' THEN
        IF _user_answer IS NOT NULL THEN
          SELECT qo.is_correct INTO _is_correct
          FROM quiz_question_options qo
          WHERE qo.id = _user_answer::uuid;

          IF _is_correct THEN
            _question_earned := _question.points;
          END IF;
        END IF;

      WHEN 'multiple_choice' THEN
        IF _user_answer IS NOT NULL THEN
          SELECT count(*) INTO _total_correct
          FROM quiz_question_options qo
          WHERE qo.question_id = _question.id AND qo.is_correct = true;

          IF _total_correct > 0 THEN
            _user_ids := string_to_array(_user_answer, ',')::uuid[];

            SELECT count(*) INTO _correct_selected
            FROM unnest(_user_ids) uid
            JOIN quiz_question_options qo ON qo.id = uid
            WHERE qo.question_id = _question.id AND qo.is_correct = true;

            _incorrect_selected := array_length(_user_ids, 1) - _correct_selected;

            _question_earned := round(
              GREATEST(0, (_correct_selected::numeric - _incorrect_selected::numeric) / _total_correct::numeric)
              * _question.points, 2
            );
          END IF;
        END IF;

      WHEN 'fill_blank', 'short_answer' THEN
        IF _user_answer IS NOT NULL AND _question.correct_answer IS NOT NULL THEN
          IF lower(trim(_user_answer)) = lower(trim(_question.correct_answer)) THEN
            _question_earned := _question.points;
          ELSIF EXISTS (
            SELECT 1 FROM quiz_attempt_answers
            WHERE attempt_id = p_attempt_id
              AND question_id = _question.id
              AND ai_accepted = true
          ) THEN
            _question_earned := _question.points;
          END IF;
        END IF;

      WHEN 'matching' THEN
        IF _user_answer IS NOT NULL AND _question.correct_answer IS NOT NULL THEN
          _user_pairs := _user_answer::jsonb;
          _correct_pairs := _question.correct_answer::jsonb;
          _total_pairs := jsonb_array_length(_correct_pairs);

          IF _total_pairs > 0 THEN
            _correct_count := 0;
            FOR _i IN 0..(_total_pairs - 1) LOOP
              IF (_user_pairs->_i->>'right') = (_correct_pairs->_i->>'right') THEN
                _correct_count := _correct_count + 1;
              END IF;
            END LOOP;

            _question_earned := round(
              (_correct_count::numeric / _total_pairs::numeric) * _question.points, 2
            );
          END IF;
        END IF;

      ELSE
        _question_earned := 0;
    END CASE;

    _earned_points := _earned_points + _question_earned;
  END LOOP;

  -- Calculate percentage score
  IF _total_points > 0 THEN
    _score := round((_earned_points / _total_points) * 100, 2);
  ELSE
    _score := 0;
  END IF;

  _passed := _score >= _attempt.passing_score;

  -- Score direction guard: AI grading is additive only — never decrease score
  IF _score > _attempt.score THEN
    PERFORM set_config('app.grading_in_progress', 'true', true);

    UPDATE quiz_attempts
    SET score = _score, passed = _passed
    WHERE id = p_attempt_id;
  ELSE
    -- Keep existing values if no improvement
    _score := _attempt.score;
    _passed := _attempt.passed;
  END IF;

  RETURN jsonb_build_object(
    'score', _score,
    'passed', _passed,
    'earned_points', _earned_points,
    'total_points', _total_points
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
