/**
 * RLS Tests — Knowledge Check Questions & Responses
 *
 * Tests cover:
 * - knowledge_check_questions: SELECT/INSERT/UPDATE/DELETE per role
 * - knowledge_check_questions_safe (view): learner sees stripped options
 * - knowledge_check_responses: SELECT/INSERT/DELETE per role
 * - check_knowledge_answer RPC: correct/wrong answers, enrollment check
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
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
  createLecturerAssignment,
  createCSMAssignment,
  createKnowledgeCheckQuestion,
  createKnowledgeCheckResponse,
  type TestUser,
  type TestTenant,
} from '../setup';

describe('Knowledge Check RLS', () => {
  const tracker = new TestDataTracker();

  // Tenants
  let masterTenant: TestTenant;
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  // Content
  let course: { id: string };
  let lecture: { id: string };
  let moduleA: { id: string };
  let questionA1: { id: string };
  let questionA2: { id: string };

  // Users
  let platformAdmin: TestUser;
  let tenantAdminA: TestUser;
  let learnerA1: TestUser;
  let learnerA2: TestUser;
  let learnerB: TestUser;
  let csmUser: TestUser;
  let lecturerEdit: TestUser;
  let lecturerReadOnly: TestUser;

  // Clients
  let paClient: SupabaseClient;
  let taClient: SupabaseClient;
  let learnerA1Client: SupabaseClient;
  let learnerA2Client: SupabaseClient;
  let learnerBClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let lecturerEditClient: SupabaseClient;
  let lecturerReadOnlyClient: SupabaseClient;

  // Pre-created response for SELECT tests
  let responseA1: { id: string };

  beforeAll(async () => {
    // 1. Tenants
    masterTenant = await getExistingMasterTenant();
    tenantA = await createTenant(tracker, { name: 'KC-TenantA', domain: 'kc-a.local', authMethods: ['email_password'] });
    tenantB = await createTenant(tracker, { name: 'KC-TenantB', domain: 'kc-b.local', authMethods: ['email_password'] });

    // 2. Content hierarchy
    course = await createCourse(tracker, { title: 'KC Test Course' });
    lecture = await createLecture(tracker, course.id, { title: 'KC Lecture' });
    moduleA = await createModule(tracker, lecture.id, course.id, { title: 'KC Module', moduleType: 'markdown' });

    // 3. Assign course to both tenants
    await createTenantCourse(tracker, tenantA.id, course.id);
    await createTenantCourse(tracker, tenantB.id, course.id);

    // 4. Create knowledge check questions
    questionA1 = await createKnowledgeCheckQuestion(tracker, moduleA.id, {
      questionText: 'What is 2+2?',
      questionType: 'single_choice',
      options: [
        { text: 'Four', isCorrect: true },
        { text: 'Five', isCorrect: false },
        { text: 'Six', isCorrect: false },
      ],
      explanation: 'Basic arithmetic',
      orderIndex: 0,
    });
    questionA2 = await createKnowledgeCheckQuestion(tracker, moduleA.id, {
      questionText: 'The sky is blue.',
      questionType: 'true_false',
      options: [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
      ],
      orderIndex: 1,
    });

    // 5. Create users
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    tenantAdminA = await createUser(tracker, tenantA.id, 'tenant_admin');
    learnerA1 = await createUser(tracker, tenantA.id, 'learner');
    learnerA2 = await createUser(tracker, tenantA.id, 'learner');
    learnerB = await createUser(tracker, tenantB.id, 'learner');
    csmUser = await createUser(tracker, masterTenant.id, 'learner');
    lecturerEdit = await createUser(tracker, masterTenant.id, 'learner');
    lecturerReadOnly = await createUser(tracker, masterTenant.id, 'learner');

    // 6. Role assignments
    await createCSMAssignment(tracker, csmUser.id, tenantA.id, platformAdmin.id);
    await createLecturerAssignment(tracker, lecturerEdit.id, course.id, platformAdmin.id, { canEdit: true, canGrade: false });
    await createLecturerAssignment(tracker, lecturerReadOnly.id, course.id, platformAdmin.id, { canEdit: false, canGrade: true });

    // 7. Enrollments
    await createEnrollment(tracker, learnerA1.id, tenantA.id, course.id);
    await createEnrollment(tracker, learnerA2.id, tenantA.id, course.id);
    await createEnrollment(tracker, learnerB.id, tenantB.id, course.id);

    // 8. Pre-create response for SELECT tests
    responseA1 = await createKnowledgeCheckResponse(tracker, questionA1.id, learnerA1.id, tenantA.id, {
      selectedOptionIndex: 0,
      isCorrect: true,
    });

    // 9. Sign in all users (JWT claims baked now)
    paClient = await createClientAs(platformAdmin);
    taClient = await createClientAs(tenantAdminA);
    learnerA1Client = await createClientAs(learnerA1);
    learnerA2Client = await createClientAs(learnerA2);
    learnerBClient = await createClientAs(learnerB);
    csmClient = await createClientAs(csmUser);
    lecturerEditClient = await createClientAs(lecturerEdit);
    lecturerReadOnlyClient = await createClientAs(lecturerReadOnly);
  }, 60_000);

  afterAll(async () => {
    await cleanupTestData(tracker);
  });

  // =========================================================================
  // knowledge_check_questions — SELECT
  // =========================================================================

  describe('knowledge_check_questions SELECT', () => {
    it('KC-001: learner in tenant with course sees questions', async () => {
      const { data, error } = await learnerA1Client
        .from('knowledge_check_questions')
        .select('*')
        .eq('module_id', moduleA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('KC-002: PA sees all questions', async () => {
      const { data, error } = await paClient
        .from('knowledge_check_questions')
        .select('*')
        .eq('module_id', moduleA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('KC-003: lecturer sees questions on assigned course', async () => {
      const { data, error } = await lecturerEditClient
        .from('knowledge_check_questions')
        .select('*')
        .eq('module_id', moduleA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });
  });

  // =========================================================================
  // knowledge_check_questions_safe (view) — learner sees stripped options
  // =========================================================================

  describe('knowledge_check_questions_safe SELECT', () => {
    it('KC-004: safe view strips isCorrect from options', async () => {
      const { data, error } = await learnerA1Client
        .from('knowledge_check_questions_safe')
        .select('*')
        .eq('module_id', moduleA.id)
        .order('order_index');

      expect(error).toBeNull();
      expect(data).toHaveLength(2);

      // First question — options should only have 'text', NOT 'isCorrect'
      const options = data![0].options as any[];
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveProperty('text');
      expect(options[0]).not.toHaveProperty('isCorrect');
    });
  });

  // =========================================================================
  // knowledge_check_questions — INSERT
  // =========================================================================

  describe('knowledge_check_questions INSERT', () => {
    it('KC-005: lecturer with can_edit inserts question', async () => {
      const { data, error } = await lecturerEditClient
        .from('knowledge_check_questions')
        .insert({
          module_id: moduleA.id,
          question_text: 'Temp question by lecturer',
          question_type: 'true_false',
          options: [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }],
          order_index: 99,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.question_text).toBe('Temp question by lecturer');

      // Cleanup
      await adminClient.from('knowledge_check_questions').delete().eq('id', data!.id);
    });

    it('KC-006: PA inserts question', async () => {
      const { data, error } = await paClient
        .from('knowledge_check_questions')
        .insert({
          module_id: moduleA.id,
          question_text: 'Temp question by PA',
          question_type: 'single_choice',
          options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }],
          order_index: 98,
        })
        .select()
        .single();

      expect(error).toBeNull();

      // Cleanup
      await adminClient.from('knowledge_check_questions').delete().eq('id', data!.id);
    });

    it('KC-007: learner cannot insert question', async () => {
      await expect(
        learnerA1Client.from('knowledge_check_questions').insert({
          module_id: moduleA.id,
          question_text: 'Hacked question',
          question_type: 'true_false',
          options: [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }],
          order_index: 0,
        }),
      ).toDenyAccess('insert');
    });

    it('KC-008: lecturer without can_edit cannot insert question', async () => {
      await expect(
        lecturerReadOnlyClient.from('knowledge_check_questions').insert({
          module_id: moduleA.id,
          question_text: 'Read-only lecturer tries insert',
          question_type: 'true_false',
          options: [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }],
          order_index: 0,
        }),
      ).toDenyAccess('insert');
    });
  });

  // =========================================================================
  // knowledge_check_questions — UPDATE
  // =========================================================================

  describe('knowledge_check_questions UPDATE', () => {
    it('KC-009: lecturer with can_edit updates question', async () => {
      const { data, error } = await lecturerEditClient
        .from('knowledge_check_questions')
        .update({ question_text: 'Updated by lecturer' })
        .eq('id', questionA1.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].question_text).toBe('Updated by lecturer');

      // Restore
      await adminClient
        .from('knowledge_check_questions')
        .update({ question_text: 'What is 2+2?' })
        .eq('id', questionA1.id);
    });

    it('KC-010: PA updates question', async () => {
      const { data, error } = await paClient
        .from('knowledge_check_questions')
        .update({ explanation: 'Updated by PA' })
        .eq('id', questionA1.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      // Restore
      await adminClient
        .from('knowledge_check_questions')
        .update({ explanation: 'Basic arithmetic' })
        .eq('id', questionA1.id);
    });

    it('KC-011: learner cannot update question', async () => {
      await expect(
        learnerA1Client
          .from('knowledge_check_questions')
          .update({ question_text: 'Hacked' })
          .eq('id', questionA1.id)
          .select(),
      ).toDenyAccess('update');
    });
  });

  // =========================================================================
  // knowledge_check_questions — DELETE
  // =========================================================================

  describe('knowledge_check_questions DELETE', () => {
    let tempQuestionLecturer: { id: string };
    let tempQuestionPA: { id: string };

    beforeAll(async () => {
      tempQuestionLecturer = await createKnowledgeCheckQuestion(tracker, moduleA.id, {
        questionText: 'Delete me (lecturer)',
        orderIndex: 90,
      });
      tempQuestionPA = await createKnowledgeCheckQuestion(tracker, moduleA.id, {
        questionText: 'Delete me (PA)',
        orderIndex: 91,
      });
    });

    it('KC-012: lecturer with can_edit deletes question', async () => {
      const { data, error } = await lecturerEditClient
        .from('knowledge_check_questions')
        .delete()
        .eq('id', tempQuestionLecturer.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('KC-013: PA deletes question', async () => {
      const { data, error } = await paClient
        .from('knowledge_check_questions')
        .delete()
        .eq('id', tempQuestionPA.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('KC-014: learner cannot delete question', async () => {
      await expect(
        learnerA1Client
          .from('knowledge_check_questions')
          .delete()
          .eq('id', questionA2.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });

  // =========================================================================
  // knowledge_check_responses — SELECT
  // =========================================================================

  describe('knowledge_check_responses SELECT', () => {
    it('KC-015: learner sees own responses', async () => {
      const { data, error } = await learnerA1Client
        .from('knowledge_check_responses')
        .select('*')
        .eq('user_id', learnerA1.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(responseA1.id);
    });

    it('KC-016: learner cannot see other user responses', async () => {
      await expect(
        learnerA2Client
          .from('knowledge_check_responses')
          .select('*')
          .eq('user_id', learnerA1.id),
      ).toDenyAccess('select');
    });

    it('KC-017: PA sees all responses', async () => {
      const { data, error } = await paClient
        .from('knowledge_check_responses')
        .select('*')
        .eq('question_id', questionA1.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('KC-018: lecturer sees responses on assigned course', async () => {
      const { data, error } = await lecturerEditClient
        .from('knowledge_check_responses')
        .select('*')
        .eq('question_id', questionA1.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // knowledge_check_responses — INSERT (direct, not via RPC)
  // =========================================================================

  describe('knowledge_check_responses INSERT', () => {
    it('KC-019: learner inserts own response (enrolled)', async () => {
      const { data, error } = await learnerA2Client
        .from('knowledge_check_responses')
        .insert({
          question_id: questionA1.id,
          user_id: learnerA2.id,
          tenant_id: tenantA.id,
          selected_option_index: 1,
          is_correct: false,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.user_id).toBe(learnerA2.id);

      // Cleanup
      await adminClient.from('knowledge_check_responses').delete().eq('id', data!.id);
    });

    it('KC-020: learner cannot insert response for another user', async () => {
      await expect(
        learnerA1Client.from('knowledge_check_responses').insert({
          question_id: questionA2.id,
          user_id: learnerA2.id,
          tenant_id: tenantA.id,
          selected_option_index: 0,
          is_correct: true,
        }),
      ).toDenyAccess('insert');
    });

    it('KC-021: learner cannot insert response with wrong tenant', async () => {
      await expect(
        learnerA1Client.from('knowledge_check_responses').insert({
          question_id: questionA2.id,
          user_id: learnerA1.id,
          tenant_id: tenantB.id,
          selected_option_index: 0,
          is_correct: true,
        }),
      ).toDenyAccess('insert');
    });
  });

  // =========================================================================
  // knowledge_check_responses — DELETE
  // =========================================================================

  describe('knowledge_check_responses DELETE', () => {
    let tempResponse: { id: string };

    beforeAll(async () => {
      tempResponse = await createKnowledgeCheckResponse(tracker, questionA2.id, learnerA1.id, tenantA.id, {
        selectedOptionIndex: 0,
        isCorrect: true,
      });
    });

    it('KC-022: learner cannot delete own response', async () => {
      await expect(
        learnerA1Client
          .from('knowledge_check_responses')
          .delete()
          .eq('id', tempResponse.id)
          .select(),
      ).toDenyAccess('delete');
    });

    it('KC-023: PA deletes response', async () => {
      const { data, error } = await paClient
        .from('knowledge_check_responses')
        .delete()
        .eq('id', tempResponse.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  // =========================================================================
  // check_knowledge_answer RPC
  // =========================================================================

  describe('check_knowledge_answer RPC', () => {
    it('KC-024: enrolled learner submits correct answer', async () => {
      // learnerA2 has no response for questionA2 yet
      const { data, error } = await learnerA2Client.rpc('check_knowledge_answer', {
        p_question_id: questionA2.id,
        p_selected_index: 0,
      });

      expect(error).toBeNull();
      const result = data as any;
      expect(result.is_correct).toBe(true);
      expect(result.correct_index).toBe(0);

      // Cleanup
      await adminClient
        .from('knowledge_check_responses')
        .delete()
        .eq('question_id', questionA2.id)
        .eq('user_id', learnerA2.id);
    });

    it('KC-025: enrolled learner submits wrong answer', async () => {
      const { data, error } = await learnerBClient.rpc('check_knowledge_answer', {
        p_question_id: questionA1.id,
        p_selected_index: 1,
      });

      expect(error).toBeNull();
      const result = data as any;
      expect(result.is_correct).toBe(false);
      expect(result.correct_index).toBe(0);
      expect(result.explanation).toBe('Basic arithmetic');

      // Cleanup
      await adminClient
        .from('knowledge_check_responses')
        .delete()
        .eq('question_id', questionA1.id)
        .eq('user_id', learnerB.id);
    });

    it('KC-026: already-answered returns error', async () => {
      // learnerA1 already has response for questionA1 from beforeAll
      const { data, error } = await learnerA1Client.rpc('check_knowledge_answer', {
        p_question_id: questionA1.id,
        p_selected_index: 0,
      });

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/already answered/i);
    });
  });
});
