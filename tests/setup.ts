/**
 * RLS Test Infrastructure
 *
 * Provides:
 * - adminClient (service role, bypasses RLS)
 * - createClientAs() (authenticated client with RLS enforced)
 * - toDenyAccess() custom Vitest matcher
 * - Test factories for all major entities
 * - TestDataTracker + cleanupTestData() for safe teardown
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';
import pg from 'pg';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY || !DATABASE_URL) {
  throw new Error(
    'Missing required env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL',
  );
}

// ---------------------------------------------------------------------------
// Admin Client (service role — bypasses RLS, used for test setup only)
// ---------------------------------------------------------------------------

export const adminClient: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ---------------------------------------------------------------------------
// Authenticated Client Factory (RLS enforced)
// ---------------------------------------------------------------------------

export async function createClientAs(user: TestUser): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });

  if (error) {
    throw new Error(`Failed to sign in as ${user.email}: ${error.message}`);
  }

  return client;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestUser {
  id: string;
  email: string;
  password: string;
  tenantId: string;
}

export interface TestTenant {
  id: string;
  name: string;
  domain: string;
  isMaster: boolean;
}

// ---------------------------------------------------------------------------
// Test Data Tracker (tracks IDs for cleanup)
// ---------------------------------------------------------------------------

export class TestDataTracker {
  readonly userIds: string[] = [];
  readonly tenantIds: string[] = [];
  readonly courseIds: string[] = [];
  readonly lectureIds: string[] = [];
  readonly moduleIds: string[] = [];
  readonly enrollmentIds: string[] = [];
  readonly tenantCourseIds: string[] = [];
  readonly csmAssignmentIds: string[] = [];
  readonly lecturerAssignmentIds: string[] = [];

  trackUser(id: string) { this.userIds.push(id); }
  trackTenant(id: string) { this.tenantIds.push(id); }
  trackCourse(id: string) { this.courseIds.push(id); }
  trackLecture(id: string) { this.lectureIds.push(id); }
  trackModule(id: string) { this.moduleIds.push(id); }
  trackEnrollment(id: string) { this.enrollmentIds.push(id); }
  trackTenantCourse(id: string) { this.tenantCourseIds.push(id); }
  trackCSMAssignment(id: string) { this.csmAssignmentIds.push(id); }
  trackLecturerAssignment(id: string) { this.lecturerAssignmentIds.push(id); }
}

// ---------------------------------------------------------------------------
// Cleanup (FK dependency order: children first)
// ---------------------------------------------------------------------------

export async function cleanupTestData(tracker: TestDataTracker): Promise<void> {
  // Phase 1: user-generated data (child tables that reference profiles/courses)
  // These are needed for later phases — no-op if no IDs tracked
  for (const table of [
    'notifications',
    'reminder_history',
    'quiz_attempt_answers',
    'quiz_attempts',
    'exam_submissions',
    'external_quiz_results',
    'user_progress',
    'comment_replies',
    'comments',
    'expert_questions',
    'issues',
  ]) {
    if (tracker.userIds.length > 0) {
      await adminClient.from(table).delete().in('user_id', tracker.userIds);
    }
  }

  // Phase 2: enrollments
  if (tracker.enrollmentIds.length > 0) {
    await adminClient.from('course_enrollments').delete().in('id', tracker.enrollmentIds);
  } else if (tracker.userIds.length > 0) {
    await adminClient.from('course_enrollments').delete().in('user_id', tracker.userIds);
  }

  // Phase 3: content subtables (for future phases)
  for (const table of [
    'quiz_question_options',
    'quiz_questions',
    'quizzes',
    'exams',
    'external_quiz_references',
    'module_videos',
    'module_pdfs',
    'module_markdown',
    'module_files',
  ]) {
    if (tracker.moduleIds.length > 0) {
      await adminClient.from(table).delete().in('module_id', tracker.moduleIds);
    }
  }

  // Phase 4: modules → lectures
  if (tracker.moduleIds.length > 0) {
    await adminClient.from('modules').delete().in('id', tracker.moduleIds);
  }
  if (tracker.lectureIds.length > 0) {
    await adminClient.from('lectures').delete().in('id', tracker.lectureIds);
  }

  // Phase 5: assignments
  if (tracker.lecturerAssignmentIds.length > 0) {
    await adminClient.from('lecturer_course_assignments').delete().in('id', tracker.lecturerAssignmentIds);
  }
  if (tracker.csmAssignmentIds.length > 0) {
    await adminClient.from('csm_tenant_assignments').delete().in('id', tracker.csmAssignmentIds);
  }

  // Phase 6: tenant_courses → courses
  if (tracker.tenantCourseIds.length > 0) {
    await adminClient.from('tenant_courses').delete().in('id', tracker.tenantCourseIds);
  }
  if (tracker.courseIds.length > 0) {
    await adminClient.from('courses').delete().in('id', tracker.courseIds);
  }

  // Phase 7: profiles + auth users
  if (tracker.userIds.length > 0) {
    await adminClient.from('profiles').delete().in('id', tracker.userIds);
    for (const userId of tracker.userIds) {
      await adminClient.auth.admin.deleteUser(userId);
    }
  }

  // Phase 8: tenants (last — everything else references them)
  if (tracker.tenantIds.length > 0) {
    await adminClient.from('tenants').delete().in('id', tracker.tenantIds);
  }
}

// ---------------------------------------------------------------------------
// Direct PG Helper (bypasses RLS + triggers by faking JWT claims)
// ---------------------------------------------------------------------------
//
// The `protect_profile_role_fields()` trigger reads JWT claims from
// `current_setting('request.jwt.claims', true)` to decide who can change
// role booleans. The Supabase service role client does NOT set this GUC,
// so the trigger blocks role changes. We work around this by opening a
// direct pg connection, faking `request.jwt.claims` with
// `is_platform_admin = true`, then running the UPDATE inside that session.
//

async function setProfileRole(
  userId: string,
  updates: { is_tenant_admin?: boolean; is_platform_admin?: boolean },
): Promise<void> {
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query('BEGIN');

    // Fake a platform admin JWT so the trigger allows the update
    await client.query(
      `SELECT set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: userId, is_platform_admin: true, role: 'authenticated' })],
    );

    // Build parameterised UPDATE
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (updates.is_tenant_admin !== undefined) {
      setClauses.push(`is_tenant_admin = $${idx++}`);
      values.push(updates.is_tenant_admin);
    }
    if (updates.is_platform_admin !== undefined) {
      setClauses.push(`is_platform_admin = $${idx++}`);
      values.push(updates.is_platform_admin);
    }
    values.push(userId);

    const result = await client.query(
      `UPDATE profiles SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      values,
    );

    if (result.rowCount === 0) {
      throw new Error(`setProfileRole: no profile found for user ${userId}`);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// Test Factories
// ---------------------------------------------------------------------------

const TEST_PASSWORD = 'Test-Password-123!';

/**
 * Fetches the existing master tenant (Calypso) from the database.
 * Seed data creates exactly one master tenant — the unique index
 * `idx_tenants_single_master` prevents creating another.
 */
