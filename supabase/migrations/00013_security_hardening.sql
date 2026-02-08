-- ============================================================================
-- X-Course v2 - Migration 00013: Security Hardening
-- ============================================================================
-- Addresses findings from the multi-provider auth security audit:
--   C2: Password reset bypasses per-tenant auth method enforcement
--   H1: Storage policies let profileless users upload files
--   H3: No protect_tenant_critical_fields() trigger on tenants table
--   H1: Orphaned auth.users accumulate when handle_new_user() skips profile
--
-- New objects:
--   1. password_verification_hook() — blocks password sign-in for SSO-only tenants
--   2. protect_tenant_critical_fields() — validates auth_methods, blocks is_master mutation
--   3. Fixed avatars_insert_own + exam_sub_insert_own — require profile existence
--   4. cleanup_orphaned_auth_users() — periodic cleanup function (pg_cron)
-- ============================================================================


-- ============================================================================
-- SECTION 1: PASSWORD VERIFICATION HOOK (fixes C2, L2)
-- ============================================================================
-- Problem: resetPasswordForEmail() sets a password on SSO-only users.
-- signInWithPassword() works for anyone with a password, regardless of
-- tenant auth method config. handle_new_user() only enforces auth methods
-- at profile creation time, not at sign-in time.
--
-- Solution: Supabase calls this hook on every password sign-in attempt.
-- Input: { "user_id": "uuid", "valid": true/false }
-- Output: { "decision": "continue" } or { "error": { "http_code": N, "message": "..." } }
--
-- When the password is valid but the tenant doesn't allow email_password,
-- we reject the sign-in. Invalid passwords are passed through to Supabase's
-- default failure behavior.
--
-- Dashboard config required:
--   Authentication → Hooks → Password Verification → public.password_verification_hook

CREATE OR REPLACE FUNCTION public.password_verification_hook(event jsonb)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _tenant_id uuid;
  _auth_methods jsonb;
BEGIN
  -- If password is invalid, let Supabase handle the default failure behavior
  IF NOT coalesce((event ->> 'valid')::boolean, false) THEN
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  -- Password is valid — check if tenant allows password auth
  _user_id := (event ->> 'user_id')::uuid;

  SELECT p.tenant_id, t.settings -> 'auth_methods'
  INTO _tenant_id, _auth_methods
  FROM profiles p
  JOIN tenants t ON t.id = p.tenant_id
  WHERE p.id = _user_id;

  -- No profile → reject (profileless users should not sign in with password)
  IF _tenant_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'Account not found'
      )
    );
  END IF;

  -- No auth_methods configured → allow all (backward compat)
  IF _auth_methods IS NULL THEN
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  -- Tenant allows email_password → continue
  IF _auth_methods ? 'email_password' THEN
    RETURN jsonb_build_object('decision', 'continue');
  END IF;

  -- Tenant does NOT allow email_password → reject
  RETURN jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'Password authentication is not allowed for this organization. Please use SSO.'
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Grant to supabase_auth_admin (required for auth hooks), revoke from public
GRANT EXECUTE ON FUNCTION public.password_verification_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.password_verification_hook FROM authenticated, anon, public;

-- Auth admin needs SELECT on tenants for the JOIN in the hook
-- (SELECT on profiles already granted in 00006 for custom_access_token_hook)
GRANT SELECT ON TABLE tenants TO supabase_auth_admin;


-- ============================================================================
-- SECTION 2: PROTECT TENANT CRITICAL FIELDS (fixes H3)
-- ============================================================================
-- Problem: tenants_all_platform_admin (00004:61-62) grants unrestricted CRUD
-- to platform admins (FOR ALL). No column-level protection exists, unlike
-- protect_profile_role_fields() (00005:224-260) for profiles.
--
-- A platform admin could:
--   - Change is_master to create a second master tenant
--   - Set malformed auth_methods in settings that silently blocks all signups
--
-- Solution: BEFORE UPDATE trigger that:
--   1. Blocks is_master changes (immutable after creation)
--   2. Validates auth_methods values in settings if changed
--
-- Note: domain column is protected by UNIQUE constraint (00002:16).

