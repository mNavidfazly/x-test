/**
 * Phase 9F — Admin RLS Tests
 *
 * Tables tested:
 *   csm_tenant_assignments (4 policies: 2 SELECT, 1 INSERT, 0 UPDATE, 1 DELETE)
 *   lecturer_course_assignments (5 policies: 2 SELECT, 1 INSERT, 1 UPDATE, 1 DELETE)
 *   access_requests (5 policies: 2 SELECT, 1 INSERT, 2 UPDATE, 0 DELETE)
 *   reminder_history (8 policies: 4 SELECT, 4 INSERT, 0 UPDATE, 0 DELETE)
 *   tenants (gap-fill: PA UPDATE, PA DELETE)
 *   profiles (gap-fill: PA UPDATE role, TA UPDATE same-tenant, TA cross-tenant denial)
 *
 * Triggers tested:
 *   enforce_master_tenant_assignment (on csm + lecturer assignments)
 *   resolve_access_request_tenant (on access_requests INSERT)
 *
 * Test prefix: AD-001 through AD-046
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
  createAccessRequest,
  createReminderHistory,
  type TestUser,
  type TestTenant,
} from '../setup';

describe('admin RLS', () => {
  const tracker = new TestDataTracker();

  // Tenants
  let masterTenant: TestTenant;
  let tenantA: TestTenant;
  let tenantB: TestTenant;
  let deletableTenant: TestTenant;

  // Content hierarchy
  let courseA: { id: string };
  let courseB: { id: string };
  let lectureA: { id: string };
  let moduleA: { id: string };

  // Tenant-course links
  let tcA: { id: string };
  let tcB: { id: string };

  // Users
  let platformAdmin: TestUser;
  let tenantAdminA: TestUser;
  let tenantAdminB: TestUser;
  let csm: TestUser;
  let lecturer: TestUser;
  let learnerA: TestUser;
  let learnerB: TestUser;
  let nonMasterUser: TestUser;

  // Pre-created test data
  let accessReqA: { id: string };
  let accessReqB: { id: string };
  let accessReqApproved: { id: string };
  let reminderByPA: { id: string };
  let reminderByTA: { id: string };

  // Authenticated clients
  let paClient: SupabaseClient;
  let taAClient: SupabaseClient;
  let taBClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let lecturerClient: SupabaseClient;
  let learnerAClient: SupabaseClient;
  let learnerBClient: SupabaseClient;

  beforeAll(async () => {
    // --- Tenants ---
    masterTenant = await getExistingMasterTenant();
    tenantA = await createTenant(tracker, { domain: 'tenant-a-admin.local' });
    tenantB = await createTenant(tracker, { domain: 'tenant-b-admin.local' });
    deletableTenant = await createTenant(tracker, { name: 'Delete Me Admin' });

    // --- Content hierarchy ---
    courseA = await createCourse(tracker);
    courseB = await createCourse(tracker);
    lectureA = await createLecture(tracker, courseA.id);
    moduleA = await createModule(tracker, lectureA.id, courseA.id);

    // --- Tenant-course links ---
    tcA = await createTenantCourse(tracker, tenantA.id, courseA.id);
    tcB = await createTenantCourse(tracker, tenantB.id, courseB.id);

    // --- Users ---
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    tenantAdminA = await createUser(tracker, tenantA.id, 'tenant_admin');
    tenantAdminB = await createUser(tracker, tenantB.id, 'tenant_admin');
    csm = await createUser(tracker, masterTenant.id); // learner initially
    lecturer = await createUser(tracker, masterTenant.id); // learner initially
    learnerA = await createUser(tracker, tenantA.id);
    learnerB = await createUser(tracker, tenantB.id);
    nonMasterUser = await createUser(tracker, tenantA.id);

    // --- Assignments (BEFORE sign-in so JWT claims are baked) ---
    await createCSMAssignment(tracker, csm.id, tenantA.id, platformAdmin.id);
    await createLecturerAssignment(tracker, lecturer.id, courseA.id, platformAdmin.id, {
      canEdit: true,
      canGrade: true,
    });

    // --- Enrollments & Progress ---
    await createEnrollment(tracker, learnerA.id, tenantA.id, courseA.id);
    await createEnrollment(tracker, learnerB.id, tenantB.id, courseB.id);
    await createUserProgress(tracker, learnerA.id, tenantA.id, courseA.id, lectureA.id, moduleA.id, {
      status: 'in_progress',
    });

    // --- Pre-created test data ---
    // accessReqA: domain matches tenantA → trigger auto-resolves tenant_id
    accessReqA = await createAccessRequest(tracker, {
      domain: tenantA.domain,
      status: 'pending',
    });
    // accessReqB: unknown domain → tenant_id stays NULL
    accessReqB = await createAccessRequest(tracker, {
      domain: 'unknown-domain.local',
      status: 'pending',
    });
    // accessReqApproved: previously approved, tenantA
    accessReqApproved = await createAccessRequest(tracker, {
      domain: tenantA.domain,
      status: 'approved',
      reviewedBy: platformAdmin.id,
      reviewedAt: new Date().toISOString(),
    });

    reminderByPA = await createReminderHistory(
      tracker, platformAdmin.id, learnerA.id, tenantA.id, { courseId: courseA.id },
    );
    reminderByTA = await createReminderHistory(
      tracker, tenantAdminA.id, learnerA.id, tenantA.id,
    );

    // --- Sign in clients (AFTER assignments) ---
    [paClient, taAClient, taBClient, csmClient, lecturerClient, learnerAClient, learnerBClient] =
      await Promise.all([
        createClientAs(platformAdmin),
        createClientAs(tenantAdminA),
        createClientAs(tenantAdminB),
        createClientAs(csm),
        createClientAs(lecturer),
        createClientAs(learnerA),
        createClientAs(learnerB),
      ]);
  }, 90_000);

  afterAll(async () => {
    await cleanupTestData(tracker);
  }, 30_000);

  // =========================================================================
  // Section 1: csm_tenant_assignments (AD-001 to AD-008)
  // =========================================================================
  describe('csm_tenant_assignments', () => {
    it('AD-001: CSM can SELECT own assignments', async () => {
      const { data, error } = await csmClient
        .from('csm_tenant_assignments')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
      expect(data!.some((r: any) => r.user_id === csm.id)).toBe(true);
    });

    it('AD-002: PA can SELECT all CSM assignments', async () => {
      const { data, error } = await paClient
        .from('csm_tenant_assignments')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('AD-003: PA can INSERT CSM assignment', async () => {
      // Create a temp master-tenant user for this test
      const tempUser = await createUser(tracker, masterTenant.id);

      const { data, error } = await paClient
        .from('csm_tenant_assignments')
        .insert({
          user_id: tempUser.id,
          tenant_id: tenantB.id,
          assigned_by: platformAdmin.id,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();

      // Cleanup
      await adminClient.from('csm_tenant_assignments').delete().eq('id', data!.id);
    });

    it('AD-004: PA can DELETE CSM assignment', async () => {
      // Create temp assignment to delete
      const tempUser = await createUser(tracker, masterTenant.id);
      const { data: created } = await adminClient
        .from('csm_tenant_assignments')
        .insert({
          user_id: tempUser.id,
          tenant_id: tenantB.id,
          assigned_by: platformAdmin.id,
        })
        .select()
        .single();

      const { data, error } = await paClient
        .from('csm_tenant_assignments')
        .delete()
        .eq('id', created!.id)
        .select();

      expect(error).toBeNull();
      expect(data!.length).toBe(1);
    });

    it('AD-005: Learner CANNOT SELECT CSM assignments', async () => {
      await expect(
        learnerAClient.from('csm_tenant_assignments').select('*'),
      ).toDenyAccess('select');
    });

    it('AD-006: TA CANNOT INSERT CSM assignment', async () => {
      const tempUser = await createUser(tracker, masterTenant.id);

      await expect(
        taAClient.from('csm_tenant_assignments').insert({
          user_id: tempUser.id,
          tenant_id: tenantA.id,
          assigned_by: tenantAdminA.id,
        }),
      ).toDenyAccess('insert');
    });

    it('AD-007: Lecturer CANNOT SELECT CSM assignments', async () => {
      await expect(
        lecturerClient.from('csm_tenant_assignments').select('*'),
      ).toDenyAccess('select');
    });

    it('AD-008: Master tenant enforcement — non-master user rejected as CSM', async () => {
      const { error } = await adminClient
        .from('csm_tenant_assignments')
        .insert({
          user_id: nonMasterUser.id,
          tenant_id: tenantB.id,
          assigned_by: platformAdmin.id,
        });

      expect(error).not.toBeNull();
      expect(error!.message).toContain('master tenant');
    });
  });

  // =========================================================================
  // Section 2: lecturer_course_assignments (AD-009 to AD-018)
  // =========================================================================
  describe('lecturer_course_assignments', () => {
    it('AD-009: Lecturer can SELECT own assignments', async () => {
      const { data, error } = await lecturerClient
        .from('lecturer_course_assignments')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
      expect(data!.some((r: any) => r.user_id === lecturer.id)).toBe(true);
    });

    it('AD-010: PA can SELECT all lecturer assignments', async () => {
      const { data, error } = await paClient
        .from('lecturer_course_assignments')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
    });

    it('AD-011: PA can INSERT lecturer assignment', async () => {
      const tempUser = await createUser(tracker, masterTenant.id);

      const { data, error } = await paClient
        .from('lecturer_course_assignments')
        .insert({
          user_id: tempUser.id,
          course_id: courseB.id,
          assigned_by: platformAdmin.id,
          can_edit: false,
          can_grade: true,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();

      // Cleanup
      await adminClient.from('lecturer_course_assignments').delete().eq('id', data!.id);
    });

    it('AD-012: PA can UPDATE lecturer assignment (toggle can_edit)', async () => {
      // Get the existing assignment
      const { data: existing } = await adminClient
        .from('lecturer_course_assignments')
        .select('*')
        .eq('user_id', lecturer.id)
        .eq('course_id', courseA.id)
        .single();

      const { data, error } = await paClient
        .from('lecturer_course_assignments')
        .update({ can_edit: !existing!.can_edit })
        .eq('id', existing!.id)
        .select();

      expect(error).toBeNull();
      expect(data!.length).toBe(1);

      // Revert
      await adminClient
        .from('lecturer_course_assignments')
        .update({ can_edit: existing!.can_edit })
        .eq('id', existing!.id);
    });

    it('AD-013: PA can DELETE lecturer assignment', async () => {
      const tempUser = await createUser(tracker, masterTenant.id);
      const { data: created } = await adminClient
        .from('lecturer_course_assignments')
        .insert({
          user_id: tempUser.id,
          course_id: courseB.id,
          assigned_by: platformAdmin.id,
        })
        .select()
        .single();

      const { data, error } = await paClient
        .from('lecturer_course_assignments')
        .delete()
        .eq('id', created!.id)
        .select();

      expect(error).toBeNull();
      expect(data!.length).toBe(1);
    });

    it('AD-014: Learner CANNOT SELECT lecturer assignments', async () => {
      await expect(
        learnerAClient.from('lecturer_course_assignments').select('*'),
      ).toDenyAccess('select');
    });

    it('AD-015: Master tenant enforcement — non-master user rejected as lecturer', async () => {
      const { error } = await adminClient
        .from('lecturer_course_assignments')
        .insert({
          user_id: nonMasterUser.id,
          course_id: courseA.id,
          assigned_by: platformAdmin.id,
        });

      expect(error).not.toBeNull();
      expect(error!.message).toContain('master tenant');
    });

    it('AD-016: TA CANNOT INSERT lecturer assignment', async () => {
      const tempUser = await createUser(tracker, masterTenant.id);

      await expect(
        taAClient.from('lecturer_course_assignments').insert({
          user_id: tempUser.id,
          course_id: courseA.id,
          assigned_by: tenantAdminA.id,
        }),
      ).toDenyAccess('insert');
    });

    it('AD-017: Lecturer CANNOT UPDATE own assignments', async () => {
      const { data: existing } = await adminClient
        .from('lecturer_course_assignments')
        .select('id')
        .eq('user_id', lecturer.id)
        .single();

      await expect(
        lecturerClient
          .from('lecturer_course_assignments')
          .update({ can_edit: false })
          .eq('id', existing!.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('AD-018: Lecturer CANNOT DELETE own assignments', async () => {
      const { data: existing } = await adminClient
        .from('lecturer_course_assignments')
        .select('id')
        .eq('user_id', lecturer.id)
        .single();

      await expect(
        lecturerClient
          .from('lecturer_course_assignments')
          .delete()
          .eq('id', existing!.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });

  // =========================================================================
  // Section 3: access_requests (AD-019 to AD-028)
  // =========================================================================
  describe('access_requests', () => {
    it('AD-019: PA can SELECT all access requests', async () => {
      const { data, error } = await paClient
        .from('access_requests')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(3);
      const ids = data!.map((r: any) => r.id);
      expect(ids).toContain(accessReqA.id);
      expect(ids).toContain(accessReqB.id);
      expect(ids).toContain(accessReqApproved.id);
    });

    it('AD-020: TA can SELECT own-tenant access requests', async () => {
      const { data, error } = await taAClient
        .from('access_requests')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
      // Should include reqA (tenant_id resolved to tenantA) and reqApproved
      const ids = data!.map((r: any) => r.id);
      expect(ids).toContain(accessReqA.id);
      expect(ids).toContain(accessReqApproved.id);
    });

    it('AD-021: TA CANNOT SELECT other-tenant or null-tenant requests', async () => {
      const { data, error } = await taAClient
        .from('access_requests')
        .select('*');

      expect(error).toBeNull();
      const ids = data!.map((r: any) => r.id);
      // reqB has null tenant_id (unknown domain) — TA shouldn't see it
      expect(ids).not.toContain(accessReqB.id);
    });

    it('AD-022: Authenticated user can INSERT access request (status=pending)', async () => {
      // INSERT without .select() — learner has no SELECT policy on access_requests
      const { error } = await learnerAClient
        .from('access_requests')
        .insert({
          email: 'newrequest@example.com',
          full_name: 'New Request',
          domain: 'example.com',
          status: 'pending',
        });

      expect(error).toBeNull();

      // Verify via admin and cleanup
      const { data: verify } = await adminClient
        .from('access_requests')
        .select('id')
        .eq('email', 'newrequest@example.com')
        .single();
      expect(verify).toBeTruthy();
      tracker.trackAccessRequest(verify!.id);
    });

    it('AD-023: INSERT denied when status != pending', async () => {
      await expect(
        learnerAClient.from('access_requests').insert({
          email: 'bad@example.com',
          full_name: 'Bad Request',
          domain: 'example.com',
          status: 'approved',
        }),
      ).toDenyAccess('insert');
    });

    it('AD-024: INSERT denied when reviewed_by is set', async () => {
      await expect(
        learnerAClient.from('access_requests').insert({
          email: 'bad2@example.com',
          full_name: 'Bad Request 2',
          domain: 'example.com',
          status: 'pending',
          reviewed_by: platformAdmin.id,
        }),
      ).toDenyAccess('insert');
    });

    it('AD-025: PA can UPDATE access request (approve)', async () => {
      const { data, error } = await paClient
        .from('access_requests')
        .update({
          status: 'approved',
          reviewed_by: platformAdmin.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', accessReqB.id)
        .select();

      expect(error).toBeNull();
      expect(data!.length).toBe(1);

      // Revert
      await adminClient
        .from('access_requests')
        .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
        .eq('id', accessReqB.id);
    });

    it('AD-026: TA can UPDATE own-tenant access request', async () => {
      const { data, error } = await taAClient
        .from('access_requests')
        .update({
          status: 'rejected',
          reviewed_by: tenantAdminA.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', accessReqA.id)
        .select();

      expect(error).toBeNull();
      expect(data!.length).toBe(1);

      // Revert
      await adminClient
        .from('access_requests')
        .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
        .eq('id', accessReqA.id);
    });

    it('AD-027: TA CANNOT UPDATE other-tenant access request', async () => {
      // reqB has null tenant_id — TA policy requires tenant_id = jwt tenant
      await expect(
        taAClient
          .from('access_requests')
          .update({ status: 'rejected' })
          .eq('id', accessReqB.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('AD-028: No DELETE for any role', async () => {
      await expect(
        paClient
          .from('access_requests')
          .delete()
          .eq('id', accessReqA.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });

  // =========================================================================
  // Section 4: reminder_history (AD-029 to AD-040)
  // =========================================================================
  describe('reminder_history', () => {
    it('AD-029: PA can SELECT all reminder_history', async () => {
      const { data, error } = await paClient
        .from('reminder_history')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);
    });

    it('AD-030: TA can SELECT own-tenant reminder_history', async () => {
      const { data, error } = await taAClient
        .from('reminder_history')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
      // All returned records should be for tenantA
      expect(data!.every((r: any) => r.tenant_id === tenantA.id)).toBe(true);
    });

    it('AD-031: TA CANNOT SELECT other-tenant reminder_history', async () => {
      // tenantB TA shouldn't see tenantA reminders
      const { data, error } = await taBClient
        .from('reminder_history')
        .select('*');

      expect(error).toBeNull();
      const ids = data!.map((r: any) => r.id);
      expect(ids).not.toContain(reminderByPA.id);
      expect(ids).not.toContain(reminderByTA.id);
    });

    it('AD-032: CSM can SELECT assigned-tenant reminder_history', async () => {
      const { data, error } = await csmClient
        .from('reminder_history')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);
      // CSM is assigned to tenantA
      const ids = data!.map((r: any) => r.id);
      expect(ids).toContain(reminderByPA.id);
    });

    it('AD-033: Lecturer can SELECT reminder for student enrolled in assigned course', async () => {
      const { data, error } = await lecturerClient
        .from('reminder_history')
        .select('*');

      expect(error).toBeNull();
      // Lecturer is assigned to courseA. learnerA is enrolled in courseA.
      // reminderByPA sent_to = learnerA → should be visible
      expect(data!.length).toBeGreaterThanOrEqual(1);
      const sentToIds = data!.map((r: any) => r.sent_to);
      expect(sentToIds).toContain(learnerA.id);
    });

    it('AD-034: Learner CANNOT SELECT reminder_history', async () => {
      await expect(
        learnerAClient.from('reminder_history').select('*'),
      ).toDenyAccess('select');
    });

    it('AD-035: PA can INSERT reminder_history', async () => {
      const { data, error } = await paClient
        .from('reminder_history')
        .insert({
          sent_by: platformAdmin.id,
          sent_to: learnerA.id,
          tenant_id: tenantA.id,
          course_id: courseA.id,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      tracker.trackReminderHistory(data!.id);
    });

    it('AD-036: TA can INSERT reminder_history (own tenant)', async () => {
      const { data, error } = await taAClient
        .from('reminder_history')
        .insert({
          sent_by: tenantAdminA.id,
          sent_to: learnerA.id,
          tenant_id: tenantA.id,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      tracker.trackReminderHistory(data!.id);
    });

    it('AD-037: CSM can INSERT reminder_history (assigned tenant)', async () => {
      const { data, error } = await csmClient
        .from('reminder_history')
        .insert({
          sent_by: csm.id,
          sent_to: learnerA.id,
          tenant_id: tenantA.id,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      tracker.trackReminderHistory(data!.id);
    });

    it('AD-038: Lecturer can INSERT reminder_history (student enrolled in assigned course)', async () => {
      const { data, error } = await lecturerClient
        .from('reminder_history')
        .insert({
          sent_by: lecturer.id,
          sent_to: learnerA.id,
          tenant_id: tenantA.id,
          course_id: courseA.id,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      tracker.trackReminderHistory(data!.id);
    });

    it('AD-039: Learner CANNOT INSERT reminder_history', async () => {
      await expect(
        learnerAClient.from('reminder_history').insert({
          sent_by: learnerA.id,
          sent_to: learnerB.id,
          tenant_id: tenantA.id,
        }),
      ).toDenyAccess('insert');
    });

    it('AD-040: No UPDATE or DELETE for any role', async () => {
      // UPDATE
      await expect(
        paClient
          .from('reminder_history')
          .update({ tenant_id: tenantB.id })
          .eq('id', reminderByPA.id)
          .select(),
      ).toDenyAccess('update');

      // DELETE
      await expect(
        paClient
          .from('reminder_history')
          .delete()
          .eq('id', reminderByPA.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });

  // =========================================================================
  // Section 5: Tenants gap-fill (AD-041 to AD-043)
  // =========================================================================
  describe('tenants gap-fill', () => {
    it('AD-041: PA can UPDATE tenant name', async () => {
      const originalName = tenantA.name;
      const newName = 'Updated Tenant A Name';

      const { data, error } = await paClient
        .from('tenants')
        .update({ name: newName })
        .eq('id', tenantA.id)
        .select();

      expect(error).toBeNull();
      expect(data!.length).toBe(1);
      expect(data![0].name).toBe(newName);

      // Revert
      await adminClient.from('tenants').update({ name: originalName }).eq('id', tenantA.id);
    });

    it('AD-042: PA can DELETE non-master tenant', async () => {
      const { data, error } = await paClient
        .from('tenants')
        .delete()
        .eq('id', deletableTenant.id)
        .select();

      expect(error).toBeNull();
      expect(data!.length).toBe(1);

      // Remove from tracker since it's already deleted
      const idx = tracker.tenantIds.indexOf(deletableTenant.id);
      if (idx !== -1) tracker.tenantIds.splice(idx, 1);
    });

    it('AD-043: TA CANNOT UPDATE tenants', async () => {
      await expect(
        taAClient
          .from('tenants')
          .update({ name: 'Should Fail' })
          .eq('id', tenantA.id)
          .select(),
      ).toDenyAccess('update');
    });
  });

  // =========================================================================
  // Section 6: Profiles gap-fill (AD-044 to AD-046)
  // =========================================================================
  describe('profiles gap-fill', () => {
    it('AD-044: PA can UPDATE another user\'s is_tenant_admin', async () => {
      // Set learnerA to is_tenant_admin=true via PA client
      const { data, error } = await paClient
        .from('profiles')
        .update({ is_tenant_admin: true })
        .eq('id', learnerA.id)
        .select();

      expect(error).toBeNull();
      expect(data!.length).toBe(1);
      expect(data![0].is_tenant_admin).toBe(true);

      // Revert
      await adminClient.from('profiles').update({ is_tenant_admin: false }).eq('id', learnerA.id);
    });

    it('AD-045: TA can UPDATE same-tenant user\'s is_tenant_admin', async () => {
      // tenantAdminA updating learnerA (both on tenantA)
      const { data, error } = await taAClient
        .from('profiles')
        .update({ is_tenant_admin: true })
        .eq('id', learnerA.id)
        .select();

      expect(error).toBeNull();
      expect(data!.length).toBe(1);
      expect(data![0].is_tenant_admin).toBe(true);

      // Revert
      await adminClient.from('profiles').update({ is_tenant_admin: false }).eq('id', learnerA.id);
    });

    it('AD-046: TA CANNOT UPDATE other-tenant user profile', async () => {
      // tenantAdminA trying to update learnerB (tenantB)
      await expect(
        taAClient
          .from('profiles')
          .update({ is_tenant_admin: true })
          .eq('id', learnerB.id)
          .select(),
      ).toDenyAccess('update');
    });
  });
});