export async function getExistingMasterTenant(): Promise<TestTenant> {
  const { data, error } = await adminClient
    .from('tenants')
    .select('*')
    .eq('is_master', true)
    .single();

  if (error || !data) {
    throw new Error(`No master tenant found: ${error?.message}`);
  }

  return {
    id: data.id,
    name: data.name,
    domain: data.domain,
    isMaster: true,
  };
}

export async function createTenant(
  tracker: TestDataTracker,
  overrides: {
    name?: string;
    domain?: string;
    isMaster?: boolean;
    authMethods?: string[];
  } = {},
): Promise<TestTenant> {
  const name = overrides.name ?? `Test-${faker.company.name()}`;
  const domain = overrides.domain ?? `test-${faker.string.alphanumeric(8)}.local`;
  const isMaster = overrides.isMaster ?? false;

  const settings = overrides.authMethods
    ? { auth_methods: overrides.authMethods }
    : null;

  const { data, error } = await adminClient
    .from('tenants')
    .insert({
      name,
      domain,
      is_master: isMaster,
      ...(settings && { settings }),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create tenant: ${error.message}`);

  tracker.trackTenant(data.id);
  return { id: data.id, name, domain, isMaster };
}

export async function createUser(
  tracker: TestDataTracker,
  tenantId: string,
  role: 'learner' | 'tenant_admin' | 'platform_admin' = 'learner',
  overrides: { email?: string; fullName?: string } = {},
): Promise<TestUser> {
  const email = overrides.email ?? faker.internet.email().toLowerCase();
  const password = TEST_PASSWORD;

  // 1. Create auth user — triggers handle_new_user() which creates profile.
  //    user_metadata.tenant_id triggers the admin-invitation bypass.
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      tenant_id: tenantId,
      full_name: overrides.fullName ?? faker.person.fullName(),
    },
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create user ${email}: ${authError?.message}`);
  }

  // 2. Set role flags on the auto-created profile (via direct pg to bypass
  //    protect_profile_role_fields() trigger which reads JWT claims)
  if (role !== 'learner') {
    await setProfileRole(authData.user.id, {
      ...(role === 'tenant_admin' && { is_tenant_admin: true }),
      ...(role === 'platform_admin' && { is_platform_admin: true }),
    });
  }

  tracker.trackUser(authData.user.id);
  return { id: authData.user.id, email, password, tenantId };
}