CREATE OR REPLACE FUNCTION protect_tenant_critical_fields()
RETURNS TRIGGER AS $$
DECLARE
  _new_auth_methods jsonb;
  _method text;
  _valid_methods text[] := ARRAY['azure_sso', 'email_password', 'magic_link', 'keycloak_sso'];
BEGIN
  -- Block is_master changes (immutable after creation)
  IF NEW.is_master IS DISTINCT FROM OLD.is_master THEN
    RAISE EXCEPTION 'Cannot modify is_master flag on tenants';
  END IF;

  -- Validate auth_methods if settings changed
  IF NEW.settings IS DISTINCT FROM OLD.settings THEN
    _new_auth_methods := NEW.settings -> 'auth_methods';

    IF _new_auth_methods IS NOT NULL THEN
      -- Must be a JSON array
      IF jsonb_typeof(_new_auth_methods) != 'array' THEN
        RAISE EXCEPTION 'settings.auth_methods must be a JSON array';
      END IF;

      -- Each element must be a valid method string
      FOR _method IN SELECT jsonb_array_elements_text(_new_auth_methods) LOOP
        IF _method != ALL(_valid_methods) THEN
          RAISE EXCEPTION 'Invalid auth method: %. Valid: azure_sso, email_password, magic_link, keycloak_sso', _method;
        END IF;
      END LOOP;

      -- Must have at least one method
      IF jsonb_array_length(_new_auth_methods) = 0 THEN
        RAISE EXCEPTION 'settings.auth_methods must contain at least one method';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_tenant_fields
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION protect_tenant_critical_fields();


-- ============================================================================
-- SECTION 3: FIX STORAGE POLICIES — REQUIRE PROFILE (fixes H1)
-- ============================================================================
-- Problem: avatars_insert_own (00007:22-27) and exam_sub_insert_own
-- (00009:984-990) only check auth.uid() IS NOT NULL. Orphaned auth.users
-- rows (no profile) can upload files to both buckets.
--
-- Solution: Add EXISTS check for profile — only users with profiles can upload.
--
-- Note: course_files_select_authenticated was already fixed in 00010
-- (replaced with 4 role-specific policies that check JWT claims).
-- avatars_update_own and avatars_delete_own don't need fixing — they check
-- foldername[1] = auth.uid() which means the user must have previously
-- uploaded (which now requires a profile).

-- 3A. Fix avatars_insert_own — require profile
DROP POLICY "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  );

-- 3B. Fix exam_sub_insert_own — require profile
DROP POLICY "exam_sub_insert_own" ON storage.objects;
CREATE POLICY "exam_sub_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exam-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
  );


-- ============================================================================
-- SECTION 4: ORPHANED USER CLEANUP FUNCTION (mitigates H1)
-- ============================================================================
-- Problem: When handle_new_user() skips profile creation (disallowed auth
-- method or no tenant match), the auth.users row persists forever.
--
-- Solution: SECURITY DEFINER function that deletes auth.users rows with no
-- matching profile, only if older than 24 hours (avoids race conditions
-- with handle_new_user() trigger).
--
-- This function should be scheduled via pg_cron (daily at 3 AM):
--   SELECT cron.schedule('cleanup-orphaned-users', '0 3 * * *',
--     'SELECT cleanup_orphaned_auth_users()');
--
-- Note: pg_cron jobs in 00008 are currently commented out. Uncomment and
-- add this job when enabling scheduled tasks.

CREATE OR REPLACE FUNCTION cleanup_orphaned_auth_users()
RETURNS integer
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_count integer;
BEGIN
  WITH orphans AS (
    DELETE FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
      AND u.created_at < now() - interval '24 hours'
    RETURNING u.id
  )
  SELECT count(*) INTO _deleted_count FROM orphans;

  RETURN _deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Restrict access: only pg_cron (running as postgres superuser) should call this.
-- Without this REVOKE, any authenticated user could call it via supabase.rpc().
REVOKE EXECUTE ON FUNCTION cleanup_orphaned_auth_users() FROM authenticated, anon, public;
