-- =============================================================================
-- Migration 00040: Audio and Download module types
-- =============================================================================
-- Adds 'audio' and 'download' to module_type enum, creates subtables, 18 RLS policies.
-- =============================================================================

-- 1. Extend enum
ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'audio';
ALTER TYPE module_type ADD VALUE IF NOT EXISTS 'download';

-- 2. Audio subtable (1:1 via UNIQUE module_id)
CREATE TABLE module_audio (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id        uuid NOT NULL UNIQUE REFERENCES modules ON DELETE CASCADE,
  file_url         text NOT NULL,
  file_name        text NOT NULL,
  file_size        bigint,
  duration_seconds integer,
  mime_type        text NOT NULL DEFAULT 'audio/mpeg'
);

-- 3. Downloads subtable (1:1 via UNIQUE module_id)
CREATE TABLE module_downloads (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL UNIQUE REFERENCES modules ON DELETE CASCADE,
  file_url  text NOT NULL,
  file_name text NOT NULL,
  file_size bigint
);

-- 4. Enable RLS
ALTER TABLE module_audio ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_downloads ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════
-- module_audio: 9 RLS policies
-- (exact pattern from module_pdfs in 00004)
-- ═══════════════════════════════════════

CREATE POLICY "module_audio_select_tenant" ON module_audio FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM modules m JOIN tenant_courses tc ON tc.course_id = m.course_id
    WHERE m.id = module_audio.module_id AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
  ));
CREATE POLICY "module_audio_select_platform_admin" ON module_audio FOR SELECT
  USING (public.jwt_claim('is_platform_admin') = 'true');
CREATE POLICY "module_audio_select_lecturer" ON module_audio FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM modules m WHERE m.id = module_audio.module_id
    AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  ));

CREATE POLICY "module_audio_insert_platform_admin" ON module_audio FOR INSERT
  WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');
CREATE POLICY "module_audio_insert_lecturer" ON module_audio FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM modules m WHERE m.id = module_audio.module_id
    AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  ));

CREATE POLICY "module_audio_update_platform_admin" ON module_audio FOR UPDATE
  USING (public.jwt_claim('is_platform_admin') = 'true');
CREATE POLICY "module_audio_update_lecturer" ON module_audio FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM modules m WHERE m.id = module_audio.module_id
    AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  ));

CREATE POLICY "module_audio_delete_platform_admin" ON module_audio FOR DELETE
  USING (public.jwt_claim('is_platform_admin') = 'true');
CREATE POLICY "module_audio_delete_lecturer" ON module_audio FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM modules m WHERE m.id = module_audio.module_id
    AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  ));

-- ═══════════════════════════════════════
-- module_downloads: 9 RLS policies (identical pattern)
-- ═══════════════════════════════════════

CREATE POLICY "module_downloads_select_tenant" ON module_downloads FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM modules m JOIN tenant_courses tc ON tc.course_id = m.course_id
    WHERE m.id = module_downloads.module_id AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
  ));
CREATE POLICY "module_downloads_select_platform_admin" ON module_downloads FOR SELECT
  USING (public.jwt_claim('is_platform_admin') = 'true');
CREATE POLICY "module_downloads_select_lecturer" ON module_downloads FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM modules m WHERE m.id = module_downloads.module_id
    AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  ));

CREATE POLICY "module_downloads_insert_platform_admin" ON module_downloads FOR INSERT
  WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');
CREATE POLICY "module_downloads_insert_lecturer" ON module_downloads FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM modules m WHERE m.id = module_downloads.module_id
    AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  ));

CREATE POLICY "module_downloads_update_platform_admin" ON module_downloads FOR UPDATE
  USING (public.jwt_claim('is_platform_admin') = 'true');
CREATE POLICY "module_downloads_update_lecturer" ON module_downloads FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM modules m WHERE m.id = module_downloads.module_id
    AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  ));

CREATE POLICY "module_downloads_delete_platform_admin" ON module_downloads FOR DELETE
  USING (public.jwt_claim('is_platform_admin') = 'true');
CREATE POLICY "module_downloads_delete_lecturer" ON module_downloads FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM modules m WHERE m.id = module_downloads.module_id
    AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  ));
