-- =============================================================================
-- Migration 00019: Course CRUD Support
-- =============================================================================
--
-- Adds two BEFORE INSERT OR UPDATE triggers on courses:
--
-- 1. hash_course_password: Auto-hashes password_hash when a plaintext password
--    is provided for password_protected courses. Clears password_hash when
--    enrollment_type is not password_protected.
--
-- 2. set_course_audit_fields: Auto-populates created_by/updated_by from
--    auth.uid() so frontend doesn't need to pass these explicitly.
--
-- Neither function needs SECURITY DEFINER — they only modify NEW fields
-- using auth.uid() and crypt() which are accessible to all roles.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Auto-hash password_hash on courses
-- ---------------------------------------------------------------------------
-- The enroll_with_password() RPC (00009) expects bcrypt format:
--   crypt(p_password, _course.password_hash)
-- This trigger hashes plaintext passwords on INSERT/UPDATE so the frontend
-- can simply pass the raw password in the password_hash column.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION hash_course_password()
RETURNS TRIGGER AS $$
BEGIN
  -- Clear password if enrollment type doesn't need it
  IF NEW.enrollment_type != 'password_protected' THEN
    NEW.password_hash = NULL;
  -- Hash plaintext password (bcrypt hashes start with $2)
  ELSIF NEW.password_hash IS NOT NULL
    AND NEW.password_hash != ''
    AND (TG_OP = 'INSERT' OR OLD.password_hash IS DISTINCT FROM NEW.password_hash)
    AND NEW.password_hash NOT LIKE '$2%' THEN
    NEW.password_hash = crypt(NEW.password_hash, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hash_course_password
  BEFORE INSERT OR UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION hash_course_password();

-- ---------------------------------------------------------------------------
-- 2. Auto-set created_by / updated_by from auth.uid()
-- ---------------------------------------------------------------------------
-- These columns exist on courses (00002) but had no trigger.
-- auth.uid() returns NULL for service-role operations — COALESCE preserves
-- any explicitly-passed value, and NULL is safe for service-role inserts.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_course_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by = COALESCE(NEW.created_by, auth.uid());
      NEW.updated_by = auth.uid();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.updated_by = auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_course_audit_fields
  BEFORE INSERT OR UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION set_course_audit_fields();
