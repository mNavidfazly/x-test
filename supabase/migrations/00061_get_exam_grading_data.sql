-- ============================================================================
-- Migration 00061: get_exam_grading_data RPC
-- ============================================================================
-- Replaces the unbounded SELECT in exam-grading.service.ts:33 with 3-table
-- embed. Pre-joins profile / exam / course fields and returns a flat row per
-- submission with the file storage path (signed URL resolution stays in
-- frontend per-row).
--
-- Permission contract mirrors exam_submissions_select_lecturer and
-- exam_submissions_select_platform_admin: PA or lecturer with can_grade.
-- Tenant Admins do NOT grade exams (not in plan / not in policy).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_exam_grading_data()
RETURNS TABLE (
  submission_id uuid,
  user_id uuid,
  tenant_id uuid,
  exam_id uuid,
  course_id uuid,
  file_url text,
  submitted_at timestamptz,
  deadline timestamptz,
  score numeric,
  feedback text,
  graded_by uuid,
  graded_at timestamptz,
  learner_email text,
  learner_full_name text,
  learner_avatar_url text,
  exam_title text,
  passing_score numeric,
  course_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _is_pa boolean := public.jwt_claim('is_platform_admin') = 'true';
  _grade_ids uuid[] := public.jwt_claim_array('lecturer_can_grade_course_ids')::uuid[];
BEGIN
  IF NOT (_is_pa OR coalesce(array_length(_grade_ids, 1), 0) > 0) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    es.id,
    es.user_id,
    es.tenant_id,
    es.exam_id,
    es.course_id,
    es.file_url,
    es.submitted_at,
    es.deadline,
    es.score,
    es.feedback,
    es.graded_by,
    es.graded_at,
    p.email,
    p.full_name,
    p.avatar_url,
    e.title,
    e.passing_score,
    c.title
  FROM exam_submissions es
  JOIN profiles p ON p.id = es.user_id
  JOIN exams e ON e.id = es.exam_id
  JOIN courses c ON c.id = es.course_id
  WHERE _is_pa OR es.course_id = ANY(_grade_ids)
  ORDER BY es.submitted_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exam_grading_data() TO authenticated;

-- Rollback: DROP FUNCTION IF EXISTS public.get_exam_grading_data();
