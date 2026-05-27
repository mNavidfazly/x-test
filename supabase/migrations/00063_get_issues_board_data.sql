-- ============================================================================
-- Migration 00063: get_issues_board_data RPC
-- ============================================================================
-- Replaces the unbounded SELECT in issue.service.ts:106-114 with 3-table
-- embed. Returns flat row per issue with joined course/module/reporter.
-- Includes internal_notes column (board users see it; learner-facing
-- "My Issues" page reads via issues_safe view which strips internal_notes).
--
-- Permission contract mirrors issues RLS policies:
--   PA: all
--   CSM: assigned tenants
--   Lecturer: assigned courses (cross-tenant)
-- TA reads via issues_safe view (no internal_notes) — separate path.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_issues_board_data()
RETURNS TABLE (
  issue_id uuid,
  user_id uuid,
  tenant_id uuid,
  course_id uuid,
  module_id uuid,
  issue_type issue_type,
  description text,
  status issue_status,
  internal_notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  course_title text,
  module_title text,
  reporter_full_name text,
  reporter_email text,
  reporter_avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _is_pa boolean := public.jwt_claim('is_platform_admin') = 'true';
  _csm_ids uuid[] := public.jwt_claim_array('csm_tenant_ids')::uuid[];
  _lec_ids uuid[] := public.jwt_claim_array('lecturer_course_ids')::uuid[];
BEGIN
  IF NOT (_is_pa
          OR coalesce(array_length(_csm_ids, 1), 0) > 0
          OR coalesce(array_length(_lec_ids, 1), 0) > 0) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.user_id,
    i.tenant_id,
    i.course_id,
    i.module_id,
    i.issue_type,
    i.description,
    i.status,
    i.internal_notes,
    i.resolved_at,
    i.resolved_by,
    i.created_at,
    i.updated_at,
    c.title,
    m.title,
    p.full_name,
    p.email,
    p.avatar_url
  FROM issues i
  LEFT JOIN courses c ON c.id = i.course_id
  LEFT JOIN modules m ON m.id = i.module_id
  LEFT JOIN profiles p ON p.id = i.user_id
  WHERE _is_pa
     OR i.tenant_id = ANY(_csm_ids)
     OR i.course_id = ANY(_lec_ids)
  ORDER BY i.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_issues_board_data() TO authenticated;

-- Rollback: DROP FUNCTION IF EXISTS public.get_issues_board_data();
