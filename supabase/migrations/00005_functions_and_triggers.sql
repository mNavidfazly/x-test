-- ============================================================================
-- X-Course v2 - Migration 00005: Functions & Triggers
-- ============================================================================
-- All trigger functions (utility, enforcement, notification) and their
-- trigger attachments.
-- ============================================================================

-- ============================================================================
-- UTILITY TRIGGER FUNCTIONS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 7.1 Auto-update updated_at timestamp
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 7.2 Auto-create profile on user signup
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _tenant_id uuid;
  _domain text;
BEGIN
  -- Extract domain from email
  _domain := split_part(NEW.email, '@', 2);

  -- Look up tenant by domain (case-insensitive)
  SELECT id INTO _tenant_id
  FROM tenants
  WHERE lower(domain) = lower(_domain);

  -- If no tenant found, try to use metadata (for invited users)
  IF _tenant_id IS NULL AND NEW.raw_user_meta_data ? 'tenant_id' THEN
    _tenant_id := (NEW.raw_user_meta_data ->> 'tenant_id')::uuid;
  END IF;

  -- Create profile (tenant_id may be null if access request flow)
  IF _tenant_id IS NOT NULL THEN
    INSERT INTO profiles (id, tenant_id, email, full_name)
    VALUES (
      NEW.id,
      _tenant_id,
      NEW.email,
      coalesce(NEW.raw_user_meta_data ->> 'full_name', '')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 7.3 Enforce platform roles require master tenant
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_platform_roles_master_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_platform_admin = true THEN
    IF NOT EXISTS (
      SELECT 1 FROM tenants WHERE id = NEW.tenant_id AND is_master = true
    ) THEN
      RAISE EXCEPTION 'Platform admin role requires master tenant';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 7.4 Enforce modules.course_id matches lectures.course_id
-- --------------------------------------------------------------------------
-- The denormalized course_id on modules is critical for RLS performance.
-- This trigger ensures it stays consistent with the lecture's actual course.

CREATE OR REPLACE FUNCTION enforce_module_course_consistency()
RETURNS TRIGGER AS $$
DECLARE
  _lecture_course_id uuid;
BEGIN
  SELECT course_id INTO _lecture_course_id
  FROM lectures
  WHERE id = NEW.lecture_id;

  IF _lecture_course_id IS NULL THEN
    RAISE EXCEPTION 'Lecture % does not exist', NEW.lecture_id;
  END IF;

  IF NEW.course_id != _lecture_course_id THEN
    RAISE EXCEPTION 'modules.course_id (%) does not match the course_id of lecture % (%)',
      NEW.course_id, NEW.lecture_id, _lecture_course_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------------------------
-- 7.5 Enforce exam_submissions.course_id matches the exam's actual course
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_exam_submission_course()
RETURNS TRIGGER AS $$
DECLARE
  _actual_course_id uuid;
BEGIN
  SELECT m.course_id INTO _actual_course_id
  FROM exams e
  JOIN modules m ON m.id = e.module_id
  WHERE e.id = NEW.exam_id;

  IF _actual_course_id IS NULL THEN
    RAISE EXCEPTION 'Exam % does not exist or has no linked module', NEW.exam_id;
  END IF;

  IF NEW.course_id != _actual_course_id THEN
    RAISE EXCEPTION 'exam_submissions.course_id (%) does not match the actual course (%) for exam %',
      NEW.course_id, _actual_course_id, NEW.exam_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ATTACH updated_at TRIGGERS
-- ============================================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON lectures
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON comment_replies
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================================
-- PROFILE CREATION TRIGGER
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- MASTER TENANT ENFORCEMENT TRIGGER
-- ============================================================================

CREATE TRIGGER enforce_master_tenant_roles
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_platform_roles_master_tenant();

-- Denormalization consistency triggers
CREATE TRIGGER enforce_module_course
  BEFORE INSERT OR UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION enforce_module_course_consistency();

CREATE TRIGGER enforce_exam_sub_course
  BEFORE INSERT OR UPDATE ON exam_submissions
  FOR EACH ROW EXECUTE FUNCTION enforce_exam_submission_course();

-- --------------------------------------------------------------------------
-- 10A: Enforce CSM/Lecturer assignments require master tenant user
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION enforce_master_tenant_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    JOIN tenants t ON t.id = p.tenant_id
    WHERE p.id = NEW.user_id AND t.is_master = true
  ) THEN
    RAISE EXCEPTION 'Only users from the master tenant can be assigned as CSM or Lecturer';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_csm_master_tenant
  BEFORE INSERT OR UPDATE ON csm_tenant_assignments
  FOR EACH ROW EXECUTE FUNCTION enforce_master_tenant_assignment();

