/**
 * RLS Tests: tenants table
 *
 * Policies (from 00004_rls_policies.sql):
 *   - tenants_select_own:            SELECT where id = jwt tenant_id
 *   - tenants_select_platform_admin: SELECT where is_platform_admin
 *   - tenants_select_csm:            SELECT where id in csm_tenant_ids
 *   - tenants_all_platform_admin:    ALL   where is_platform_admin
 *
 * Trigger (from 00013):
 *   - protect_tenant_critical_fields: blocks is_master mutation, validates auth_methods
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  createClientAs,
  createTenant,
  createUser,
  createCSMAssignment,
  getExistingMasterTenant,
  cleanupTestData,
  TestDataTracker,
  type TestUser,
  type TestTenant,
} from '../setup';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('tenants RLS', () => {
  const tracker = new TestDataTracker();

  // Test data
  let masterTenant: TestTenant;
  let clientTenantA: TestTenant;
  let clientTenantB: TestTenant;

  let platformAdmin: TestUser;
  let csmUser: TestUser; // assigned to clientTenantA
  let learnerA: TestUser; // in clientTenantA
  let learnerB: TestUser; // in clientTenantB

  // Authenticated clients (RLS enforced)
  let platformAdminClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let learnerAClient: SupabaseClient;
  let learnerBClient: SupabaseClient;

  beforeAll(async () => {
    // Use existing master tenant (unique index allows only one)
    masterTenant = await getExistingMasterTenant();

    clientTenantA = await createTenant(tracker, {
      name: 'RLS-Test-ClientA',
      domain: 'rls-test-client-a.local',
      authMethods: ['email_password'],
    });

    clientTenantB = await createTenant(tracker, {
      name: 'RLS-Test-ClientB',
      domain: 'rls-test-client-b.local',
      authMethods: ['email_password'],
    });

    // Create users
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    csmUser = await createUser(tracker, masterTenant.id, 'learner');

    // CSM assignment: csmUser → clientTenantA (must be before sign-in for JWT claims)
    await createCSMAssignment(tracker, csmUser.id, clientTenantA.id, platformAdmin.id);

    learnerA = await createUser(tracker, clientTenantA.id, 'learner');
    learnerB = await createUser(tracker, clientTenantB.id, 'learner');

    // Sign in all users (JWT claims are computed at sign-in)
    platformAdminClient = await createClientAs(platformAdmin);
    csmClient = await createClientAs(csmUser);
    learnerAClient = await createClientAs(learnerA);
    learnerBClient = await createClientAs(learnerB);
  });

  afterAll(async () => {
    await cleanupTestData(tracker);
  });

  // ─── SELECT ────────────────────────────────────────────────────────────

  describe('SELECT', () => {
    it('TEN-001: learner can read own tenant', async () => {
      const { data, error } = await learnerAClient
        .from('tenants')
        .select('*')
        .eq('id', clientTenantA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(clientTenantA.id);
    });

    it('TEN-002: learner cannot read other tenant', async () => {
      await expect(
        learnerAClient.from('tenants').select('*').eq('id', clientTenantB.id),
      ).toDenyAccess('select');
    });

    it('ROL-001: platform admin can read all tenants', async () => {
      const { data, error } = await platformAdminClient
        .from('tenants')
        .select('*');

      expect(error).toBeNull();
      // Should see at least our 3 test tenants + seed Calypso tenant
      expect(data!.length).toBeGreaterThanOrEqual(3);

      const ids = data!.map((t: any) => t.id);
      expect(ids).toContain(masterTenant.id);
      expect(ids).toContain(clientTenantA.id);
      expect(ids).toContain(clientTenantB.id);
    });

    it('XTA-001: CSM can read assigned tenant', async () => {
      const { data, error } = await csmClient
        .from('tenants')
        .select('*')
        .eq('id', clientTenantA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(clientTenantA.id);
    });

    it('XTA-002: CSM cannot read unassigned tenant', async () => {
      // CSM is only assigned to clientTenantA, not clientTenantB
      await expect(
        csmClient.from('tenants').select('*').eq('id', clientTenantB.id),
      ).toDenyAccess('select');
    });
  });

  // ─── INSERT ────────────────────────────────────────────────────────────

  describe('INSERT', () => {
    it('ROL-002: platform admin can create tenant', async () => {
      const { data, error } = await platformAdminClient
        .from('tenants')
        .insert({
          name: 'PA-Created-Tenant',
          domain: 'pa-created.local',
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data!.name).toBe('PA-Created-Tenant');

      // Clean up the tenant we just created
      tracker.trackTenant(data!.id);
    });

    it('ROL-003: learner cannot create tenant', async () => {
      await expect(
        learnerAClient.from('tenants').insert({
          name: 'Unauthorized-Tenant',
          domain: 'unauthorized.local',
        }),
      ).toDenyAccess('insert');
    });
  });

  // ─── UPDATE / TRIGGER ─────────────────────────────────────────────────

  describe('UPDATE', () => {
    it('ESC-001: cannot change is_master via UPDATE (trigger blocks)', async () => {
      // Even platform admin cannot change is_master (protect_tenant_critical_fields trigger)
      const { error } = await platformAdminClient
        .from('tenants')
        .update({ is_master: true })
        .eq('id', clientTenantA.id)
        .select();

      // Trigger raises exception → Supabase returns error
      expect(error).not.toBeNull();
      expect(error!.message).toContain('is_master');
    });

    it('ROL-004: learner cannot update any tenant', async () => {
      await expect(
        learnerAClient
          .from('tenants')
          .update({ name: 'Hacked-Name' })
          .eq('id', clientTenantA.id)
          .select(),
      ).toDenyAccess('update');
    });
  });

  // ─── DELETE ────────────────────────────────────────────────────────────

  describe('DELETE', () => {
    it('ROL-005: learner cannot delete any tenant', async () => {
      await expect(
        learnerAClient
          .from('tenants')
          .delete()
          .eq('id', clientTenantA.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });
});
