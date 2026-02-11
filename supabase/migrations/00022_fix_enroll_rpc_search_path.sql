-- =============================================================================
-- Migration 00022: Fix enroll_with_password() search_path
-- =============================================================================
-- BUG (DI-08): enroll_with_password() is SECURITY DEFINER with
-- SET search_path = public, but crypt() from pgcrypto lives in the
-- `extensions` schema. Adding `extensions` to the search_path fixes the
-- "function crypt(text, text) does not exist" error.
--
-- hash_course_password() (00019) works because it's NOT SECURITY DEFINER
-- and inherits PostgREST's search_path which includes `extensions`.
-- =============================================================================

CREATE OR REPLACE FUNCTION enroll_with_password(p_course_id uuid, p_password text)
RETURNS uuid AS $$
DECLARE
  _course record;
  _tenant_id uuid;
  _enrollment_id uuid;
BEGIN
  _tenant_id := public.jwt_claim('tenant_id')::uuid;

  -- Verify course exists, is password_protected, and assigned to user's tenant
  SELECT c.* INTO _course
  FROM courses c
  JOIN tenant_courses tc ON tc.course_id = c.id
  WHERE c.id = p_course_id
    AND tc.tenant_id = _tenant_id
    AND c.enrollment_type = 'password_protected';

  IF _course IS NULL THEN
    RAISE EXCEPTION 'Course not found, not password-protected, or not available to your tenant';
  END IF;

  -- Validate password
  IF _course.password_hash IS NULL OR _course.password_hash != crypt(p_password, _course.password_hash) THEN
    RAISE EXCEPTION 'Invalid course password';
  END IF;

  -- Check if already enrolled
  IF EXISTS (
    SELECT 1 FROM course_enrollments
    WHERE user_id = auth.uid()
      AND course_id = p_course_id
      AND tenant_id = _tenant_id
  ) THEN
    RAISE EXCEPTION 'You are already enrolled in this course';
  END IF;

  -- Create enrollment
  INSERT INTO course_enrollments (user_id, tenant_id, course_id)
  VALUES (auth.uid(), _tenant_id, p_course_id)
  RETURNING id INTO _enrollment_id;

  RETURN _enrollment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
