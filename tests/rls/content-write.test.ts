/**
 * RLS Tests: content write operations (INSERT/UPDATE/DELETE)
 *
 * Tests that content write operations are properly secured across all 14
 * content tables. Verifies:
 *   - Platform Admin can INSERT/UPDATE/DELETE everything
 *   - Lecturer (can_edit) can write to assigned course hierarchy
 *   - Lecturer (can_edit) CANNOT escalate (INSERT/DELETE courses, tenant_courses)
 *   - Lecturer (read-only) CANNOT write anything
 *   - Tenant Admin, CSM, Learner CANNOT write content
 *
 * Policies from 00004_rls_policies.sql:
 *   courses:       PA = INSERT/UPDATE/DELETE, Lecturer(can_edit) = UPDATE only
 *   lectures:      PA + Lecturer(can_edit) = INSERT/UPDATE/DELETE via course_id
 *   modules:       PA + Lecturer(can_edit) = INSERT/UPDATE/DELETE via course_id
 *   subtables:     PA + Lecturer(can_edit) = INSERT/UPDATE/DELETE via EXISTS→modules.course_id
 *   tenant_courses: PA = INSERT/DELETE only (no UPDATE policy)
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
  createCSMAssignment,
  createLecturerAssignment,
  createModuleMarkdown,
  createQuiz,
  createQuizQuestion,
  createExam,
  createExternalQuizReference,
  getExistingMasterTenant,
  cleanupTestData,
  TestDataTracker,
  type TestUser,
  type TestTenant,
} from '../setup';
import type { SupabaseClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';

describe('content write RLS', () => {
  const tracker = new TestDataTracker();

  // Tenants
  let masterTenant: TestTenant;
  let tenantA: TestTenant;

  // Users
  let platformAdmin: TestUser;
  let lecturerCanEdit: TestUser;
  let lecturerReadOnly: TestUser;
  let csmUser: TestUser;
  let tenantAdminA: TestUser;
  let learnerA: TestUser;

  // Authenticated clients
  let paClient: SupabaseClient;
  let lecEditClient: SupabaseClient;
  let lecROClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let taClient: SupabaseClient;
  let learnerClient: SupabaseClient;

  // Content hierarchy
  let courseA: { id: string; title: string };
  let lectureA1: { id: string };
  let moduleMarkdown: { id: string };
  let markdownRow: { id: string };
  let moduleQuiz: { id: string };
  let quizRow: { id: string };
  let quizQuestionRow: { id: string };
  let moduleExam: { id: string };
  let examRow: { id: string };
  let moduleExtQuiz: { id: string };
  let extQuizRow: { id: string };

  // Throwaway rows for DELETE tests (created once, consumed once)
  let courseToDeletePA: { id: string };
  let lectureToDeletePA: { id: string };
  let lectureToDeleteLec: { id: string };
  let moduleToDeletePA: { id: string };
  let moduleToDeleteLec: { id: string };
  let courseB: { id: string };
  let tenantCourseToDeletePA: { id: string };

  // Spare modules for subtable INSERT/DELETE tests (no subtable row attached)
  let spareModuleForSubPA: { id: string };
  let spareModuleForSubLec: { id: string };

  // Subtable rows created by PA/Lecturer that will be deleted in tests
  let paMarkdownToDelete: { id: string };
  let lecMarkdownToDelete: { id: string };

  beforeAll(async () => {
    // ── Tenants ──────────────────────────────────────────────────────────
    masterTenant = await getExistingMasterTenant();
    tenantA = await createTenant(tracker, {
      name: 'CW-RLS-TenantA',
      domain: 'cw-rls-a.local',
      authMethods: ['email_password'],
    });

    // ── Content hierarchy ────────────────────────────────────────────────
    courseA = await createCourse(tracker, { title: 'CW-CourseA' });
    lectureA1 = await createLecture(tracker, courseA.id, { title: 'CW-LectureA1', sortOrder: 0 });

    // Modules with subtables
    moduleMarkdown = await createModule(tracker, lectureA1.id, courseA.id, {
      title: 'CW-Markdown', moduleType: 'markdown', sortOrder: 0,
    });
    markdownRow = await createModuleMarkdown(tracker, moduleMarkdown.id);

    moduleQuiz = await createModule(tracker, lectureA1.id, courseA.id, {
      title: 'CW-Quiz', moduleType: 'quiz', sortOrder: 1,
    });
    quizRow = await createQuiz(tracker, moduleQuiz.id);
    quizQuestionRow = await createQuizQuestion(tracker, quizRow.id);

    moduleExam = await createModule(tracker, lectureA1.id, courseA.id, {
      title: 'CW-Exam', moduleType: 'exam', sortOrder: 2,
    });
    examRow = await createExam(tracker, moduleExam.id);

    moduleExtQuiz = await createModule(tracker, lectureA1.id, courseA.id, {
      title: 'CW-ExtQuiz', moduleType: 'external_quiz', sortOrder: 3,
    });
    extQuizRow = await createExternalQuizReference(tracker, moduleExtQuiz.id);

    // Assign courseA to tenantA (so tenant users can see it)
    await createTenantCourse(tracker, tenantA.id, courseA.id);

    // ── Throwaway rows for DELETE tests ──────────────────────────────────
    courseToDeletePA = await createCourse(tracker, { title: 'CW-ToDelete-PA' });
    lectureToDeletePA = await createLecture(tracker, courseA.id, { title: 'CW-Lec-Del-PA', sortOrder: 90 });
    lectureToDeleteLec = await createLecture(tracker, courseA.id, { title: 'CW-Lec-Del-Lec', sortOrder: 91 });
    moduleToDeletePA = await createModule(tracker, lectureA1.id, courseA.id, {
      title: 'CW-Mod-Del-PA', moduleType: 'markdown', sortOrder: 90,
    });
    moduleToDeleteLec = await createModule(tracker, lectureA1.id, courseA.id, {
      title: 'CW-Mod-Del-Lec', moduleType: 'markdown', sortOrder: 91,
    });

    // Spare modules for subtable INSERT/DELETE (no subtable attached)
    spareModuleForSubPA = await createModule(tracker, lectureA1.id, courseA.id, {
      title: 'CW-Spare-Sub-PA', moduleType: 'markdown', sortOrder: 92,
    });
    spareModuleForSubLec = await createModule(tracker, lectureA1.id, courseA.id, {
      title: 'CW-Spare-Sub-Lec', moduleType: 'markdown', sortOrder: 93,
    });

    // Pre-create subtable rows for DELETE tests
    paMarkdownToDelete = await createModuleMarkdown(tracker, spareModuleForSubPA.id);
    lecMarkdownToDelete = await createModuleMarkdown(tracker, spareModuleForSubLec.id);

    // courseB + tenant_course for tenant_courses DELETE test
    courseB = await createCourse(tracker, { title: 'CW-CourseB' });
    tenantCourseToDeletePA = await createTenantCourse(tracker, tenantA.id, courseB.id);

    // ── Users ────────────────────────────────────────────────────────────
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    lecturerCanEdit = await createUser(tracker, masterTenant.id, 'learner');
    lecturerReadOnly = await createUser(tracker, masterTenant.id, 'learner');
    csmUser = await createUser(tracker, masterTenant.id, 'learner');
    tenantAdminA = await createUser(tracker, tenantA.id, 'tenant_admin');
    learnerA = await createUser(tracker, tenantA.id, 'learner');

    // ── Role assignments (BEFORE sign-in — JWT claims baked at login) ───
    await createLecturerAssignment(tracker, lecturerCanEdit.id, courseA.id, platformAdmin.id, { canEdit: true });
    await createLecturerAssignment(tracker, lecturerReadOnly.id, courseA.id, platformAdmin.id, { canEdit: false });
    await createCSMAssignment(tracker, csmUser.id, tenantA.id, platformAdmin.id);

    // ── Sign in ──────────────────────────────────────────────────────────
    paClient = await createClientAs(platformAdmin);
    lecEditClient = await createClientAs(lecturerCanEdit);
    lecROClient = await createClientAs(lecturerReadOnly);
    csmClient = await createClientAs(csmUser);
    taClient = await createClientAs(tenantAdminA);
    learnerClient = await createClientAs(learnerA);
  });

  afterAll(async () => {
    await cleanupTestData(tracker);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 1: Platform Admin Positive Writes (12 tests)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Platform Admin writes', () => {
    it('CW-001: PA can INSERT course', async () => {
      const { data, error } = await paClient
        .from('courses')
        .insert({ title: 'CW-PA-NewCourse', description: 'test' })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data!.title).toBe('CW-PA-NewCourse');
      // Clean up
      tracker.trackCourse(data!.id);
    });

    it('CW-002: PA can UPDATE course', async () => {
      const { data, error } = await paClient
        .from('courses')
        .update({ title: 'CW-CourseA-Updated' })
        .eq('id', courseA.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].title).toBe('CW-CourseA-Updated');

      // Restore original title
      await adminClient.from('courses').update({ title: 'CW-CourseA' }).eq('id', courseA.id);
    });

    it('CW-003: PA can DELETE course', async () => {
      const { data, error } = await paClient
        .from('courses')
        .delete()
        .eq('id', courseToDeletePA.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(courseToDeletePA.id);
    });

    it('CW-004: PA can INSERT lecture', async () => {
      const { data, error } = await paClient
        .from('lectures')
        .insert({ course_id: courseA.id, title: 'CW-PA-NewLecture', sort_order: 80 })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.title).toBe('CW-PA-NewLecture');
      tracker.trackLecture(data!.id);
    });

    it('CW-005: PA can UPDATE lecture', async () => {
      const { data, error } = await paClient
        .from('lectures')
        .update({ title: 'CW-LectureA1-Updated' })
        .eq('id', lectureA1.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].title).toBe('CW-LectureA1-Updated');

      await adminClient.from('lectures').update({ title: 'CW-LectureA1' }).eq('id', lectureA1.id);
    });

    it('CW-006: PA can DELETE lecture', async () => {
      const { data, error } = await paClient
        .from('lectures')
        .delete()
        .eq('id', lectureToDeletePA.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(lectureToDeletePA.id);
    });

    it('CW-007: PA can INSERT module', async () => {
      const { data, error } = await paClient
        .from('modules')
        .insert({
          lecture_id: lectureA1.id,
          course_id: courseA.id,
          title: 'CW-PA-NewModule',
          module_type: 'markdown',
          sort_order: 80,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.title).toBe('CW-PA-NewModule');
      tracker.trackModule(data!.id);
    });

    it('CW-008: PA can UPDATE module title', async () => {
      const { data, error } = await paClient
        .from('modules')
        .update({ title: 'CW-Markdown-Updated' })
        .eq('id', moduleMarkdown.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].title).toBe('CW-Markdown-Updated');

      await adminClient.from('modules').update({ title: 'CW-Markdown' }).eq('id', moduleMarkdown.id);
    });

    it('CW-009: PA can DELETE module', async () => {
      const { data, error } = await paClient
        .from('modules')
        .delete()
        .eq('id', moduleToDeletePA.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(moduleToDeletePA.id);
    });

    it('CW-010: PA can INSERT tenant_courses', async () => {
      // courseA is already assigned to tenantA; assign to master tenant
      const { data, error } = await paClient
        .from('tenant_courses')
        .insert({ tenant_id: masterTenant.id, course_id: courseA.id })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      tracker.trackTenantCourse(data!.id);
    });

    it('CW-011: PA can DELETE tenant_courses', async () => {
      const { data, error } = await paClient
        .from('tenant_courses')
        .delete()
        .eq('id', tenantCourseToDeletePA.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(tenantCourseToDeletePA.id);
    });

    it('CW-012: PA can INSERT/UPDATE/DELETE subtable (module_markdown)', async () => {
      // INSERT into spare module
      const { data: inserted, error: insertErr } = await paClient
        .from('module_markdown')
        .insert({ module_id: spareModuleForSubPA.id, content: 'PA-new-content' })
        .select()
        .single();

      // If the pre-created row still exists (paMarkdownToDelete), we may conflict.
      // We already created paMarkdownToDelete in beforeAll for DELETE test.
      // So first DELETE the pre-existing row, then INSERT fresh.
      if (insertErr) {
        // Delete the pre-created row first
        await paClient
          .from('module_markdown')
          .delete()
          .eq('id', paMarkdownToDelete.id)
          .select();

        const { data: retry, error: retryErr } = await paClient
          .from('module_markdown')
          .insert({ module_id: spareModuleForSubPA.id, content: 'PA-new-content' })
          .select()
          .single();

        expect(retryErr).toBeNull();
        expect(retry!.content).toBe('PA-new-content');

        // UPDATE
        const { data: updated, error: updateErr } = await paClient
          .from('module_markdown')
          .update({ content: 'PA-updated-content' })
          .eq('id', retry!.id)
          .select();

        expect(updateErr).toBeNull();
        expect(updated).toHaveLength(1);
        expect(updated![0].content).toBe('PA-updated-content');

        // DELETE
        const { data: deleted, error: deleteErr } = await paClient
          .from('module_markdown')
          .delete()
          .eq('id', retry!.id)
          .select();

        expect(deleteErr).toBeNull();
        expect(deleted).toHaveLength(1);
        return;
      }

      expect(inserted!.content).toBe('PA-new-content');

      // UPDATE
      const { data: updated, error: updateErr } = await paClient
        .from('module_markdown')
        .update({ content: 'PA-updated-content' })
        .eq('id', inserted!.id)
        .select();

      expect(updateErr).toBeNull();
      expect(updated).toHaveLength(1);
      expect(updated![0].content).toBe('PA-updated-content');

      // DELETE
      const { data: deleted, error: deleteErr } = await paClient
        .from('module_markdown')
        .delete()
        .eq('id', inserted!.id)
        .select();

      expect(deleteErr).toBeNull();
      expect(deleted).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 2: Lecturer (can_edit) Positive Writes (10 tests)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Lecturer (can_edit) writes', () => {
    it('CW-013: Lecturer can UPDATE assigned course', async () => {
      const { data, error } = await lecEditClient
        .from('courses')
        .update({ description: 'Lecturer-updated-desc' })
        .eq('id', courseA.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].description).toBe('Lecturer-updated-desc');

      await adminClient.from('courses').update({ description: null }).eq('id', courseA.id);
    });

    it('CW-014: Lecturer can INSERT lecture', async () => {
      const { data, error } = await lecEditClient
        .from('lectures')
        .insert({ course_id: courseA.id, title: 'CW-Lec-NewLecture', sort_order: 81 })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.title).toBe('CW-Lec-NewLecture');
      tracker.trackLecture(data!.id);
    });

    it('CW-015: Lecturer can UPDATE lecture', async () => {
      const { data, error } = await lecEditClient
        .from('lectures')
        .update({ title: 'CW-LecA1-LecUpdated' })
        .eq('id', lectureA1.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].title).toBe('CW-LecA1-LecUpdated');

      await adminClient.from('lectures').update({ title: 'CW-LectureA1' }).eq('id', lectureA1.id);
    });

    it('CW-016: Lecturer can DELETE lecture', async () => {
      const { data, error } = await lecEditClient
        .from('lectures')
        .delete()
        .eq('id', lectureToDeleteLec.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(lectureToDeleteLec.id);
    });

    it('CW-017: Lecturer can INSERT module', async () => {
      const { data, error } = await lecEditClient
        .from('modules')
        .insert({
          lecture_id: lectureA1.id,
          course_id: courseA.id,
          title: 'CW-Lec-NewModule',
          module_type: 'markdown',
          sort_order: 81,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.title).toBe('CW-Lec-NewModule');
      tracker.trackModule(data!.id);
    });

    it('CW-018: Lecturer can UPDATE module', async () => {
      const { data, error } = await lecEditClient
        .from('modules')
        .update({ title: 'CW-Markdown-LecUpdated' })
        .eq('id', moduleMarkdown.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].title).toBe('CW-Markdown-LecUpdated');

      await adminClient.from('modules').update({ title: 'CW-Markdown' }).eq('id', moduleMarkdown.id);
    });

    it('CW-019: Lecturer can DELETE module', async () => {
      const { data, error } = await lecEditClient
        .from('modules')
        .delete()
        .eq('id', moduleToDeleteLec.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].id).toBe(moduleToDeleteLec.id);
    });

    it('CW-020: Lecturer can INSERT subtable (module_markdown)', async () => {
      // Delete the pre-created row first so we can INSERT fresh
      await adminClient.from('module_markdown').delete().eq('id', lecMarkdownToDelete.id);

      const { data, error } = await lecEditClient
        .from('module_markdown')
        .insert({ module_id: spareModuleForSubLec.id, content: 'Lec-new-content' })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data!.content).toBe('Lec-new-content');

      // Keep the row for UPDATE/DELETE tests
      lecMarkdownToDelete = { id: data!.id };
    });

    it('CW-021: Lecturer can UPDATE subtable', async () => {
      const { data, error } = await lecEditClient
        .from('module_markdown')
        .update({ content: 'Lec-updated-content' })
        .eq('id', lecMarkdownToDelete.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect(data![0].content).toBe('Lec-updated-content');
    });

    it('CW-022: Lecturer can DELETE subtable', async () => {
      const { data, error } = await lecEditClient
        .from('module_markdown')
        .delete()
        .eq('id', lecMarkdownToDelete.id)
        .select();

      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 3: Lecturer (can_edit) Escalation Boundaries (4 tests)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Lecturer (can_edit) escalation boundaries', () => {
    it('CW-023: Lecturer CANNOT INSERT courses', async () => {
      await expect(
        lecEditClient.from('courses').insert({
          title: 'Unauthorized-Course',
          description: 'Should fail',
        }),
      ).toDenyAccess('insert');
    });

    it('CW-024: Lecturer CANNOT DELETE courses', async () => {
      await expect(
        lecEditClient
          .from('courses')
          .delete()
          .eq('id', courseA.id)
          .select(),
      ).toDenyAccess('delete');
    });

    it('CW-025: Lecturer CANNOT INSERT tenant_courses', async () => {
      await expect(
        lecEditClient.from('tenant_courses').insert({
          tenant_id: tenantA.id,
          course_id: courseA.id,
        }),
      ).toDenyAccess('insert');
    });

    it('CW-026: Lecturer CANNOT DELETE tenant_courses', async () => {
      // Get a real tenant_course id for courseA→tenantA
      const { data: tc } = await adminClient
        .from('tenant_courses')
        .select('id')
        .eq('tenant_id', tenantA.id)
        .eq('course_id', courseA.id)
        .single();

      await expect(
        lecEditClient
          .from('tenant_courses')
          .delete()
          .eq('id', tc!.id)
          .select(),
      ).toDenyAccess('delete');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 4: Lecturer (read-only) Denial (6 tests)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Lecturer (read-only) denial', () => {
    it('CW-027: RO Lecturer CANNOT UPDATE courses', async () => {
      await expect(
        lecROClient
          .from('courses')
          .update({ title: 'Hacked' })
          .eq('id', courseA.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('CW-028: RO Lecturer CANNOT INSERT lectures', async () => {
      await expect(
        lecROClient.from('lectures').insert({
          course_id: courseA.id,
          title: 'Unauthorized-Lecture',
          sort_order: 99,
        }),
      ).toDenyAccess('insert');
    });

    it('CW-029: RO Lecturer CANNOT UPDATE lectures', async () => {
      await expect(
        lecROClient
          .from('lectures')
          .update({ title: 'Hacked' })
          .eq('id', lectureA1.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('CW-030: RO Lecturer CANNOT INSERT modules', async () => {
      await expect(
        lecROClient.from('modules').insert({
          lecture_id: lectureA1.id,
          course_id: courseA.id,
          title: 'Unauthorized-Module',
          module_type: 'markdown',
          sort_order: 99,
        }),
      ).toDenyAccess('insert');
    });

    it('CW-031: RO Lecturer CANNOT UPDATE modules', async () => {
      await expect(
        lecROClient
          .from('modules')
          .update({ title: 'Hacked' })
          .eq('id', moduleMarkdown.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('CW-032: RO Lecturer CANNOT INSERT subtable (module_markdown)', async () => {
      await expect(
        lecROClient.from('module_markdown').insert({
          module_id: moduleMarkdown.id,
          content: 'Unauthorized',
        }),
      ).toDenyAccess('insert');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 5: Tenant Admin Denial (5 tests)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Tenant Admin denial', () => {
    it('CW-033: TA CANNOT INSERT courses', async () => {
      await expect(
        taClient.from('courses').insert({
          title: 'TA-Course',
          description: 'Should fail',
        }),
      ).toDenyAccess('insert');
    });

    it('CW-034: TA CANNOT UPDATE courses', async () => {
      await expect(
        taClient
          .from('courses')
          .update({ title: 'Hacked' })
          .eq('id', courseA.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('CW-035: TA CANNOT INSERT lectures', async () => {
      await expect(
        taClient.from('lectures').insert({
          course_id: courseA.id,
          title: 'TA-Lecture',
          sort_order: 99,
        }),
      ).toDenyAccess('insert');
    });

    it('CW-036: TA CANNOT INSERT modules', async () => {
      await expect(
        taClient.from('modules').insert({
          lecture_id: lectureA1.id,
          course_id: courseA.id,
          title: 'TA-Module',
          module_type: 'markdown',
          sort_order: 99,
        }),
      ).toDenyAccess('insert');
    });

    it('CW-037: TA CANNOT INSERT tenant_courses', async () => {
      await expect(
        taClient.from('tenant_courses').insert({
          tenant_id: tenantA.id,
          course_id: courseA.id,
        }),
      ).toDenyAccess('insert');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 6: CSM Denial (5 tests)
  // ═══════════════════════════════════════════════════════════════════════

  describe('CSM denial', () => {
    it('CW-038: CSM CANNOT INSERT courses', async () => {
      await expect(
        csmClient.from('courses').insert({
          title: 'CSM-Course',
          description: 'Should fail',
        }),
      ).toDenyAccess('insert');
    });

    it('CW-039: CSM CANNOT UPDATE courses', async () => {
      await expect(
        csmClient
          .from('courses')
          .update({ title: 'Hacked' })
          .eq('id', courseA.id)
          .select(),
      ).toDenyAccess('update');
    });

    it('CW-040: CSM CANNOT INSERT lectures', async () => {
      await expect(
        csmClient.from('lectures').insert({
          course_id: courseA.id,
          title: 'CSM-Lecture',
          sort_order: 99,
        }),
      ).toDenyAccess('insert');
    });

    it('CW-041: CSM CANNOT INSERT modules', async () => {
      await expect(
        csmClient.from('modules').insert({
          lecture_id: lectureA1.id,
          course_id: courseA.id,
          title: 'CSM-Module',
          module_type: 'markdown',
          sort_order: 99,
        }),
      ).toDenyAccess('insert');
    });

    it('CW-042: CSM CANNOT INSERT tenant_courses', async () => {
      await expect(
        csmClient.from('tenant_courses').insert({
          tenant_id: tenantA.id,
          course_id: courseA.id,
        }),
      ).toDenyAccess('insert');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // GROUP 7: Learner Subtable Denial (6 tests)
  // (Learner denial for courses/lectures/modules/tenant_courses already
  //  covered by ESC-004 to ESC-010 in courses.test.ts and
  //  content-hierarchy.test.ts)
  // ═══════════════════════════════════════════════════════════════════════

  describe('Learner subtable denial', () => {
    it('CW-043: Learner CANNOT INSERT module_videos', async () => {
      await expect(
        learnerClient.from('module_videos').insert({
          module_id: moduleMarkdown.id,
          bunny_video_id: faker.string.uuid(),
          bunny_library_id: 123456,
          encoding_status: 4,
        }),
      ).toDenyAccess('insert');
    });

    it('CW-044: Learner CANNOT INSERT module_pdfs', async () => {
      await expect(
        learnerClient.from('module_pdfs').insert({
          module_id: moduleMarkdown.id,
          file_url: 'fake.pdf',
          file_name: 'fake.pdf',
        }),
      ).toDenyAccess('insert');
    });

    it('CW-045: Learner CANNOT INSERT quizzes', async () => {
      await expect(
        learnerClient.from('quizzes').insert({
          module_id: moduleQuiz.id,
          title: 'Fake Quiz',
          passing_score: 50,
        }),
      ).toDenyAccess('insert');
    });

    it('CW-046: Learner CANNOT INSERT quiz_questions', async () => {
      await expect(
        learnerClient.from('quiz_questions').insert({
          quiz_id: quizRow.id,
          question_text: 'Fake?',
          question_type: 'single_choice',
          points: 1,
          sort_order: 99,
        }),
      ).toDenyAccess('insert');
    });

    it('CW-047: Learner CANNOT INSERT exams', async () => {
      await expect(
        learnerClient.from('exams').insert({
          module_id: moduleExam.id,
          title: 'Fake Exam',
          duration_minutes: 30,
          passing_score: 50,
        }),
      ).toDenyAccess('insert');
    });

    it('CW-048: Learner CANNOT INSERT external_quiz_references', async () => {
      await expect(
        learnerClient.from('external_quiz_references').insert({
          module_id: moduleExtQuiz.id,
          external_quiz_id: 'FAKE-001',
          external_quiz_url: 'https://fake.com',
        }),
      ).toDenyAccess('insert');
    });
  });
});
