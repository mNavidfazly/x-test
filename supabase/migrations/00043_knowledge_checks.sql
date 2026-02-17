-- =============================================================================
-- Migration 00043: Module Knowledge Checks (Phase 12F)
-- =============================================================================
-- Lightweight inline quizzes per module: 1-5 questions, single_choice / true_false.
-- Lecturers author via module editor; learners answer in module viewer.
-- =============================================================================

-- 1. Questions table (shared content — no tenant_id)
CREATE TABLE knowledge_check_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id     uuid NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'single_choice',
  options       jsonb NOT NULL,  -- [{text: string, isCorrect: boolean}, ...]
  explanation   text,
  order_index   integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  CONSTRAINT valid_question_type CHECK (question_type IN ('single_choice', 'true_false'))
);

-- 2. Responses table (tenant-scoped user data)
CREATE TABLE knowledge_check_responses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id           uuid NOT NULL REFERENCES knowledge_check_questions(id) ON DELETE CASCADE,
  user_id               uuid NOT NULL REFERENCES auth.users(id),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  selected_option_index integer NOT NULL,
  is_correct            boolean NOT NULL,
  answered_at           timestamptz DEFAULT now(),
  UNIQUE(question_id, user_id)
);

-- 3. Indexes
CREATE INDEX idx_kc_questions_module_order
  ON knowledge_check_questions(module_id, order_index);

CREATE INDEX idx_kc_responses_question
  ON knowledge_check_responses(question_id);

CREATE INDEX idx_kc_responses_user
  ON knowledge_check_responses(user_id, question_id);

-- 4. Enable RLS
ALTER TABLE knowledge_check_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_check_responses ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Safe view: strips isCorrect from options JSONB (learner-safe)
-- =============================================================================
CREATE VIEW knowledge_check_questions_safe AS
  SELECT
    id,
    module_id,
    question_text,
    question_type,
    (
      SELECT jsonb_agg(jsonb_build_object('text', elem->>'text'))
      FROM jsonb_array_elements(options) AS elem
    ) AS options,
    order_index,
    created_at
  FROM knowledge_check_questions;

GRANT SELECT ON knowledge_check_questions_safe TO authenticated;

-- =============================================================================
-- knowledge_check_questions: 9 RLS policies
-- Pattern: identical to module_audio/module_downloads from migration 00040
-- =============================================================================

-- SELECT policies
CREATE POLICY "kc_questions_select_tenant" ON knowledge_check_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM modules m
    JOIN tenant_courses tc ON tc.course_id = m.course_id
    WHERE m.id = knowledge_check_questions.module_id
      AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
  ));

CREATE POLICY "kc_questions_select_platform_admin" ON knowledge_check_questions FOR SELECT
  USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "kc_questions_select_lecturer" ON knowledge_check_questions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM modules m
    WHERE m.id = knowledge_check_questions.module_id
      AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  ));

-- INSERT policies
CREATE POLICY "kc_questions_insert_platform_admin" ON knowledge_check_questions FOR INSERT
  WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "kc_questions_insert_lecturer" ON knowledge_check_questions FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM modules m
    WHERE m.id = knowledge_check_questions.module_id
      AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  ));

-- UPDATE policies
CREATE POLICY "kc_questions_update_platform_admin" ON knowledge_check_questions FOR UPDATE
  USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "kc_questions_update_lecturer" ON knowledge_check_questions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM modules m
    WHERE m.id = knowledge_check_questions.module_id
      AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  ));

-- DELETE policies
CREATE POLICY "kc_questions_delete_platform_admin" ON knowledge_check_questions FOR DELETE
  USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "kc_questions_delete_lecturer" ON knowledge_check_questions FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM modules m
    WHERE m.id = knowledge_check_questions.module_id
      AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  ));

-- =============================================================================
-- knowledge_check_responses: 5 RLS policies
-- =============================================================================

-- SELECT: own responses
CREATE POLICY "kc_responses_select_own" ON knowledge_check_responses FOR SELECT
  USING (user_id = auth.uid());

-- SELECT: platform admin
CREATE POLICY "kc_responses_select_platform_admin" ON knowledge_check_responses FOR SELECT
  USING (public.jwt_claim('is_platform_admin') = 'true');

-- SELECT: lecturer on assigned courses (cross-tenant)
CREATE POLICY "kc_responses_select_lecturer" ON knowledge_check_responses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM knowledge_check_questions kcq
    JOIN modules m ON m.id = kcq.module_id
    WHERE kcq.id = knowledge_check_responses.question_id
      AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  ));

-- INSERT: own user_id + tenant_id, must be enrolled in module's course
CREATE POLICY "kc_responses_insert_own" ON knowledge_check_responses FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.jwt_claim('tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM knowledge_check_questions kcq
      JOIN modules m ON m.id = kcq.module_id
      JOIN course_enrollments ce ON ce.course_id = m.course_id
        AND ce.user_id = auth.uid()
      WHERE kcq.id = knowledge_check_responses.question_id
    )
  );

-- DELETE: platform admin only (for resets)
CREATE POLICY "kc_responses_delete_platform_admin" ON knowledge_check_responses FOR DELETE
  USING (public.jwt_claim('is_platform_admin') = 'true');

-- =============================================================================
-- SECURITY DEFINER RPC: check_knowledge_answer
-- Validates enrollment, looks up correct answer, inserts response, returns result.
-- =============================================================================
CREATE FUNCTION check_knowledge_answer(
  p_question_id uuid,
  p_selected_index integer
)
RETURNS jsonb AS $$
DECLARE
  _question record;
  _options jsonb;
  _correct_index integer;
  _is_correct boolean;
  _explanation text;
  _user_id uuid;
  _tenant_id uuid;
BEGIN
  _user_id := auth.uid();
  _tenant_id := public.jwt_claim('tenant_id')::uuid;

  -- 1. Fetch question and course_id
  SELECT kcq.*, m.course_id INTO _question
  FROM knowledge_check_questions kcq
  JOIN modules m ON m.id = kcq.module_id
  WHERE kcq.id = p_question_id;

  IF _question IS NULL THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  -- 2. Verify enrollment
  IF NOT EXISTS (
    SELECT 1 FROM course_enrollments ce
    WHERE ce.course_id = _question.course_id
      AND ce.user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not enrolled in this course';
  END IF;

  -- 3. Check if already answered
  IF EXISTS (
    SELECT 1 FROM knowledge_check_responses
    WHERE question_id = p_question_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Already answered this question';
  END IF;

  -- 4. Find correct answer from options JSONB
  _options := _question.options;
  _correct_index := NULL;
  _explanation := _question.explanation;

  FOR i IN 0..(jsonb_array_length(_options) - 1) LOOP
    IF (_options->i->>'isCorrect')::boolean = true THEN
      _correct_index := i;
      EXIT;
    END IF;
  END LOOP;

  _is_correct := (p_selected_index = _correct_index);

  -- 5. Insert response
  INSERT INTO knowledge_check_responses (question_id, user_id, tenant_id, selected_option_index, is_correct)
  VALUES (p_question_id, _user_id, _tenant_id, p_selected_index, _is_correct);

  -- 6. Return result
  RETURN jsonb_build_object(
    'is_correct', _is_correct,
    'correct_index', _correct_index,
    'explanation', _explanation
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
