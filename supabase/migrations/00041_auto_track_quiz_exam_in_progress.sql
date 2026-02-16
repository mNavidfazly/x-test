-- Migration 00041: Auto-track in_progress for quiz/exam modules
--
-- When a learner starts a quiz (INSERT into quiz_attempts) or submits an exam
-- (INSERT into exam_submissions), auto-create an in_progress user_progress row.
-- Uses ON CONFLICT DO NOTHING to never overwrite existing progress (e.g., completed).
-- Belt-and-suspenders: the frontend already sets in_progress on page view,
-- but these triggers catch cases where the frontend fire-and-forget fails.

-- 1. Quiz: set in_progress when a quiz attempt is created
CREATE OR REPLACE FUNCTION auto_mark_quiz_in_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_module_id uuid;
  v_lecture_id uuid;
  v_course_id uuid;
BEGIN
  SELECT m.id, m.lecture_id, m.course_id
  INTO v_module_id, v_lecture_id, v_course_id
  FROM quizzes q JOIN modules m ON m.id = q.module_id
  WHERE q.id = NEW.quiz_id;

  IF v_module_id IS NOT NULL THEN
    INSERT INTO user_progress (user_id, tenant_id, course_id, lecture_id, module_id, status, marked_by)
    VALUES (NEW.user_id, NEW.tenant_id, v_course_id, v_lecture_id, v_module_id, 'in_progress', 'system')
    ON CONFLICT (user_id, tenant_id, module_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_mark_quiz_in_progress failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_quiz_attempt_started
  AFTER INSERT ON quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION auto_mark_quiz_in_progress();

-- 2. Exam: set in_progress when an exam submission is created
CREATE OR REPLACE FUNCTION auto_mark_exam_in_progress()
RETURNS TRIGGER AS $$
DECLARE
  v_module_id uuid;
  v_lecture_id uuid;
  v_course_id uuid;
BEGIN
  SELECT e.module_id, m.lecture_id, m.course_id
  INTO v_module_id, v_lecture_id, v_course_id
  FROM exams e JOIN modules m ON m.id = e.module_id
  WHERE e.id = NEW.exam_id;

  IF v_module_id IS NOT NULL THEN
    INSERT INTO user_progress (user_id, tenant_id, course_id, lecture_id, module_id, status, marked_by)
    VALUES (NEW.user_id, NEW.tenant_id, v_course_id, v_lecture_id, v_module_id, 'in_progress', 'system')
    ON CONFLICT (user_id, tenant_id, module_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'auto_mark_exam_in_progress failed: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_exam_submission_in_progress
  AFTER INSERT ON exam_submissions
  FOR EACH ROW EXECUTE FUNCTION auto_mark_exam_in_progress();
