-- ============================================================================
-- X-Courses v2 - Migration 00016: Remove Azure SSO
-- ============================================================================
-- Removes azure_sso support from the platform. All SSO now goes through
-- Keycloak (keycloak_sso). Non-SSO methods (email_password, magic_link)
-- remain unchanged.
--
-- Changes:
--   1. handle_new_user() — remove azure provider branch
--   2. protect_tenant_critical_fields() — remove azure_sso from valid methods
--   3. Data migration — strip azure_sso from any tenant settings
-- ============================================================================

-- 1. handle_new_user() — remove azure provider branch
-- (Full redefinition, supersedes 00015 version)
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


-- 2. protect_tenant_critical_fields() — remove azure_sso from valid methods
-- (Full redefinition, supersedes 00013 version)
CREATE OR REPLACE FUNCTION protect_tenant_critical_fields()
RETURNS TRIGGER AS $$
DECLARE
  _new_auth_methods jsonb;
  _method text;
  _valid_methods text[] := ARRAY['email_password', 'magic_link', 'keycloak_sso'];
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
          RAISE EXCEPTION 'Invalid auth method: %. Valid: email_password, magic_link, keycloak_sso', _method;
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


-- 3. Data migration — strip azure_sso from any tenant settings
-- Rebuilds auth_methods array without azure_sso for affected tenants.
-- If azure_sso was the ONLY method, replaces with keycloak_sso (safe default).
UPDATE tenants
SET settings = settings || jsonb_build_object(
  'auth_methods',
  CASE
    WHEN (SELECT count(*) FROM jsonb_array_elements_text(settings->'auth_methods') AS elem WHERE elem != 'azure_sso') = 0
    THEN '["keycloak_sso"]'::jsonb
    ELSE (SELECT jsonb_agg(elem) FROM jsonb_array_elements_text(settings->'auth_methods') AS elem WHERE elem != 'azure_sso')
  END
)
WHERE settings->'auth_methods' @> '"azure_sso"'::jsonb;
