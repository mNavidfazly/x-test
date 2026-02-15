-- Migration 00039: Allow all authenticated users to read lecturer_course_assignments
-- Rationale: Lecturer names and avatars should be visible to learners on course cards,
-- course detail pages, and the "Ask Expert" section.
-- The table contains only assignment metadata (user_id, course_id, permissions, timestamps).
-- Course visibility is already gated by tenant_courses RLS on the courses table.

CREATE POLICY "lecturer_assignments_select_authenticated"
  ON lecturer_course_assignments
  FOR SELECT
  USING (auth.role() = 'authenticated');
