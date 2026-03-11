-- Migration 00045: Partial credit grading for multiple_choice and matching
--
-- Changes grade_quiz_attempt() to award partial credit instead of all-or-nothing:
--   - multiple_choice: max(0, (correct_selected - incorrect_selected) / total_correct) * points
--   - matching: (correct_pairs / total_pairs) * points
-- All other question types (single_choice, true_false, fill_blank, short_answer) remain binary.
--
-- No schema changes. Function signature (RETURNS jsonb) and return keys are unchanged.
-- ============================================================================

CREATE OR REPLACE FUNCTION grade_quiz_attempt(p_attempt_id uuid)
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
        -- Partial credit: max(0, (correct_selected - incorrect_selected) / total_correct) * points
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
          END IF;
        END IF;

      WHEN 'matching' THEN
        -- Partial credit: (correct_pairs / total_pairs) * points
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
