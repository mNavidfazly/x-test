-- ============================================================================
-- X-Courses v2 - Migration 00004: Row Level Security Policies
-- ============================================================================
-- Enable RLS on all 30 tables and define ~236 policies covering:
-- tenant isolation, cross-tenant lecturer access, CSM assigned tenant access,
-- platform admin global access, content hierarchy inheritance.
-- ============================================================================

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_markdown ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_quiz_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE csm_tenant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecturer_course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE expert_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- --------------------------------------------------------------------------
-- 6.1 Tenants
-- --------------------------------------------------------------------------

CREATE POLICY "tenants_select_own" ON tenants
  FOR SELECT USING (id = public.jwt_claim('tenant_id')::uuid);

CREATE POLICY "tenants_select_platform_admin" ON tenants
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "tenants_select_csm" ON tenants
  FOR SELECT USING (id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[]));

CREATE POLICY "tenants_all_platform_admin" ON tenants
  FOR ALL USING (public.jwt_claim('is_platform_admin') = 'true');

-- --------------------------------------------------------------------------
-- 6.2 Profiles
-- --------------------------------------------------------------------------

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_select_tenant_admin" ON profiles
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "profiles_select_platform_admin" ON profiles
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "profiles_select_csm" ON profiles
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

-- Lecturers can see profiles of users who have progress on their assigned courses
CREATE POLICY "profiles_select_lecturer" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM course_enrollments ce
      WHERE ce.user_id = profiles.id
        AND ce.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_platform_admin" ON profiles
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "profiles_update_tenant_admin" ON profiles
  FOR UPDATE USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

-- --------------------------------------------------------------------------
-- 6.3 Courses
-- --------------------------------------------------------------------------

-- Users see courses assigned to their tenant
CREATE POLICY "courses_select_tenant" ON courses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_courses tc
      WHERE tc.course_id = courses.id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "courses_select_platform_admin" ON courses
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "courses_select_lecturer" ON courses
  FOR SELECT USING (
    id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  );

CREATE POLICY "courses_insert_platform_admin" ON courses
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "courses_update_platform_admin" ON courses
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "courses_update_lecturer" ON courses
  FOR UPDATE USING (
    id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  );

CREATE POLICY "courses_delete_platform_admin" ON courses
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

-- --------------------------------------------------------------------------
-- 6.4 Lectures
-- --------------------------------------------------------------------------

CREATE POLICY "lectures_select_tenant" ON lectures
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_courses tc
      WHERE tc.course_id = lectures.course_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "lectures_select_platform_admin" ON lectures
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "lectures_select_lecturer" ON lectures
  FOR SELECT USING (
    course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  );

CREATE POLICY "lectures_insert_platform_admin" ON lectures
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "lectures_insert_lecturer" ON lectures
  FOR INSERT WITH CHECK (
    course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  );

CREATE POLICY "lectures_update_platform_admin" ON lectures
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "lectures_update_lecturer" ON lectures
  FOR UPDATE USING (
    course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  );

CREATE POLICY "lectures_delete_platform_admin" ON lectures
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "lectures_delete_lecturer" ON lectures
  FOR DELETE USING (
    course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  );

-- --------------------------------------------------------------------------
-- 6.5 Modules
-- --------------------------------------------------------------------------

CREATE POLICY "modules_select_tenant" ON modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_courses tc
      WHERE tc.course_id = modules.course_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "modules_select_platform_admin" ON modules
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "modules_select_lecturer" ON modules
  FOR SELECT USING (
    course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  );

CREATE POLICY "modules_insert_platform_admin" ON modules
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "modules_insert_lecturer" ON modules
  FOR INSERT WITH CHECK (
    course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  );

CREATE POLICY "modules_update_platform_admin" ON modules
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "modules_update_lecturer" ON modules
  FOR UPDATE USING (
    course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  );

CREATE POLICY "modules_delete_platform_admin" ON modules
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "modules_delete_lecturer" ON modules
  FOR DELETE USING (
    course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  );

-- --------------------------------------------------------------------------
-- 6.6 Module Subtables (videos, pdfs, markdown, files)
-- All follow the same pattern: read via course access, write via admin/lecturer
-- --------------------------------------------------------------------------

