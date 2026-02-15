-- Migration 00037: Make avatars bucket private
-- Previously public=true in 00007, switching to private with signed URLs

-- Make avatars bucket private
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Drop the old public SELECT policy
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;

-- Add authenticated-only SELECT policy (any logged-in user can view any avatar via signed URL)
CREATE POLICY "avatars_select_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
