-- Migration 00034: Auto-resolve domain → tenant_id on access request insert
-- Fixes: tenant_id was always NULL because the public form only sends domain,
-- making access_requests_select_tenant_admin RLS policy never match.

CREATE OR REPLACE FUNCTION resolve_access_request_tenant()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.domain IS NOT NULL AND NEW.tenant_id IS NULL THEN
    SELECT id INTO NEW.tenant_id
    FROM tenants
    WHERE lower(domain) = lower(NEW.domain)
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER before_insert_resolve_tenant
  BEFORE INSERT ON access_requests
  FOR EACH ROW EXECUTE FUNCTION resolve_access_request_tenant();
