-- ============================================================================
-- Migration 00056: get_teaching_overview RPC
-- ============================================================================
-- Consolidates 6 parallel queries in teaching-overview.service.ts:40-46 into a
-- single aggregation RPC. Eliminates the unbounded modules scan (currently
-- 843 rows in prod, approaching the 1000-row cap).
--
-- Returns one row per course visible to caller, with per-course KPI counts:
--   enrolled_count, pending_exams, pending_questions, open_issues,
--   stale_modules, total_modules, and the can_edit/can_grade flags used by
--   the page UI for badge rendering.
--
-- Permission contract: matches the existing client-side filter at
-- teaching-overview.service.ts:68-70 — visible courses are PA-all or
-- lecturer-assigned. pending_exams is conditionally 0 when canGrade is false
-- (preserves TO-BUG-01 fix at teaching-overview.service.ts:104).
--
-- Staleness formula matches client logic (lines 90-95):
--   stale = (now - updated_at) > threshold_days
--           AND (postponed_until IS NULL OR postponed_until < now)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_teaching_overview()
RETURNS TABLE (
  course_id uuid,
  title text,
  staleness_threshold_days int,
  enrolled_count int,
  pending_exams int,
  pending_questions int,
  open_issues int,
  stale_modules int,
  total_modules int,
  can_edit boolean,
  can_grade boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _is_pa     boolean := public.jwt_claim('is_platform_admin') = 'true';
  _lec_ids   uuid[]  := public.jwt_claim_array('lecturer_course_ids')::uuid[];
  _edit_ids  uuid[]  := public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[];
  _grade_ids uuid[]  := public.jwt_claim_array('lecturer_can_grade_course_ids')::uuid[];
BEGIN
  IF NOT (_is_pa OR coalesce(array_length(_lec_ids, 1), 0) > 0) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT c.id, c.title, coalesce(c.staleness_threshold_days, 180) AS threshold
    FROM courses c
    WHERE _is_pa OR c.id = ANY(_lec_ids)
  )
  SELECT
    v.id,
    v.title,
    v.threshold,
    (SELECT coalesce(count(*), 0)::int FROM course_enrollments
      WHERE course_id = v.id),
    CASE WHEN _is_pa OR v.id = ANY(_grade_ids)
      THEN (SELECT coalesce(count(*), 0)::int FROM exam_submissions
            WHERE course_id = v.id AND score IS NULL)
      ELSE 0
    END,
    (SELECT coalesce(count(*), 0)::int FROM expert_questions
      WHERE course_id = v.id AND status = 'pending'),
    (SELECT coalesce(count(*), 0)::int FROM issues
      WHERE course_id = v.id AND status IN ('open', 'investigating')),
    (SELECT coalesce(count(*), 0)::int FROM modules m
      WHERE m.course_id = v.id
        AND (extract(epoch FROM (now() - m.updated_at)) / 86400) > v.threshold
        AND (m.staleness_postponed_until IS NULL
             OR m.staleness_postponed_until < now())),
    (SELECT coalesce(count(*), 0)::int FROM modules WHERE course_id = v.id),
    _is_pa OR v.id = ANY(_edit_ids),
    _is_pa OR v.id = ANY(_grade_ids)
  FROM visible v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_teaching_overview() TO authenticated;

-- Rollback: DROP FUNCTION IF EXISTS public.get_teaching_overview();
