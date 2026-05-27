-- ============================================================================
-- Migration 00064: get_user_management_data RPC
-- ============================================================================
-- Replaces star-select with embed in user-management.service.ts:37-40.
-- Profile rows are growing (Equinor Crude moves landed recently); a single
-- big tenant could approach 1000 rows. RPC returns flat user-for-board rows
-- with tenant name joined.
--
-- Permission contract mirrors profiles RLS:
--   PA: all tenants
--   TA: own tenant only
-- Other roles never reach this admin page (route guard
-- roleGuard('tenant_admin', 'platform_admin')).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_management_data()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  avatar_url text,
  is_tenant_admin boolean,
  is_platform_admin boolean,
  tenant_id uuid,
  tenant_name text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  _is_pa boolean := public.jwt_claim('is_platform_admin') = 'true';
  _is_ta boolean := public.jwt_claim('is_tenant_admin') = 'true';
  _tenant uuid := nullif(public.jwt_claim('tenant_id'),'')::uuid;
BEGIN
  IF NOT (_is_pa OR _is_ta) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.is_tenant_admin,
    p.is_platform_admin,
    p.tenant_id,
    t.name,
    p.created_at,
    p.updated_at
  FROM profiles p
  LEFT JOIN tenants t ON t.id = p.tenant_id
  WHERE _is_pa OR (_is_ta AND p.tenant_id = _tenant)
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_management_data() TO authenticated;

-- Rollback: DROP FUNCTION IF EXISTS public.get_user_management_data();
