-- ============================================================================
-- X-Course v2 - Migration 00012: Per-Tenant Auth Method Enforcement
-- ============================================================================
-- Updates handle_new_user() to check tenants.settings->'auth_methods' against
-- the auth provider from raw_app_meta_data before creating a profile.
--
-- Auth methods stored in tenants.settings jsonb:
--   {"auth_methods": ["azure_sso", "email_password", "magic_link"]}
--
-- Valid values: azure_sso, email_password, magic_link, keycloak_sso (Phase 2)
-- Default: If auth_methods key is absent → all methods allowed (backward compat)
--
-- Supabase provider mapping:
--   'azure'    → requires azure_sso
--   'keycloak' → requires keycloak_sso
--   'email'    → requires email_password OR magic_link (can't distinguish at DB level)
--
-- Admin invitations (raw_user_meta_data ? 'tenant_id') bypass the check.
-- ============================================================================

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
    INSERT INTO profiles (id, tenant_id, email, full_name)
    VALUES (
      NEW.id, _tenant_id, NEW.email,
      coalesce(NEW.raw_user_meta_data ->> 'full_name', '')
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