-- Helper: module subtables need to look up course_id via module
-- Since modules has course_id denormalized, we join through modules

-- MODULE_VIDEOS
CREATE POLICY "module_videos_select_tenant" ON module_videos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE m.id = module_videos.module_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "module_videos_select_platform_admin" ON module_videos
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_videos_select_lecturer" ON module_videos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_videos.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_videos_insert_platform_admin" ON module_videos
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_videos_insert_lecturer" ON module_videos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_videos.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_videos_update_platform_admin" ON module_videos
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_videos_update_lecturer" ON module_videos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_videos.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_videos_delete_platform_admin" ON module_videos
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_videos_delete_lecturer" ON module_videos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_videos.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

-- MODULE_PDFS
CREATE POLICY "module_pdfs_select_tenant" ON module_pdfs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE m.id = module_pdfs.module_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "module_pdfs_select_platform_admin" ON module_pdfs
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_pdfs_select_lecturer" ON module_pdfs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_pdfs.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_pdfs_insert_platform_admin" ON module_pdfs
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_pdfs_insert_lecturer" ON module_pdfs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_pdfs.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_pdfs_update_platform_admin" ON module_pdfs
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_pdfs_update_lecturer" ON module_pdfs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_pdfs.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_pdfs_delete_platform_admin" ON module_pdfs
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_pdfs_delete_lecturer" ON module_pdfs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_pdfs.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

-- MODULE_MARKDOWN
CREATE POLICY "module_markdown_select_tenant" ON module_markdown
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE m.id = module_markdown.module_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "module_markdown_select_platform_admin" ON module_markdown
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_markdown_select_lecturer" ON module_markdown
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_markdown.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_markdown_insert_platform_admin" ON module_markdown
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_markdown_insert_lecturer" ON module_markdown
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_markdown.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_markdown_update_platform_admin" ON module_markdown
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_markdown_update_lecturer" ON module_markdown
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_markdown.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_markdown_delete_platform_admin" ON module_markdown
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_markdown_delete_lecturer" ON module_markdown
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_markdown.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

-- MODULE_FILES
CREATE POLICY "module_files_select_tenant" ON module_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE m.id = module_files.module_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "module_files_select_platform_admin" ON module_files
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_files_select_lecturer" ON module_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_files.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_files_insert_platform_admin" ON module_files
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_files_insert_lecturer" ON module_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_files.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_files_update_platform_admin" ON module_files
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_files_update_lecturer" ON module_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_files.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "module_files_delete_platform_admin" ON module_files
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "module_files_delete_lecturer" ON module_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = module_files.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 6.7 Quizzes
-- --------------------------------------------------------------------------

CREATE POLICY "quizzes_select_tenant" ON quizzes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE m.id = quizzes.module_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "quizzes_select_platform_admin" ON quizzes
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quizzes_select_lecturer" ON quizzes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = quizzes.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "quizzes_insert_platform_admin" ON quizzes
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quizzes_insert_lecturer" ON quizzes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = quizzes.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "quizzes_update_platform_admin" ON quizzes
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quizzes_update_lecturer" ON quizzes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = quizzes.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "quizzes_delete_platform_admin" ON quizzes
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quizzes_delete_lecturer" ON quizzes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = quizzes.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 6.8 Quiz Questions
-- --------------------------------------------------------------------------

CREATE POLICY "quiz_questions_select_tenant" ON quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      JOIN modules m ON m.id = q.module_id
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE q.id = quiz_questions.quiz_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "quiz_questions_select_platform_admin" ON quiz_questions
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quiz_questions_select_lecturer" ON quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      JOIN modules m ON m.id = q.module_id
      WHERE q.id = quiz_questions.quiz_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "quiz_questions_insert_platform_admin" ON quiz_questions
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quiz_questions_insert_lecturer" ON quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes q
      JOIN modules m ON m.id = q.module_id
      WHERE q.id = quiz_questions.quiz_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "quiz_questions_update_platform_admin" ON quiz_questions
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quiz_questions_update_lecturer" ON quiz_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      JOIN modules m ON m.id = q.module_id
      WHERE q.id = quiz_questions.quiz_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "quiz_questions_delete_platform_admin" ON quiz_questions
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quiz_questions_delete_lecturer" ON quiz_questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      JOIN modules m ON m.id = q.module_id
      WHERE q.id = quiz_questions.quiz_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 6.9 Quiz Question Options
-- --------------------------------------------------------------------------

CREATE POLICY "quiz_options_select_tenant" ON quiz_question_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quiz_questions qq
      JOIN quizzes q ON q.id = qq.quiz_id
      JOIN modules m ON m.id = q.module_id
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE qq.id = quiz_question_options.question_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "quiz_options_select_platform_admin" ON quiz_question_options
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quiz_options_select_lecturer" ON quiz_question_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quiz_questions qq
      JOIN quizzes q ON q.id = qq.quiz_id
      JOIN modules m ON m.id = q.module_id
      WHERE qq.id = quiz_question_options.question_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "quiz_options_insert_platform_admin" ON quiz_question_options
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quiz_options_insert_lecturer" ON quiz_question_options
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_questions qq
      JOIN quizzes q ON q.id = qq.quiz_id
      JOIN modules m ON m.id = q.module_id
      WHERE qq.id = quiz_question_options.question_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "quiz_options_update_platform_admin" ON quiz_question_options
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quiz_options_update_lecturer" ON quiz_question_options
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM quiz_questions qq
      JOIN quizzes q ON q.id = qq.quiz_id
      JOIN modules m ON m.id = q.module_id
      WHERE qq.id = quiz_question_options.question_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "quiz_options_delete_platform_admin" ON quiz_question_options
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quiz_options_delete_lecturer" ON quiz_question_options
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM quiz_questions qq
      JOIN quizzes q ON q.id = qq.quiz_id
      JOIN modules m ON m.id = q.module_id
      WHERE qq.id = quiz_question_options.question_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 6.10 Exams
-- --------------------------------------------------------------------------

CREATE POLICY "exams_select_tenant" ON exams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE m.id = exams.module_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "exams_select_platform_admin" ON exams
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "exams_select_lecturer" ON exams
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = exams.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "exams_insert_platform_admin" ON exams
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "exams_insert_lecturer" ON exams
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = exams.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "exams_update_platform_admin" ON exams
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "exams_update_lecturer" ON exams
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = exams.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "exams_delete_platform_admin" ON exams
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "exams_delete_lecturer" ON exams
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = exams.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 6.11 External Quiz References
-- --------------------------------------------------------------------------

CREATE POLICY "ext_quiz_refs_select_tenant" ON external_quiz_references
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE m.id = external_quiz_references.module_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "ext_quiz_refs_select_platform_admin" ON external_quiz_references
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "ext_quiz_refs_select_lecturer" ON external_quiz_references
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = external_quiz_references.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "ext_quiz_refs_insert_platform_admin" ON external_quiz_references
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "ext_quiz_refs_update_platform_admin" ON external_quiz_references
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "ext_quiz_refs_delete_platform_admin" ON external_quiz_references
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "ext_quiz_refs_insert_lecturer" ON external_quiz_references
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = external_quiz_references.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "ext_quiz_refs_update_lecturer" ON external_quiz_references
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = external_quiz_references.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

CREATE POLICY "ext_quiz_refs_delete_lecturer" ON external_quiz_references
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = external_quiz_references.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 6.12 Assignment / Linking Tables
-- --------------------------------------------------------------------------

-- TENANT_COURSES
CREATE POLICY "tenant_courses_select_tenant" ON tenant_courses
  FOR SELECT USING (tenant_id = public.jwt_claim('tenant_id')::uuid);

CREATE POLICY "tenant_courses_select_platform_admin" ON tenant_courses
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "tenant_courses_select_csm" ON tenant_courses
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

CREATE POLICY "tenant_courses_insert_platform_admin" ON tenant_courses
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "tenant_courses_delete_platform_admin" ON tenant_courses
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

-- CSM_TENANT_ASSIGNMENTS
CREATE POLICY "csm_assignments_select_own" ON csm_tenant_assignments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "csm_assignments_select_platform_admin" ON csm_tenant_assignments
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "csm_assignments_insert_platform_admin" ON csm_tenant_assignments
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "csm_assignments_delete_platform_admin" ON csm_tenant_assignments
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

-- LECTURER_COURSE_ASSIGNMENTS
CREATE POLICY "lecturer_assignments_select_own" ON lecturer_course_assignments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "lecturer_assignments_select_platform_admin" ON lecturer_course_assignments
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "lecturer_assignments_insert_platform_admin" ON lecturer_course_assignments
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "lecturer_assignments_update_platform_admin" ON lecturer_course_assignments
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "lecturer_assignments_delete_platform_admin" ON lecturer_course_assignments
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

-- --------------------------------------------------------------------------
-- 6.13 Course Enrollments
-- --------------------------------------------------------------------------

CREATE POLICY "enrollments_select_own" ON course_enrollments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "enrollments_select_tenant_admin" ON course_enrollments
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "enrollments_select_platform_admin" ON course_enrollments
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "enrollments_select_csm" ON course_enrollments
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

CREATE POLICY "enrollments_select_lecturer" ON course_enrollments
  FOR SELECT USING (
    course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  );

-- Self-enroll: must be own user, own tenant, and course must be assigned to tenant
CREATE POLICY "enrollments_insert_self" ON course_enrollments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.jwt_claim('tenant_id')::uuid
    AND EXISTS (
      SELECT 1 FROM tenant_courses tc
      WHERE tc.course_id = course_enrollments.course_id
        AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

CREATE POLICY "enrollments_insert_tenant_admin" ON course_enrollments
  FOR INSERT WITH CHECK (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "enrollments_insert_platform_admin" ON course_enrollments
  FOR INSERT WITH CHECK (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "enrollments_delete_tenant_admin" ON course_enrollments
  FOR DELETE USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "enrollments_delete_platform_admin" ON course_enrollments
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

-- --------------------------------------------------------------------------
-- 6.14 User Progress
-- --------------------------------------------------------------------------

CREATE POLICY "progress_select_own" ON user_progress
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "progress_insert_own" ON user_progress
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.jwt_claim('tenant_id')::uuid
  );

CREATE POLICY "progress_update_own" ON user_progress
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "progress_select_tenant_admin" ON user_progress
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "progress_update_tenant_admin" ON user_progress
  FOR UPDATE USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "progress_select_platform_admin" ON user_progress
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "progress_update_platform_admin" ON user_progress
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "progress_select_csm" ON user_progress
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

-- Lecturers see progress for assigned courses (cross-tenant)
CREATE POLICY "progress_select_lecturer" ON user_progress
  FOR SELECT USING (
    course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  );

-- --------------------------------------------------------------------------
-- 6.15 Comments
-- --------------------------------------------------------------------------

-- All users in a tenant see same-tenant comments
CREATE POLICY "comments_select_tenant" ON comments
  FOR SELECT USING (tenant_id = public.jwt_claim('tenant_id')::uuid);

CREATE POLICY "comments_select_platform_admin" ON comments
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "comments_select_csm" ON comments
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

-- Lecturers see comments on assigned courses (cross-tenant)
CREATE POLICY "comments_select_lecturer" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = comments.module_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "comments_insert_own" ON comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.jwt_claim('tenant_id')::uuid
  );

-- Lecturers can comment on modules of their assigned courses (with their own tenant_id)
CREATE POLICY "comments_insert_lecturer" ON comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM modules m
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE m.id = comments.module_id
        AND tc.tenant_id = comments.tenant_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "comments_update_own" ON comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "comments_delete_own" ON comments
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "comments_delete_tenant_admin" ON comments
  FOR DELETE USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "comments_delete_platform_admin" ON comments
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

-- --------------------------------------------------------------------------
-- 6.16 Comment Replies
-- --------------------------------------------------------------------------

CREATE POLICY "comment_replies_select_tenant" ON comment_replies
  FOR SELECT USING (tenant_id = public.jwt_claim('tenant_id')::uuid);

CREATE POLICY "comment_replies_select_platform_admin" ON comment_replies
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "comment_replies_select_csm" ON comment_replies
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

CREATE POLICY "comment_replies_select_lecturer" ON comment_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM comments c
      JOIN modules m ON m.id = c.module_id
      WHERE c.id = comment_replies.comment_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "comment_replies_insert_own" ON comment_replies
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.jwt_claim('tenant_id')::uuid
  );

CREATE POLICY "comment_replies_insert_lecturer" ON comment_replies
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM comments c
      JOIN modules m ON m.id = c.module_id
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE c.id = comment_replies.comment_id
        AND tc.tenant_id = comment_replies.tenant_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "comment_replies_update_own" ON comment_replies
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "comment_replies_delete_own" ON comment_replies
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "comment_replies_delete_tenant_admin" ON comment_replies
  FOR DELETE USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "comment_replies_delete_platform_admin" ON comment_replies
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

-- --------------------------------------------------------------------------
-- 6.17 Expert Questions
-- --------------------------------------------------------------------------

-- Learners see own questions
CREATE POLICY "expert_questions_select_own" ON expert_questions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "expert_questions_select_tenant_admin" ON expert_questions
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "expert_questions_select_platform_admin" ON expert_questions
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

-- CSMs see questions from assigned tenants (read-only awareness)
CREATE POLICY "expert_questions_select_csm" ON expert_questions
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

-- Lecturers see questions for assigned courses (cross-tenant)
CREATE POLICY "expert_questions_select_lecturer" ON expert_questions
  FOR SELECT USING (
    course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  );

CREATE POLICY "expert_questions_insert_own" ON expert_questions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.jwt_claim('tenant_id')::uuid
  );

-- Lecturers respond (update response_text, responded_by, responded_at, status)
CREATE POLICY "expert_questions_update_lecturer" ON expert_questions
  FOR UPDATE USING (
    course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  );

CREATE POLICY "expert_questions_update_platform_admin" ON expert_questions
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

-- --------------------------------------------------------------------------
-- 6.18 Issues
-- --------------------------------------------------------------------------

-- Users see own issues only
CREATE POLICY "issues_select_own" ON issues
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "issues_select_tenant_admin" ON issues
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "issues_select_platform_admin" ON issues
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "issues_select_csm" ON issues
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

CREATE POLICY "issues_select_lecturer" ON issues
  FOR SELECT USING (
    course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  );

CREATE POLICY "issues_insert_own" ON issues
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.jwt_claim('tenant_id')::uuid
  );

CREATE POLICY "issues_update_platform_admin" ON issues
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "issues_update_lecturer" ON issues
  FOR UPDATE USING (
    course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
  );

-- --------------------------------------------------------------------------
-- 6.19 Quiz Attempts
-- --------------------------------------------------------------------------

CREATE POLICY "quiz_attempts_select_own" ON quiz_attempts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "quiz_attempts_select_tenant_admin" ON quiz_attempts
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "quiz_attempts_select_platform_admin" ON quiz_attempts
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quiz_attempts_select_lecturer" ON quiz_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      JOIN modules m ON m.id = q.module_id
      WHERE q.id = quiz_attempts.quiz_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "quiz_attempts_insert_own" ON quiz_attempts
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.jwt_claim('tenant_id')::uuid
  );

CREATE POLICY "quiz_attempts_update_own" ON quiz_attempts
  FOR UPDATE USING (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- 6.20 Quiz Attempt Answers
-- --------------------------------------------------------------------------

CREATE POLICY "quiz_answers_select_own" ON quiz_attempt_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND qa.user_id = auth.uid()
    )
  );

CREATE POLICY "quiz_answers_select_platform_admin" ON quiz_attempt_answers
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "quiz_answers_select_lecturer" ON quiz_attempt_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      JOIN quizzes q ON q.id = qa.quiz_id
      JOIN modules m ON m.id = q.module_id
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

CREATE POLICY "quiz_answers_insert_own" ON quiz_attempt_answers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND qa.user_id = auth.uid()
    )
  );

-- --------------------------------------------------------------------------
-- 6.21 Exam Submissions
-- --------------------------------------------------------------------------