export async function createCourse(
  tracker: TestDataTracker,
  overrides: { title?: string; createdBy?: string; enrollmentType?: string; passwordHash?: string } = {},
): Promise<{ id: string; title: string }> {
  const title = overrides.title ?? `Test Course ${faker.string.alphanumeric(6)}`;

  const { data, error } = await adminClient
    .from('courses')
    .insert({
      title,
      description: faker.lorem.sentence(),
      ...(overrides.createdBy && { created_by: overrides.createdBy }),
      ...(overrides.enrollmentType && { enrollment_type: overrides.enrollmentType }),
      ...(overrides.passwordHash && { password_hash: overrides.passwordHash }),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create course: ${error.message}`);

  tracker.trackCourse(data.id);
  return { id: data.id, title };
}

export async function createLecture(
  tracker: TestDataTracker,
  courseId: string,
  overrides: { title?: string; sortOrder?: number } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('lectures')
    .insert({
      course_id: courseId,
      title: overrides.title ?? `Test Lecture ${faker.string.alphanumeric(6)}`,
      sort_order: overrides.sortOrder ?? 1,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create lecture: ${error.message}`);

  tracker.trackLecture(data.id);
  return { id: data.id };
}

export async function createModule(
  tracker: TestDataTracker,
  lectureId: string,
  courseId: string,
  overrides: { title?: string; moduleType?: string; sortOrder?: number } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('modules')
    .insert({
      lecture_id: lectureId,
      course_id: courseId,
      title: overrides.title ?? `Test Module ${faker.string.alphanumeric(6)}`,
      module_type: overrides.moduleType ?? 'markdown',
      sort_order: overrides.sortOrder ?? 1,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create module: ${error.message}`);

  tracker.trackModule(data.id);
  return { id: data.id };
}

export async function createTenantCourse(
  tracker: TestDataTracker,
  tenantId: string,
  courseId: string,
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('tenant_courses')
    .insert({ tenant_id: tenantId, course_id: courseId })
    .select()
    .single();

  if (error) throw new Error(`Failed to create tenant_course: ${error.message}`);

  tracker.trackTenantCourse(data.id);
  return { id: data.id };
}

export async function createEnrollment(
  tracker: TestDataTracker,
  userId: string,
  tenantId: string,
  courseId: string,
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('course_enrollments')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      course_id: courseId,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create enrollment: ${error.message}`);

  tracker.trackEnrollment(data.id);
  return { id: data.id };
}

export async function createUserProgress(
  tracker: TestDataTracker,
  userId: string,
  tenantId: string,
  courseId: string,
  lectureId: string,
  moduleId: string,
  overrides: { status?: string; markedBy?: string } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('user_progress')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      course_id: courseId,
      lecture_id: lectureId,
      module_id: moduleId,
      status: overrides.status ?? 'not_started',
      ...(overrides.markedBy && { marked_by: overrides.markedBy }),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user_progress: ${error.message}`);
  return { id: data.id };
}

export async function createCSMAssignment(
  tracker: TestDataTracker,
  userId: string,
  tenantId: string,
  assignedBy: string,
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('csm_tenant_assignments')
    .insert({ user_id: userId, tenant_id: tenantId, assigned_by: assignedBy })
    .select()
    .single();

  if (error) throw new Error(`Failed to create CSM assignment: ${error.message}`);

  tracker.trackCSMAssignment(data.id);
  return { id: data.id };
}

export async function createLecturerAssignment(
  tracker: TestDataTracker,
  userId: string,
  courseId: string,
  assignedBy: string,
  overrides: { canEdit?: boolean; canGrade?: boolean } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('lecturer_course_assignments')
    .insert({
      user_id: userId,
      course_id: courseId,
      assigned_by: assignedBy,
      can_edit: overrides.canEdit ?? false,
      can_grade: overrides.canGrade ?? true,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create lecturer assignment: ${error.message}`);

  tracker.trackLecturerAssignment(data.id);
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// Content Subtable Factories
// ---------------------------------------------------------------------------

export async function createModuleVideo(
  tracker: TestDataTracker,
  moduleId: string,
  overrides: { bunnyVideoId?: string; bunnyLibraryId?: number; encodingStatus?: number; duration?: number } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('module_videos')
    .insert({
      module_id: moduleId,
      bunny_video_id: overrides.bunnyVideoId ?? faker.string.uuid(),
      bunny_library_id: overrides.bunnyLibraryId ?? 123456,
      encoding_status: overrides.encodingStatus ?? 4,
      duration: overrides.duration ?? 300,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create module_video: ${error.message}`);
  return { id: data.id };
}

export async function createModulePdf(
  tracker: TestDataTracker,
  moduleId: string,
  overrides: { fileUrl?: string; fileName?: string; pageCount?: number } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('module_pdfs')
    .insert({
      module_id: moduleId,
      file_url: overrides.fileUrl ?? `https://storage.example.com/${faker.string.alphanumeric(12)}.pdf`,
      file_name: overrides.fileName ?? `${faker.system.fileName()}.pdf`,
      page_count: overrides.pageCount ?? 10,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create module_pdf: ${error.message}`);
  return { id: data.id };
}

export async function createModuleMarkdown(
  tracker: TestDataTracker,
  moduleId: string,
  overrides: { content?: string } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('module_markdown')
    .insert({
      module_id: moduleId,
      content: overrides.content ?? `# ${faker.lorem.sentence()}\n\n${faker.lorem.paragraphs(2)}`,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create module_markdown: ${error.message}`);
  return { id: data.id };
}

export async function createModuleFile(
  tracker: TestDataTracker,
  moduleId: string,
  overrides: { fileUrl?: string; fileName?: string; fileSize?: number } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('module_files')
    .insert({
      module_id: moduleId,
      file_url: overrides.fileUrl ?? `https://storage.example.com/${faker.string.alphanumeric(12)}.zip`,
      file_name: overrides.fileName ?? faker.system.fileName(),
      file_size: overrides.fileSize ?? 1024000,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create module_file: ${error.message}`);
  return { id: data.id };
}

export async function createQuiz(
  tracker: TestDataTracker,
  moduleId: string,
  overrides: { title?: string; passingScore?: number; timeLimit?: number } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('quizzes')
    .insert({
      module_id: moduleId,
      title: overrides.title ?? `Test Quiz ${faker.string.alphanumeric(6)}`,
      passing_score: overrides.passingScore ?? 70,
      ...(overrides.timeLimit !== undefined && { time_limit: overrides.timeLimit }),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create quiz: ${error.message}`);
  return { id: data.id };
}

export async function createQuizQuestion(
  tracker: TestDataTracker,
  quizId: string,
  overrides: { questionText?: string; questionType?: string; points?: number; sortOrder?: number } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('quiz_questions')
    .insert({
      quiz_id: quizId,
      question_text: overrides.questionText ?? faker.lorem.sentence(),
      question_type: overrides.questionType ?? 'single_choice',
      points: overrides.points ?? 1,
      sort_order: overrides.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create quiz_question: ${error.message}`);
  return { id: data.id };
}

export async function createQuizQuestionOption(
  tracker: TestDataTracker,
  questionId: string,
  overrides: { optionText?: string; isCorrect?: boolean; sortOrder?: number } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('quiz_question_options')
    .insert({
      question_id: questionId,
      option_text: overrides.optionText ?? faker.lorem.word(),
      is_correct: overrides.isCorrect ?? false,
      sort_order: overrides.sortOrder ?? 0,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create quiz_question_option: ${error.message}`);
  return { id: data.id };
}

export async function createExam(
  tracker: TestDataTracker,
  moduleId: string,
  overrides: { title?: string; durationMinutes?: number; passingScore?: number } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('exams')
    .insert({
      module_id: moduleId,
      title: overrides.title ?? `Test Exam ${faker.string.alphanumeric(6)}`,
      duration_minutes: overrides.durationMinutes ?? 60,
      passing_score: overrides.passingScore ?? 70,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create exam: ${error.message}`);
  return { id: data.id };
}

export async function createExternalQuizReference(
  tracker: TestDataTracker,
  moduleId: string,
  overrides: { externalQuizId?: string; externalQuizUrl?: string; passingScore?: number } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('external_quiz_references')
    .insert({
      module_id: moduleId,
      external_quiz_id: overrides.externalQuizId ?? `EXT-${faker.string.alphanumeric(8)}`,
      external_quiz_url: overrides.externalQuizUrl ?? `https://quiz.example.com/${faker.string.alphanumeric(10)}`,
      ...(overrides.passingScore !== undefined && { passing_score: overrides.passingScore }),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create external_quiz_reference: ${error.message}`);
  return { id: data.id };
}

export async function createQuizAttempt(
  tracker: TestDataTracker,
  userId: string,
  tenantId: string,
  quizId: string,
  overrides: { attemptNumber?: number; score?: number; passed?: boolean; submittedAt?: string } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('quiz_attempts')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      quiz_id: quizId,
      attempt_number: overrides.attemptNumber ?? 1,
      ...(overrides.score !== undefined && { score: overrides.score }),
      ...(overrides.passed !== undefined && { passed: overrides.passed }),
      ...(overrides.submittedAt !== undefined && { submitted_at: overrides.submittedAt }),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create quiz_attempt: ${error.message}`);
  return { id: data.id };
}

export async function createQuizAttemptAnswer(
  tracker: TestDataTracker,
  attemptId: string,
  questionId: string,
  overrides: { userAnswer?: string } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('quiz_attempt_answers')
    .insert({
      attempt_id: attemptId,
      question_id: questionId,
      ...(overrides.userAnswer !== undefined && { user_answer: overrides.userAnswer }),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create quiz_attempt_answer: ${error.message}`);
  return { id: data.id };
}

export async function createExamSubmission(
  tracker: TestDataTracker,
  userId: string,
  tenantId: string,
  examId: string,
  courseId: string,
  overrides: { fileUrl?: string; deadline?: string; score?: number; feedback?: string; gradedBy?: string } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('exam_submissions')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      exam_id: examId,
      course_id: courseId,
      file_url: overrides.fileUrl ?? `exam-submissions/${courseId}/${userId}/submission.pdf`,
      deadline: overrides.deadline ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ...(overrides.score !== undefined && { score: overrides.score }),
      ...(overrides.feedback !== undefined && { feedback: overrides.feedback }),
      ...(overrides.gradedBy !== undefined && { graded_by: overrides.gradedBy, graded_at: new Date().toISOString() }),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create exam_submission: ${error.message}`);
  return { id: data.id };
}

export async function createExternalQuizResult(
  tracker: TestDataTracker,
  userId: string,
  tenantId: string,
  externalQuizId: string,
  overrides: { score?: number; passed?: boolean; completedAt?: string } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('external_quiz_results')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      external_quiz_id: externalQuizId,
      ...(overrides.score !== undefined && { score: overrides.score }),
      ...(overrides.passed !== undefined && { passed: overrides.passed }),
      ...(overrides.completedAt !== undefined && { completed_at: overrides.completedAt }),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create external_quiz_result: ${error.message}`);
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// Phase 6D: Comments & Expert Questions factories
// ---------------------------------------------------------------------------

export async function createComment(
  tracker: TestDataTracker,
  userId: string,
  tenantId: string,
  moduleId: string,
  overrides: { body?: string } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('comments')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      module_id: moduleId,
      body: overrides.body ?? 'Test comment ' + Math.random().toString(36).slice(2, 8),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create comment: ${error.message}`);
  return { id: data.id };
}

export async function createCommentReply(
  tracker: TestDataTracker,
  userId: string,
  tenantId: string,
  commentId: string,
  overrides: { body?: string } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('comment_replies')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      comment_id: commentId,
      body: overrides.body ?? 'Test reply ' + Math.random().toString(36).slice(2, 8),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create comment_reply: ${error.message}`);
  return { id: data.id };
}

export async function createExpertQuestion(
  tracker: TestDataTracker,
  userId: string,
  tenantId: string,
  courseId: string,
  overrides: {
    questionText?: string;
    moduleId?: string;
    status?: string;
    responseText?: string;
    respondedBy?: string;
    respondedAt?: string;
  } = {},
): Promise<{ id: string }> {
  const { data, error } = await adminClient
    .from('expert_questions')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      course_id: courseId,
      question_text: overrides.questionText ?? 'Test question ' + Math.random().toString(36).slice(2, 8),
      ...(overrides.moduleId !== undefined && { module_id: overrides.moduleId }),
      ...(overrides.status !== undefined && { status: overrides.status }),
      ...(overrides.responseText !== undefined && { response_text: overrides.responseText }),
      ...(overrides.respondedBy !== undefined && { responded_by: overrides.respondedBy }),
      ...(overrides.respondedAt !== undefined && { responded_at: overrides.respondedAt }),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create expert_question: ${error.message}`);
  return { id: data.id };
}

// ---------------------------------------------------------------------------
// Custom Vitest Matcher: toDenyAccess
// ---------------------------------------------------------------------------
//
// Usage:
//   await expect(client.from('tenants').select('*').eq('id', otherId))
//     .toDenyAccess('select');
//
//   await expect(client.from('tenants').insert({ name: 'X' }))
//     .toDenyAccess('insert');
//
//   await expect(client.from('tenants').update({ name: 'X' }).eq('id', id).select())
//     .toDenyAccess('update');   // MUST chain .select() for update/delete
//

type RlsOperation = 'select' | 'insert' | 'update' | 'delete';

interface CustomMatchers<R = unknown> {
  toDenyAccess(operation: RlsOperation): Promise<R>;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  async toDenyAccess(
    received: Promise<{ data: any; error: any }>,
    operation: RlsOperation,
  ) {
    const { data, error } = await received;

    let pass: boolean;
    let expectedBehavior: string;

    switch (operation) {
      case 'select':
        // RLS silently filters rows — denied means empty array
        pass = Array.isArray(data) && data.length === 0;
        expectedBehavior = 'return empty array';
        break;

      case 'insert':
        // RLS returns error on denied INSERT
        pass = error !== null;
        expectedBehavior = 'return error';
        break;

      case 'update':
      case 'delete':
        // Must chain .select() — denied means 0 rows affected
        pass = Array.isArray(data) && data.length === 0;
        expectedBehavior = 'affect 0 rows (did you chain .select()?)';
        break;

      default:
        throw new Error(`Unknown RLS operation: ${operation}`);
    }

    return {
      pass,
      message: () =>
        pass
          ? `Expected ${operation.toUpperCase()} to be ALLOWED but it was denied`
          : `Expected ${operation.toUpperCase()} to be DENIED (${expectedBehavior}) but got data=${JSON.stringify(data)?.slice(0, 200)}, error=${JSON.stringify(error)?.slice(0, 200)}`,
    };
  },
});
