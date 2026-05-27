-- ============================================================================
-- Migration 00062: get_questions_board_data RPC
-- ============================================================================
-- Replaces the unbounded SELECT in expert-question.service.ts:99-107 with
-- 3-table embed. Returns flat row per question with joined course/module/
-- asker fields. Avatar signed-URL resolution stays in frontend.
--
-- Permission contract mirrors expert_questions RLS policies:
--   PA: all
--   TA: own tenant
--   CSM: assigned tenants
--   Lecturer: assigned courses (cross-tenant)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_questions_board_data()
RETURNS TABLE (
  question_id uuid,
  user_id uuid,
  tenant_id uuid,
  course_id uuid,
  module_id uuid,
  question_text text,
  status expert_question_status,
  response_text text,
  responded_by uuid,
  responded_at timestamptz,
  created_at timestamptz,
  course_title text,
  module_title text,
  asker_full_name text,
  asker_email text,
  asker_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _is_pa boolean := public.jwt_claim('is_platform_admin') = 'true';
  _is_ta boolean := public.jwt_claim('is_tenant_admin') = 'true';
  _tenant uuid := nullif(public.jwt_claim('tenant_id'),'')::uuid;
  _csm_ids uuid[] := public.jwt_claim_array('csm_tenant_ids')::uuid[];
  _lec_ids uuid[] := public.jwt_claim_array('lecturer_course_ids')::uuid[];
BEGIN
  IF NOT (_is_pa OR _is_ta
          OR coalesce(array_length(_csm_ids, 1), 0) > 0
          OR coalesce(array_length(_lec_ids, 1), 0) > 0) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    eq.id,
    eq.user_id,
    eq.tenant_id,
    eq.course_id,
    eq.module_id,
    eq.question_text,
    eq.status,
    eq.response_text,
    eq.responded_by,
    eq.responded_at,
    eq.created_at,
    c.title,
    m.title,
    p.full_name,
    p.email,
    p.avatar_url
  FROM expert_questions eq
  LEFT JOIN courses c ON c.id = eq.course_id
  LEFT JOIN modules m ON m.id = eq.module_id
  LEFT JOIN profiles p ON p.id = eq.user_id
  WHERE _is_pa
     OR (_is_ta AND eq.tenant_id = _tenant)
     OR eq.tenant_id = ANY(_csm_ids)
     OR eq.course_id = ANY(_lec_ids)
  ORDER BY eq.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_questions_board_data() TO authenticated;

-- Rollback: DROP FUNCTION IF EXISTS public.get_questions_board_data();
