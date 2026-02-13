-- Migration 00030: Auto-mark external quiz completed — progress trigger
-- Phase 5B
--
-- When an external quiz platform sends a passing result via the webhook
-- (POST /api/quiz-results/external), the FastAPI endpoint inserts into
-- external_quiz_results. This AFTER INSERT trigger auto-marks the
-- corresponding module's user_progress as completed.
--
-- Follows the exact pattern from migration 00026 (auto_mark_quiz_completed).
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_mark_external_quiz_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_module_id uuid;
  v_lecture_id uuid;
  v_course_id uuid;
BEGIN
  -- Only auto-mark when passed = true
  IF NEW.passed IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Resolve module via external_quiz_references → modules
  SELECT eqr.module_id, m.lecture_id, m.course_id
  INTO v_module_id, v_lecture_id, v_course_id
  FROM external_quiz_references eqr
  JOIN modules m ON m.id = eqr.module_id
  WHERE eqr.external_quiz_id = NEW.external_quiz_id
  LIMIT 1;

  IF v_module_id IS NOT NULL THEN
    INSERT INTO user_progress (user_id, tenant_id, course_id, lecture_id, module_id, status, completed_at, marked_by)
    VALUES (NEW.user_id, NEW.tenant_id, v_course_id, v_lecture_id, v_module_id, 'completed', now(), 'system')
    ON CONFLICT (user_id, tenant_id, module_id) DO UPDATE
    SET status = 'completed', completed_at = now(), marked_by = 'system';
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_mark_external_quiz_completed failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_external_quiz_passed
  AFTER INSERT ON external_quiz_results
  FOR EACH ROW EXECUTE FUNCTION auto_mark_external_quiz_completed();