CREATE TRIGGER enforce_lecturer_master_tenant
  BEFORE INSERT OR UPDATE ON lecturer_course_assignments
  FOR EACH ROW EXECUTE FUNCTION enforce_master_tenant_assignment();

-- ============================================================================
-- PROFILE ROLE FIELD PROTECTION TRIGGER
-- ============================================================================
-- RLS cannot restrict which COLUMNS are updated, only which ROWS.
-- This trigger prevents privilege escalation by blocking unauthorized
-- changes to role fields (is_platform_admin, is_tenant_admin, tenant_id).

CREATE OR REPLACE FUNCTION protect_profile_role_fields()
RETURNS TRIGGER AS $$
DECLARE
  _is_platform_admin boolean;
  _is_tenant_admin boolean;
  _caller_tenant_id uuid;
BEGIN
  -- Extract caller's role from JWT
  _is_platform_admin := coalesce(public.jwt_claim('is_platform_admin'), '') = 'true';
  _is_tenant_admin := coalesce(public.jwt_claim('is_tenant_admin'), '') = 'true';
  _caller_tenant_id := nullif(public.jwt_claim('tenant_id'), '')::uuid;

  -- Platform admins can change anything — no restrictions
  IF _is_platform_admin THEN
    RETURN NEW;
  END IF;

  -- Nobody except platform admin can change is_platform_admin
  IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
    RAISE EXCEPTION 'Only platform admins can modify is_platform_admin';
  END IF;

  -- Nobody except platform admin can change tenant_id
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'Only platform admins can modify tenant_id';
  END IF;

  -- Tenant admins of the same tenant can toggle is_tenant_admin
  IF NEW.is_tenant_admin IS DISTINCT FROM OLD.is_tenant_admin THEN
    IF NOT (_is_tenant_admin AND _caller_tenant_id = OLD.tenant_id) THEN
      RAISE EXCEPTION 'Only tenant admins of the same tenant can modify is_tenant_admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE TRIGGER protect_profile_roles
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION protect_profile_role_fields();

-- ============================================================================
-- NOTIFICATION TRIGGER FUNCTIONS
-- ============================================================================

-- --------------------------------------------------------------------------
-- 11.1 Notify learner when enrolled in course
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_course_assigned()
RETURNS TRIGGER AS $$
DECLARE
  _course_title text;
