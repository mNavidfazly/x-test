/**
 * Phase 6D — Expert Questions RLS Tests
 *
 * Tables tested:
 *   expert_questions (8 policies: 5 SELECT, 1 INSERT, 2 UPDATE, 0 DELETE — migration 00004)
 *
 * Test prefix: EQ-001 through EQ-016
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
  createCSMAssignment,
  createLecturerAssignment,
  createExpertQuestion,
  type TestUser,
  type TestTenant,
} from '../setup';

describe('expert_questions RLS', () => {
  const tracker = new TestDataTracker();

  // Tenants
  let masterTenant: TestTenant;
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  // Content hierarchy
  let course: { id: string };
  let lecture: { id: string };
  let module: { id: string };

  // Users
  let platformAdmin: TestUser;
  let tenantAdminA: TestUser;
  let learnerA1: TestUser;
  let learnerB: TestUser;
  let csmUser: TestUser;
  let lecturerUser: TestUser;

  // Authenticated clients
  let paClient: SupabaseClient;
  let taClient: SupabaseClient;
  let learnerA1Client: SupabaseClient;
  let learnerBClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let lecturerClient: SupabaseClient;

  // Pre-created data
  let questionA1: { id: string };
  let questionA1answered: { id: string };
  let questionB: { id: string };

  // Track IDs of rows created by INSERT tests for afterAll cleanup
  const insertedIds: string[] = [];

  beforeAll(async () => {
    // Step 1: Get master tenant
    masterTenant = await getExistingMasterTenant();

    // Step 2: Create client tenants
    tenantA = await createTenant(tracker, { name: 'EQ TenantA', domain: `eq-a-${Date.now()}.test` });
    tenantB = await createTenant(tracker, { name: 'EQ TenantB', domain: `eq-b-${Date.now()}.test` });

    // Step 3: Content hierarchy
    course = await createCourse(tracker, { title: 'EQ Test Course' });
    lecture = await createLecture(tracker, course.id);
    module = await createModule(tracker, lecture.id, course.id);

    // Step 4: Assign course to both tenants
    await createTenantCourse(tracker, tenantA.id, course.id);
    await createTenantCourse(tracker, tenantB.id, course.id);

    // Step 5: Create users
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    tenantAdminA = await createUser(tracker, tenantA.id, 'tenant_admin');
    learnerA1 = await createUser(tracker, tenantA.id);
    learnerB = await createUser(tracker, tenantB.id);
    csmUser = await createUser(tracker, masterTenant.id);
    lecturerUser = await createUser(tracker, masterTenant.id);

    // Step 6: Role assignments BEFORE sign-in
    await createCSMAssignment(tracker, csmUser.id, tenantA.id, platformAdmin.id);
    await createLecturerAssignment(tracker, lecturerUser.id, course.id, platformAdmin.id);

    // Step 7: Pre-create test data
    questionA1 = await createExpertQuestion(tracker, learnerA1.id, tenantA.id, course.id, {
      questionText: 'Question from learnerA1',
    });
    questionA1answered = await createExpertQuestion(tracker, learnerA1.id, tenantA.id, course.id, {
      questionText: 'Answered question from learnerA1',
      status: 'answered',
      responseText: 'Here is the answer',
      respondedBy: lecturerUser.id,
      respondedAt: new Date().toISOString(),
    });
    questionB = await createExpertQuestion(tracker, learnerB.id, tenantB.id, course.id, {
      questionText: 'Question from learnerB',
    });

    // Step 8: Sign in all users
    [paClient, taClient, learnerA1Client, learnerBClient, csmClient, lecturerClient] =
      await Promise.all([
        createClientAs(platformAdmin),
        createClientAs(tenantAdminA),
        createClientAs(learnerA1),
        createClientAs(learnerB),
        createClientAs(csmUser),
        createClientAs(lecturerUser),
      ]);
  }, 60_000);

  afterAll(async () => {
    // Clean up any rows created by INSERT tests
    for (const id of insertedIds) {
      await adminClient.from('expert_questions').delete().eq('id', id);
    }
    await cleanupTestData(tracker);
  });

  // =========================================================================
  // GROUP 1: expert_questions SELECT (7 tests)
  // =========================================================================

  it('EQ-001: learner sees own questions only', async () => {
    const { data, error } = await learnerA1Client
      .from('expert_questions')
      .select('id')
      .eq('course_id', course.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(questionA1.id);
    expect(ids).toContain(questionA1answered.id);
    expect(ids).not.toContain(questionB.id);
  });

  it('EQ-002: learnerA1 cannot see learnerB\'s questions', async () => {
    await expect(
      learnerA1Client
        .from('expert_questions')
        .select('id')
        .eq('id', questionB.id),
    ).toDenyAccess('select');
  });

  it('EQ-003: tenant admin sees own tenant questions', async () => {
    const { data, error } = await taClient
      .from('expert_questions')
      .select('id')
      .eq('course_id', course.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(questionA1.id);
    expect(ids).toContain(questionA1answered.id);
    expect(ids).not.toContain(questionB.id);
  });

  it('EQ-004: tenant admin cannot see other tenant questions', async () => {
    await expect(
      taClient
        .from('expert_questions')
        .select('id')
        .eq('id', questionB.id),
    ).toDenyAccess('select');
  });

  it('EQ-005: platform admin sees ALL questions across tenants', async () => {
    const { data, error } = await paClient
      .from('expert_questions')
      .select('id')
      .eq('course_id', course.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(questionA1.id);
    expect(ids).toContain(questionA1answered.id);
    expect(ids).toContain(questionB.id);
  });

  it('EQ-006: CSM sees questions from assigned tenant only', async () => {
    const { data, error } = await csmClient
      .from('expert_questions')
      .select('id')
      .eq('course_id', course.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(questionA1.id);
    expect(ids).toContain(questionA1answered.id);
    expect(ids).not.toContain(questionB.id);
  });

  it('EQ-007: lecturer sees questions on assigned course cross-tenant', async () => {
    const { data, error } = await lecturerClient
      .from('expert_questions')
      .select('id')
      .eq('course_id', course.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(questionA1.id);
    expect(ids).toContain(questionA1answered.id);
    expect(ids).toContain(questionB.id);
  });

  // =========================================================================
  // GROUP 2: expert_questions INSERT (2 tests)
  // =========================================================================

  it('EQ-008: learner can insert question on own tenant', async () => {
    const { data, error } = await learnerA1Client
      .from('expert_questions')
      .insert({
        user_id: learnerA1.id,
        tenant_id: tenantA.id,
        course_id: course.id,
        question_text: 'EQ-008 insert test',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.question_text).toBe('EQ-008 insert test');
    insertedIds.push(data!.id);
  });

  it('EQ-009: learner cannot insert question with wrong tenant_id', async () => {
    await expect(
      learnerA1Client
        .from('expert_questions')
        .insert({
          user_id: learnerA1.id,
          tenant_id: tenantB.id,
          course_id: course.id,
          question_text: 'EQ-009 wrong tenant',
        }),
    ).toDenyAccess('insert');
  });

  // =========================================================================
  // GROUP 3: expert_questions UPDATE (4 tests)
  // =========================================================================

  it('EQ-010: lecturer can update question on assigned course', async () => {
    const { data, error } = await lecturerClient
      .from('expert_questions')
      .update({
        response_text: 'Lecturer response',
        status: 'answered',
      })
      .eq('id', questionA1.id)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].response_text).toBe('Lecturer response');
    expect(data![0].status).toBe('answered');

    // Restore original values
    await adminClient
      .from('expert_questions')
      .update({ response_text: null, status: 'pending', responded_by: null, responded_at: null })
      .eq('id', questionA1.id);
  });

  it('EQ-011: platform admin can update any question', async () => {
    const { data, error } = await paClient
      .from('expert_questions')
      .update({ status: 'closed' })
      .eq('id', questionB.id)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].status).toBe('closed');

    // Restore
    await adminClient
      .from('expert_questions')
      .update({ status: 'pending' })
      .eq('id', questionB.id);
  });

  it('EQ-012: learner cannot update own question', async () => {
    await expect(
      learnerA1Client
        .from('expert_questions')
        .update({ question_text: 'Edited by learner' })
        .eq('id', questionA1.id)
        .select(),
    ).toDenyAccess('update');
  });

  it('EQ-013: tenant admin cannot update questions', async () => {
    await expect(
      taClient
        .from('expert_questions')
        .update({ status: 'closed' })
        .eq('id', questionA1.id)
        .select(),
    ).toDenyAccess('update');
  });

  // =========================================================================
  // GROUP 4: expert_questions DELETE (3 tests)
  // =========================================================================

  it('EQ-014: learner cannot delete own question', async () => {
    await expect(
      learnerA1Client
        .from('expert_questions')
        .delete()
        .eq('id', questionA1.id)
        .select(),
    ).toDenyAccess('delete');
  });

  it('EQ-015: platform admin cannot delete questions', async () => {
    await expect(
      paClient
        .from('expert_questions')
        .delete()
        .eq('id', questionA1.id)
        .select(),
    ).toDenyAccess('delete');
  });

  it('EQ-016: lecturer cannot delete questions', async () => {
    await expect(
      lecturerClient
        .from('expert_questions')
        .delete()
        .eq('id', questionA1.id)
        .select(),
    ).toDenyAccess('delete');
  });
});
