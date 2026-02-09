-- ============================================================================
-- X-Courses v2 - Migration 00006: JWT Custom Claims Hook
-- ============================================================================
-- Custom access token hook that injects tenant_id, role flags, and
-- multi-tenant arrays (CSM assignments, lecturer permissions) into JWT claims.
-- Configure in Supabase Dashboard: Authentication > Hooks > Custom Access Token Hook
-- Point to: public.custom_access_token_hook
-- ============================================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb AS $$
DECLARE
  claims jsonb;
  _user_id uuid;
  _profile record;
  _csm_tenant_ids uuid[];
  _lecturer_course_ids uuid[];
  _lecturer_can_edit_ids uuid[];
  _lecturer_can_grade_ids uuid[];
BEGIN
  _user_id := (event ->> 'user_id')::uuid;

  -- Get profile data
  SELECT * INTO _profile
  FROM profiles
  WHERE id = _user_id;

  -- If no profile exists yet, return unmodified token
  IF _profile IS NULL THEN
    RETURN event;
  END IF;

  -- Get CSM tenant assignments
  SELECT coalesce(array_agg(tenant_id), '{}')
  INTO _csm_tenant_ids
  FROM csm_tenant_assignments
  WHERE user_id = _user_id;

  -- Get lecturer course assignments
  SELECT
    coalesce(array_agg(course_id), '{}'),
    coalesce(array_agg(course_id) FILTER (WHERE can_edit = true), '{}'),
    coalesce(array_agg(course_id) FILTER (WHERE can_grade = true), '{}')
  INTO _lecturer_course_ids, _lecturer_can_edit_ids, _lecturer_can_grade_ids
  FROM lecturer_course_assignments
  WHERE user_id = _user_id;

  -- Build custom claims
  claims := event -> 'claims';

  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(_profile.tenant_id::text));
  claims := jsonb_set(claims, '{is_tenant_admin}', to_jsonb(_profile.is_tenant_admin));
  claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(_profile.is_platform_admin));
  claims := jsonb_set(claims, '{csm_tenant_ids}', to_jsonb(_csm_tenant_ids));
  claims := jsonb_set(claims, '{lecturer_course_ids}', to_jsonb(_lecturer_course_ids));
  claims := jsonb_set(claims, '{lecturer_can_edit_course_ids}', to_jsonb(_lecturer_can_edit_ids));
  claims := jsonb_set(claims, '{lecturer_can_grade_course_ids}', to_jsonb(_lecturer_can_grade_ids));

  -- Update the event with new claims
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to auth admin, revoke from public
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- Grant necessary table access to auth admin for the hook
GRANT SELECT ON TABLE profiles TO supabase_auth_admin;
GRANT SELECT ON TABLE csm_tenant_assignments TO supabase_auth_admin;
GRANT SELECT ON TABLE lecturer_course_assignments TO supabase_auth_admin;
