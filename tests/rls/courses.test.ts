/**
 * RLS Tests: courses + tenant_courses tables
 *
 * Policies (from 00004_rls_policies.sql, 00011_comprehensive_audit_fixes.sql):
 *   courses SELECT:
 *     - courses_select_tenant:          EXISTS tenant_courses WHERE tenant_id = jwt.tenant_id
 *     - courses_select_platform_admin:  is_platform_admin
 *     - courses_select_lecturer:        id = ANY(lecturer_course_ids)
 *     - courses_select_csm:            EXISTS tenant_courses WHERE tenant_id = ANY(csm_tenant_ids)
 *   courses INSERT/UPDATE/DELETE:       platform_admin + lecturer (can_edit for update)
 *
 *   tenant_courses SELECT:
 *     - tenant_courses_select_tenant:          tenant_id = jwt.tenant_id
 *     - tenant_courses_select_platform_admin:  is_platform_admin
 *     - tenant_courses_select_csm:             tenant_id = ANY(csm_tenant_ids)
 *   tenant_courses INSERT/DELETE:       platform_admin only
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  createClientAs,
  createTenant,
  createUser,
  createCourse,
  createTenantCourse,
  createCSMAssignment,
  createLecturerAssignment,
  getExistingMasterTenant,
  cleanupTestData,
  TestDataTracker,
  type TestUser,
  type TestTenant,
} from '../setup';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('courses RLS', () => {
  const tracker = new TestDataTracker();

  // Tenants
  let masterTenant: TestTenant;
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  // Users
  let platformAdmin: TestUser;
  let csmUser: TestUser;
  let lecturerUser: TestUser;
  let tenantAdminA: TestUser;
  let learnerA: TestUser;
  let learnerB: TestUser;

  // Authenticated clients
  let platformAdminClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let lecturerClient: SupabaseClient;
  let tenantAdminAClient: SupabaseClient;
  let learnerAClient: SupabaseClient;
  let learnerBClient: SupabaseClient;

  // Content
  let courseA: { id: string; title: string };
  let courseB: { id: string; title: string };

  beforeAll(async () => {
    // --- Tenants ---
    masterTenant = await getExistingMasterTenant();
    tenantA = await createTenant(tracker, {
      name: 'Courses-RLS-TenantA',
      domain: 'courses-rls-a.local',
      authMethods: ['email_password'],
    });
    tenantB = await createTenant(tracker, {
      name: 'Courses-RLS-TenantB',
      domain: 'courses-rls-b.local',
      authMethods: ['email_password'],
    });

    // --- Courses ---
    courseA = await createCourse(tracker, { title: 'Course-A-Assigned' });
    courseB = await createCourse(tracker, { title: 'Course-B-Unassigned' });

    // Assign courseA to tenantA only
    await createTenantCourse(tracker, tenantA.id, courseA.id);

    // --- Users ---
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    csmUser = await createUser(tracker, masterTenant.id, 'learner');
    lecturerUser = await createUser(tracker, masterTenant.id, 'learner');
    tenantAdminA = await createUser(tracker, tenantA.id, 'tenant_admin');
    learnerA = await createUser(tracker, tenantA.id, 'learner');
    learnerB = await createUser(tracker, tenantB.id, 'learner');

    // --- Role assignments (before sign-in for JWT claims) ---
    await createCSMAssignment(tracker, csmUser.id, tenantA.id, platformAdmin.id);
    await createLecturerAssignment(tracker, lecturerUser.id, courseA.id, platformAdmin.id);

    // --- Sign in ---
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

  // ─── courses SELECT ──────────────────────────────────────────────────

  describe('courses SELECT', () => {
    it('TEN-005: tenant user sees courses assigned to their tenant', async () => {
      const { data, error } = await learnerAClient
        .from('courses')
        .select('*')
        .eq('id', courseA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(courseA.id);
    });

    it('TEN-006: tenant user cannot see unassigned courses', async () => {
      await expect(
        learnerAClient.from('courses').select('*').eq('id', courseB.id),
      ).toDenyAccess('select');
    });

    it('TEN-007: tenant user from tenantB cannot see tenantA courses', async () => {
      await expect(
        learnerBClient.from('courses').select('*').eq('id', courseA.id),
      ).toDenyAccess('select');
    });

    it('ROL-011: platform admin sees ALL courses', async () => {
      const { data, error } = await platformAdminClient
        .from('courses')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);

      const ids = data!.map((c: any) => c.id);
      expect(ids).toContain(courseA.id);
      expect(ids).toContain(courseB.id);
    });

    it('ROL-012: lecturer sees assigned course only', async () => {
      const { data, error } = await lecturerClient
        .from('courses')
        .select('*');

      expect(error).toBeNull();

      const ids = data!.map((c: any) => c.id);
      expect(ids).toContain(courseA.id);
      expect(ids).not.toContain(courseB.id);
    });

    it('ROL-013: CSM sees courses for assigned tenants', async () => {
      const { data, error } = await csmClient
        .from('courses')
        .select('*');

      expect(error).toBeNull();

      const ids = data!.map((c: any) => c.id);
      // CSM assigned to tenantA → sees courseA via courses_select_csm
      expect(ids).toContain(courseA.id);
      // courseB is not assigned to any tenant → CSM cannot see it
      expect(ids).not.toContain(courseB.id);
    });

    it('ROL-014: tenant admin sees same courses as learner', async () => {
      const { data, error } = await tenantAdminAClient
        .from('courses')
        .select('*');

      expect(error).toBeNull();

      const ids = data!.map((c: any) => c.id);
      expect(ids).toContain(courseA.id);
      expect(ids).not.toContain(courseB.id);
    });
  });

  // ─── courses INSERT ──────────────────────────────────────────────────

  describe('courses INSERT', () => {
    it('ESC-004: learner cannot INSERT into courses', async () => {
      await expect(
        learnerAClient.from('courses').insert({
          title: 'Unauthorized-Course',
          description: 'Should fail',
        }),
      ).toDenyAccess('insert');
    });
  });

  // ─── courses UPDATE ──────────────────────────────────────────────────

  describe('courses UPDATE', () => {
    it('ESC-006: learner cannot UPDATE courses', async () => {
      await expect(
        learnerAClient
          .from('courses')
          .update({ title: 'Hacked' })
          .eq('id', courseA.id)
          .select(),
      ).toDenyAccess('update');
    });
  });

  // ─── courses DELETE ──────────────────────────────────────────────────

  describe('courses DELETE', () => {
    it('ESC-007: learner cannot DELETE courses', async () => {
      await expect(
        learnerAClient
          .from('courses')
          .delete()
          .eq('id', courseA.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });

  // ─── tenant_courses SELECT ───────────────────────────────────────────

  describe('tenant_courses SELECT', () => {
    it('TEN-008: tenant user can read tenant_courses for own tenant', async () => {
      const { data, error } = await learnerAClient
        .from('tenant_courses')
        .select('*')
        .eq('tenant_id', tenantA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);

      const courseIds = data!.map((tc: any) => tc.course_id);
      expect(courseIds).toContain(courseA.id);
    });

    it('TEN-009: tenant user cannot read tenant_courses for other tenants', async () => {
      await expect(
        learnerAClient.from('tenant_courses').select('*').eq('tenant_id', tenantB.id),
      ).toDenyAccess('select');
    });

    it('ROL-015: platform admin sees ALL tenant_courses', async () => {
      const { data, error } = await platformAdminClient
        .from('tenant_courses')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);

      const courseIds = data!.map((tc: any) => tc.course_id);
      expect(courseIds).toContain(courseA.id);
    });

    it('ROL-016: CSM sees tenant_courses for assigned tenants', async () => {
      const { data, error } = await csmClient
        .from('tenant_courses')
        .select('*')
        .eq('tenant_id', tenantA.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);

      const courseIds = data!.map((tc: any) => tc.course_id);
      expect(courseIds).toContain(courseA.id);
    });

    it('XTA-006: cross-tenant isolation on tenant_courses', async () => {
      await expect(
        learnerBClient.from('tenant_courses').select('*').eq('tenant_id', tenantA.id),
      ).toDenyAccess('select');
    });
  });

  // ─── tenant_courses INSERT ───────────────────────────────────────────

  describe('tenant_courses INSERT', () => {
    it('ESC-005: learner cannot INSERT into tenant_courses', async () => {
      await expect(
        learnerAClient.from('tenant_courses').insert({
          tenant_id: tenantA.id,
          course_id: courseB.id,
        }),
      ).toDenyAccess('insert');
    });
  });
});
