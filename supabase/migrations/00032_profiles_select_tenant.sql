-- ============================================================================
-- Migration 00032: profiles_select_tenant policy
-- ============================================================================
-- Allows any authenticated user to see profiles from their own tenant.
-- Without this, the nested Supabase join `author:profiles!user_id(...)` in
-- comment queries returns NULL for other users' profiles — only PA and TA
-- had cross-user profile visibility within a tenant.
--
-- This is a reasonable policy for a corporate LMS: coworkers should be able
-- to see each other's names in comments, progress dashboards, etc.
-- ============================================================================

CREATE POLICY "profiles_select_tenant" ON profiles
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
  );
