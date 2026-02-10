-- 00017: Add keycloak_sso to Calypso tenant auth methods
-- X-Courses v2 — Enable Keycloak SSO for the Calypso tenant

-- Add keycloak_sso to existing auth_methods array (preserving current methods)
UPDATE tenants
SET settings = COALESCE(settings, '{}'::jsonb) ||
  jsonb_build_object(
    'auth_methods',
    COALESCE(settings->'auth_methods', '[]'::jsonb) || '["keycloak_sso"]'::jsonb
  )
WHERE domain = 'calypso-commodities.com'
  AND NOT COALESCE(settings->'auth_methods', '[]'::jsonb) @> '"keycloak_sso"'::jsonb;
