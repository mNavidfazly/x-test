-- ============================================================================
-- Migration 00054: mark_all_notifications_read RPC
-- ============================================================================
-- Bug: notification.service.ts:75 issues
--   UPDATE notifications SET read_at = now() WHERE user_id = auth.uid() AND read_at IS NULL
-- via PostgREST. PostgREST caps UPDATE row count at 1000 (max_rows setting).
-- For Platform Admins (RLS-scoped to their own user_id only) the typical user
-- has <1000 unread, but heavy users + admin perspectives can exceed the cap,
-- leaving stale unread rows in DB while the optimistic local-signal update
-- reports zero unread.
--
-- Fix: SECURITY DEFINER RPC executes the UPDATE inside Postgres, bypassing the
-- PostgREST row cap. Permission contract mirrors notifications_update_own RLS
-- policy (user_id = auth.uid()).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _n int;
BEGIN
  UPDATE notifications
     SET read_at = now()
   WHERE user_id = auth.uid()
     AND read_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated;

-- Rollback: DROP FUNCTION IF EXISTS public.mark_all_notifications_read();
