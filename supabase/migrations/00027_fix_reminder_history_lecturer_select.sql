-- =============================================================================
-- Migration 00027: Add missing reminder_history_select_lecturer policy
-- =============================================================================
-- BUG: Lecturers have INSERT but no SELECT policy on reminder_history.
-- All other roles (PA, TA, CSM) have both. This prevents lecturers from
-- viewing reminders they sent or seeing reminder history for their courses.
-- Mirrors the pattern of reminder_history_insert_lecturer (00009).
-- =============================================================================

CREATE POLICY "reminder_history_select_lecturer" ON reminder_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_enrollments ce
      WHERE ce.user_id = reminder_history.sent_to
        AND ce.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );
