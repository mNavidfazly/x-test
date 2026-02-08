-- ============================================================================
-- X-Course v2 - Migration 00003: Indexes
-- ============================================================================
-- Performance indexes for all tables.
-- ============================================================================

-- Profiles
CREATE INDEX idx_profiles_tenant_id ON profiles (tenant_id);
CREATE INDEX idx_profiles_email ON profiles (email);

-- Content hierarchy
CREATE INDEX idx_lectures_course_id ON lectures (course_id);
CREATE INDEX idx_lectures_course_sort ON lectures (course_id, sort_order);
CREATE INDEX idx_modules_lecture_id ON modules (lecture_id);
CREATE INDEX idx_modules_course_id ON modules (course_id);
CREATE INDEX idx_modules_lecture_sort ON modules (lecture_id, sort_order);

-- Linking tables
CREATE INDEX idx_tenant_courses_tenant_id ON tenant_courses (tenant_id);
CREATE INDEX idx_tenant_courses_course_id ON tenant_courses (course_id);
CREATE INDEX idx_csm_assignments_user ON csm_tenant_assignments (user_id);
CREATE INDEX idx_csm_assignments_tenant ON csm_tenant_assignments (tenant_id);
CREATE INDEX idx_lecturer_assignments_user ON lecturer_course_assignments (user_id);
CREATE INDEX idx_lecturer_assignments_course ON lecturer_course_assignments (course_id);

-- Enrollments
CREATE INDEX idx_enrollments_user_tenant ON course_enrollments (user_id, tenant_id);
CREATE INDEX idx_enrollments_tenant_course ON course_enrollments (tenant_id, course_id);

-- Progress
CREATE INDEX idx_progress_user_tenant ON user_progress (user_id, tenant_id);
CREATE INDEX idx_progress_tenant_course ON user_progress (tenant_id, course_id);
CREATE INDEX idx_progress_module ON user_progress (module_id);

-- Comments
CREATE INDEX idx_comments_tenant_module ON comments (tenant_id, module_id);
CREATE INDEX idx_comment_replies_comment ON comment_replies (comment_id);

-- Expert questions
CREATE INDEX idx_expert_questions_tenant ON expert_questions (tenant_id);
CREATE INDEX idx_expert_questions_course ON expert_questions (course_id);
CREATE INDEX idx_expert_questions_user ON expert_questions (user_id);

-- Issues
CREATE INDEX idx_issues_tenant ON issues (tenant_id);
CREATE INDEX idx_issues_course ON issues (course_id);

-- Quiz attempts
CREATE INDEX idx_quiz_attempts_user_quiz ON quiz_attempts (user_id, quiz_id);
CREATE INDEX idx_quiz_attempts_tenant ON quiz_attempts (tenant_id);

-- Exam submissions
CREATE INDEX idx_exam_submissions_user_tenant ON exam_submissions (user_id, tenant_id);
CREATE INDEX idx_exam_submissions_exam ON exam_submissions (exam_id);

-- Notifications
CREATE INDEX idx_notifications_user_tenant ON notifications (user_id, tenant_id);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created ON notifications (created_at DESC);

-- Access requests
CREATE INDEX idx_access_requests_pending ON access_requests (status) WHERE status = 'pending';
CREATE INDEX idx_access_requests_domain ON access_requests (domain);

-- External quiz results
CREATE INDEX idx_external_quiz_results_user ON external_quiz_results (user_id, tenant_id);

-- Reminder history
CREATE INDEX idx_reminder_history_tenant ON reminder_history (tenant_id);
