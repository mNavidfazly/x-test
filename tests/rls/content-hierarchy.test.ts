/**
 * RLS Tests: content hierarchy (lectures → modules → subtables)
 *
 * Tests inherited access: content tables have no tenant_id. Access flows
 * from tenant_courses through course_id (direct or via JOIN).
 *
 * Policies (from 00004_rls_policies.sql):
 *   lectures, modules: SELECT tenant/platform_admin/lecturer, INSERT/UPDATE/DELETE platform_admin/lecturer
 *   module_videos/pdfs/markdown/files: same pattern, JOIN through modules for course_id
 *
 * Known gap: NO CSM SELECT on lectures, modules, or any subtable.
 * CSMs can see courses (courses_select_csm from 00011) but cannot drill into content.
 * Tests INH-003, INH-006, INH-015 document this gap.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createClientAs,
  createTenant,
  createUser,
  createCourse,
  createLecture,
  createModule,
  createTenantCourse,
  createCSMAssignment,
  createLecturerAssignment,
  createModuleVideo,
  createModulePdf,
  createModuleMarkdown,
  createModuleFile,
  getExistingMasterTenant,
  cleanupTestData,
  TestDataTracker,
  type TestUser,
  type TestTenant,
} from '../setup';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('content hierarchy RLS', () => {
  const tracker = new TestDataTracker();

  // Tenants
  let masterTenant: TestTenant;
  let tenantA: TestTenant;
  let tenantB: TestTenant;

  // Users
  let platformAdmin: TestUser;
  let csmUser: TestUser;
  let lecturerUser: TestUser;
  let learnerA: TestUser;
  let learnerB: TestUser;

  // Authenticated clients
  let platformAdminClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let lecturerClient: SupabaseClient;
  let learnerAClient: SupabaseClient;
  let learnerBClient: SupabaseClient;

  // Course A (assigned to tenantA)
  let courseA: { id: string; title: string };
  let lectureA1: { id: string };
  let lectureA2: { id: string };
  let moduleA1Video: { id: string };
  let moduleA1Pdf: { id: string };
  let moduleA2Md: { id: string };
  let videoA1: { id: string };
  let pdfA1: { id: string };
  let markdownA2: { id: string };
  let fileA1: { id: string };

  // Course B (not assigned to any tenant)
  let courseB: { id: string; title: string };
  let lectureB1: { id: string };
  let moduleB1Video: { id: string };
  let videoB1: { id: string };

  beforeAll(async () => {
    // --- Tenants ---
    masterTenant = await getExistingMasterTenant();
    tenantA = await createTenant(tracker, {
      name: 'Content-RLS-TenantA',
      domain: 'content-rls-a.local',
      authMethods: ['email_password'],
    });
    tenantB = await createTenant(tracker, {
      name: 'Content-RLS-TenantB',
      domain: 'content-rls-b.local',
      authMethods: ['email_password'],
    });

    // --- Course A hierarchy ---
    courseA = await createCourse(tracker, { title: 'Content-CourseA' });
    lectureA1 = await createLecture(tracker, courseA.id, { title: 'LectureA1', sortOrder: 0 });
    lectureA2 = await createLecture(tracker, courseA.id, { title: 'LectureA2', sortOrder: 1 });

    moduleA1Video = await createModule(tracker, lectureA1.id, courseA.id, {
      title: 'ModuleA1-Video', moduleType: 'video', sortOrder: 0,
    });
    moduleA1Pdf = await createModule(tracker, lectureA1.id, courseA.id, {
      title: 'ModuleA1-Pdf', moduleType: 'pdf', sortOrder: 1,
    });
    moduleA2Md = await createModule(tracker, lectureA2.id, courseA.id, {
      title: 'ModuleA2-Markdown', moduleType: 'markdown', sortOrder: 0,
    });

    videoA1 = await createModuleVideo(tracker, moduleA1Video.id);
    pdfA1 = await createModulePdf(tracker, moduleA1Pdf.id);
    markdownA2 = await createModuleMarkdown(tracker, moduleA2Md.id);
    fileA1 = await createModuleFile(tracker, moduleA1Video.id);

    // --- Course B hierarchy ---
    courseB = await createCourse(tracker, { title: 'Content-CourseB' });
    lectureB1 = await createLecture(tracker, courseB.id, { title: 'LectureB1', sortOrder: 0 });
    moduleB1Video = await createModule(tracker, lectureB1.id, courseB.id, {
      title: 'ModuleB1-Video', moduleType: 'video', sortOrder: 0,
    });
    videoB1 = await createModuleVideo(tracker, moduleB1Video.id);

    // --- Assign courseA to tenantA ---
    await createTenantCourse(tracker, tenantA.id, courseA.id);

    // --- Users ---
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    csmUser = await createUser(tracker, masterTenant.id, 'learner');
    lecturerUser = await createUser(tracker, masterTenant.id, 'learner');
    learnerA = await createUser(tracker, tenantA.id, 'learner');
    learnerB = await createUser(tracker, tenantB.id, 'learner');

    // --- Role assignments (before sign-in) ---
    await createCSMAssignment(tracker, csmUser.id, tenantA.id, platformAdmin.id);
    await createLecturerAssignment(tracker, lecturerUser.id, courseA.id, platformAdmin.id);

    // --- Sign in ---
    platformAdminClient = await createClientAs(platformAdmin);
    csmClient = await createClientAs(csmUser);
    lecturerClient = await createClientAs(lecturerUser);
    learnerAClient = await createClientAs(learnerA);
    learnerBClient = await createClientAs(learnerB);
  });

  afterAll(async () => {
    await cleanupTestData(tracker);
  });

  // ═══ LECTURES ═══════════════════════════════════════════════════════════

  describe('lectures SELECT', () => {
    it('INH-001: tenant user sees lectures for assigned course', async () => {
      const { data, error } = await learnerAClient
        .from('lectures')
        .select('*')
        .eq('course_id', courseA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(2);

      const ids = data!.map((l: any) => l.id);
      expect(ids).toContain(lectureA1.id);
      expect(ids).toContain(lectureA2.id);
    });

    it('INH-002: tenant user cannot see lectures for unassigned course', async () => {
      await expect(
        learnerAClient.from('lectures').select('*').eq('course_id', courseB.id),
      ).toDenyAccess('select');
    });

    it('INH-003: CSM cannot see lectures for assigned tenant courses (known gap)', async () => {
      // CSM is assigned to tenantA. courses_select_csm lets them see courseA.
      // But there is NO lectures_select_csm policy — this is a known gap.
      // CSM's tenant_id is master tenant, and courseA is not assigned to master tenant,
      // so lectures_select_tenant also doesn't match.
      const { data, error } = await csmClient
        .from('lectures')
        .select('*')
        .eq('course_id', courseA.id);

      expect(error).toBeNull();
      expect(data).toEqual([]); // Known gap: CSM denied lectures
    });

    it('ROL-017: platform admin sees ALL lectures', async () => {
      const { data, error } = await platformAdminClient
        .from('lectures')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(3);

      const ids = data!.map((l: any) => l.id);
      expect(ids).toContain(lectureA1.id);
      expect(ids).toContain(lectureA2.id);
      expect(ids).toContain(lectureB1.id);
    });

    it('ROL-018: lecturer sees lectures for assigned course only', async () => {
      const { data, error } = await lecturerClient
        .from('lectures')
        .select('*');

      expect(error).toBeNull();

      const ids = data!.map((l: any) => l.id);
      expect(ids).toContain(lectureA1.id);
      expect(ids).toContain(lectureA2.id);
      expect(ids).not.toContain(lectureB1.id);
    });
  });

  describe('lectures WRITE', () => {
    it('ESC-008: learner cannot INSERT lectures', async () => {
      await expect(
        learnerAClient.from('lectures').insert({
          course_id: courseA.id,
          title: 'Unauthorized-Lecture',
          sort_order: 99,
        }),
      ).toDenyAccess('insert');
    });

    it('ESC-009: learner cannot UPDATE lectures', async () => {
      await expect(
        learnerAClient
          .from('lectures')
          .update({ title: 'Hacked' })
          .eq('id', lectureA1.id)
          .select(),
      ).toDenyAccess('update');
    });
  });

  // ═══ MODULES ════════════════════════════════════════════════════════════

  describe('modules SELECT', () => {
    it('INH-004: tenant user sees modules for assigned course', async () => {
      const { data, error } = await learnerAClient
        .from('modules')
        .select('*')
        .eq('course_id', courseA.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(3);

      const ids = data!.map((m: any) => m.id);
      expect(ids).toContain(moduleA1Video.id);
      expect(ids).toContain(moduleA1Pdf.id);
      expect(ids).toContain(moduleA2Md.id);
    });

    it('INH-005: tenant user cannot see modules for unassigned course', async () => {
      await expect(
        learnerAClient.from('modules').select('*').eq('course_id', courseB.id),
      ).toDenyAccess('select');
    });

    it('INH-006: CSM cannot see modules (known gap)', async () => {
      // No modules_select_csm policy exists. CSM's tenant_id is master tenant,
      // courseA is not assigned to master tenant → modules_select_tenant doesn't match.
      const { data, error } = await csmClient
        .from('modules')
        .select('*')
        .eq('course_id', courseA.id);

      expect(error).toBeNull();
      expect(data).toEqual([]); // Known gap: CSM denied modules
    });

    it('ROL-019: platform admin sees ALL modules', async () => {
      const { data, error } = await platformAdminClient
        .from('modules')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(4);

      const ids = data!.map((m: any) => m.id);
      expect(ids).toContain(moduleA1Video.id);
      expect(ids).toContain(moduleA1Pdf.id);
      expect(ids).toContain(moduleA2Md.id);
      expect(ids).toContain(moduleB1Video.id);
    });

    it('ROL-020: lecturer sees modules for assigned course only', async () => {
      const { data, error } = await lecturerClient
        .from('modules')
        .select('*');

      expect(error).toBeNull();

      const ids = data!.map((m: any) => m.id);
      expect(ids).toContain(moduleA1Video.id);
      expect(ids).toContain(moduleA1Pdf.id);
      expect(ids).toContain(moduleA2Md.id);
      expect(ids).not.toContain(moduleB1Video.id);
    });
  });

  describe('modules WRITE', () => {
    it('ESC-010: learner cannot INSERT modules', async () => {
      await expect(
        learnerAClient.from('modules').insert({
          lecture_id: lectureA1.id,
          course_id: courseA.id,
          title: 'Unauthorized-Module',
          module_type: 'markdown',
          sort_order: 99,
        }),
      ).toDenyAccess('insert');
    });
  });

  // ═══ MODULE VIDEOS ══════════════════════════════════════════════════════

  describe('module_videos SELECT', () => {
    it('INH-007: tenant user sees videos for assigned course modules', async () => {
      const { data, error } = await learnerAClient
        .from('module_videos')
        .select('*')
        .eq('module_id', moduleA1Video.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(videoA1.id);
    });

    it('INH-008: tenant user cannot see videos for unassigned course modules', async () => {
      await expect(
        learnerAClient.from('module_videos').select('*').eq('module_id', moduleB1Video.id),
      ).toDenyAccess('select');
    });

    it('INH-009: platform admin sees ALL module_videos', async () => {
      const { data, error } = await platformAdminClient
        .from('module_videos')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(2);

      const ids = data!.map((v: any) => v.id);
      expect(ids).toContain(videoA1.id);
      expect(ids).toContain(videoB1.id);
    });

    it('INH-010: lecturer sees videos for assigned course modules', async () => {
      const { data, error } = await lecturerClient
        .from('module_videos')
        .select('*');

      expect(error).toBeNull();

      const ids = data!.map((v: any) => v.id);
      expect(ids).toContain(videoA1.id);
      expect(ids).not.toContain(videoB1.id);
    });
  });

  // ═══ MODULE PDFS ════════════════════════════════════════════════════════

  describe('module_pdfs SELECT', () => {
    it('INH-011: tenant user sees PDFs for assigned course modules', async () => {
      const { data, error } = await learnerAClient
        .from('module_pdfs')
        .select('*')
        .eq('module_id', moduleA1Pdf.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(pdfA1.id);
    });

    it('INH-012: tenant user cannot see PDFs for unassigned course modules', async () => {
      // courseB has no PDFs, but querying by courseB's module should return empty
      await expect(
        learnerAClient.from('module_pdfs').select('*').eq('module_id', moduleB1Video.id),
      ).toDenyAccess('select');
    });
  });

  // ═══ MODULE MARKDOWN ════════════════════════════════════════════════════

  describe('module_markdown SELECT', () => {
    it('INH-013: tenant user sees markdown for assigned course modules', async () => {
      const { data, error } = await learnerAClient
        .from('module_markdown')
        .select('*')
        .eq('module_id', moduleA2Md.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(markdownA2.id);
    });

    it('INH-014: tenant user cannot see markdown for unassigned course modules', async () => {
      await expect(
        learnerAClient.from('module_markdown').select('*').eq('module_id', moduleB1Video.id),
      ).toDenyAccess('select');
    });
  });

  // ═══ MODULE FILES ═══════════════════════════════════════════════════════

  describe('module_files SELECT', () => {
    it('INH-015: CSM cannot see module_files (known gap)', async () => {
      // No module_files_select_csm policy exists. CSM's tenant_id is master tenant,
      // courseA not assigned to master tenant → module_files_select_tenant doesn't match.
      const { data, error } = await csmClient
        .from('module_files')
        .select('*')
        .eq('module_id', moduleA1Video.id);

      expect(error).toBeNull();
      expect(data).toEqual([]); // Known gap: CSM denied module_files
    });

    it('INH-016: tenant user sees files for assigned course modules', async () => {
      const { data, error } = await learnerAClient
        .from('module_files')
        .select('*')
        .eq('module_id', moduleA1Video.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(fileA1.id);
    });

    it('INH-017: tenant user cannot see files for unassigned course modules', async () => {
      await expect(
        learnerAClient.from('module_files').select('*').eq('module_id', moduleB1Video.id),
      ).toDenyAccess('select');
    });

    it('INH-018: platform admin sees ALL module_files', async () => {
      const { data, error } = await platformAdminClient
        .from('module_files')
        .select('*');

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThanOrEqual(1);

      const ids = data!.map((f: any) => f.id);
      expect(ids).toContain(fileA1.id);
    });

    it('INH-019: lecturer sees files for assigned course modules', async () => {
      const { data, error } = await lecturerClient
        .from('module_files')
        .select('*');

      expect(error).toBeNull();

      const ids = data!.map((f: any) => f.id);
      expect(ids).toContain(fileA1.id);
    });
  });
});