BEGIN
  SELECT title INTO _course_title FROM courses WHERE id = NEW.course_id;

  INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
  VALUES (
    NEW.user_id,
    NEW.tenant_id,
    'course_assigned',
    'New course assigned',
    'You have been enrolled in: ' || coalesce(_course_title, 'a course'),
    jsonb_build_object('course_id', NEW.course_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 11.2 Notify enrolled learners when new module is added
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_new_module()
RETURNS TRIGGER AS $$
DECLARE
  _course_title text;
  _enrollment record;
BEGIN
  SELECT title INTO _course_title FROM courses WHERE id = NEW.course_id;

  FOR _enrollment IN
    SELECT user_id, tenant_id
    FROM course_enrollments
    WHERE course_id = NEW.course_id
  LOOP
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    VALUES (
      _enrollment.user_id,
      _enrollment.tenant_id,
      'new_module',
      'New content available',
      'A new module "' || NEW.title || '" has been added to ' || coalesce(_course_title, 'your course'),
      jsonb_build_object(
        'course_id', NEW.course_id,
        'module_id', NEW.id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 11.3 Notify learner when progress is reset due to significant update
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_progress_reset()
RETURNS TRIGGER AS $$
DECLARE
  _module_title text;
  _course_title text;
BEGIN
  -- Only fire when status changes to not_started from another status
  IF NEW.status = 'not_started' AND OLD.status != 'not_started' THEN
    SELECT m.title, c.title
    INTO _module_title, _course_title
    FROM modules m
    JOIN courses c ON c.id = m.course_id
    WHERE m.id = NEW.module_id;

    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      NEW.tenant_id,
      'progress_reset',
      'Module content updated',
      'Module "' || coalesce(_module_title, '') || '" in "' || coalesce(_course_title, '') || '" has been updated. Please review the new content.',
      jsonb_build_object(
        'course_id', NEW.course_id,
        'module_id', NEW.module_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 11.4 Notify learner when exam is graded
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_exam_graded()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when score changes from NULL to a value
  IF OLD.score IS NULL AND NEW.score IS NOT NULL THEN
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      NEW.tenant_id,
      'exam_graded',
      'Your exam has been graded',
      'Your exam submission has been reviewed. Click to see your results.',
      jsonb_build_object(
        'submission_id', NEW.id,
        'course_id', NEW.course_id,
        'exam_id', NEW.exam_id,
        'score', NEW.score
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 11.5 Notify learner when expert question is answered
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_question_answered()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when response_text changes from NULL to a value
  IF OLD.response_text IS NULL AND NEW.response_text IS NOT NULL THEN
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      NEW.tenant_id,
      'question_answered',
      'Your question has been answered',
      'An expert has responded to your question. Click to see the answer.',
      jsonb_build_object(
        'question_id', NEW.id,
        'course_id', NEW.course_id,
        'module_id', NEW.module_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 11.6 Notify learner when reminder is sent
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_reminder_sent()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
  VALUES (
    NEW.sent_to,
    NEW.tenant_id,
    'reminder',
    'Continue your learning',
    'You have incomplete courses. Continue learning to stay on track!',
    jsonb_build_object('course_id', NEW.course_id)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 11.7 Notify lecturers when new expert question is asked
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_new_expert_question()
RETURNS TRIGGER AS $$
DECLARE
  _lecturer record;
  _csm record;
  _learner_name text;
BEGIN
  SELECT full_name INTO _learner_name FROM profiles WHERE id = NEW.user_id;

  -- Notify lecturers assigned to the course
  FOR _lecturer IN
    SELECT lca.user_id, p.tenant_id
    FROM lecturer_course_assignments lca
    JOIN profiles p ON p.id = lca.user_id
    WHERE lca.course_id = NEW.course_id
  LOOP
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    VALUES (
      _lecturer.user_id,
      _lecturer.tenant_id,
      'new_expert_question',
      'New question from a learner',
      coalesce(_learner_name, 'A learner') || ' asked a question on your course.',
      jsonb_build_object(
        'question_id', NEW.id,
        'course_id', NEW.course_id,
        'module_id', NEW.module_id,
        'asker_tenant_id', NEW.tenant_id
      )
    );
  END LOOP;

  -- Notify CSMs assigned to the asker's tenant
  FOR _csm IN
    SELECT cta.user_id, p.tenant_id
    FROM csm_tenant_assignments cta
    JOIN profiles p ON p.id = cta.user_id
    WHERE cta.tenant_id = NEW.tenant_id
  LOOP
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    VALUES (
      _csm.user_id,
      _csm.tenant_id,
      'new_expert_question',
      'New question from a learner',
      coalesce(_learner_name, 'A learner') || ' asked a question on a course in your assigned tenant.',
      jsonb_build_object(
        'question_id', NEW.id,
        'course_id', NEW.course_id,
        'module_id', NEW.module_id,
        'asker_tenant_id', NEW.tenant_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 11.8 Notify lecturers when new exam submission arrives
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_new_exam_submission()
RETURNS TRIGGER AS $$
DECLARE
  _lecturer record;
  _learner_name text;
BEGIN
  SELECT full_name INTO _learner_name FROM profiles WHERE id = NEW.user_id;

  FOR _lecturer IN
    SELECT lca.user_id, p.tenant_id
    FROM lecturer_course_assignments lca
    JOIN profiles p ON p.id = lca.user_id
    WHERE lca.course_id = NEW.course_id
      AND lca.can_grade = true
  LOOP
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    VALUES (
      _lecturer.user_id,
      _lecturer.tenant_id,
      'new_exam_submission',
      'New exam submission to grade',
      coalesce(_learner_name, 'A learner') || ' submitted an exam for grading.',
      jsonb_build_object(
        'submission_id', NEW.id,
        'course_id', NEW.course_id,
        'exam_id', NEW.exam_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 11.9 Notify lecturers, CSMs, and platform admins when new issue is reported
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_new_issue()
RETURNS TRIGGER AS $$
DECLARE
  _recipient record;
  _reporter_name text;
  _notified_ids uuid[] := '{}';
BEGIN
  SELECT full_name INTO _reporter_name FROM profiles WHERE id = NEW.user_id;

  -- Notify lecturers assigned to the course
  FOR _recipient IN
    SELECT lca.user_id, p.tenant_id
    FROM lecturer_course_assignments lca
    JOIN profiles p ON p.id = lca.user_id
    WHERE lca.course_id = NEW.course_id
  LOOP
    IF NOT _recipient.user_id = ANY(_notified_ids) THEN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        _recipient.user_id,
        _recipient.tenant_id,
        'new_issue',
        'New issue reported',
        coalesce(_reporter_name, 'A user') || ' reported an issue: ' || NEW.issue_type::text,
        jsonb_build_object(
          'issue_id', NEW.id,
          'course_id', NEW.course_id,
          'module_id', NEW.module_id,
          'issue_type', NEW.issue_type
        )
      );
      _notified_ids := _notified_ids || _recipient.user_id;
    END IF;
  END LOOP;

  -- Notify CSMs assigned to the reporter's tenant
  FOR _recipient IN
    SELECT cta.user_id, p.tenant_id
    FROM csm_tenant_assignments cta
    JOIN profiles p ON p.id = cta.user_id
    WHERE cta.tenant_id = NEW.tenant_id
  LOOP
    IF NOT _recipient.user_id = ANY(_notified_ids) THEN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        _recipient.user_id,
        _recipient.tenant_id,
        'new_issue',
        'New issue reported',
        coalesce(_reporter_name, 'A user') || ' reported an issue: ' || NEW.issue_type::text,
        jsonb_build_object(
          'issue_id', NEW.id,
          'course_id', NEW.course_id,
          'module_id', NEW.module_id,
          'issue_type', NEW.issue_type
        )
      );
      _notified_ids := _notified_ids || _recipient.user_id;
    END IF;
  END LOOP;

  -- Notify platform admins
  FOR _recipient IN
    SELECT id AS user_id, tenant_id
    FROM profiles
    WHERE is_platform_admin = true
  LOOP
    IF NOT _recipient.user_id = ANY(_notified_ids) THEN
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        _recipient.user_id,
        _recipient.tenant_id,
        'new_issue',
        'New issue reported',
        coalesce(_reporter_name, 'A user') || ' reported an issue: ' || NEW.issue_type::text,
        jsonb_build_object(
          'issue_id', NEW.id,
          'course_id', NEW.course_id,
          'module_id', NEW.module_id,
          'issue_type', NEW.issue_type
        )
      );
      _notified_ids := _notified_ids || _recipient.user_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --------------------------------------------------------------------------
-- 11.10 Notify admins when new access request is created
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_new_access_request()
RETURNS TRIGGER AS $$
DECLARE
  _recipient record;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    -- Known domain: notify tenant admins of that tenant
    FOR _recipient IN
      SELECT id AS user_id, tenant_id
      FROM profiles
      WHERE tenant_id = NEW.tenant_id AND is_tenant_admin = true
    LOOP
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        _recipient.user_id,
        _recipient.tenant_id,
        'new_access_request',
        'New access request',
        NEW.email || ' has requested access.',
        jsonb_build_object('request_id', NEW.id, 'email', NEW.email)
      );
    END LOOP;

    -- Also notify platform admins for visibility
    FOR _recipient IN
      SELECT id AS user_id, tenant_id
      FROM profiles
      WHERE is_platform_admin = true
    LOOP
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        _recipient.user_id,
        _recipient.tenant_id,
        'new_access_request',
        'New access request',
        NEW.email || ' has requested access (domain matched to a tenant).',
        jsonb_build_object('request_id', NEW.id, 'email', NEW.email)
      );
    END LOOP;
  ELSE
    -- Unknown domain: notify platform admins
    FOR _recipient IN
      SELECT id AS user_id, tenant_id
      FROM profiles
      WHERE is_platform_admin = true
    LOOP
      INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
      VALUES (
        _recipient.user_id,
        _recipient.tenant_id,
        'new_access_request',
        'New access request (unknown domain)',
        NEW.email || ' has requested access from an unrecognized domain.',
        jsonb_build_object('request_id', NEW.id, 'email', NEW.email, 'domain', NEW.domain)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ATTACH NOTIFICATION TRIGGERS
-- ============================================================================

CREATE TRIGGER on_course_enrollment
  AFTER INSERT ON course_enrollments
  FOR EACH ROW EXECUTE FUNCTION notify_course_assigned();

CREATE TRIGGER on_new_module
  AFTER INSERT ON modules
  FOR EACH ROW EXECUTE FUNCTION notify_new_module();

CREATE TRIGGER on_progress_reset
  AFTER UPDATE ON user_progress
  FOR EACH ROW EXECUTE FUNCTION notify_progress_reset();

CREATE TRIGGER on_exam_graded
  AFTER UPDATE ON exam_submissions
  FOR EACH ROW EXECUTE FUNCTION notify_exam_graded();

CREATE TRIGGER on_question_answered
  AFTER UPDATE ON expert_questions
  FOR EACH ROW EXECUTE FUNCTION notify_question_answered();

CREATE TRIGGER on_reminder_sent
  AFTER INSERT ON reminder_history
  FOR EACH ROW EXECUTE FUNCTION notify_reminder_sent();

CREATE TRIGGER on_new_expert_question
  AFTER INSERT ON expert_questions
  FOR EACH ROW EXECUTE FUNCTION notify_new_expert_question();

CREATE TRIGGER on_new_exam_submission
  AFTER INSERT ON exam_submissions
  FOR EACH ROW EXECUTE FUNCTION notify_new_exam_submission();

CREATE TRIGGER on_new_issue
  AFTER INSERT ON issues
  FOR EACH ROW EXECUTE FUNCTION notify_new_issue();

CREATE TRIGGER on_new_access_request
  AFTER INSERT ON access_requests
  FOR EACH ROW EXECUTE FUNCTION notify_new_access_request();
