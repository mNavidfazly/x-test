-- ============================================================================
-- Migration 00060: get_progress_dashboard_data RPC
-- ============================================================================
-- Consolidates the 4 parallel queries + optional 5th tenants query in
-- progress.service.ts:40-61 into a single aggregation RPC. Pre-aggregates
-- per-user-per-course completion counts server-side, eliminating the
-- client-side Map<userId, Map<courseId>> building.
--
-- Returns one row per visible enrollment with the user/course/tenant fields
-- already joined and the per-course completed count pre-computed. Frontend
-- then groups by user_id (small in-JS reduction).
--
-- Permission contract (4 role branches, mirrors RLS on course_enrollments
-- and user_progress):
--   PA:       all enrollments
--   TA:       own tenant only
--   CSM:      enrollments in assigned tenants
--   Lecturer: enrollments in assigned courses (cross-tenant)
--   Learner:  RAISE EXCEPTION (blocked by route guard, but defense in depth)
--
-- tenant_name returned only when caller is PA or CSM (matches
-- isPAOrCSM check at progress.service.ts:37 — frontend showTenantColumn
-- computed). TA / Lecturer get NULL — those roles can't even query tenants.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_progress_dashboard_data()
RETURNS TABLE (
  user_id uuid,
  tenant_id uuid,
  tenant_name text,
  email text,
  full_name text,
  course_id uuid,
  course_title text,
  completed int,
  total int,
  last_updated timestamptz
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
  _include_tenant_name boolean;
BEGIN
  IF NOT (_is_pa OR _is_ta
          OR coalesce(array_length(_csm_ids, 1), 0) > 0
          OR coalesce(array_length(_lec_ids, 1), 0) > 0) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  _include_tenant_name := _is_pa OR coalesce(array_length(_csm_ids, 1), 0) > 0;

  RETURN QUERY
  WITH visible AS (
    SELECT DISTINCT e.user_id, e.tenant_id, e.course_id
    FROM course_enrollments e
    WHERE _is_pa
       OR (_is_ta AND e.tenant_id = _tenant)
       OR e.tenant_id = ANY(_csm_ids)
       OR e.course_id = ANY(_lec_ids)
  ),
  module_totals AS (
    SELECT m.course_id, count(*)::int AS total FROM modules m GROUP BY m.course_id
  )
  SELECT
    v.user_id,
    v.tenant_id,
    CASE WHEN _include_tenant_name
      THEN (SELECT t.name FROM tenants t WHERE t.id = v.tenant_id)
      ELSE NULL
    END,
    p.email,
    p.full_name,
    v.course_id,
    c.title,
    (SELECT coalesce(count(*), 0)::int FROM user_progress up
      WHERE up.user_id = v.user_id
        AND up.course_id = v.course_id
        AND up.status = 'completed'),
    coalesce(mt.total, 0),
    (SELECT max(up.updated_at) FROM user_progress up
      WHERE up.user_id = v.user_id AND up.course_id = v.course_id)
  FROM visible v
  JOIN profiles p ON p.id = v.user_id
  JOIN courses c ON c.id = v.course_id
  LEFT JOIN module_totals mt ON mt.course_id = v.course_id
  ORDER BY p.email, c.title;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_progress_dashboard_data() TO authenticated;

-- Rollback: DROP FUNCTION IF EXISTS public.get_progress_dashboard_data();
