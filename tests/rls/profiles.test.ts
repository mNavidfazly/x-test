/**
 * RLS Tests: profiles table
 *
 * Policies (from 00004_rls_policies.sql):
 *   SELECT:
 *     - profiles_select_own:            id = auth.uid()
 *     - profiles_select_tenant_admin:   same tenant + is_tenant_admin
 *     - profiles_select_platform_admin: is_platform_admin
 *     - profiles_select_csm:            tenant_id in csm_tenant_ids
 *     - profiles_select_lecturer:       enrolled in lecturer's assigned courses
 *   UPDATE:
 *     - profiles_update_own:            id = auth.uid()
 *     - profiles_update_platform_admin: is_platform_admin
 *     - profiles_update_tenant_admin:   same tenant + is_tenant_admin
 *   INSERT: none (created by handle_new_user trigger)
 *   DELETE: none
 *
 * Triggers:
 *   - protect_profile_role_fields (00005): blocks role field escalation
 *   - enforce_platform_roles_master_tenant (00005): platform_admin requires master tenant
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  createClientAs,
  createTenant,
  createUser,
  createCourse,
  createLecture,
  createModule,
  createTenantCourse,
  createEnrollment,
  createCSMAssignment,
  createLecturerAssignment,
  getExistingMasterTenant,
  cleanupTestData,
  TestDataTracker,
  type TestUser,
  type TestTenant,
} from '../setup';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('profiles RLS', () => {
  const tracker = new TestDataTracker();

  // Tenants
  let masterTenant: TestTenant;
  let clientTenantA: TestTenant;
  let clientTenantB: TestTenant;

  // Users
  let platformAdmin: TestUser;
  let csmUser: TestUser;
  let lecturerUser: TestUser;
  let tenantAdminA: TestUser;
  let learnerA: TestUser;
  let learnerB: TestUser;

  // Clients
  let platformAdminClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let lecturerClient: SupabaseClient;
  let tenantAdminAClient: SupabaseClient;
  let learnerAClient: SupabaseClient;
  let learnerBClient: SupabaseClient;

  // Supporting data for lecturer test
  let testCourse: { id: string };

  beforeAll(async () => {
    // 1. Use existing master tenant (unique index allows only one)
    masterTenant = await getExistingMasterTenant();

    clientTenantA = await createTenant(tracker, {
      name: 'Prof-Test-ClientA',
      domain: 'prof-test-client-a.local',
      authMethods: ['email_password'],
    });

    clientTenantB = await createTenant(tracker, {
      name: 'Prof-Test-ClientB',
      domain: 'prof-test-client-b.local',
      authMethods: ['email_password'],
    });

    // 2. Create users (platform admin first — needed as assigned_by)
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    csmUser = await createUser(tracker, masterTenant.id, 'learner');
    lecturerUser = await createUser(tracker, masterTenant.id, 'learner');
    tenantAdminA = await createUser(tracker, clientTenantA.id, 'tenant_admin');
    learnerA = await createUser(tracker, clientTenantA.id, 'learner');
    learnerB = await createUser(tracker, clientTenantB.id, 'learner');

    // 3. Set up CSM assignment (csmUser → clientTenantA)
    await createCSMAssignment(tracker, csmUser.id, clientTenantA.id, platformAdmin.id);

    // 4. Set up lecturer assignment (lecturerUser → testCourse)
    testCourse = await createCourse(tracker, { createdBy: platformAdmin.id });
    await createTenantCourse(tracker, clientTenantA.id, testCourse.id);
    await createLecturerAssignment(tracker, lecturerUser.id, testCourse.id, platformAdmin.id, {
      canEdit: true,
    });

    // 5. Enroll learnerA in testCourse (needed for lecturer → profiles_select_lecturer)
    await createEnrollment(tracker, learnerA.id, clientTenantA.id, testCourse.id);

    // 6. Sign in all users (JWT claims are computed here)
    platformAdminClient = await createClientAs(platformAdmin);
    csmClient = await createClientAs(csmUser);
    lecturerClient = await createClientAs(lecturerUser);
    tenantAdminAClient = await createClientAs(tenantAdminA);
    learnerAClient = await createClientAs(learnerA);
    learnerBClient = await createClientAs(learnerB);
  });

  afterAll(async () => {
    await cleanupTestData(tracker);
  });

  // ─── SELECT ────────────────────────────────────────────────────────────

  describe('SELECT', () => {
    it('TEN-003: learner can read own profile', async () => {
      const { data, error } = await learnerAClient
        .from('profiles')
        .select('*')
        .eq('id', learnerA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(learnerA.id);
    });

    it('TEN-004: learner cannot read other tenant profiles', async () => {
      // learnerA (clientTenantA) tries to read learnerB (clientTenantB)
      await expect(
        learnerAClient.from('profiles').select('*').eq('id', learnerB.id),
      ).toDenyAccess('select');
    });

    it('ROL-004: tenant admin reads own tenant profiles', async () => {
      const { data, error } = await tenantAdminAClient
        .from('profiles')
        .select('*')
        .eq('tenant_id', clientTenantA.id);

      expect(error).toBeNull();
      // Should see at least tenantAdminA + learnerA
      expect(data!.length).toBeGreaterThanOrEqual(2);
      const ids = data!.map((p: any) => p.id);
      expect(ids).toContain(tenantAdminA.id);
      expect(ids).toContain(learnerA.id);
    });

    it('ROL-005: tenant admin cannot read other tenant profiles', async () => {
      await expect(
        tenantAdminAClient.from('profiles').select('*').eq('id', learnerB.id),
      ).toDenyAccess('select');
    });

    it('ROL-006: platform admin reads all profiles', async () => {
      const { data, error } = await platformAdminClient
        .from('profiles')
        .select('*');

      expect(error).toBeNull();
      // Should see profiles from all tenants
      const ids = data!.map((p: any) => p.id);
      expect(ids).toContain(learnerA.id);
      expect(ids).toContain(learnerB.id);
      expect(ids).toContain(platformAdmin.id);
    });

    it('XTA-003: CSM reads assigned tenant profiles', async () => {
      // CSM is assigned to clientTenantA
      const { data, error } = await csmClient
        .from('profiles')
        .select('*')
        .eq('id', learnerA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(learnerA.id);
    });

    it('XTA-004: lecturer reads enrolled students', async () => {
      // Lecturer is assigned to testCourse; learnerA is enrolled in testCourse
      const { data, error } = await lecturerClient
        .from('profiles')
        .select('*')
        .eq('id', learnerA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(learnerA.id);
    });

    it('XTA-005: lecturer cannot read non-enrolled students from another tenant', async () => {
      // learnerB is in clientTenantB and NOT enrolled in testCourse
      await expect(
        lecturerClient.from('profiles').select('*').eq('id', learnerB.id),
      ).toDenyAccess('select');
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────────

  describe('UPDATE', () => {
    it('ROL-007: learner can update own profile (name)', async () => {
      const newName = 'Updated Name ' + Date.now();
      const { data, error } = await learnerAClient
        .from('profiles')
        .update({ full_name: newName })
        .eq('id', learnerA.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].full_name).toBe(newName);
    });

    it('ESC-002: learner cannot set is_platform_admin (trigger blocks)', async () => {
      const { error } = await learnerAClient
        .from('profiles')
        .update({ is_platform_admin: true })
        .eq('id', learnerA.id)
        .select();

      // enforce_platform_roles_master_tenant trigger fires first because
      // learnerA is in clientTenantA (not the master tenant)
      expect(error).not.toBeNull();
      expect(error!.message).toContain('Platform admin role requires master tenant');
    });

    it('ESC-003: tenant admin cannot set is_platform_admin (trigger blocks)', async () => {
      const { error } = await tenantAdminAClient
        .from('profiles')
        .update({ is_platform_admin: true })
        .eq('id', tenantAdminA.id)
        .select();

      expect(error).not.toBeNull();
      expect(error!.message).toContain('Platform admin role requires master tenant');
    });

    it('ROL-008: learner cannot update another user profile', async () => {
      await expect(
        learnerAClient
          .from('profiles')
          .update({ full_name: 'Hacked' })
          .eq('id', learnerB.id)
          .select(),
      ).toDenyAccess('update');
    });
  });

  // ─── INSERT ────────────────────────────────────────────────────────────

  describe('INSERT', () => {
    it('ROL-009: no direct INSERT into profiles (RLS denies)', async () => {
      await expect(
        learnerAClient.from('profiles').insert({
          id: '00000000-0000-0000-0000-000000000000',
          tenant_id: clientTenantA.id,
          email: 'fake@test.local',
          full_name: 'Fake User',
        }),
      ).toDenyAccess('insert');
    });
  });

  // ─── DELETE ────────────────────────────────────────────────────────────

  describe('DELETE', () => {
    it('ROL-010: no DELETE on profiles (no policy exists)', async () => {
      await expect(
        platformAdminClient
          .from('profiles')
          .delete()
          .eq('id', learnerA.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });
});