CREATE POLICY "exam_submissions_select_own" ON exam_submissions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "exam_submissions_select_tenant_admin" ON exam_submissions
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "exam_submissions_select_platform_admin" ON exam_submissions
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

-- Lecturers with can_grade see submissions for assigned courses
CREATE POLICY "exam_submissions_select_lecturer" ON exam_submissions
  FOR SELECT USING (
    course_id = ANY(public.jwt_claim_array('lecturer_can_grade_course_ids')::uuid[])
  );

CREATE POLICY "exam_submissions_insert_own" ON exam_submissions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND tenant_id = public.jwt_claim('tenant_id')::uuid
  );

-- Lecturers with can_grade update (score, feedback, graded_by, graded_at)
CREATE POLICY "exam_submissions_update_lecturer" ON exam_submissions
  FOR UPDATE USING (
    course_id = ANY(public.jwt_claim_array('lecturer_can_grade_course_ids')::uuid[])
  );

CREATE POLICY "exam_submissions_update_platform_admin" ON exam_submissions
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

-- Exam reset (delete submission)
CREATE POLICY "exam_submissions_delete_lecturer" ON exam_submissions
  FOR DELETE USING (
    course_id = ANY(public.jwt_claim_array('lecturer_can_grade_course_ids')::uuid[])
  );

CREATE POLICY "exam_submissions_delete_platform_admin" ON exam_submissions
  FOR DELETE USING (public.jwt_claim('is_platform_admin') = 'true');

-- --------------------------------------------------------------------------
-- 6.22 External Quiz Results
-- --------------------------------------------------------------------------

CREATE POLICY "ext_quiz_results_select_own" ON external_quiz_results
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "ext_quiz_results_select_platform_admin" ON external_quiz_results
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "ext_quiz_results_select_lecturer" ON external_quiz_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM external_quiz_references eqr
      JOIN modules m ON m.id = eqr.module_id
      WHERE eqr.external_quiz_id = external_quiz_results.external_quiz_id
        AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

-- Inserts done via service role (FastAPI webhook endpoint)

-- --------------------------------------------------------------------------
-- 6.23 Notifications
-- --------------------------------------------------------------------------

CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Inserts done via SECURITY DEFINER trigger functions (no direct user insert)

-- --------------------------------------------------------------------------
-- 6.24 Reminder History
-- --------------------------------------------------------------------------

CREATE POLICY "reminder_history_select_tenant_admin" ON reminder_history
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "reminder_history_select_platform_admin" ON reminder_history
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "reminder_history_select_csm" ON reminder_history
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

-- Insert policies for reminder senders
CREATE POLICY "reminder_history_insert_tenant_admin" ON reminder_history
  FOR INSERT WITH CHECK (
    sent_by = auth.uid()
    AND tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

CREATE POLICY "reminder_history_insert_platform_admin" ON reminder_history
  FOR INSERT WITH CHECK (
    sent_by = auth.uid()
    AND public.jwt_claim('is_platform_admin') = 'true'
  );

CREATE POLICY "reminder_history_insert_csm" ON reminder_history
  FOR INSERT WITH CHECK (
    sent_by = auth.uid()
    AND tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

CREATE POLICY "reminder_history_insert_lecturer" ON reminder_history
  FOR INSERT WITH CHECK (
    sent_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM user_progress up
      WHERE up.user_id = reminder_history.sent_to
        AND up.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 6.25 Access Requests
-- --------------------------------------------------------------------------

CREATE POLICY "access_requests_select_platform_admin" ON access_requests
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "access_requests_select_tenant_admin" ON access_requests
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

-- Insert handled via FastAPI (service role) or anon endpoint
-- Allowing authenticated users to insert their own request
CREATE POLICY "access_requests_insert_anon" ON access_requests
  FOR INSERT WITH CHECK (
    status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

CREATE POLICY "access_requests_update_platform_admin" ON access_requests
  FOR UPDATE USING (public.jwt_claim('is_platform_admin') = 'true');

CREATE POLICY "access_requests_update_tenant_admin" ON access_requests
  FOR UPDATE USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );
