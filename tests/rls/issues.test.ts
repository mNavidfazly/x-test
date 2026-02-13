/**
 * Phase 7C — Issues RLS Tests
 *
 * Tables tested:
 *   issues (6 active policies: 3 SELECT, 1 INSERT, 2 UPDATE, 0 DELETE)
 *   issues_safe (view — bypasses RLS, WHERE clause filters by user_id / tenant_admin)
 *
 * Policies on base table (after migration 00010 dropped learner + TA SELECT):
 *   SELECT: issues_select_platform_admin, issues_select_csm, issues_select_lecturer
 *   INSERT: issues_insert_own (user_id = auth.uid(), tenant_id = jwt tenant)
 *   UPDATE: issues_update_platform_admin, issues_update_lecturer
 *   DELETE: (none)
 *
 * Test prefix: IS-001 through IS-021
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
  createIssue,
  type TestUser,
  type TestTenant,
} from '../setup';

describe('issues RLS', () => {
  const tracker = new TestDataTracker();

  // Tenants
  let masterTenant: TestTenant;
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  // Content hierarchy
  let course: { id: string };
  let course2: { id: string };
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

  // Pre-created issues
  let issueA1_open: { id: string };
  let issueA1_with_notes: { id: string };
  let issueB_open: { id: string };

  beforeAll(async () => {
    // Step 1: Get master tenant
    masterTenant = await getExistingMasterTenant();

    // Step 2: Create client tenants
    tenantA = await createTenant(tracker, { name: 'IS TenantA', domain: `is-a-${Date.now()}.test` });
    tenantB = await createTenant(tracker, { name: 'IS TenantB', domain: `is-b-${Date.now()}.test` });

    // Step 3: Content hierarchy — shared (no tenant_id)
    course = await createCourse(tracker, { title: 'IS-Course' });
    course2 = await createCourse(tracker, { title: 'IS-Course-Unassigned' });
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
    await createLecturerAssignment(tracker, lecturerUser.id, course.id, platformAdmin.id, { canEdit: true, canGrade: true });

    // Step 7: Pre-create issues (via admin)
    issueA1_open = await createIssue(tracker, learnerA1.id, tenantA.id, course.id, {
      moduleId: module.id,
      description: 'IS-issue-A1-open',
    });
    issueA1_with_notes = await createIssue(tracker, learnerA1.id, tenantA.id, course.id, {
      description: 'IS-issue-A1-notes',
      internalNotes: 'Staff only note',
      status: 'investigating',
    });
    issueB_open = await createIssue(tracker, learnerB.id, tenantB.id, course.id, {
      description: 'IS-issue-B-open',
    });

    // Step 8: Sign in all users
    [paClient, taClient, learnerA1Client, learnerBClient, csmClient, lecturerClient] = await Promise.all([
      createClientAs(platformAdmin),
      createClientAs(tenantAdminA),
      createClientAs(learnerA1),
      createClientAs(learnerB),
      createClientAs(csmUser),
      createClientAs(lecturerUser),
    ]);
  }, 60000);

  afterAll(async () => {
    await cleanupTestData(tracker);
  });

  // ==========================================================================
  // Base table SELECT (7 tests)
  // ==========================================================================

  describe('Base table SELECT', () => {
    it('IS-001: Learner cannot SELECT from base issues table', async () => {
      // Learner SELECT policy was dropped in migration 00010
      const { data } = await learnerA1Client.from('issues').select('id');
      expect(data).toEqual([]);
    });

    it('IS-002: Tenant admin cannot SELECT from base issues table', async () => {
      // Tenant admin SELECT policy was dropped in migration 00010
      const { data } = await taClient.from('issues').select('id');
      expect(data).toEqual([]);
    });

    it('IS-003: Platform admin sees ALL issues', async () => {
      const { data, error } = await paClient.from('issues').select('id');
      expect(error).toBeNull();
      const ids = data!.map((r: any) => r.id);
      expect(ids).toContain(issueA1_open.id);
      expect(ids).toContain(issueA1_with_notes.id);
      expect(ids).toContain(issueB_open.id);
    });

    it('IS-004: CSM sees assigned tenant issues only', async () => {
      const { data, error } = await csmClient.from('issues').select('id');
      expect(error).toBeNull();
      const ids = data!.map((r: any) => r.id);
      // CSM assigned to tenantA — sees tenantA issues
      expect(ids).toContain(issueA1_open.id);
      expect(ids).toContain(issueA1_with_notes.id);
      // Does NOT see tenantB issues
      expect(ids).not.toContain(issueB_open.id);
    });

    it('IS-005: Lecturer sees assigned course issues cross-tenant', async () => {
      const { data, error } = await lecturerClient.from('issues').select('id');
      expect(error).toBeNull();
      const ids = data!.map((r: any) => r.id);
      // Lecturer assigned to course — sees ALL issues on that course (both tenants)
      expect(ids).toContain(issueA1_open.id);
      expect(ids).toContain(issueA1_with_notes.id);
      expect(ids).toContain(issueB_open.id);
    });

    it('IS-006: CSM cannot see unassigned tenant issues', async () => {
      const { data, error } = await csmClient.from('issues').select('id, tenant_id');
      expect(error).toBeNull();
      const tenantIds = data!.map((r: any) => r.tenant_id);
      // Should only contain tenantA, not tenantB
      expect(tenantIds.every((id: string) => id === tenantA.id)).toBe(true);
    });

    it('IS-007: Lecturer cannot see unassigned course issues', async () => {
      // Create an issue on course2 which lecturer is NOT assigned to
      const unassignedIssue = await createIssue(tracker, learnerA1.id, tenantA.id, course2.id, {
        description: 'IS-unassigned-course-issue',
      });

      const { data, error } = await lecturerClient.from('issues').select('id');
      expect(error).toBeNull();
      const ids = data!.map((r: any) => r.id);
      expect(ids).not.toContain(unassignedIssue.id);

      // Cleanup
      await adminClient.from('issues').delete().eq('id', unassignedIssue.id);
    });
  });

  // ==========================================================================
  // issues_safe view SELECT (4 tests)
  // ==========================================================================

  describe('issues_safe view SELECT', () => {
    it('IS-008: Learner sees own issues via issues_safe', async () => {
      const { data, error } = await learnerA1Client.from('issues_safe').select('id');
      expect(error).toBeNull();
      const ids = data!.map((r: any) => r.id);
      expect(ids).toContain(issueA1_open.id);
      expect(ids).toContain(issueA1_with_notes.id);
    });

    it('IS-009: Learner cannot see other learner issues via issues_safe', async () => {
      const { data, error } = await learnerA1Client.from('issues_safe').select('id');
      expect(error).toBeNull();
      const ids = data!.map((r: any) => r.id);
      // learnerA1 should NOT see learnerB's issues
      expect(ids).not.toContain(issueB_open.id);
    });

    it('IS-010: Tenant admin sees tenant issues via issues_safe', async () => {
      const { data, error } = await taClient.from('issues_safe').select('id');
      expect(error).toBeNull();
      const ids = data!.map((r: any) => r.id);
      // TA sees all tenantA issues
      expect(ids).toContain(issueA1_open.id);
      expect(ids).toContain(issueA1_with_notes.id);
      // Does NOT see tenantB
      expect(ids).not.toContain(issueB_open.id);
    });

    it('IS-011: issues_safe excludes internal_notes column', async () => {
      const { data, error } = await learnerA1Client.from('issues_safe').select('*').eq('id', issueA1_with_notes.id);
      expect(error).toBeNull();
      expect(data!.length).toBe(1);
      const row = data![0];
      // internal_notes should not be present as a key
      expect('internal_notes' in row).toBe(false);
      // But standard columns should be present
      expect(row.description).toBeTruthy();
      expect(row.status).toBe('investigating');
    });
  });

  // ==========================================================================
  // INSERT (2 tests)
  // ==========================================================================

  describe('INSERT', () => {
    it('IS-012: Learner can insert with own user_id + tenant_id', async () => {
      const desc = `IS-012-test-${Date.now()}`;
      // Learner has INSERT but no SELECT on base table —
      // cannot use .select().single() (requires SELECT policy)
      const { error } = await learnerA1Client
        .from('issues')
        .insert({
          user_id: learnerA1.id,
          tenant_id: tenantA.id,
          course_id: course.id,
          module_id: module.id,
          issue_type: 'technical',
          description: desc,
        });

      expect(error).toBeNull();

      // Verify via admin + cleanup
      const { data: verify } = await adminClient
        .from('issues')
        .select('id')
        .eq('description', desc)
        .single();
      expect(verify!.id).toBeTruthy();
      await adminClient.from('issues').delete().eq('id', verify!.id);
    });

    it('IS-013: Learner cannot insert with wrong tenant_id', async () => {
      const { data, error } = await learnerA1Client
        .from('issues')
        .insert({
          user_id: learnerA1.id,
          tenant_id: tenantB.id, // wrong tenant
          course_id: course.id,
          issue_type: 'content_error',
          description: 'IS-013 should fail',
        })
        .select()
        .single();

      // Should be denied — either error or no data
      expect(data?.id ?? null).toBeNull();
    });
  });

  // ==========================================================================
  // UPDATE (5 tests)
  // ==========================================================================

  describe('UPDATE', () => {
    it('IS-014: Lecturer can update assigned course issue', async () => {
      const { data, error } = await lecturerClient
        .from('issues')
        .update({ status: 'investigating', internal_notes: 'Lecturer checking' })
        .eq('id', issueA1_open.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.status).toBe('investigating');
      expect(data.internal_notes).toBe('Lecturer checking');

      // Revert
      await adminClient.from('issues').update({ status: 'open', internal_notes: null }).eq('id', issueA1_open.id);
    });

    it('IS-015: Platform admin can update any issue', async () => {
      const { data, error } = await paClient
        .from('issues')
        .update({ status: 'resolved', internal_notes: 'PA resolved this' })
        .eq('id', issueB_open.id)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.status).toBe('resolved');

      // Revert
      await adminClient.from('issues').update({ status: 'open', internal_notes: null }).eq('id', issueB_open.id);
    });

    it('IS-016: Learner cannot update own issue', async () => {
      const { data, error } = await learnerA1Client
        .from('issues')
        .update({ status: 'closed' })
        .eq('id', issueA1_open.id)
        .select();

      // No update policy for learner — should return empty
      expect(data).toEqual([]);
    });

    it('IS-017: Tenant admin cannot update issues', async () => {
      const { data, error } = await taClient
        .from('issues')
        .update({ status: 'investigating' })
        .eq('id', issueA1_open.id)
        .select();

      // No update policy for tenant admin — should return empty
      expect(data).toEqual([]);
    });

    it('IS-018: CSM cannot update issues', async () => {
      const { data, error } = await csmClient
        .from('issues')
        .update({ status: 'investigating' })
        .eq('id', issueA1_open.id)
        .select();

      // CSM has SELECT but no UPDATE policy — should return empty
      expect(data).toEqual([]);
    });
  });

  // ==========================================================================
  // DELETE (3 tests)
  // ==========================================================================

  describe('DELETE', () => {
    it('IS-019: Learner cannot delete issues', async () => {
      const { data } = await learnerA1Client
        .from('issues')
        .delete()
        .eq('id', issueA1_open.id)
        .select();

      // No DELETE policy — returns empty
      expect(data).toEqual([]);

      // Verify issue still exists
      const { data: verify } = await adminClient.from('issues').select('id').eq('id', issueA1_open.id).single();
      expect(verify!.id).toBe(issueA1_open.id);
    });

    it('IS-020: Platform admin cannot delete issues (no DELETE policy)', async () => {
      const { data } = await paClient
        .from('issues')
        .delete()
        .eq('id', issueA1_open.id)
        .select();

      // Even PA has no DELETE policy
      expect(data).toEqual([]);

      // Verify issue still exists
      const { data: verify } = await adminClient.from('issues').select('id').eq('id', issueA1_open.id).single();
      expect(verify!.id).toBe(issueA1_open.id);
    });

    it('IS-021: Lecturer cannot delete issues (no DELETE policy)', async () => {
      const { data } = await lecturerClient
        .from('issues')
        .delete()
        .eq('id', issueA1_open.id)
        .select();

      // No DELETE policy for lecturer
      expect(data).toEqual([]);

      // Verify issue still exists
      const { data: verify } = await adminClient.from('issues').select('id').eq('id', issueA1_open.id).single();
      expect(verify!.id).toBe(issueA1_open.id);
    });
  });
});
