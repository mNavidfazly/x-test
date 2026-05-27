-- ============================================================================
-- Migration 00057: get_staleness_data RPC
-- ============================================================================
-- Replaces the 2 unbounded queries in staleness.service.ts:50-53 (modules
-- table approaching 1000-row cap). Returns one row per visible course with
-- the full module list nested as jsonb, so the existing client-side sort +
-- postponeAllStaleModules logic continues to work without UX changes.
--
-- Permission contract matches the existing client-side filter at
-- staleness.service.ts:62-64: PA-all or lecturer-assigned courses only.
--
-- Staleness math mirrors client formula:
--   isPostponed = staleness_postponed_until > now
--   isStale = (now - updated_at) > threshold_days * 1 day AND NOT isPostponed
--   daysOverdue = (days_since_update - threshold) if past threshold else null
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_staleness_data()
RETURNS TABLE (
  course_id uuid,
  title text,
  threshold_days int,
  modules jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _is_pa boolean := public.jwt_claim('is_platform_admin') = 'true';
  _lec_ids uuid[] := public.jwt_claim_array('lecturer_course_ids')::uuid[];
BEGIN
  IF NOT (_is_pa OR coalesce(array_length(_lec_ids, 1), 0) > 0) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT c.id, c.title, coalesce(c.staleness_threshold_days, 180) AS threshold
    FROM courses c
    WHERE _is_pa OR c.id = ANY(_lec_ids)
  ),
  module_rows AS (
    SELECT
      m.id,
      m.title,
      m.module_type,
      m.course_id,
      m.updated_at,
      m.staleness_postponed_until,
      v.threshold,
      floor(extract(epoch FROM (now() - m.updated_at)) / 86400)::int AS days_since_update,
      (m.staleness_postponed_until IS NOT NULL
        AND m.staleness_postponed_until > now()) AS is_postponed,
      ((extract(epoch FROM (now() - m.updated_at)) / 86400) > v.threshold) AS is_past_threshold
    FROM modules m
    JOIN visible v ON v.id = m.course_id
  )
  SELECT
    v.id,
    v.title,
    v.threshold,
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', mr.id,
        'title', mr.title,
        'module_type', mr.module_type,
        'updated_at', mr.updated_at,
        'days_since_update', mr.days_since_update,
        'is_stale', mr.is_past_threshold AND NOT mr.is_postponed,
        'days_overdue', CASE WHEN mr.is_past_threshold
                             THEN mr.days_since_update - mr.threshold
                             ELSE NULL END,
        'postponed_until', mr.staleness_postponed_until,
        'is_postponed', mr.is_postponed
      ) ORDER BY mr.id)
      FROM module_rows mr
      WHERE mr.course_id = v.id
    ), '[]'::jsonb) AS modules
  FROM visible v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staleness_data() TO authenticated;

-- Rollback: DROP FUNCTION IF EXISTS public.get_staleness_data();
