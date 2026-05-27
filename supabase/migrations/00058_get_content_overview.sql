-- ============================================================================
-- Migration 00058: get_content_overview RPC
-- ============================================================================
-- Replaces the deeply-nested embed at content-management.service.ts:55-66 that
-- pulls courses → lectures → modules with tenant_courses(count). PostgREST
-- embedded children count against the 1000-row cap per parent row — risky
-- once a single course exceeds ~1000 modules.
--
-- Returns a flat row per course with all nested data pre-computed in jsonb:
-- lectures (with their modules + staleness flags), modules_by_type counts,
-- stale/fresh/postponed counts, last update timestamp, total duration.
--
-- Permission contract: PA-only — matches the route guard
-- roleGuard('platform_admin') on /platform/content (per CM user stories).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_content_overview()
RETURNS TABLE (
  course_id uuid,
  title text,
  description text,
  thumbnail_url text,
  enrollment_type enrollment_type,
  staleness_threshold_days int,
  updated_at timestamptz,
  tenant_count int,
  lecture_count int,
  total_modules int,
  modules_by_type jsonb,
  stale_module_count int,
  postponed_module_count int,
  last_module_update timestamptz,
  total_duration_minutes int,
  lectures jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF public.jwt_claim('is_platform_admin') <> 'true' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH module_flags AS (
    SELECT
      m.id,
      m.title,
      m.module_type,
      m.sort_order,
      m.estimated_duration_minutes,
      m.updated_at,
      m.staleness_postponed_until,
      m.lecture_id,
      m.course_id,
      coalesce(c.staleness_threshold_days, 180) AS threshold,
      floor(extract(epoch FROM (now() - m.updated_at)) / 86400)::int AS days_since_update,
      (m.staleness_postponed_until IS NOT NULL AND m.staleness_postponed_until > now()) AS is_postponed,
      ((extract(epoch FROM (now() - m.updated_at)) / 86400) > coalesce(c.staleness_threshold_days, 180)) AS is_past_threshold
    FROM modules m
    JOIN courses c ON c.id = m.course_id
  )
  SELECT
    c.id,
    c.title,
    c.description,
    c.thumbnail_url,
    c.enrollment_type,
    coalesce(c.staleness_threshold_days, 180),
    c.updated_at,
    (SELECT coalesce(count(*), 0)::int FROM tenant_courses WHERE course_id = c.id),
    (SELECT coalesce(count(*), 0)::int FROM lectures WHERE course_id = c.id),
    (SELECT coalesce(count(*), 0)::int FROM module_flags WHERE course_id = c.id),
    coalesce((SELECT jsonb_object_agg(module_type, cnt)
      FROM (SELECT module_type, count(*)::int AS cnt FROM module_flags
            WHERE course_id = c.id GROUP BY module_type) sub), '{}'::jsonb),
    (SELECT coalesce(count(*) FILTER (WHERE is_past_threshold AND NOT is_postponed), 0)::int
      FROM module_flags WHERE course_id = c.id),
    (SELECT coalesce(count(*) FILTER (WHERE is_postponed), 0)::int
      FROM module_flags WHERE course_id = c.id),
    (SELECT max(updated_at) FROM module_flags WHERE course_id = c.id),
    coalesce((SELECT sum(estimated_duration_minutes)::int FROM module_flags WHERE course_id = c.id), 0),
    coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'title', l.title,
        'sort_order', l.sort_order,
        'modules', coalesce((
          SELECT jsonb_agg(jsonb_build_object(
            'id', mf.id,
            'title', mf.title,
            'module_type', mf.module_type,
            'sort_order', mf.sort_order,
            'estimated_duration_minutes', mf.estimated_duration_minutes,
            'updated_at', mf.updated_at,
            'days_since_update', mf.days_since_update,
            'is_stale', mf.is_past_threshold AND NOT mf.is_postponed,
            'is_postponed', mf.is_postponed,
            'postponed_until', mf.staleness_postponed_until
          ) ORDER BY mf.sort_order)
          FROM module_flags mf
          WHERE mf.lecture_id = l.id
        ), '[]'::jsonb)
      ) ORDER BY l.sort_order)
      FROM lectures l
      WHERE l.course_id = c.id
    ), '[]'::jsonb)
  FROM courses c
  ORDER BY c.title;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_content_overview() TO authenticated;

-- Rollback: DROP FUNCTION IF EXISTS public.get_content_overview();
