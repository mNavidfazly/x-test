/**
 * Enrollment & Progress RLS Tests (Phase 4D)
 *
 * Tables tested:
 *   - course_enrollments (10 policies: 5 SELECT, 3 INSERT, 2 DELETE)
 *   - user_progress (11 policies: 5 SELECT, 3 INSERT, 3 UPDATE, 0 DELETE)
 *   - enroll_with_password() RPC (SECURITY DEFINER)
 *   - enforce_quiz_exam_completion trigger
 *
 * Policy source files:
 *   - supabase/migrations/00004_rls_policies.sql
 *   - supabase/migrations/00009_audit_fixes.sql (enrollment INSERT rewrites)
 *   - supabase/migrations/00022_fix_enroll_rpc_search_path.sql
 *   - supabase/migrations/00026_progress_tracking.sql (admin INSERT policies)
 *
 * Test prefix: EP-001 through EP-048
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
  createUserProgress,
  createCSMAssignment,
  createLecturerAssignment,
  type TestUser,
  type TestTenant,
} from '../setup';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('enrollment & progress RLS', () => {
  const tracker = new TestDataTracker();

  // --- Tenants ---
  let masterTenant: TestTenant;
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  // --- Courses ---
  let courseOpen: { id: string; title: string };
  let coursePassword: { id: string; title: string };
  let courseInvite: { id: string; title: string };

  // --- Content hierarchy ---
  let lectureA1: { id: string };
  let moduleA1: { id: string }; // markdown — under courseOpen
  let moduleA2: { id: string }; // quiz — under courseOpen (for trigger test)
  let lectureB1: { id: string };
  let moduleB1: { id: string }; // markdown — under coursePassword

  // --- Users ---
  let platformAdmin: TestUser;
  let tenantAdminA: TestUser;
  let learnerA1: TestUser;
  let learnerA2: TestUser;
  let learnerB: TestUser;
  let csmUser: TestUser;
  let lecturerUser: TestUser;

  // --- Authenticated clients ---
  let paClient: SupabaseClient;
  let taClient: SupabaseClient;
  let learnerA1Client: SupabaseClient;
  let learnerA2Client: SupabaseClient;
  let learnerBClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let lecturerClient: SupabaseClient;

  // --- Pre-created enrollments ---
  let enrollmentA1Open: { id: string };
  let enrollmentA1Pass: { id: string };
  let enrollmentBOpen: { id: string };

  // --- Pre-created progress ---
  let progressA1: { id: string };
  let progressB1: { id: string };

  // --- Throwaway enrollment IDs (created by INSERT tests, tracked for cleanup) ---
  let enrollmentFromEP016: string | null = null;
  let enrollmentFromEP018: string | null = null;
  let enrollmentFromEP024: string | null = null;

  beforeAll(async () => {
    // 1. Tenants
    masterTenant = await getExistingMasterTenant();
    tenantA = await createTenant(tracker, {
      name: 'EP-TenantA',
      domain: 'ep-rls-a.local',
      authMethods: ['email_password'],
    });
    tenantB = await createTenant(tracker, {
      name: 'EP-TenantB',
      domain: 'ep-rls-b.local',
      authMethods: ['email_password'],
    });

    // 2. Courses (3 enrollment types)
    courseOpen = await createCourse(tracker, {
      title: 'EP-OpenCourse',
      enrollmentType: 'open',
    });
    coursePassword = await createCourse(tracker, {
      title: 'EP-PassCourse',
      enrollmentType: 'password_protected',
      passwordHash: 'test-pass-123',
    });
    courseInvite = await createCourse(tracker, {
      title: 'EP-InviteCourse',
    }); // default = invite_only

    // 3. Content hierarchy (for progress tests)
    lectureA1 = await createLecture(tracker, courseOpen.id, { title: 'EP-LectureA1' });
    moduleA1 = await createModule(tracker, lectureA1.id, courseOpen.id, {
      title: 'EP-ModuleA1-Markdown',
      moduleType: 'markdown',
    });
    moduleA2 = await createModule(tracker, lectureA1.id, courseOpen.id, {
      title: 'EP-ModuleA2-Quiz',
      moduleType: 'quiz',
      sortOrder: 2,
    });
    lectureB1 = await createLecture(tracker, coursePassword.id, { title: 'EP-LectureB1' });
    moduleB1 = await createModule(tracker, lectureB1.id, coursePassword.id, {
      title: 'EP-ModuleB1-Markdown',
      moduleType: 'markdown',
    });

    // 4. Tenant-course assignments
    await createTenantCourse(tracker, tenantA.id, courseOpen.id);
    await createTenantCourse(tracker, tenantA.id, coursePassword.id);
    await createTenantCourse(tracker, tenantA.id, courseInvite.id);
    await createTenantCourse(tracker, tenantB.id, courseOpen.id);
    // coursePassword NOT assigned to tenantB — used in EP-026

    // 5. Users
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    tenantAdminA = await createUser(tracker, tenantA.id, 'tenant_admin');
    learnerA1 = await createUser(tracker, tenantA.id, 'learner');
    learnerA2 = await createUser(tracker, tenantA.id, 'learner');
    learnerB = await createUser(tracker, tenantB.id, 'learner');
    csmUser = await createUser(tracker, masterTenant.id, 'learner');
    lecturerUser = await createUser(tracker, masterTenant.id, 'learner');

    // 6. Role assignments (BEFORE sign-in — JWT claims baked at login)
    await createCSMAssignment(tracker, csmUser.id, tenantA.id, platformAdmin.id);
    await createLecturerAssignment(tracker, lecturerUser.id, courseOpen.id, platformAdmin.id);

    // 7. Pre-created enrollments (via adminClient)
    enrollmentA1Open = await createEnrollment(tracker, learnerA1.id, tenantA.id, courseOpen.id);
    enrollmentA1Pass = await createEnrollment(tracker, learnerA1.id, tenantA.id, coursePassword.id);
    enrollmentBOpen = await createEnrollment(tracker, learnerB.id, tenantB.id, courseOpen.id);

    // 8. Pre-created progress rows
    progressA1 = await createUserProgress(
      tracker, learnerA1.id, tenantA.id, courseOpen.id, lectureA1.id, moduleA1.id,
      { status: 'in_progress' },
    );
    progressB1 = await createUserProgress(
      tracker, learnerB.id, tenantB.id, courseOpen.id, lectureA1.id, moduleA1.id,
      { status: 'in_progress' },
    );

    // 9. Sign in all users (JWT claims now include role assignments)
    paClient = await createClientAs(platformAdmin);
    taClient = await createClientAs(tenantAdminA);
    learnerA1Client = await createClientAs(learnerA1);
    learnerA2Client = await createClientAs(learnerA2);
    learnerBClient = await createClientAs(learnerB);
    csmClient = await createClientAs(csmUser);
    lecturerClient = await createClientAs(lecturerUser);
  }, 60_000); // Extended timeout for 7 sign-ins + data setup

  afterAll(async () => {
    // Clean up any enrollments created by INSERT/RPC tests that weren't tracked by factories
    for (const eid of [enrollmentFromEP016, enrollmentFromEP018, enrollmentFromEP024]) {
      if (eid) {
        await adminClient.from('course_enrollments').delete().eq('id', eid);
      }
    }
    await cleanupTestData(tracker);
  });

  // =========================================================================
  // GROUP 1: course_enrollments SELECT (10 tests)
  // =========================================================================
  describe('course_enrollments SELECT', () => {
    it('EP-001: learner sees own enrollments', async () => {
      const { data, error } = await learnerA1Client
        .from('course_enrollments')
        .select('*')
        .eq('user_id', learnerA1.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(2); // courseOpen + coursePassword
    });

    it('EP-002: learner cannot see other user enrollments', async () => {
      await expect(
        learnerA2Client
          .from('course_enrollments')
          .select('*')
          .eq('user_id', learnerA1.id),
      ).toDenyAccess('select');
    });

    it('EP-003: tenant admin sees own tenant enrollments', async () => {
      const { data, error } = await taClient
        .from('course_enrollments')
        .select('*')
        .eq('tenant_id', tenantA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });

    it('EP-004: tenant admin cannot see other tenant enrollments', async () => {
      await expect(
        taClient
          .from('course_enrollments')
          .select('*')
          .eq('tenant_id', tenantB.id),
      ).toDenyAccess('select');
    });

    it('EP-005: platform admin sees ALL enrollments', async () => {
      const { data, error } = await paClient
        .from('course_enrollments')
        .select('*')
        .in('course_id', [courseOpen.id, coursePassword.id]);

      expect(error).toBeNull();
      // Should see enrollments from both tenantA and tenantB
      const tenantIds = new Set(data!.map((e: any) => e.tenant_id));
      expect(tenantIds.size).toBeGreaterThanOrEqual(2);
    });

    it('EP-006: CSM sees assigned tenant enrollments', async () => {
      const { data, error } = await csmClient
        .from('course_enrollments')
        .select('*')
        .eq('tenant_id', tenantA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });

    it('EP-007: CSM cannot see unassigned tenant enrollments', async () => {
      await expect(
        csmClient
          .from('course_enrollments')
          .select('*')
          .eq('tenant_id', tenantB.id),
      ).toDenyAccess('select');
    });

    it('EP-008: lecturer sees assigned course enrollments (cross-tenant)', async () => {
      const { data, error } = await lecturerClient
        .from('course_enrollments')
        .select('*')
        .eq('course_id', courseOpen.id);

      expect(error).toBeNull();
      // Should see enrollments from BOTH tenantA and tenantB (cross-tenant)
      expect(data!.length).toBeGreaterThanOrEqual(2);
      const tenantIds = new Set(data!.map((e: any) => e.tenant_id));
      expect(tenantIds.size).toBeGreaterThanOrEqual(2);
    });

    it('EP-009: lecturer cannot see unassigned course enrollments', async () => {
      await expect(
        lecturerClient
          .from('course_enrollments')
          .select('*')
          .eq('course_id', coursePassword.id),
      ).toDenyAccess('select');
    });

    it('EP-010: tenantB learner cannot see tenantA enrollments', async () => {
      await expect(
        learnerBClient
          .from('course_enrollments')
          .select('*')
          .eq('tenant_id', tenantA.id),
      ).toDenyAccess('select');
    });
  });

  // =========================================================================
  // GROUP 2: course_enrollments INSERT (8 tests)
  // =========================================================================
  describe('course_enrollments INSERT', () => {
    it('EP-011: learner self-enrolls in open course', async () => {
      const { data, error } = await learnerA2Client
        .from('course_enrollments')
        .insert({
          user_id: learnerA2.id,
          tenant_id: tenantA.id,
          course_id: courseOpen.id,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.user_id).toBe(learnerA2.id);
      expect(data!.course_id).toBe(courseOpen.id);

      // Track for cleanup + delete immediately to free UNIQUE for later tests
      await adminClient.from('course_enrollments').delete().eq('id', data!.id);
    });

    it('EP-012: learner cannot self-enroll in invite_only course', async () => {
      await expect(
        learnerA2Client
          .from('course_enrollments')
          .insert({
            user_id: learnerA2.id,
            tenant_id: tenantA.id,
            course_id: courseInvite.id,
          }),
      ).toDenyAccess('insert');
    });

    it('EP-013: learner cannot self-enroll in password_protected course (direct INSERT)', async () => {
      await expect(
        learnerA2Client
          .from('course_enrollments')
          .insert({
            user_id: learnerA2.id,
            tenant_id: tenantA.id,
            course_id: coursePassword.id,
          }),
      ).toDenyAccess('insert');
    });

    it('EP-014: learner cannot enroll another user', async () => {
      await expect(
        learnerA1Client
          .from('course_enrollments')
          .insert({
            user_id: learnerA2.id, // NOT self
            tenant_id: tenantA.id,
            course_id: courseOpen.id,
          }),
      ).toDenyAccess('insert');
    });

    it('EP-015: learner cannot enroll in course not assigned to their tenant', async () => {
      // coursePassword is NOT assigned to tenantB
      await expect(
        learnerBClient
          .from('course_enrollments')
          .insert({
            user_id: learnerB.id,
            tenant_id: tenantB.id,
            course_id: coursePassword.id,
          }),
      ).toDenyAccess('insert');
    });

    it('EP-016: tenant admin enrolls user in own tenant', async () => {
      const { data, error } = await taClient
        .from('course_enrollments')
        .insert({
          user_id: learnerA2.id,
          tenant_id: tenantA.id,
          course_id: coursePassword.id,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.user_id).toBe(learnerA2.id);
      enrollmentFromEP016 = data!.id;
    });

    it('EP-017: tenant admin cannot enroll user in other tenant', async () => {
      await expect(
        taClient
          .from('course_enrollments')
          .insert({
            user_id: learnerB.id,
            tenant_id: tenantB.id,
            course_id: courseOpen.id,
          }),
      ).toDenyAccess('insert');
    });

    it('EP-018: platform admin enrolls any user in any course', async () => {
      const { data, error } = await paClient
        .from('course_enrollments')
        .insert({
          user_id: learnerB.id,
          tenant_id: tenantB.id,
          course_id: coursePassword.id,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.user_id).toBe(learnerB.id);
      enrollmentFromEP018 = data!.id;
    });
  });

  // =========================================================================
  // GROUP 3: course_enrollments DELETE (5 tests)
  // =========================================================================
  describe('course_enrollments DELETE', () => {
    it('EP-019: learner cannot delete own enrollment', async () => {
      await expect(
        learnerA1Client
          .from('course_enrollments')
          .delete()
          .eq('id', enrollmentA1Open.id)
          .select(),
      ).toDenyAccess('delete');
    });

    it('EP-020: tenant admin deletes enrollment in own tenant', async () => {
      // Consumes enrollment created in EP-016
      expect(enrollmentFromEP016).not.toBeNull();

      const { data, error } = await taClient
        .from('course_enrollments')
        .delete()
        .eq('id', enrollmentFromEP016!)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      enrollmentFromEP016 = null; // consumed
    });

    it('EP-021: tenant admin cannot delete enrollment in other tenant', async () => {
      await expect(
        taClient
          .from('course_enrollments')
          .delete()
          .eq('id', enrollmentBOpen.id)
          .select(),
      ).toDenyAccess('delete');
    });

    it('EP-022: platform admin deletes any enrollment', async () => {
      // Consumes enrollment created in EP-018
      expect(enrollmentFromEP018).not.toBeNull();

      const { data, error } = await paClient
        .from('course_enrollments')
        .delete()
        .eq('id', enrollmentFromEP018!)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      enrollmentFromEP018 = null; // consumed
    });

    it('EP-023: CSM cannot delete enrollments', async () => {
      await expect(
        csmClient
          .from('course_enrollments')
          .delete()
          .eq('id', enrollmentA1Open.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });

  // =========================================================================
  // GROUP 4: enroll_with_password RPC (3 tests)
  // =========================================================================
  describe('enroll_with_password RPC', () => {
    it('EP-024: correct password enrolls learner via RPC', async () => {
      const { data, error } = await learnerA2Client.rpc('enroll_with_password', {
        p_course_id: coursePassword.id,
        p_password: 'test-pass-123',
      });

      expect(error).toBeNull();
      expect(data).toBeTruthy(); // returns enrollment UUID

      // Track for cleanup
      const { data: enrollment } = await adminClient
        .from('course_enrollments')
        .select('id')
        .eq('user_id', learnerA2.id)
        .eq('course_id', coursePassword.id)
        .single();

      if (enrollment) {
        enrollmentFromEP024 = enrollment.id;
      }
    });

    it('EP-025: wrong password rejected by RPC', async () => {
      // learnerA1 is already enrolled, use a fresh approach:
      // learnerB tries to enroll in a course assigned to their tenant — but coursePassword isn't assigned to tenantB
      // Instead, let's try with learnerA1 (already enrolled) — will get "already enrolled" error
      // Actually, test wrong password with a non-enrolled user from tenantA
      // We already used learnerA2 in EP-024, so we can't use them again.
      // Use csmUser — CSM is from master tenant, but coursePassword is not assigned to master tenant
      // Best approach: just test that the RPC returns an error for wrong password using learnerA1
      // who is already enrolled — but that gives "already enrolled" error, not "Invalid course password"
      //
      // The cleanest test: create a throwaway enrollment scenario.
      // Since learnerA2 was enrolled in EP-024, let's delete that first and retry with wrong password.
      if (enrollmentFromEP024) {
        await adminClient.from('course_enrollments').delete().eq('id', enrollmentFromEP024);
        enrollmentFromEP024 = null;
      }

      const { error } = await learnerA2Client.rpc('enroll_with_password', {
        p_course_id: coursePassword.id,
        p_password: 'wrong-password',
      });

      expect(error).not.toBeNull();
      expect(error!.message).toContain('Invalid course password');
    });

    it('EP-026: cross-tenant learner rejected by RPC (course not assigned)', async () => {
      // coursePassword is NOT assigned to tenantB
      const { error } = await learnerBClient.rpc('enroll_with_password', {
        p_course_id: coursePassword.id,
        p_password: 'test-pass-123',
      });

      expect(error).not.toBeNull();
      expect(error!.message).toContain('not available to your tenant');
    });
  });

  // =========================================================================
  // GROUP 5: user_progress SELECT (10 tests)
  // =========================================================================
  describe('user_progress SELECT', () => {
    it('EP-027: learner sees own progress', async () => {
      const { data, error } = await learnerA1Client
        .from('user_progress')
        .select('*')
        .eq('user_id', learnerA1.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
      expect(data![0].user_id).toBe(learnerA1.id);
    });

    it('EP-028: learner cannot see other user progress', async () => {
      await expect(
        learnerA2Client
          .from('user_progress')
          .select('*')
          .eq('user_id', learnerA1.id),
      ).toDenyAccess('select');
    });

    it('EP-029: tenant admin sees own tenant progress', async () => {
      const { data, error } = await taClient
        .from('user_progress')
        .select('*')
        .eq('tenant_id', tenantA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('EP-030: tenant admin cannot see other tenant progress', async () => {
      await expect(
        taClient
          .from('user_progress')
          .select('*')
          .eq('tenant_id', tenantB.id),
      ).toDenyAccess('select');
    });

    it('EP-031: platform admin sees ALL progress', async () => {
      const { data, error } = await paClient
        .from('user_progress')
        .select('*')
        .in('id', [progressA1.id, progressB1.id]);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);
    });

    it('EP-032: CSM sees assigned tenant progress', async () => {
      const { data, error } = await csmClient
        .from('user_progress')
        .select('*')
        .eq('tenant_id', tenantA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('EP-033: CSM cannot see unassigned tenant progress', async () => {
      await expect(
        csmClient
          .from('user_progress')
          .select('*')
          .eq('tenant_id', tenantB.id),
      ).toDenyAccess('select');
    });

    it('EP-034: lecturer sees assigned course progress (cross-tenant)', async () => {
      const { data, error } = await lecturerClient
        .from('user_progress')
        .select('*')
        .eq('course_id', courseOpen.id);

      expect(error).toBeNull();
      // Should see progress from BOTH tenantA and tenantB
      expect(data!.length).toBeGreaterThanOrEqual(2);
      const tenantIds = new Set(data!.map((p: any) => p.tenant_id));
      expect(tenantIds.size).toBeGreaterThanOrEqual(2);
    });

    it('EP-035: lecturer cannot see unassigned course progress', async () => {
      await expect(
        lecturerClient
          .from('user_progress')
          .select('*')
          .eq('course_id', coursePassword.id),
      ).toDenyAccess('select');
    });

    it('EP-036: tenantB learner cannot see tenantA progress', async () => {
      await expect(
        learnerBClient
          .from('user_progress')
          .select('*')
          .eq('tenant_id', tenantA.id),
      ).toDenyAccess('select');
    });
  });

  // =========================================================================
  // GROUP 6: user_progress INSERT (5 tests)
  // =========================================================================
  describe('user_progress INSERT', () => {
    it('EP-037: learner inserts own progress (markdown module)', async () => {
      // Use moduleB1 to avoid UNIQUE conflict with pre-created progressA1 on moduleA1
      const { data, error } = await learnerA1Client
        .from('user_progress')
        .insert({
          user_id: learnerA1.id,
          tenant_id: tenantA.id,
          course_id: coursePassword.id,
          lecture_id: lectureB1.id,
          module_id: moduleB1.id,
          status: 'in_progress',
          marked_by: 'user',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.user_id).toBe(learnerA1.id);

      // Cleanup this row to avoid UNIQUE conflicts
      await adminClient.from('user_progress').delete().eq('id', data!.id);
    });

    it('EP-038: learner cannot insert progress for another user', async () => {
      await expect(
        learnerA1Client
          .from('user_progress')
          .insert({
            user_id: learnerA2.id, // NOT self
            tenant_id: tenantA.id,
            course_id: courseOpen.id,
            lecture_id: lectureA1.id,
            module_id: moduleA1.id,
            status: 'not_started',
          }),
      ).toDenyAccess('insert');
    });

    it('EP-039: learner cannot insert progress with wrong tenant_id', async () => {
      await expect(
        learnerA1Client
          .from('user_progress')
          .insert({
            user_id: learnerA1.id,
            tenant_id: tenantB.id, // Wrong tenant
            course_id: courseOpen.id,
            lecture_id: lectureA1.id,
            module_id: moduleA2.id,
            status: 'not_started',
          }),
      ).toDenyAccess('insert');
    });

    it('EP-040: tenant admin inserts progress for own tenant user (admin mark)', async () => {
      const { data, error } = await taClient
        .from('user_progress')
        .insert({
          user_id: learnerA2.id,
          tenant_id: tenantA.id,
          course_id: courseOpen.id,
          lecture_id: lectureA1.id,
          module_id: moduleA1.id,
          status: 'completed',
          marked_by: 'admin',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.marked_by).toBe('admin');

      // Cleanup
      await adminClient.from('user_progress').delete().eq('id', data!.id);
    });

    it('EP-041: platform admin inserts progress for any user', async () => {
      const { data, error } = await paClient
        .from('user_progress')
        .insert({
          user_id: learnerB.id,
          tenant_id: tenantB.id,
          course_id: courseOpen.id,
          lecture_id: lectureA1.id,
          module_id: moduleA2.id,
          status: 'completed',
          marked_by: 'admin',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.user_id).toBe(learnerB.id);

      // Cleanup
      await adminClient.from('user_progress').delete().eq('id', data!.id);
    });
  });

  // =========================================================================
  // GROUP 7: user_progress UPDATE (5 tests)
  // =========================================================================
  describe('user_progress UPDATE', () => {
    it('EP-042: learner updates own progress', async () => {
      const { data, error } = await learnerA1Client
        .from('user_progress')
        .update({ status: 'completed', marked_by: 'user' })
        .eq('id', progressA1.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].status).toBe('completed');

      // Restore
      await adminClient
        .from('user_progress')
        .update({ status: 'in_progress', completed_at: null, marked_by: null })
        .eq('id', progressA1.id);
    });

    it('EP-043: learner cannot update other user progress', async () => {
      await expect(
        learnerA2Client
          .from('user_progress')
          .update({ status: 'completed' })
          .eq('id', progressA1.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('EP-044: tenant admin updates own tenant progress', async () => {
      const { data, error } = await taClient
        .from('user_progress')
        .update({ status: 'completed', marked_by: 'admin' })
        .eq('id', progressA1.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].status).toBe('completed');

      // Restore
      await adminClient
        .from('user_progress')
        .update({ status: 'in_progress', completed_at: null, marked_by: null })
        .eq('id', progressA1.id);
    });

    it('EP-045: tenant admin cannot update other tenant progress', async () => {
      await expect(
        taClient
          .from('user_progress')
          .update({ status: 'completed' })
          .eq('id', progressB1.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('EP-046: platform admin updates any progress', async () => {
      const { data, error } = await paClient
        .from('user_progress')
        .update({ status: 'completed', marked_by: 'admin' })
        .eq('id', progressB1.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      // Restore
      await adminClient
        .from('user_progress')
        .update({ status: 'in_progress', completed_at: null, marked_by: null })
        .eq('id', progressB1.id);
    });
  });

  // =========================================================================
  // GROUP 8: user_progress DELETE (1 test)
  // =========================================================================
  describe('user_progress DELETE', () => {
    it('EP-047: no DELETE policy — even PA cannot delete progress', async () => {
      await expect(
        paClient
          .from('user_progress')
          .delete()
          .eq('id', progressA1.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });

  // =========================================================================
  // GROUP 9: Trigger enforcement (1 test)
  // =========================================================================
  describe('trigger enforcement', () => {
    it('EP-048: enforce_quiz_exam_completion blocks marking quiz module as completed', async () => {
      // moduleA2 is a quiz type — requires a passed quiz_attempt to mark complete
      // Learner tries to mark as completed without any quiz attempts
      const { error } = await learnerA1Client
        .from('user_progress')
        .insert({
          user_id: learnerA1.id,
          tenant_id: tenantA.id,
          course_id: courseOpen.id,
          lecture_id: lectureA1.id,
          module_id: moduleA2.id,
          status: 'completed',
          marked_by: 'user',
        });

      expect(error).not.toBeNull();
      expect(error!.message.toLowerCase()).toContain('quiz');
    });
  });
});
