-- ============================================================================
-- X-Courses v2 - Migration 00008: Scheduled Jobs (pg_cron)
-- ============================================================================
-- Requires pg_cron extension enabled in Supabase Dashboard.
-- Uncomment after enabling pg_cron.
-- ============================================================================

/*
-- Exam deadline reminder: runs every hour
-- NOTE: This targets already-submitted-but-ungraded exams (rows in exam_submissions).
-- Pre-submission reminders (users who downloaded but haven't submitted) require
-- FastAPI tracking of exam download events, which is outside the scope of this migration.
SELECT cron.schedule(
  'exam-deadline-reminder',
  '0 * * * *', -- every hour
  $$
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    SELECT
      es.user_id,
      es.tenant_id,
      'exam_deadline',
      'Exam deadline approaching',
      'Your exam deadline is approaching. Ensure your submission is complete.',
      jsonb_build_object(
        'submission_id', es.id,
        'course_id', es.course_id,
        'exam_id', es.exam_id,
        'deadline', es.deadline
      )
    FROM exam_submissions es
    WHERE es.deadline BETWEEN now() AND now() + interval '24 hours'
      AND es.score IS NULL -- not yet graded (still in progress)
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = es.user_id
          AND n.type = 'exam_deadline'
          AND n.data ->> 'submission_id' = es.id::text
      );
  $$
);

-- Content staleness check: runs daily at midnight
-- Finds modules not updated in the configured threshold (default 6 months)
SELECT cron.schedule(
  'content-staleness-check',
  '0 0 * * *', -- daily at midnight
  $$
    -- Notify lecturers about stale courses they're assigned to
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    SELECT DISTINCT
      lca.user_id,
      p.tenant_id,
      'content_staleness',
      'Course content may be outdated',
      'Course "' || c.title || '" has not been updated in over ' ||
        coalesce(c.staleness_threshold_days, 180) || ' days.',
      jsonb_build_object('course_id', c.id)
    FROM courses c
    JOIN lecturer_course_assignments lca ON lca.course_id = c.id
    JOIN profiles p ON p.id = lca.user_id
    WHERE (SELECT MAX(m.updated_at) FROM modules m WHERE m.course_id = c.id)
      < now() - (coalesce(c.staleness_threshold_days, 180) || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = lca.user_id
          AND n.type = 'content_staleness'
          AND n.data ->> 'course_id' = c.id::text
          AND n.created_at > now() - interval '7 days' -- don't spam, once per week max
      );

    -- Notify platform admins about all stale courses
    INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
    SELECT DISTINCT
      pa.id,
      pa.tenant_id,
      'content_staleness',
      'Course content may be outdated',
      'Course "' || c.title || '" has not been updated in over ' ||
        coalesce(c.staleness_threshold_days, 180) || ' days.',
      jsonb_build_object('course_id', c.id)
    FROM courses c
    CROSS JOIN (SELECT id, tenant_id FROM profiles WHERE is_platform_admin = true) pa
    WHERE (SELECT MAX(m.updated_at) FROM modules m WHERE m.course_id = c.id)
      < now() - (coalesce(c.staleness_threshold_days, 180) || ' days')::interval
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = pa.id
          AND n.type = 'content_staleness'
          AND n.data ->> 'course_id' = c.id::text
          AND n.created_at > now() - interval '7 days'
      );
  $$
);
*/
