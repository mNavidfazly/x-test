-- ============================================================
-- Migration 00033: Enable Supabase Realtime for Notifications
-- ============================================================
-- Required for frontend postgres_changes subscription.
-- The NotificationService subscribes to INSERT events on the
-- notifications table filtered by user_id to deliver real-time
-- notifications (bell badge + toast popup).
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
END $$;
