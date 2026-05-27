-- ============================================================================
-- Migration 00055: get_user_xp_breakdown RPC
-- ============================================================================
-- Consolidates the 10 parallel queries in xp.service.ts:184-215 into a single
-- aggregation RPC. Eliminates the unbounded quiz_questions scan (Phase 1
-- paginated it; Phase 2 replaces it with server-side GROUP BY).
--
-- XP formula (mirrors computeXp() in xp.service.ts:71-115):
--   modules:           completed_modules * 10
--   quizzes:           sum_per_pass(question_count * (2 if first else 1) + round(score/10))
--                      first-pass detected via ROW_NUMBER() OVER (PARTITION BY quiz_id ORDER BY started_at)
--                      question_count falls back to 10 if quiz has no questions (matches "?? 10" line 84)
--   exams:             sum(50 + round(score/5)) over graded submissions + external_quiz_passes * 20
--   knowledge_checks:  correct_responses * 5
--   engagement:        comments*3 + comment_replies*2 + expert_questions*5 + course_enrollments*5
--
-- Permission contract: own breakdown OR platform admin (matches the per-table
-- own/PA RLS combination on user_progress / quiz_attempts / exam_submissions /
-- external_quiz_results / knowledge_check_responses / comments / comment_replies /
-- expert_questions / course_enrollments).
--
-- Performance budget: <100ms p95 — called by loadXp(true) after every
-- module-complete / quiz-pass / knowledge-check-correct action.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_xp_breakdown(p_user_id uuid DEFAULT auth.uid())
RETURNS TABLE (
  modules_xp int,
  quizzes_xp int,
  exams_xp int,
  knowledge_checks_xp int,
  engagement_xp int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id required';
  END IF;

  IF p_user_id <> auth.uid() AND public.jwt_claim('is_platform_admin') <> 'true' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH q_counts AS (
    SELECT quiz_id, count(*)::int AS qcount
    FROM quiz_questions
    GROUP BY quiz_id
  ),
  ranked_passes AS (
    SELECT
      qa.quiz_id,
      coalesce(qa.score, 0) AS score,
      coalesce(qc.qcount, 10) AS qcount,
      ROW_NUMBER() OVER (PARTITION BY qa.quiz_id ORDER BY qa.started_at) AS pass_idx
    FROM quiz_attempts qa
    LEFT JOIN q_counts qc ON qc.quiz_id = qa.quiz_id
    WHERE qa.user_id = p_user_id AND qa.passed = true
  )
  SELECT
    (SELECT coalesce(count(*), 0)::int FROM user_progress
      WHERE user_id = p_user_id AND status = 'completed') * 10,
    coalesce((
      SELECT sum(qcount * (CASE WHEN pass_idx = 1 THEN 2 ELSE 1 END) + round(score / 10))::int
      FROM ranked_passes
    ), 0),
    coalesce((SELECT sum(50 + round(score / 5))::int
              FROM exam_submissions
              WHERE user_id = p_user_id AND score IS NOT NULL), 0)
      + (SELECT coalesce(count(*), 0)::int
         FROM external_quiz_results
         WHERE user_id = p_user_id AND passed = true) * 20,
    (SELECT coalesce(count(*), 0)::int FROM knowledge_check_responses
      WHERE user_id = p_user_id AND is_correct = true) * 5,
    (SELECT coalesce(count(*), 0)::int FROM comments WHERE user_id = p_user_id) * 3
      + (SELECT coalesce(count(*), 0)::int FROM comment_replies WHERE user_id = p_user_id) * 2
      + (SELECT coalesce(count(*), 0)::int FROM expert_questions WHERE user_id = p_user_id) * 5
      + (SELECT coalesce(count(*), 0)::int FROM course_enrollments WHERE user_id = p_user_id) * 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_xp_breakdown(uuid) TO authenticated;

-- Rollback: DROP FUNCTION IF EXISTS public.get_user_xp_breakdown(uuid);

-- Performance verification snippet (run manually after push):
--   EXPLAIN ANALYZE SELECT * FROM get_user_xp_breakdown('<learner-uuid>');
--   If quiz_attempts scan is slow, add:
--     CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_passed
--       ON quiz_attempts (user_id, passed, quiz_id, started_at)
--       WHERE passed = true;
