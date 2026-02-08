-- ============================================================================
-- X-Course v2 - Migration 00007: Storage Bucket Policies
-- ============================================================================
-- Storage buckets (avatars, course-files, exam-submissions) and their
-- access policies.
-- ============================================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', true),
  ('course-files', 'course-files', false),
  ('exam-submissions', 'exam-submissions', false);

-- --------------------------------------------------------------------------
-- 14.1 Avatars (public read, owner write)
-- --------------------------------------------------------------------------

CREATE POLICY "avatars_select_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- --------------------------------------------------------------------------
-- 14.2 Course Files (enrolled users read, admins/lecturers write)
-- --------------------------------------------------------------------------

CREATE POLICY "course_files_select_authenticated" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'course-files'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "course_files_insert_admin" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'course-files'
    AND (
      public.jwt_claim('is_platform_admin') = 'true'
      OR array_length(public.jwt_claim_array('lecturer_can_edit_course_ids'), 1) > 0
    )
  );

CREATE POLICY "course_files_update_admin" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'course-files'
    AND (
      public.jwt_claim('is_platform_admin') = 'true'
      OR array_length(public.jwt_claim_array('lecturer_can_edit_course_ids'), 1) > 0
    )
  );

CREATE POLICY "course_files_delete_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'course-files'
    AND (
      public.jwt_claim('is_platform_admin') = 'true'
      OR array_length(public.jwt_claim_array('lecturer_can_edit_course_ids'), 1) > 0
    )
  );

-- --------------------------------------------------------------------------
-- 14.3 Exam Submissions (owner write, owner + lecturer + admin read)
-- --------------------------------------------------------------------------

CREATE POLICY "exam_sub_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'exam-submissions'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "exam_sub_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exam-submissions'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "exam_sub_select_lecturer" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exam-submissions'
    AND array_length(public.jwt_claim_array('lecturer_can_grade_course_ids'), 1) > 0
  );

CREATE POLICY "exam_sub_select_platform_admin" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exam-submissions'
    AND public.jwt_claim('is_platform_admin') = 'true'
  );

CREATE POLICY "exam_sub_delete_admin" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'exam-submissions'
    AND (
      public.jwt_claim('is_platform_admin') = 'true'
      OR array_length(public.jwt_claim_array('lecturer_can_grade_course_ids'), 1) > 0
    )
  );
