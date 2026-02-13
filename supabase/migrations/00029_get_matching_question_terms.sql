-- Migration 00029: get_matching_question_terms — fetch matching question terms securely
--
-- Problem: loadQuizForTaking queries the base quiz_questions table to get
-- correct_answer for matching questions (to extract left/right terms).
-- Learners cannot read the base table directly (RLS blocks it — the safe
-- view works because it runs as the view owner who bypasses RLS).
-- Result: matching question dropdowns don't render (matchingLeft/Right undefined).
--
-- Fix: SECURITY DEFINER RPC that returns matching terms (left array + right array)
-- without exposing the correct pairing order to the client.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_matching_question_terms(p_question_ids uuid[])
RETURNS jsonb AS $$
DECLARE
  _result jsonb := '{}'::jsonb;
  _question record;
  _pairs jsonb;
BEGIN
  FOR _question IN
    SELECT id, correct_answer
    FROM quiz_questions
    WHERE id = ANY(p_question_ids)
      AND question_type = 'matching'
      AND correct_answer IS NOT NULL
  LOOP
    BEGIN
      _pairs := _question.correct_answer::jsonb;
      _result := _result || jsonb_build_object(
        _question.id::text,
        jsonb_build_object(
          'left', (SELECT jsonb_agg(p->>'left' ORDER BY ord) FROM jsonb_array_elements(_pairs) WITH ORDINALITY AS t(p, ord)),
          'right', (SELECT jsonb_agg(p->>'right' ORDER BY ord) FROM jsonb_array_elements(_pairs) WITH ORDINALITY AS t(p, ord))
        )
      );
    EXCEPTION WHEN OTHERS THEN
      -- Skip questions with invalid JSON in correct_answer
      NULL;
    END;
  END LOOP;

  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
