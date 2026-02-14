/**
 * Phase 8B + 8C — Notification Trigger Integration Tests & RLS Tests
 *
 * Tables tested:
 *   notifications (2 RLS policies: SELECT own, UPDATE own, no INSERT, no DELETE)
 *
 * Section A (Phase 8C): RLS policy tests (NT-001 to NT-009)
 * Section B (Phase 8B): Trigger integration tests (NT-010 to NT-030)
 *
 * All 13 SECURITY DEFINER trigger functions are verified:
 *   1. notify_course_assigned       (course_enrollments INSERT)
 *   2. notify_new_module            (modules INSERT)
 *   3. notify_progress_reset        (user_progress UPDATE)
 *   4. notify_exam_graded           (exam_submissions UPDATE)
 *   5. notify_question_answered     (expert_questions UPDATE)
 *   6. notify_reminder_sent         (reminder_history INSERT)
 *   7. notify_new_expert_question   (expert_questions INSERT)
 *   8. notify_new_exam_submission   (exam_submissions INSERT)
 *   9. notify_new_issue             (issues INSERT)
 *  10. notify_new_access_request    (access_requests INSERT)
 *  11. notify_issue_resolved        (issues UPDATE)
 *  12. notify_exam_reset            (exam_submissions DELETE)
 *  13. notify_access_request_reviewed (access_requests UPDATE)
 */

import { SupabaseClient } from '@supabase/supabase-js';
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
  createUserProgress,
  createCSMAssignment,
  createLecturerAssignment,
  createExam,
  createExamSubmission,
  createExpertQuestion,
  createIssue,
  type TestUser,
  type TestTenant,
} from '../setup';

describe('notifications RLS + triggers', () => {
  const tracker = new TestDataTracker();

  // Tenants
  let masterTenant: TestTenant;
  let clientTenant: TestTenant;

  // Content hierarchy
  let course: { id: string; title: string };
  let course2: { id: string; title: string }; // No enrollees — for negative tests
  let lecture: { id: string };
  let module1: { id: string };
  let examModule: { id: string };
  let exam: { id: string };

  // Users (6)
  let platformAdmin: TestUser;
  let tenantAdmin: TestUser;
  let learnerA: TestUser;
  let learnerB: TestUser;
  let csmUser: TestUser;
  let lecturerUser: TestUser;

  // Authenticated clients
  let paClient: SupabaseClient;
  let taClient: SupabaseClient;
  let learnerAClient: SupabaseClient;
  let learnerBClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let lecturerClient: SupabaseClient;

  // Pre-created data IDs
  let enrollmentA: { id: string };
  let enrollmentB: { id: string };
  let progressA: { id: string };
  let expertQuestionA: { id: string };
  let issueA: { id: string };
  let examSubmissionA: { id: string };

  // Track notification IDs from setup for RLS test reference
  let learnerANotifId: string;
  let learnerBNotifId: string;

  beforeAll(async () => {
    // Step 1: Get master tenant
    masterTenant = await getExistingMasterTenant();

    // Step 2: Create client tenant
    clientTenant = await createTenant(tracker, {
      name: 'NT ClientTenant',
      domain: `nt-client-${Date.now()}.test`,
    });

    // Step 3: Content hierarchy
    course = await createCourse(tracker, { title: `NT-Course-${Date.now()}` });
    course2 = await createCourse(tracker, { title: `NT-Course2-NoEnrollees-${Date.now()}` });
    lecture = await createLecture(tracker, course.id, { title: 'NT-Lecture' });
    const lecture2 = await createLecture(tracker, course2.id, { title: 'NT-Lecture2' });
    module1 = await createModule(tracker, lecture.id, course.id, { title: 'NT-Module' });
    examModule = await createModule(tracker, lecture.id, course.id, {
      title: 'NT-ExamModule',
      moduleType: 'exam',
    });
    exam = await createExam(tracker, examModule.id, { title: 'NT-Exam' });

    // Step 4: Assign courses to tenants
    await createTenantCourse(tracker, masterTenant.id, course.id);
    await createTenantCourse(tracker, clientTenant.id, course.id);

    // Step 5: Create users
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    tenantAdmin = await createUser(tracker, clientTenant.id, 'tenant_admin');
    learnerA = await createUser(tracker, masterTenant.id);
    learnerB = await createUser(tracker, clientTenant.id);
    csmUser = await createUser(tracker, masterTenant.id);
    lecturerUser = await createUser(tracker, masterTenant.id);

    // Step 6: Role assignments BEFORE sign-in
    await createCSMAssignment(tracker, csmUser.id, clientTenant.id, platformAdmin.id);
    await createLecturerAssignment(tracker, lecturerUser.id, course.id, platformAdmin.id, {
      canEdit: true,
      canGrade: true,
    });

    // Step 7: Pre-create data (each fires triggers that create notifications)
    // Enrollments → fires notify_course_assigned
    enrollmentA = await createEnrollment(tracker, learnerA.id, masterTenant.id, course.id);
    enrollmentB = await createEnrollment(tracker, learnerB.id, clientTenant.id, course.id);

    // UserProgress for learnerA (completed — for reset test)
    progressA = await createUserProgress(
      tracker, learnerA.id, masterTenant.id, course.id, lecture.id, module1.id,
      { status: 'completed' },
    );

    // ExpertQuestion from learnerA (pending — for question_answered test)
    // This also fires notify_new_expert_question
    expertQuestionA = await createExpertQuestion(
      tracker, learnerA.id, masterTenant.id, course.id,
      { moduleId: module1.id, questionText: 'NT-setup-question' },
    );

    // Issue from learnerA (open — for issue_resolved test)
    // This also fires notify_new_issue
    issueA = await createIssue(tracker, learnerA.id, masterTenant.id, course.id, {
      moduleId: module1.id,
      description: 'NT-setup-issue',
    });

    // ExamSubmission from learnerA (score=NULL — for exam_graded test)
    // This also fires notify_new_exam_submission
    examSubmissionA = await createExamSubmission(
      tracker, learnerA.id, masterTenant.id, exam.id, course.id,
    );

    // Grab notification IDs created by setup triggers for RLS tests
    const { data: learnerANotifs } = await adminClient
      .from('notifications')
      .select('id')
      .eq('user_id', learnerA.id)
      .eq('type', 'course_assigned')
      .limit(1);
    learnerANotifId = learnerANotifs?.[0]?.id;

    const { data: learnerBNotifs } = await adminClient
      .from('notifications')
      .select('id')
      .eq('user_id', learnerB.id)
      .eq('type', 'course_assigned')
      .limit(1);
    learnerBNotifId = learnerBNotifs?.[0]?.id;

    // Step 8: Sign in all users
    [paClient, taClient, learnerAClient, learnerBClient, csmClient, lecturerClient] =
      await Promise.all([
        createClientAs(platformAdmin),
        createClientAs(tenantAdmin),
        createClientAs(learnerA),
        createClientAs(learnerB),
        createClientAs(csmUser),
        createClientAs(lecturerUser),
      ]);
  }, 90000);

  afterAll(async () => {
    // Clean up any stray notifications created by ad-hoc tests
    // (access_requests rows need manual cleanup since no factory tracks them)
    await cleanupTestData(tracker);
  });

  // ==========================================================================
  // Section A: RLS Tests (Phase 8C) — 9 tests
  // ==========================================================================

  describe('Section A: RLS Policies', () => {
    // ------ SELECT ------

    it('NT-001: Learner can SELECT own notifications', async () => {
      const { data, error } = await learnerAClient
        .from('notifications')
        .select('id')
        .eq('user_id', learnerA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      expect(data!.some((n: any) => n.id === learnerANotifId)).toBe(true);
    });

    it('NT-002: Learner CANNOT see other user notifications', async () => {
      const { data, error } = await learnerAClient
        .from('notifications')
        .select('id');

      expect(error).toBeNull();
      const ids = data!.map((n: any) => n.id);
      // learnerA should NOT see learnerB's notification
      expect(ids).not.toContain(learnerBNotifId);
    });

    it('NT-003: PA CANNOT see other user notifications (no admin override)', async () => {
      const { data, error } = await paClient
        .from('notifications')
        .select('id, user_id');

      expect(error).toBeNull();
      // PA only sees own notifications (if any); should NOT see learnerA/B notifs
      const userIds = data!.map((n: any) => n.user_id);
      const uniqueUserIds = [...new Set(userIds)];
      // All returned notifications belong to PA only
      if (uniqueUserIds.length > 0) {
        expect(uniqueUserIds).toEqual([platformAdmin.id]);
      }
    });

    // ------ UPDATE ------

    it('NT-004: Learner can UPDATE own notification (mark as read)', async () => {
      const now = new Date().toISOString();
      const { data, error } = await learnerAClient
        .from('notifications')
        .update({ read_at: now })
        .eq('id', learnerANotifId)
        .select('id, read_at')
        .single();

      expect(error).toBeNull();
      expect(data!.read_at).toBeTruthy();

      // Revert
      await adminClient
        .from('notifications')
        .update({ read_at: null })
        .eq('id', learnerANotifId);
    });

    it('NT-005: Learner CANNOT UPDATE other user notification', async () => {
      const { data } = await learnerAClient
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', learnerBNotifId)
        .select();

      expect(data).toEqual([]);
    });

    // ------ INSERT (denied) ------

    it('NT-006: Learner CANNOT INSERT notification directly', async () => {
      const { error } = await learnerAClient
        .from('notifications')
        .insert({
          user_id: learnerA.id,
          tenant_id: masterTenant.id,
          type: 'course_assigned',
          title: 'Fake notification',
          data: {},
        });

      expect(error).not.toBeNull();
    });

    it('NT-007: PA CANNOT INSERT notification directly', async () => {
      const { error } = await paClient
        .from('notifications')
        .insert({
          user_id: platformAdmin.id,
          tenant_id: masterTenant.id,
          type: 'course_assigned',
          title: 'Fake notification from PA',
          data: {},
        });

      expect(error).not.toBeNull();
    });

    // ------ DELETE (denied) ------

    it('NT-008: Learner CANNOT DELETE own notification', async () => {
      const { data } = await learnerAClient
        .from('notifications')
        .delete()
        .eq('id', learnerANotifId)
        .select();

      expect(data).toEqual([]);

      // Verify still exists
      const { data: verify } = await adminClient
        .from('notifications')
        .select('id')
        .eq('id', learnerANotifId)
        .single();
      expect(verify!.id).toBe(learnerANotifId);
    });

    it('NT-009: PA CANNOT DELETE notifications', async () => {
      const { data } = await paClient
        .from('notifications')
        .delete()
        .eq('id', learnerANotifId)
        .select();

      expect(data).toEqual([]);

      // Verify still exists
      const { data: verify } = await adminClient
        .from('notifications')
        .select('id')
        .eq('id', learnerANotifId)
        .single();
      expect(verify!.id).toBe(learnerANotifId);
    });
  });

  // ==========================================================================
  // Section B: Trigger Integration Tests (Phase 8B) — 21 tests
  // ==========================================================================

  describe('Section B: Trigger Tests', () => {
    // Helper: wait briefly for triggers to complete
    const briefly = () => new Promise(r => setTimeout(r, 300));

    // ------ 1. notify_course_assigned ------

    describe('notify_course_assigned', () => {
      it('NT-010: INSERT enrollment → learner gets course_assigned notif', async () => {
        // Create a temp learner + enroll
        const tempLearner = await createUser(tracker, clientTenant.id);
        const enrollment = await createEnrollment(tracker, tempLearner.id, clientTenant.id, course.id);
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', tempLearner.id)
          .eq('type', 'course_assigned');

        expect(data!.length).toBe(1);
        const notif = data![0];
        expect(notif.title).toBe('New course assigned');
        expect(notif.body).toContain(course.title);
        expect(notif.data.course_id).toBe(course.id);
        expect(notif.tenant_id).toBe(clientTenant.id);
      });
    });

    // ------ 2. notify_new_module ------

    describe('notify_new_module', () => {
      it('NT-011: INSERT module → all enrolled learners get new_module notif', async () => {
        const newMod = await createModule(tracker, lecture.id, course.id, {
          title: `NT-011-mod-${Date.now()}`,
        });
        await briefly();

        // Both learnerA (master) and learnerB (client) are enrolled
        const { data: notifsA } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', learnerA.id)
          .eq('type', 'new_module')
          .contains('data', { module_id: newMod.id });

        const { data: notifsB } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', learnerB.id)
          .eq('type', 'new_module')
          .contains('data', { module_id: newMod.id });

        expect(notifsA!.length).toBe(1);
        expect(notifsB!.length).toBe(1);
        expect(notifsA![0].body).toContain(`NT-011-mod-`);
        expect(notifsA![0].data.course_id).toBe(course.id);
      });

      it('NT-012: INSERT module on course with no enrollees → 0 notifications', async () => {
        // course2 has no tenant_courses or enrollments
        const lecture2 = await createLecture(tracker, course2.id, { title: 'NT-012-lec' });
        const newMod = await createModule(tracker, lecture2.id, course2.id, {
          title: `NT-012-mod-${Date.now()}`,
        });
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('id')
          .eq('type', 'new_module')
          .contains('data', { module_id: newMod.id });

        expect(data!.length).toBe(0);
      });
    });

    // ------ 3. notify_progress_reset ------

    describe('notify_progress_reset', () => {
      it('NT-013: UPDATE progress completed → not_started → learner gets progress_reset notif', async () => {
        // progressA is currently 'completed', update to 'not_started'
        await adminClient
          .from('user_progress')
          .update({ status: 'not_started' })
          .eq('id', progressA.id);
        await briefly();

        const { data, error } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', learnerA.id)
          .eq('type', 'progress_reset')
          .filter('data->>module_id', 'eq', module1.id);

        expect(error).toBeNull();
        expect(data!.length).toBeGreaterThanOrEqual(1);
        const notif = data![data!.length - 1]; // latest
        expect(notif.title).toBe('Module content updated');
        expect(notif.data.course_id).toBe(course.id);

        // Revert progress back to completed for potential future tests
        await adminClient
          .from('user_progress')
          .update({ status: 'completed' })
          .eq('id', progressA.id);

        // Clean up notification
        await adminClient.from('notifications').delete()
          .eq('user_id', learnerA.id)
          .eq('type', 'progress_reset');
      });

      it('NT-014: UPDATE progress not_started → completed → NO progress_reset notif', async () => {
        // First set to not_started (without trigger — it's already completed, set via admin)
        await adminClient
          .from('user_progress')
          .update({ status: 'not_started' })
          .eq('id', progressA.id);

        // Clean up the reset notification from above
        await briefly();
        await adminClient.from('notifications').delete()
          .eq('user_id', learnerA.id)
          .eq('type', 'progress_reset');

        // Now update not_started → completed (should NOT fire progress_reset)
        await adminClient
          .from('user_progress')
          .update({ status: 'completed' })
          .eq('id', progressA.id);
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('id')
          .eq('user_id', learnerA.id)
          .eq('type', 'progress_reset');

        expect(data!.length).toBe(0);
      });
    });

    // ------ 4. notify_exam_graded ------

    describe('notify_exam_graded', () => {
      it('NT-015: UPDATE score NULL → 85 → learner gets exam_graded notif', async () => {
        await adminClient
          .from('exam_submissions')
          .update({
            score: 85,
            feedback: 'Good work',
            graded_by: lecturerUser.id,
            graded_at: new Date().toISOString(),
          })
          .eq('id', examSubmissionA.id);
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', learnerA.id)
          .eq('type', 'exam_graded')
          .contains('data', { submission_id: examSubmissionA.id });

        expect(data!.length).toBe(1);
        expect(data![0].title).toBe('Your exam has been graded');
        expect(data![0].data.score).toBe(85);
        expect(data![0].data.course_id).toBe(course.id);
        expect(data![0].data.exam_id).toBe(exam.id);

        // Revert score
        await adminClient
          .from('exam_submissions')
          .update({ score: null, feedback: null, graded_by: null, graded_at: null })
          .eq('id', examSubmissionA.id);

        // Clean up notification
        await adminClient.from('notifications').delete()
          .eq('type', 'exam_graded')
          .contains('data', { submission_id: examSubmissionA.id });
      });

      it('NT-016: UPDATE score 85 → 90 (re-grade) → NO new exam_graded notif', async () => {
        // First grade: NULL → 85
        await adminClient
          .from('exam_submissions')
          .update({
            score: 85,
            graded_by: lecturerUser.id,
            graded_at: new Date().toISOString(),
          })
          .eq('id', examSubmissionA.id);
        await briefly();

        // Clean up first notification
        await adminClient.from('notifications').delete()
          .eq('type', 'exam_graded')
          .contains('data', { submission_id: examSubmissionA.id });

        // Re-grade: 85 → 90 (should NOT fire — OLD.score is NOT NULL)
        await adminClient
          .from('exam_submissions')
          .update({ score: 90 })
          .eq('id', examSubmissionA.id);
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('id')
          .eq('type', 'exam_graded')
          .contains('data', { submission_id: examSubmissionA.id });

        expect(data!.length).toBe(0);

        // Revert
        await adminClient
          .from('exam_submissions')
          .update({ score: null, feedback: null, graded_by: null, graded_at: null })
          .eq('id', examSubmissionA.id);
      });
    });

    // ------ 5. notify_question_answered ------

    describe('notify_question_answered', () => {
      it('NT-017: UPDATE response_text NULL → text → asker gets question_answered notif', async () => {
        await adminClient
          .from('expert_questions')
          .update({
            response_text: 'Here is the answer',
            responded_by: lecturerUser.id,
            responded_at: new Date().toISOString(),
            status: 'answered',
          })
          .eq('id', expertQuestionA.id);
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', learnerA.id)
          .eq('type', 'question_answered')
          .contains('data', { question_id: expertQuestionA.id });

        expect(data!.length).toBe(1);
        expect(data![0].title).toBe('Your question has been answered');
        expect(data![0].data.course_id).toBe(course.id);

        // Revert
        await adminClient
          .from('expert_questions')
          .update({ response_text: null, responded_by: null, responded_at: null, status: 'pending' })
          .eq('id', expertQuestionA.id);

        // Clean up
        await adminClient.from('notifications').delete()
          .eq('type', 'question_answered')
          .contains('data', { question_id: expertQuestionA.id });
      });

      it('NT-018: UPDATE existing response_text → NO new notif', async () => {
        // First answer: NULL → text
        await adminClient
          .from('expert_questions')
          .update({
            response_text: 'First answer',
            responded_by: lecturerUser.id,
            responded_at: new Date().toISOString(),
            status: 'answered',
          })
          .eq('id', expertQuestionA.id);
        await briefly();

        // Clean up first notification
        await adminClient.from('notifications').delete()
          .eq('type', 'question_answered')
          .contains('data', { question_id: expertQuestionA.id });

        // Update existing response (should NOT fire — OLD.response_text IS NOT NULL)
        await adminClient
          .from('expert_questions')
          .update({ response_text: 'Updated answer' })
          .eq('id', expertQuestionA.id);
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('id')
          .eq('type', 'question_answered')
          .contains('data', { question_id: expertQuestionA.id });

        expect(data!.length).toBe(0);

        // Revert
        await adminClient
          .from('expert_questions')
          .update({ response_text: null, responded_by: null, responded_at: null, status: 'pending' })
          .eq('id', expertQuestionA.id);
      });
    });

    // ------ 6. notify_reminder_sent ------

    describe('notify_reminder_sent', () => {
      it('NT-019: INSERT reminder_history → sent_to user gets reminder notif', async () => {
        const { data: rh, error: rhErr } = await adminClient
          .from('reminder_history')
          .insert({
            sent_to: learnerA.id,
            sent_by: lecturerUser.id,
            tenant_id: masterTenant.id,
            course_id: course.id,
          })
          .select()
          .single();

        expect(rhErr).toBeNull();
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', learnerA.id)
          .eq('type', 'reminder')
          .contains('data', { course_id: course.id });

        // At least one reminder notif
        expect(data!.length).toBeGreaterThanOrEqual(1);
        const notif = data!.find((n: any) => true); // Get any
        expect(notif.title).toBe('Continue your learning');

        // Clean up
        await adminClient.from('notifications').delete()
          .eq('user_id', learnerA.id)
          .eq('type', 'reminder');
        await adminClient.from('reminder_history').delete().eq('id', rh!.id);
      });
    });

    // ------ 7. notify_new_expert_question ------

    describe('notify_new_expert_question', () => {
      it('NT-020: INSERT expert_question → lecturer gets new_expert_question notif', async () => {
        const eq = await createExpertQuestion(
          tracker, learnerA.id, masterTenant.id, course.id,
          { moduleId: module1.id, questionText: `NT-020-q-${Date.now()}` },
        );
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', lecturerUser.id)
          .eq('type', 'new_expert_question')
          .contains('data', { question_id: eq.id });

        expect(data!.length).toBe(1);
        expect(data![0].title).toBe('New question from a learner');
        expect(data![0].data.course_id).toBe(course.id);

        // Clean up notifications for this question
        await adminClient.from('notifications').delete()
          .eq('type', 'new_expert_question')
          .contains('data', { question_id: eq.id });
      });

      it('NT-021: INSERT expert_question (client tenant) → CSM gets notif too', async () => {
        const eq = await createExpertQuestion(
          tracker, learnerB.id, clientTenant.id, course.id,
          { moduleId: module1.id, questionText: `NT-021-q-${Date.now()}` },
        );
        await briefly();

        // CSM is assigned to clientTenant
        const { data: csmNotifs } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', csmUser.id)
          .eq('type', 'new_expert_question')
          .contains('data', { question_id: eq.id });

        expect(csmNotifs!.length).toBe(1);
        expect(csmNotifs![0].body).toContain('assigned tenant');
        expect(csmNotifs![0].data.asker_tenant_id).toBe(clientTenant.id);

        // Lecturer should also get one
        const { data: lecNotifs } = await adminClient
          .from('notifications')
          .select('id')
          .eq('user_id', lecturerUser.id)
          .eq('type', 'new_expert_question')
          .contains('data', { question_id: eq.id });

        expect(lecNotifs!.length).toBe(1);

        // Clean up
        await adminClient.from('notifications').delete()
          .eq('type', 'new_expert_question')
          .contains('data', { question_id: eq.id });
      });
    });

    // ------ 8. notify_new_exam_submission ------

    describe('notify_new_exam_submission', () => {
      it('NT-022: INSERT exam_submission → lecturer (can_grade) gets new_exam_submission notif', async () => {
        const sub = await createExamSubmission(
          tracker, learnerB.id, clientTenant.id, exam.id, course.id,
        );
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', lecturerUser.id)
          .eq('type', 'new_exam_submission')
          .contains('data', { submission_id: sub.id });

        expect(data!.length).toBe(1);
        expect(data![0].title).toBe('New exam submission to grade');
        expect(data![0].data.course_id).toBe(course.id);
        expect(data![0].data.exam_id).toBe(exam.id);

        // Clean up
        await adminClient.from('notifications').delete()
          .eq('type', 'new_exam_submission')
          .contains('data', { submission_id: sub.id });
      });
    });

    // ------ 9. notify_new_issue ------

    describe('notify_new_issue', () => {
      it('NT-023: INSERT issue → lecturer + CSM + PA all get new_issue (deduplicated)', async () => {
        const iss = await createIssue(
          tracker, learnerB.id, clientTenant.id, course.id,
          { description: `NT-023-issue-${Date.now()}` },
        );
        await briefly();

        // Lecturer (assigned to course)
        const { data: lecNotifs } = await adminClient
          .from('notifications')
          .select('id')
          .eq('user_id', lecturerUser.id)
          .eq('type', 'new_issue')
          .contains('data', { issue_id: iss.id });
        expect(lecNotifs!.length).toBe(1);

        // CSM (assigned to clientTenant)
        const { data: csmNotifs } = await adminClient
          .from('notifications')
          .select('id')
          .eq('user_id', csmUser.id)
          .eq('type', 'new_issue')
          .contains('data', { issue_id: iss.id });
        expect(csmNotifs!.length).toBe(1);

        // PA
        const { data: paNotifs } = await adminClient
          .from('notifications')
          .select('id')
          .eq('user_id', platformAdmin.id)
          .eq('type', 'new_issue')
          .contains('data', { issue_id: iss.id });
        expect(paNotifs!.length).toBe(1);

        // Clean up
        await adminClient.from('notifications').delete()
          .eq('type', 'new_issue')
          .contains('data', { issue_id: iss.id });
      });
    });

    // ------ 10. notify_new_access_request ------

    describe('notify_new_access_request', () => {
      it('NT-024: INSERT access_request (known domain) → TA + PA get new_access_request', async () => {
        const tag = `nt024-${Date.now()}`;
        const email = `${tag}@${clientTenant.domain}`;

        const { data: ar, error } = await adminClient
          .from('access_requests')
          .insert({
            email,
            full_name: 'NT024 User',
            domain: clientTenant.domain,
            tenant_id: clientTenant.id,
          })
          .select()
          .single();

        expect(error).toBeNull();
        await briefly();

        // Tenant admin of clientTenant
        const { data: taNotifs } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', tenantAdmin.id)
          .eq('type', 'new_access_request')
          .contains('data', { request_id: ar!.id });
        expect(taNotifs!.length).toBe(1);
        expect(taNotifs![0].body).toContain(email);

        // Platform admin
        const { data: paNotifs } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', platformAdmin.id)
          .eq('type', 'new_access_request')
          .contains('data', { request_id: ar!.id });
        expect(paNotifs!.length).toBe(1);
        expect(paNotifs![0].body).toContain('domain matched');

        // Clean up
        await adminClient.from('notifications').delete()
          .eq('type', 'new_access_request')
          .contains('data', { request_id: ar!.id });
        await adminClient.from('access_requests').delete().eq('id', ar!.id);
      });

      it('NT-025: INSERT access_request (unknown domain) → PA only, title includes "unknown domain"', async () => {
        const tag = `nt025-${Date.now()}`;
        const email = `${tag}@unknown-corp.xyz`;

        const { data: ar, error } = await adminClient
          .from('access_requests')
          .insert({
            email,
            full_name: 'NT025 Unknown',
            domain: 'unknown-corp.xyz',
            tenant_id: null,
          })
          .select()
          .single();

        expect(error).toBeNull();
        await briefly();

        // PA gets notif with "unknown domain" title
        const { data: paNotifs } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', platformAdmin.id)
          .eq('type', 'new_access_request')
          .contains('data', { request_id: ar!.id });

        expect(paNotifs!.length).toBe(1);
        expect(paNotifs![0].title).toContain('unknown domain');
        expect(paNotifs![0].body).toContain('unrecognized domain');

        // TA should NOT get this (no tenant_id match)
        const { data: taNotifs } = await adminClient
          .from('notifications')
          .select('id')
          .eq('user_id', tenantAdmin.id)
          .eq('type', 'new_access_request')
          .contains('data', { request_id: ar!.id });
        expect(taNotifs!.length).toBe(0);

        // Clean up
        await adminClient.from('notifications').delete()
          .eq('type', 'new_access_request')
          .contains('data', { request_id: ar!.id });
        await adminClient.from('access_requests').delete().eq('id', ar!.id);
      });
    });

    // ------ 11. notify_issue_resolved ------

    describe('notify_issue_resolved', () => {
      it('NT-026: UPDATE issue status open → resolved → reporter gets issue_resolved notif', async () => {
        await adminClient
          .from('issues')
          .update({
            status: 'resolved',
            resolved_by: lecturerUser.id,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', issueA.id);
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', learnerA.id)
          .eq('type', 'issue_resolved')
          .contains('data', { issue_id: issueA.id });

        expect(data!.length).toBe(1);
        expect(data![0].title).toBe('Your issue has been resolved');
        expect(data![0].data.course_id).toBe(course.id);

        // Revert
        await adminClient
          .from('issues')
          .update({ status: 'open', resolved_by: null, resolved_at: null })
          .eq('id', issueA.id);

        // Clean up
        await adminClient.from('notifications').delete()
          .eq('type', 'issue_resolved')
          .contains('data', { issue_id: issueA.id });
      });

      it('NT-027: UPDATE issue status resolved → closed → NO issue_resolved notif', async () => {
        // First resolve it
        await adminClient
          .from('issues')
          .update({
            status: 'resolved',
            resolved_by: lecturerUser.id,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', issueA.id);
        await briefly();

        // Clean up resolve notification
        await adminClient.from('notifications').delete()
          .eq('type', 'issue_resolved')
          .contains('data', { issue_id: issueA.id });

        // Now resolved → closed (should NOT fire — only fires on status → 'resolved')
        await adminClient
          .from('issues')
          .update({ status: 'closed' })
          .eq('id', issueA.id);
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('id')
          .eq('type', 'issue_resolved')
          .contains('data', { issue_id: issueA.id });

        expect(data!.length).toBe(0);

        // Revert
        await adminClient
          .from('issues')
          .update({ status: 'open', resolved_by: null, resolved_at: null })
          .eq('id', issueA.id);
      });
    });

    // ------ 12. notify_exam_reset ------

    describe('notify_exam_reset', () => {
      it('NT-028: DELETE exam_submission → student gets exam_reset notif', async () => {
        // Both learnerA and learnerB already have submissions — create temp learner
        const tempLearner = await createUser(tracker, clientTenant.id);
        await createEnrollment(tracker, tempLearner.id, clientTenant.id, course.id);

        const tempSub = await createExamSubmission(
          tracker, tempLearner.id, clientTenant.id, exam.id, course.id,
        );
        await briefly();

        // Clean up the new_exam_submission + course_assigned notifications
        await adminClient.from('notifications').delete()
          .eq('type', 'new_exam_submission')
          .filter('data->>submission_id', 'eq', tempSub.id);
        await adminClient.from('notifications').delete()
          .eq('user_id', tempLearner.id)
          .eq('type', 'course_assigned');

        // DELETE the submission → fires notify_exam_reset
        await adminClient
          .from('exam_submissions')
          .delete()
          .eq('id', tempSub.id);
        await briefly();

        const { data } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', tempLearner.id)
          .eq('type', 'exam_reset');

        expect(data!.length).toBeGreaterThanOrEqual(1);
        const notif = data![data!.length - 1]; // latest
        expect(notif.title).toBe('Your exam has been reset');
        expect(notif.body).toContain('NT-Exam');
        expect(notif.data.exam_id).toBe(exam.id);

        // Clean up
        await adminClient.from('notifications').delete()
          .eq('user_id', tempLearner.id)
          .eq('type', 'exam_reset');
      });
    });

    // ------ 13. notify_access_request_reviewed ------

    describe('notify_access_request_reviewed', () => {
      it('NT-029: UPDATE access_request pending → approved → requester gets access_request_reviewed notif', async () => {
        // Create a user who also has an access_request
        const reqUser = await createUser(tracker, clientTenant.id);

        const { data: ar, error } = await adminClient
          .from('access_requests')
          .insert({
            email: reqUser.email,
            full_name: 'NT029 Requester',
            domain: clientTenant.domain,
            tenant_id: clientTenant.id,
            status: 'pending',
          })
          .select()
          .single();
        expect(error).toBeNull();
        await briefly();

        // Clean up the new_access_request notif from INSERT
        await adminClient.from('notifications').delete()
          .eq('type', 'new_access_request')
          .contains('data', { request_id: ar!.id });

        // Approve the request
        await adminClient
          .from('access_requests')
          .update({
            status: 'approved',
            reviewed_by: platformAdmin.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', ar!.id);
        await briefly();

        // Requester (has profile) should get direct notification
        const { data: reqNotifs } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', reqUser.id)
          .eq('type', 'access_request_reviewed')
          .contains('data', { request_id: ar!.id });

        expect(reqNotifs!.length).toBe(1);
        expect(reqNotifs![0].title).toBe('Access request approved');
        expect(reqNotifs![0].body).toContain('approved');
        expect(reqNotifs![0].data.status).toBe('approved');

        // Clean up
        await adminClient.from('notifications').delete()
          .eq('type', 'access_request_reviewed')
          .contains('data', { request_id: ar!.id });
        await adminClient.from('access_requests').delete().eq('id', ar!.id);
      });

      it('NT-030: UPDATE access_request pending → rejected (no profile) → PAs get notif with needs_invite', async () => {
        const tag = `nt030-${Date.now()}`;
        const email = `${tag}@${clientTenant.domain}`;

        // Create access_request for a user who does NOT have a profile
        const { data: ar, error } = await adminClient
          .from('access_requests')
          .insert({
            email,
            full_name: 'NT030 NoProfile',
            domain: clientTenant.domain,
            tenant_id: clientTenant.id,
            status: 'pending',
          })
          .select()
          .single();
        expect(error).toBeNull();
        await briefly();

        // Clean up the new_access_request notif from INSERT
        await adminClient.from('notifications').delete()
          .eq('type', 'new_access_request')
          .contains('data', { request_id: ar!.id });

        // Reject the request
        await adminClient
          .from('access_requests')
          .update({
            status: 'rejected',
            reviewed_by: platformAdmin.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', ar!.id);
        await briefly();

        // No profile for this email → PAs get fallback notification with needs_invite
        const { data: paNotifs } = await adminClient
          .from('notifications')
          .select('*')
          .eq('user_id', platformAdmin.id)
          .eq('type', 'access_request_reviewed')
          .contains('data', { request_id: ar!.id });

        expect(paNotifs!.length).toBe(1);
        expect(paNotifs![0].title).toContain('needs invite');
        expect(paNotifs![0].data.needs_invite).toBe(true);
        expect(paNotifs![0].data.email).toBe(email);

        // Clean up
        await adminClient.from('notifications').delete()
          .eq('type', 'access_request_reviewed')
          .contains('data', { request_id: ar!.id });
        await adminClient.from('access_requests').delete().eq('id', ar!.id);
      });
    });
  });
});
