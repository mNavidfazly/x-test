-- APPLIED TO PRODUCTION: 2026-02-10
-- ============================================================================
-- X-Courses v2 - Migration 00015: Keycloak SSO Support
-- ============================================================================
-- Adds infrastructure for Keycloak SSO integration (Phase 2A):
--   1. profiles.keycloak_idp_alias column (stores user's IdP for kc_idp_hint)
--   2. Extended handle_new_user() to populate keycloak_idp_alias on first login
--   3. Extended protect_profile_role_fields() to block client-side alias changes
--   4. sync_keycloak_idp_alias() trigger to update alias on returning user login
--
-- Keycloak setup: calypso-xcourses client in existing "customers" realm
-- Dev: dev-auth.x-lng.com/realms/customers
-- ============================================================================

-- 1. Add keycloak_idp_alias column (nullable — NULL for non-Keycloak users)
ALTER TABLE profiles ADD COLUMN keycloak_idp_alias text;

-- 2. Extended handle_new_user() — includes keycloak_idp_alias in profile INSERT
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _tenant_id uuid;
  _domain text;
  _settings jsonb;
  _provider text;
  _auth_methods jsonb;
  _allowed boolean := false;
BEGIN
  _domain := split_part(NEW.email, '@', 2);

  -- Step 1: Email domain match (works for any provider)
  SELECT id, settings INTO _tenant_id, _settings
  FROM tenants WHERE lower(domain) = lower(_domain);

  -- Step 2: Explicit tenant_id in metadata (admin invitations)
  IF _tenant_id IS NULL AND NEW.raw_user_meta_data ? 'tenant_id' THEN
    _tenant_id := (NEW.raw_user_meta_data ->> 'tenant_id')::uuid;
    SELECT settings INTO _settings FROM tenants WHERE id = _tenant_id;
  END IF;

  -- If no tenant resolved, nothing to do
  IF _tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Step 3: Check auth method is allowed for this tenant
  _provider := NEW.raw_app_meta_data ->> 'provider';
  _auth_methods := _settings -> 'auth_methods';

  IF _auth_methods IS NULL THEN
    -- No auth_methods configured → allow all (backward compatibility)
    _allowed := true;
  ELSIF NEW.raw_user_meta_data ? 'tenant_id' THEN
    -- Admin invitation → bypass auth method check
    _allowed := true;
  ELSIF _provider = 'azure' THEN
    _allowed := _auth_methods ? 'azure_sso';
  ELSIF _provider = 'keycloak' THEN
    _allowed := _auth_methods ? 'keycloak_sso';
  ELSIF _provider = 'email' THEN
    -- Can't distinguish email+password from magic link at DB level
    -- (Supabase uses provider='email' for both)
    _allowed := (_auth_methods ? 'email_password') OR (_auth_methods ? 'magic_link');
  END IF;
  -- Unknown provider → _allowed stays false (secure default)

  -- Step 4: Create profile if allowed
  IF _allowed THEN
    INSERT INTO profiles (id, tenant_id, email, full_name, keycloak_idp_alias)
    VALUES (
      NEW.id, _tenant_id, NEW.email,
      coalesce(NEW.raw_user_meta_data ->> 'full_name', ''),
      NEW.raw_user_meta_data ->> 'keycloak_idp_alias'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Extended protect_profile_role_fields() — block client-side keycloak_idp_alias changes
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

  -- Nobody except platform admin can change keycloak_idp_alias (set by sync trigger only)
  IF NEW.keycloak_idp_alias IS DISTINCT FROM OLD.keycloak_idp_alias THEN
    RAISE EXCEPTION 'Only platform admins can modify keycloak_idp_alias';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Sync trigger for returning Keycloak users
-- On every auth.users UPDATE (e.g. token refresh, re-login), sync the IdP alias
-- from raw_user_meta_data into profiles. This ensures the alias stays current
-- even if the user's IdP changes in Keycloak.
CREATE OR REPLACE FUNCTION sync_keycloak_idp_alias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data ? 'keycloak_idp_alias' THEN
    UPDATE profiles
    SET keycloak_idp_alias = NEW.raw_user_meta_data ->> 'keycloak_idp_alias'
    WHERE id = NEW.id
      AND keycloak_idp_alias IS DISTINCT FROM (NEW.raw_user_meta_data ->> 'keycloak_idp_alias');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_keycloak_idp_alias() TO supabase_auth_admin;

CREATE TRIGGER on_auth_user_updated_sync_idp
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_keycloak_idp_alias();
