-- 00018: Add Equinor tenant
-- X-Courses v2 — Add Equinor as a client tenant with Keycloak SSO only

INSERT INTO tenants (name, domain, is_master, settings)
VALUES (
  'Equinor',
  'equinor.com',
  false,
  jsonb_build_object('auth_methods', '["keycloak_sso"]'::jsonb)
)
ON CONFLICT (domain) DO NOTHING;
