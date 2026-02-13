/**
 * Quiz & Exam RLS Tests (Phase 5E)
 *
 * Tables tested:
 *   - quiz_attempts (7 policies: 4 SELECT, 1 INSERT, 1 UPDATE, 0 DELETE)
 *   - quiz_attempt_answers (5 policies: 4 SELECT, 1 INSERT, 0 UPDATE, 0 DELETE)
 *   - exam_submissions (9 policies: 4 SELECT, 1 INSERT, 2 UPDATE, 2 DELETE)
 *   - external_quiz_results (4 policies: 4 SELECT, 0 INSERT, 0 UPDATE, 0 DELETE)
 *   - protect_quiz_attempt_score trigger
 *   - enforce_exam_submission_course trigger
 *
 * Policy source files:
 *   - supabase/migrations/00004_rls_policies.sql
 *   - supabase/migrations/00012_csm_policies.sql
 *   - supabase/migrations/00028_fix_quiz_attempt_score_trigger.sql
 *
 * Test prefix: QE-001 through QE-055
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  createClientAs,
  TestDataTracker,
  cleanupTestData,
  getExistingMasterTenant,
  createTenant,
  createUser,
  createCourse,
  createLecture,
  createModule,
  createTenantCourse,
  createEnrollment,
  createQuiz,
  createQuizQuestion,
  createQuizQuestionOption,
  createExam,
  createExternalQuizReference,
  createQuizAttempt,
  createQuizAttemptAnswer,
  createExamSubmission,
  createExternalQuizResult,
  createCSMAssignment,
  createLecturerAssignment,
  type TestUser,
  type TestTenant,
} from '../setup';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('quiz & exam RLS', () => {
  const tracker = new TestDataTracker();

  // --- Tenants ---
  let masterTenant: TestTenant;
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  // --- Content hierarchy ---
  let course: { id: string };
  let lecture: { id: string };
  let moduleQuiz: { id: string };
  let moduleExam: { id: string };
  let moduleExam2: { id: string }; // second exam module for DELETE throwaway rows
  let moduleExtQuiz: { id: string };
  let quiz: { id: string };
  let quizQuestion: { id: string };
  let quizOption: { id: string };
  let exam: { id: string };
  let exam2: { id: string };
  let extQuizRef: { id: string };

  // --- Users ---
  let platformAdmin: TestUser;
  let tenantAdminA: TestUser;
  let learnerA1: TestUser;
  let learnerA2: TestUser;
  let learnerB: TestUser;
  let csmUser: TestUser;
  let lecturerGrade: TestUser;

  // --- Authenticated clients ---
  let paClient: SupabaseClient;
  let taClient: SupabaseClient;
  let learnerA1Client: SupabaseClient;
  let learnerA2Client: SupabaseClient;
  let learnerBClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let lecturerClient: SupabaseClient;

  // --- Pre-created data (learnerA1 in tenantA) ---
  let attemptA1: { id: string };
  let answerA1: { id: string };
  let submissionA1: { id: string };
  let extResultA1: { id: string };

  // --- Pre-created data (learnerB in tenantB) ---
  let attemptB: { id: string };
  let answerB: { id: string };
  let submissionB: { id: string };
  let extResultB: { id: string };

  // --- Throwaway rows for DELETE tests ---
  let submissionDeleteLecturer: { id: string };
  let submissionDeletePA: { id: string };

  // --- Second course for trigger test ---
  let course2: { id: string };

  beforeAll(async () => {
    // 1. Tenants
    masterTenant = await getExistingMasterTenant();
    tenantA = await createTenant(tracker, {
      name: 'QE-TenantA',
      domain: 'qe-rls-a.local',
      authMethods: ['email_password'],
    });
    tenantB = await createTenant(tracker, {
      name: 'QE-TenantB',
      domain: 'qe-rls-b.local',
      authMethods: ['email_password'],
    });

    // 2. Course + content hierarchy
    course = await createCourse(tracker, { title: 'QE-Course', enrollmentType: 'open' });
    course2 = await createCourse(tracker, { title: 'QE-Course2', enrollmentType: 'open' });
    lecture = await createLecture(tracker, course.id, { title: 'QE-Lecture' });

    moduleQuiz = await createModule(tracker, lecture.id, course.id, {
      title: 'QE-Module-Quiz',
      moduleType: 'quiz',
    });
    moduleExam = await createModule(tracker, lecture.id, course.id, {
      title: 'QE-Module-Exam',
      moduleType: 'exam',
      sortOrder: 2,
    });
    moduleExam2 = await createModule(tracker, lecture.id, course.id, {
      title: 'QE-Module-Exam2',
      moduleType: 'exam',
      sortOrder: 3,
    });
    moduleExtQuiz = await createModule(tracker, lecture.id, course.id, {
      title: 'QE-Module-ExtQuiz',
      moduleType: 'external_quiz',
      sortOrder: 4,
    });

    // Quiz content
    quiz = await createQuiz(tracker, moduleQuiz.id, { title: 'QE-Quiz' });
    quizQuestion = await createQuizQuestion(tracker, quiz.id, {
      questionText: 'QE question?',
      questionType: 'single_choice',
    });
    quizOption = await createQuizQuestionOption(tracker, quizQuestion.id, {
      optionText: 'Answer A',
      isCorrect: true,
    });

    // Exams
    exam = await createExam(tracker, moduleExam.id, { title: 'QE-Exam' });
    exam2 = await createExam(tracker, moduleExam2.id, { title: 'QE-Exam2' });

    // External quiz reference
    extQuizRef = await createExternalQuizReference(tracker, moduleExtQuiz.id, {
      externalQuizId: 'EXT-QE-001',
    });

    // 3. Tenant-course assignments
    await createTenantCourse(tracker, tenantA.id, course.id);
    await createTenantCourse(tracker, tenantB.id, course.id);
    await createTenantCourse(tracker, tenantA.id, course2.id);

    // 4. Users
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    tenantAdminA = await createUser(tracker, tenantA.id, 'tenant_admin');
    learnerA1 = await createUser(tracker, tenantA.id, 'learner');
    learnerA2 = await createUser(tracker, tenantA.id, 'learner');
    learnerB = await createUser(tracker, tenantB.id, 'learner');
    csmUser = await createUser(tracker, masterTenant.id, 'learner');
    lecturerGrade = await createUser(tracker, masterTenant.id, 'learner');

    // 5. Role assignments (BEFORE sign-in — JWT claims baked at login)
    await createCSMAssignment(tracker, csmUser.id, tenantA.id, platformAdmin.id);
    await createLecturerAssignment(tracker, lecturerGrade.id, course.id, platformAdmin.id, {
      canEdit: true,
      canGrade: true,
    });

    // 6. Enrollments (required for some INSERT policies)
    await createEnrollment(tracker, learnerA1.id, tenantA.id, course.id);
    await createEnrollment(tracker, learnerA2.id, tenantA.id, course.id);
    await createEnrollment(tracker, learnerB.id, tenantB.id, course.id);

    // 7. Pre-created data — learnerA1 (tenantA)
    attemptA1 = await createQuizAttempt(tracker, learnerA1.id, tenantA.id, quiz.id, {
      score: 80,
      passed: true,
      submittedAt: new Date().toISOString(),
    });
    answerA1 = await createQuizAttemptAnswer(tracker, attemptA1.id, quizQuestion.id, {
      userAnswer: quizOption.id,
    });
    submissionA1 = await createExamSubmission(tracker, learnerA1.id, tenantA.id, exam.id, course.id);
    extResultA1 = await createExternalQuizResult(tracker, learnerA1.id, tenantA.id, 'EXT-QE-001', {
      score: 90,
      passed: true,
    });

    // 8. Pre-created data — learnerB (tenantB)
    attemptB = await createQuizAttempt(tracker, learnerB.id, tenantB.id, quiz.id, {
      score: 60,
      passed: false,
      submittedAt: new Date().toISOString(),
    });
    answerB = await createQuizAttemptAnswer(tracker, attemptB.id, quizQuestion.id, {
      userAnswer: quizOption.id,
    });
    submissionB = await createExamSubmission(tracker, learnerB.id, tenantB.id, exam.id, course.id);
    extResultB = await createExternalQuizResult(tracker, learnerB.id, tenantB.id, 'EXT-QE-001', {
      score: 40,
      passed: false,
    });

    // 9. Throwaway rows for DELETE tests (learnerA2 + exam2 to avoid UNIQUE conflicts)
    submissionDeleteLecturer = await createExamSubmission(
      tracker, learnerA2.id, tenantA.id, exam2.id, course.id,
      { fileUrl: 'exam-submissions/delete-lecturer.pdf' },
    );
    submissionDeletePA = await createExamSubmission(
      tracker, learnerB.id, tenantB.id, exam2.id, course.id,
      { fileUrl: 'exam-submissions/delete-pa.pdf' },
    );

    // 10. Sign in all users (JWT claims now include role assignments)
    paClient = await createClientAs(platformAdmin);
    taClient = await createClientAs(tenantAdminA);
    learnerA1Client = await createClientAs(learnerA1);
    learnerA2Client = await createClientAs(learnerA2);
    learnerBClient = await createClientAs(learnerB);
    csmClient = await createClientAs(csmUser);
    lecturerClient = await createClientAs(lecturerGrade);
  }, 60_000);

  afterAll(async () => {
    await cleanupTestData(tracker);
  });

  // =========================================================================
  // GROUP 1: quiz_attempts SELECT (8 tests)
  // =========================================================================
  describe('quiz_attempts SELECT', () => {
    it('QE-001: learner sees own quiz attempts', async () => {
      const { data, error } = await learnerA1Client
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', learnerA1.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(attemptA1.id);
    });

    it('QE-002: learner cannot see other user attempts', async () => {
      await expect(
        learnerA2Client
          .from('quiz_attempts')
          .select('*')
          .eq('user_id', learnerA1.id),
      ).toDenyAccess('select');
    });

    it('QE-003: TA sees same-tenant attempts', async () => {
      const { data, error } = await taClient
        .from('quiz_attempts')
        .select('*')
        .eq('tenant_id', tenantA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('QE-004: TA cannot see other-tenant attempts', async () => {
      await expect(
        taClient
          .from('quiz_attempts')
          .select('*')
          .eq('tenant_id', tenantB.id),
      ).toDenyAccess('select');
    });

    it('QE-005: PA sees ALL attempts', async () => {
      const { data, error } = await paClient
        .from('quiz_attempts')
        .select('*')
        .in('id', [attemptA1.id, attemptB.id]);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('QE-006: lecturer sees assigned-course attempts (cross-tenant)', async () => {
      const { data, error } = await lecturerClient
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quiz.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
      const tenantIds = new Set(data!.map((r: any) => r.tenant_id));
      expect(tenantIds.size).toBeGreaterThanOrEqual(2);
    });

    it('QE-007: CSM sees assigned-tenant attempts', async () => {
      const { data, error } = await csmClient
        .from('quiz_attempts')
        .select('*')
        .eq('tenant_id', tenantA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('QE-008: CSM cannot see unassigned-tenant attempts', async () => {
      await expect(
        csmClient
          .from('quiz_attempts')
          .select('*')
          .eq('tenant_id', tenantB.id),
      ).toDenyAccess('select');
    });
  });

  // =========================================================================
  // GROUP 2: quiz_attempts INSERT (4 tests)
  // =========================================================================
  describe('quiz_attempts INSERT', () => {
    it('QE-009: learner inserts own quiz attempt', async () => {
      const { data, error } = await learnerA2Client
        .from('quiz_attempts')
        .insert({
          user_id: learnerA2.id,
          tenant_id: tenantA.id,
          quiz_id: quiz.id,
          attempt_number: 1,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.user_id).toBe(learnerA2.id);

      // Cleanup immediately to free UNIQUE constraint
      await adminClient.from('quiz_attempts').delete().eq('id', data!.id);
    });

    it('QE-010: learner cannot insert attempt for another user', async () => {
      await expect(
        learnerA1Client
          .from('quiz_attempts')
          .insert({
            user_id: learnerA2.id, // NOT self
            tenant_id: tenantA.id,
            quiz_id: quiz.id,
            attempt_number: 99,
          }),
      ).toDenyAccess('insert');
    });

    it('QE-011: learner cannot insert attempt with wrong tenant_id', async () => {
      await expect(
        learnerA1Client
          .from('quiz_attempts')
          .insert({
            user_id: learnerA1.id,
            tenant_id: tenantB.id, // Wrong tenant
            quiz_id: quiz.id,
            attempt_number: 99,
          }),
      ).toDenyAccess('insert');
    });

    it('QE-012: TA cannot insert quiz attempt for another user', async () => {
      await expect(
        taClient
          .from('quiz_attempts')
          .insert({
            user_id: learnerA1.id, // NOT self
            tenant_id: tenantA.id,
            quiz_id: quiz.id,
            attempt_number: 99,
          }),
      ).toDenyAccess('insert');
    });
  });

  // =========================================================================
  // GROUP 3: quiz_attempts UPDATE (3 tests)
  // =========================================================================
  describe('quiz_attempts UPDATE', () => {
    it('QE-013: learner updates own attempt (submitted_at)', async () => {
      const now = new Date().toISOString();
      const { data, error } = await learnerA1Client
        .from('quiz_attempts')
        .update({ submitted_at: now })
        .eq('id', attemptA1.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      // Restore
      await adminClient
        .from('quiz_attempts')
        .update({ submitted_at: attemptA1.id ? now : null }) // keep as-is since we just set it
        .eq('id', attemptA1.id);
    });

    it('QE-014: learner cannot update other user attempt', async () => {
      await expect(
        learnerA2Client
          .from('quiz_attempts')
          .update({ submitted_at: new Date().toISOString() })
          .eq('id', attemptA1.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('QE-015: protect_quiz_attempt_score reverts learner score change', async () => {
      // First, read the current score
      const { data: before } = await adminClient
        .from('quiz_attempts')
        .select('score, passed')
        .eq('id', attemptA1.id)
        .single();

      // Learner tries to change score — RLS allows UPDATE, but trigger reverts
      await learnerA1Client
        .from('quiz_attempts')
        .update({ score: 100, passed: true })
        .eq('id', attemptA1.id);

      // Re-read via admin — score should be unchanged
      const { data: after } = await adminClient
        .from('quiz_attempts')
        .select('score, passed')
        .eq('id', attemptA1.id)
        .single();

      expect(Number(after!.score)).toBe(Number(before!.score));
      expect(after!.passed).toBe(before!.passed);
    });
  });

  // =========================================================================
  // GROUP 4: quiz_attempts DELETE (1 test)
  // =========================================================================
  describe('quiz_attempts DELETE', () => {
    it('QE-016: no DELETE policy — PA cannot delete quiz attempts', async () => {
      await expect(
        paClient
          .from('quiz_attempts')
          .delete()
          .eq('id', attemptA1.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });

  // =========================================================================
  // GROUP 5: quiz_attempt_answers SELECT (7 tests)
  // =========================================================================
  describe('quiz_attempt_answers SELECT', () => {
    it('QE-017: learner sees own quiz answers', async () => {
      const { data, error } = await learnerA1Client
        .from('quiz_attempt_answers')
        .select('*')
        .eq('attempt_id', attemptA1.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(answerA1.id);
    });

    it('QE-018: learner cannot see other user answers', async () => {
      await expect(
        learnerA2Client
          .from('quiz_attempt_answers')
          .select('*')
          .eq('attempt_id', attemptA1.id),
      ).toDenyAccess('select');
    });

    it('QE-019: TA CANNOT see quiz answers (no policy)', async () => {
      await expect(
        taClient
          .from('quiz_attempt_answers')
          .select('*')
          .eq('id', answerA1.id),
      ).toDenyAccess('select');
    });

    it('QE-020: PA sees ALL quiz answers', async () => {
      const { data, error } = await paClient
        .from('quiz_attempt_answers')
        .select('*')
        .in('id', [answerA1.id, answerB.id]);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('QE-021: lecturer sees assigned-course answers', async () => {
      const { data, error } = await lecturerClient
        .from('quiz_attempt_answers')
        .select('*')
        .in('attempt_id', [attemptA1.id, attemptB.id]);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });

    it('QE-022: CSM sees assigned-tenant answers', async () => {
      const { data, error } = await csmClient
        .from('quiz_attempt_answers')
        .select('*')
        .eq('attempt_id', attemptA1.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('QE-023: CSM cannot see unassigned-tenant answers', async () => {
      await expect(
        csmClient
          .from('quiz_attempt_answers')
          .select('*')
          .eq('attempt_id', attemptB.id),
      ).toDenyAccess('select');
    });
  });

  // =========================================================================
  // GROUP 6: quiz_attempt_answers INSERT (2 tests)
  // =========================================================================
  describe('quiz_attempt_answers INSERT', () => {
    it('QE-024: learner inserts answer for own attempt', async () => {
      const { data, error } = await learnerA1Client
        .from('quiz_attempt_answers')
        .insert({
          attempt_id: attemptA1.id,
          question_id: quizQuestion.id,
          user_answer: 'test-answer',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.attempt_id).toBe(attemptA1.id);

      // Cleanup immediately
      await adminClient.from('quiz_attempt_answers').delete().eq('id', data!.id);
    });

    it('QE-025: learner cannot insert answer for other user attempt', async () => {
      await expect(
        learnerA2Client
          .from('quiz_attempt_answers')
          .insert({
            attempt_id: attemptA1.id, // Belongs to learnerA1
            question_id: quizQuestion.id,
            user_answer: 'hack',
          }),
      ).toDenyAccess('insert');
    });
  });

  // =========================================================================
  // GROUP 7: quiz_attempt_answers UPDATE + DELETE (2 tests)
  // =========================================================================
  describe('quiz_attempt_answers UPDATE + DELETE', () => {
    it('QE-026: no UPDATE policy — learner cannot update answers', async () => {
      await expect(
        learnerA1Client
          .from('quiz_attempt_answers')
          .update({ user_answer: 'changed' })
          .eq('id', answerA1.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('QE-027: no DELETE policy — PA cannot delete answers', async () => {
      await expect(
        paClient
          .from('quiz_attempt_answers')
          .delete()
          .eq('id', answerA1.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });

  // =========================================================================
  // GROUP 8: exam_submissions SELECT (8 tests)
  // =========================================================================
  describe('exam_submissions SELECT', () => {
    it('QE-028: learner sees own exam submission', async () => {
      const { data, error } = await learnerA1Client
        .from('exam_submissions')
        .select('*')
        .eq('user_id', learnerA1.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
      expect(data!.some((s: any) => s.id === submissionA1.id)).toBe(true);
    });

    it('QE-029: learner cannot see other user submission', async () => {
      await expect(
        learnerA2Client
          .from('exam_submissions')
          .select('*')
          .eq('user_id', learnerA1.id),
      ).toDenyAccess('select');
    });

    it('QE-030: TA sees same-tenant submissions', async () => {
      const { data, error } = await taClient
        .from('exam_submissions')
        .select('*')
        .eq('tenant_id', tenantA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('QE-031: TA cannot see other-tenant submissions', async () => {
      await expect(
        taClient
          .from('exam_submissions')
          .select('*')
          .eq('tenant_id', tenantB.id),
      ).toDenyAccess('select');
    });

    it('QE-032: PA sees ALL submissions', async () => {
      const { data, error } = await paClient
        .from('exam_submissions')
        .select('*')
        .in('id', [submissionA1.id, submissionB.id]);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('QE-033: lecturer (can_grade) sees assigned-course submissions', async () => {
      const { data, error } = await lecturerClient
        .from('exam_submissions')
        .select('*')
        .eq('course_id', course.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
      const tenantIds = new Set(data!.map((s: any) => s.tenant_id));
      expect(tenantIds.size).toBeGreaterThanOrEqual(2);
    });

    it('QE-034: CSM sees assigned-tenant submissions', async () => {
      const { data, error } = await csmClient
        .from('exam_submissions')
        .select('*')
        .eq('tenant_id', tenantA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('QE-035: CSM cannot see unassigned-tenant submissions', async () => {
      await expect(
        csmClient
          .from('exam_submissions')
          .select('*')
          .eq('tenant_id', tenantB.id),
      ).toDenyAccess('select');
    });
  });

  // =========================================================================
  // GROUP 9: exam_submissions INSERT (3 tests)
  // =========================================================================
  describe('exam_submissions INSERT', () => {
    it('QE-036: learner inserts own exam submission', async () => {
      // learnerA2 has no submission for exam yet — can insert
      const { data, error } = await learnerA2Client
        .from('exam_submissions')
        .insert({
          user_id: learnerA2.id,
          tenant_id: tenantA.id,
          exam_id: exam.id,
          course_id: course.id,
          file_url: 'exam-submissions/test-qe036.pdf',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.user_id).toBe(learnerA2.id);

      // Cleanup immediately to free UNIQUE constraint
      await adminClient.from('exam_submissions').delete().eq('id', data!.id);
    });

    it('QE-037: learner cannot insert submission for another user', async () => {
      await expect(
        learnerA1Client
          .from('exam_submissions')
          .insert({
            user_id: learnerA2.id, // NOT self
            tenant_id: tenantA.id,
            exam_id: exam.id,
            course_id: course.id,
            file_url: 'exam-submissions/hack.pdf',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
      ).toDenyAccess('insert');
    });

    it('QE-038: learner cannot insert with wrong tenant_id', async () => {
      await expect(
        learnerA1Client
          .from('exam_submissions')
          .insert({
            user_id: learnerA1.id,
            tenant_id: tenantB.id, // Wrong tenant
            exam_id: exam.id,
            course_id: course.id,
            file_url: 'exam-submissions/wrong-tenant.pdf',
            deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          }),
      ).toDenyAccess('insert');
    });
  });

  // =========================================================================
  // GROUP 10: exam_submissions UPDATE (4 tests)
  // =========================================================================
  describe('exam_submissions UPDATE', () => {
    it('QE-039: lecturer (can_grade) updates submission (grading)', async () => {
      const { data, error } = await lecturerClient
        .from('exam_submissions')
        .update({ score: 85, feedback: 'Good work' })
        .eq('id', submissionA1.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(Number(data![0].score)).toBe(85);

      // Restore
      await adminClient
        .from('exam_submissions')
        .update({ score: null, feedback: null, graded_by: null, graded_at: null })
        .eq('id', submissionA1.id);
    });

    it('QE-040: PA updates any submission', async () => {
      const { data, error } = await paClient
        .from('exam_submissions')
        .update({ score: 95, feedback: 'Excellent' })
        .eq('id', submissionB.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(Number(data![0].score)).toBe(95);

      // Restore
      await adminClient
        .from('exam_submissions')
        .update({ score: null, feedback: null, graded_by: null, graded_at: null })
        .eq('id', submissionB.id);
    });

    it('QE-041: learner cannot update own submission', async () => {
      await expect(
        learnerA1Client
          .from('exam_submissions')
          .update({ score: 100 })
          .eq('id', submissionA1.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('QE-042: TA cannot update submissions', async () => {
      await expect(
        taClient
          .from('exam_submissions')
          .update({ score: 50 })
          .eq('id', submissionA1.id)
          .select(),
      ).toDenyAccess('update');
    });
  });

  // =========================================================================
  // GROUP 11: exam_submissions DELETE (4 tests)
  // =========================================================================
  describe('exam_submissions DELETE', () => {
    it('QE-043: lecturer (can_grade) deletes submission', async () => {
      const { data, error } = await lecturerClient
        .from('exam_submissions')
        .delete()
        .eq('id', submissionDeleteLecturer.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('QE-044: PA deletes any submission', async () => {
      const { data, error } = await paClient
        .from('exam_submissions')
        .delete()
        .eq('id', submissionDeletePA.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('QE-045: learner cannot delete own submission', async () => {
      await expect(
        learnerA1Client
          .from('exam_submissions')
          .delete()
          .eq('id', submissionA1.id)
          .select(),
      ).toDenyAccess('delete');
    });

    it('QE-046: TA cannot delete submissions', async () => {
      await expect(
        taClient
          .from('exam_submissions')
          .delete()
          .eq('id', submissionA1.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });

  // =========================================================================
  // GROUP 12: external_quiz_results SELECT (7 tests)
  // =========================================================================
  describe('external_quiz_results SELECT', () => {
    it('QE-047: learner sees own external quiz results', async () => {
      const { data, error } = await learnerA1Client
        .from('external_quiz_results')
        .select('*')
        .eq('user_id', learnerA1.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(extResultA1.id);
    });

    it('QE-048: learner cannot see other user results', async () => {
      await expect(
        learnerA2Client
          .from('external_quiz_results')
          .select('*')
          .eq('user_id', learnerA1.id),
      ).toDenyAccess('select');
    });

    it('QE-049: TA CANNOT see external quiz results (no policy)', async () => {
      await expect(
        taClient
          .from('external_quiz_results')
          .select('*')
          .eq('id', extResultA1.id),
      ).toDenyAccess('select');
    });

    it('QE-050: PA sees ALL external quiz results', async () => {
      const { data, error } = await paClient
        .from('external_quiz_results')
        .select('*')
        .in('id', [extResultA1.id, extResultB.id]);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('QE-051: lecturer sees assigned-course results', async () => {
      const { data, error } = await lecturerClient
        .from('external_quiz_results')
        .select('*')
        .eq('external_quiz_id', 'EXT-QE-001');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });

    it('QE-052: CSM sees assigned-tenant results', async () => {
      const { data, error } = await csmClient
        .from('external_quiz_results')
        .select('*')
        .eq('tenant_id', tenantA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('QE-053: CSM cannot see unassigned-tenant results', async () => {
      await expect(
        csmClient
          .from('external_quiz_results')
          .select('*')
          .eq('tenant_id', tenantB.id),
      ).toDenyAccess('select');
    });
  });

  // =========================================================================
  // GROUP 13: external_quiz_results INSERT (1 test)
  // =========================================================================
  describe('external_quiz_results INSERT', () => {
    it('QE-054: no INSERT policy — learner cannot insert results', async () => {
      await expect(
        learnerA1Client
          .from('external_quiz_results')
          .insert({
            user_id: learnerA1.id,
            tenant_id: tenantA.id,
            external_quiz_id: 'EXT-QE-001',
            score: 100,
            passed: true,
          }),
      ).toDenyAccess('insert');
    });
  });

  // =========================================================================
  // GROUP 14: Trigger verification (1 test)
  // =========================================================================
  describe('trigger enforcement', () => {
    it('QE-055: enforce_exam_submission_course rejects wrong course_id', async () => {
      // course2 does NOT match exam's module's course (course)
      const { error } = await adminClient
        .from('exam_submissions')
        .insert({
          user_id: learnerA2.id,
          tenant_id: tenantA.id,
          exam_id: exam.id,
          course_id: course2.id, // Mismatched — exam belongs to course, not course2
          file_url: 'exam-submissions/trigger-test.pdf',
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(error).not.toBeNull();
      expect(error!.message.toLowerCase()).toContain('course');
    });
  });
});
