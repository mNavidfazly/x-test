-- ============================================================================
-- Migration 00059: Fix ambiguous column reference in get_content_overview
-- ============================================================================
-- PL/pgSQL output column `course_id` (from RETURNS TABLE) shadowed the
-- physical `course_id` columns on tenant_courses / lectures / modules /
-- module_flags inside subqueries. Postgres raises
-- "column reference \"course_id\" is ambiguous" on every call.
--
-- Fix: qualify every `course_id` reference inside subqueries with its table
-- alias. No semantic change — same query shape as 00058.
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
    (SELECT coalesce(count(*), 0)::int FROM tenant_courses tc WHERE tc.course_id = c.id),
    (SELECT coalesce(count(*), 0)::int FROM lectures l2 WHERE l2.course_id = c.id),
    (SELECT coalesce(count(*), 0)::int FROM module_flags mf WHERE mf.course_id = c.id),
    coalesce((SELECT jsonb_object_agg(sub.module_type, sub.cnt)
      FROM (SELECT mf.module_type, count(*)::int AS cnt FROM module_flags mf
            WHERE mf.course_id = c.id GROUP BY mf.module_type) sub), '{}'::jsonb),
    (SELECT coalesce(count(*) FILTER (WHERE mf.is_past_threshold AND NOT mf.is_postponed), 0)::int
      FROM module_flags mf WHERE mf.course_id = c.id),
    (SELECT coalesce(count(*) FILTER (WHERE mf.is_postponed), 0)::int
      FROM module_flags mf WHERE mf.course_id = c.id),
    (SELECT max(mf.updated_at) FROM module_flags mf WHERE mf.course_id = c.id),
    coalesce((SELECT sum(mf.estimated_duration_minutes)::int FROM module_flags mf WHERE mf.course_id = c.id), 0),
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

-- Rollback: revert to migration 00058 definition
