-- Migration 00026: Progress Tracking — Admin INSERT policies + auto-mark triggers + significant update reset
-- Phase 4B

-- ============================================================================
-- 1. Admin INSERT policies on user_progress
-- ============================================================================

-- PA can insert progress for any user (admin override)
CREATE POLICY progress_insert_platform_admin ON user_progress
  FOR INSERT WITH CHECK (
    public.jwt_claim('is_platform_admin') = 'true'
  );

-- TA can insert progress for users in their tenant
CREATE POLICY progress_insert_tenant_admin ON user_progress
  FOR INSERT WITH CHECK (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

-- ============================================================================
-- 2. Auto-mark quiz completed trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_mark_quiz_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_module_id uuid;
  v_lecture_id uuid;
  v_course_id uuid;
BEGIN
  IF NEW.passed = true AND (OLD.passed IS NULL OR OLD.passed = false) THEN
    SELECT m.id, m.lecture_id, m.course_id
    INTO v_module_id, v_lecture_id, v_course_id
    FROM quizzes q JOIN modules m ON m.id = q.module_id
    WHERE q.id = NEW.quiz_id;

    IF v_module_id IS NOT NULL THEN
      INSERT INTO user_progress (user_id, tenant_id, course_id, lecture_id, module_id, status, completed_at, marked_by)
      VALUES (NEW.user_id, NEW.tenant_id, v_course_id, v_lecture_id, v_module_id, 'completed', now(), 'system')
      ON CONFLICT (user_id, tenant_id, module_id) DO UPDATE
      SET status = 'completed', completed_at = now(), marked_by = 'system';
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_mark_quiz_completed failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_quiz_passed
  AFTER UPDATE ON quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION auto_mark_quiz_completed();

-- ============================================================================
-- 3. Auto-mark exam completed trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_mark_exam_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_module_id uuid;
  v_lecture_id uuid;
  v_course_id uuid;
  v_passing_score numeric;
BEGIN
  IF NEW.score IS NOT NULL AND OLD.score IS NULL THEN
    SELECT e.module_id, e.passing_score, m.lecture_id, m.course_id
    INTO v_module_id, v_passing_score, v_lecture_id, v_course_id
    FROM exams e JOIN modules m ON m.id = e.module_id
    WHERE e.id = NEW.exam_id;

    IF v_module_id IS NOT NULL AND NEW.score >= v_passing_score THEN
      INSERT INTO user_progress (user_id, tenant_id, course_id, lecture_id, module_id, status, completed_at, marked_by)
      VALUES (NEW.user_id, NEW.tenant_id, v_course_id, v_lecture_id, v_module_id, 'completed', now(), 'system')
      ON CONFLICT (user_id, tenant_id, module_id) DO UPDATE
      SET status = 'completed', completed_at = now(), marked_by = 'system';
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_mark_exam_completed failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_exam_passed_auto_mark
  AFTER UPDATE ON exam_submissions
  FOR EACH ROW EXECUTE FUNCTION auto_mark_exam_completed();

-- ============================================================================
-- 4. Significant update progress reset trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_progress_on_significant_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.significant_update_at IS DISTINCT FROM OLD.significant_update_at
    AND NEW.significant_update_at IS NOT NULL THEN
    UPDATE user_progress
    SET status = 'not_started',
        completed_at = NULL,
        marked_by = NULL,
        notes = 'Reset due to significant content update'
    WHERE module_id = NEW.id
      AND status = 'completed'
      AND completed_at < NEW.significant_update_at;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'reset_progress_on_significant_update failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_significant_module_update
  AFTER UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION reset_progress_on_significant_update();
