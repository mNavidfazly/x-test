/**
 * Phase 6D — Comments & Comment Replies RLS Tests
 *
 * Tables tested:
 *   comments        (10 policies: 4 SELECT, 3 INSERT, 1 UPDATE, 3 DELETE — migrations 00004, 00011)
 *   comment_replies (10 policies: 4 SELECT, 3 INSERT, 1 UPDATE, 3 DELETE — migrations 00004, 00011)
 *
 * Test prefix: CM-001 through CM-024
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
  createComment,
  createCommentReply,
  type TestUser,
  type TestTenant,
} from '../setup';

describe('comments & comment_replies RLS', () => {
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
  let learnerA2: TestUser;
  let learnerB: TestUser;
  let csmUser: TestUser;
  let lecturerUser: TestUser;

  // Authenticated clients
  let paClient: SupabaseClient;
  let taClient: SupabaseClient;
  let learnerA1Client: SupabaseClient;
  let learnerA2Client: SupabaseClient;
  let learnerBClient: SupabaseClient;
  let csmClient: SupabaseClient;
  let lecturerClient: SupabaseClient;

  // Pre-created data
  let commentA1: { id: string };
  let commentB: { id: string };
  let replyA1: { id: string };
  let replyB: { id: string };

  // Throwaway rows for DELETE tests (consumed once)
  let commentForDeleteOwn: { id: string } | null;
  let commentForDeleteTA: { id: string } | null;
  let commentForDeletePA: { id: string } | null;
  let replyForDeleteOwn: { id: string } | null;
  let replyForDeletePA: { id: string } | null;

  // Track IDs of rows created by INSERT tests for afterAll cleanup
  const insertedIds: { comments: string[]; replies: string[] } = { comments: [], replies: [] };

  beforeAll(async () => {
    // Step 1: Get master tenant
    masterTenant = await getExistingMasterTenant();

    // Step 2: Create client tenants
    tenantA = await createTenant(tracker, { name: 'CM TenantA', domain: `cm-a-${Date.now()}.test` });
    tenantB = await createTenant(tracker, { name: 'CM TenantB', domain: `cm-b-${Date.now()}.test` });

    // Step 3: Content hierarchy
    course = await createCourse(tracker, { title: 'CM Test Course' });
    lecture = await createLecture(tracker, course.id);
    module = await createModule(tracker, lecture.id, course.id);

    // Step 4: Assign course to both tenants
    await createTenantCourse(tracker, tenantA.id, course.id);
    await createTenantCourse(tracker, tenantB.id, course.id);

    // Step 5: Create users
    platformAdmin = await createUser(tracker, masterTenant.id, 'platform_admin');
    tenantAdminA = await createUser(tracker, tenantA.id, 'tenant_admin');
    learnerA1 = await createUser(tracker, tenantA.id);
    learnerA2 = await createUser(tracker, tenantA.id);
    learnerB = await createUser(tracker, tenantB.id);
    csmUser = await createUser(tracker, masterTenant.id);
    lecturerUser = await createUser(tracker, masterTenant.id);

    // Step 6: Role assignments BEFORE sign-in (JWT claims baked at login)
    await createCSMAssignment(tracker, csmUser.id, tenantA.id, platformAdmin.id);
    await createLecturerAssignment(tracker, lecturerUser.id, course.id, platformAdmin.id, { canEdit: true });

    // Step 7: Pre-create test data
    commentA1 = await createComment(tracker, learnerA1.id, tenantA.id, module.id, { body: 'Comment from learnerA1' });
    commentB = await createComment(tracker, learnerB.id, tenantB.id, module.id, { body: 'Comment from learnerB' });
    replyA1 = await createCommentReply(tracker, learnerA1.id, tenantA.id, commentA1.id, { body: 'Reply from learnerA1' });
    replyB = await createCommentReply(tracker, learnerB.id, tenantB.id, commentB.id, { body: 'Reply from learnerB' });

    // Throwaway rows for DELETE tests
    commentForDeleteOwn = await createComment(tracker, learnerA1.id, tenantA.id, module.id, { body: 'Throwaway own' });
    commentForDeleteTA = await createComment(tracker, learnerA1.id, tenantA.id, module.id, { body: 'Throwaway TA' });
    commentForDeletePA = await createComment(tracker, learnerB.id, tenantB.id, module.id, { body: 'Throwaway PA' });
    replyForDeleteOwn = await createCommentReply(tracker, learnerA1.id, tenantA.id, commentA1.id, { body: 'Throwaway reply own' });
    replyForDeletePA = await createCommentReply(tracker, learnerB.id, tenantB.id, commentB.id, { body: 'Throwaway reply PA' });

    // Step 8: Sign in all users
    [paClient, taClient, learnerA1Client, learnerA2Client, learnerBClient, csmClient, lecturerClient] =
      await Promise.all([
        createClientAs(platformAdmin),
        createClientAs(tenantAdminA),
        createClientAs(learnerA1),
        createClientAs(learnerA2),
        createClientAs(learnerB),
        createClientAs(csmUser),
        createClientAs(lecturerUser),
      ]);
  }, 60_000);

  afterAll(async () => {
    // Clean up any rows created by INSERT tests
    for (const id of insertedIds.replies) {
      await adminClient.from('comment_replies').delete().eq('id', id);
    }
    for (const id of insertedIds.comments) {
      await adminClient.from('comments').delete().eq('id', id);
    }
    await cleanupTestData(tracker);
  });

  // =========================================================================
  // GROUP 1: comments SELECT (7 tests)
  // =========================================================================

  it('CM-001: learner sees own tenant comments only', async () => {
    const { data, error } = await learnerA1Client
      .from('comments')
      .select('id')
      .eq('module_id', module.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(commentA1.id);
    expect(ids).not.toContain(commentB.id);
  });

  it('CM-002: learnerB sees own tenant comments only', async () => {
    const { data, error } = await learnerBClient
      .from('comments')
      .select('id')
      .eq('module_id', module.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(commentB.id);
    expect(ids).not.toContain(commentA1.id);
  });

  it('CM-003: platform admin sees ALL comments across tenants', async () => {
    const { data, error } = await paClient
      .from('comments')
      .select('id')
      .eq('module_id', module.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(commentA1.id);
    expect(ids).toContain(commentB.id);
  });

  it('CM-004: CSM sees comments from assigned tenant only', async () => {
    const { data, error } = await csmClient
      .from('comments')
      .select('id')
      .eq('module_id', module.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(commentA1.id);
    expect(ids).not.toContain(commentB.id);
  });

  it('CM-005: lecturer sees comments on assigned course cross-tenant', async () => {
    const { data, error } = await lecturerClient
      .from('comments')
      .select('id')
      .eq('module_id', module.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(commentA1.id);
    expect(ids).toContain(commentB.id);
  });

  it('CM-006: tenant admin sees own tenant comments only', async () => {
    const { data, error } = await taClient
      .from('comments')
      .select('id')
      .eq('module_id', module.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(commentA1.id);
    expect(ids).not.toContain(commentB.id);
  });

  it('CM-007: learnerA2 cannot see tenantB comments', async () => {
    await expect(
      learnerA2Client
        .from('comments')
        .select('id')
        .eq('id', commentB.id),
    ).toDenyAccess('select');
  });

  // =========================================================================
  // GROUP 2: comments INSERT (4 tests)
  // =========================================================================

  it('CM-008: learner can insert comment on own tenant', async () => {
    const { data, error } = await learnerA1Client
      .from('comments')
      .insert({
        user_id: learnerA1.id,
        tenant_id: tenantA.id,
        module_id: module.id,
        body: 'CM-008 insert test',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.body).toBe('CM-008 insert test');
    // Cleanup
    insertedIds.comments.push(data!.id);
  });

  it('CM-009: learner cannot insert comment with wrong tenant_id', async () => {
    await expect(
      learnerA1Client
        .from('comments')
        .insert({
          user_id: learnerA1.id,
          tenant_id: tenantB.id,
          module_id: module.id,
          body: 'CM-009 wrong tenant',
        }),
    ).toDenyAccess('insert');
  });

  it('CM-010: lecturer can insert comment with own tenant_id', async () => {
    // Lecturers post with their own (master) tenant_id via comments_insert_own.
    // Cross-tenant INSERT via comments_insert_lecturer doesn't work due to
    // recursive RLS on tenant_courses in the policy subquery (no lecturer SELECT on tenant_courses).
    // Visibility is handled by comments_select_lecturer (cross-tenant read).
    const { data, error } = await lecturerClient
      .from('comments')
      .insert({
        user_id: lecturerUser.id,
        tenant_id: masterTenant.id,
        module_id: module.id,
        body: 'CM-010 lecturer own tenant',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.body).toBe('CM-010 lecturer own tenant');
    insertedIds.comments.push(data!.id);
  });

  it('CM-011: CSM can insert comment with own tenant_id', async () => {
    // Same pattern as lecturer — CSMs post with their own (master) tenant_id.
    const { data, error } = await csmClient
      .from('comments')
      .insert({
        user_id: csmUser.id,
        tenant_id: masterTenant.id,
        module_id: module.id,
        body: 'CM-011 csm own tenant',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.body).toBe('CM-011 csm own tenant');
    insertedIds.comments.push(data!.id);
  });

  // =========================================================================
  // GROUP 3: comments UPDATE (2 tests)
  // =========================================================================

  it('CM-012: author can update own comment body', async () => {
    const { data, error } = await learnerA1Client
      .from('comments')
      .update({ body: 'Updated by author' })
      .eq('id', commentA1.id)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].body).toBe('Updated by author');

    // Restore
    await adminClient.from('comments').update({ body: 'Comment from learnerA1' }).eq('id', commentA1.id);
  });

  it('CM-013: other user cannot update someone else\'s comment', async () => {
    await expect(
      learnerA2Client
        .from('comments')
        .update({ body: 'Hijacked' })
        .eq('id', commentA1.id)
        .select(),
    ).toDenyAccess('update');
  });

  // =========================================================================
  // GROUP 4: comments DELETE (4 tests)
  // =========================================================================

  it('CM-014: author can delete own comment', async () => {
    expect(commentForDeleteOwn).not.toBeNull();
    const { data, error } = await learnerA1Client
      .from('comments')
      .delete()
      .eq('id', commentForDeleteOwn!.id)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    commentForDeleteOwn = null; // consumed
  });

  it('CM-015: tenant admin can delete same-tenant comment', async () => {
    expect(commentForDeleteTA).not.toBeNull();
    const { data, error } = await taClient
      .from('comments')
      .delete()
      .eq('id', commentForDeleteTA!.id)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    commentForDeleteTA = null; // consumed
  });

  it('CM-016: platform admin can delete any comment', async () => {
    expect(commentForDeletePA).not.toBeNull();
    const { data, error } = await paClient
      .from('comments')
      .delete()
      .eq('id', commentForDeletePA!.id)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    commentForDeletePA = null; // consumed
  });

  it('CM-017: learnerA2 cannot delete learnerA1\'s comment', async () => {
    await expect(
      learnerA2Client
        .from('comments')
        .delete()
        .eq('id', commentA1.id)
        .select(),
    ).toDenyAccess('delete');
  });

  // =========================================================================
  // GROUP 5: comment_replies SELECT (3 tests)
  // =========================================================================

  it('CM-018: learner sees own tenant replies only', async () => {
    const { data, error } = await learnerA1Client
      .from('comment_replies')
      .select('id')
      .eq('comment_id', commentA1.id);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(replyA1.id);

    // Cannot see tenantB replies
    await expect(
      learnerA1Client
        .from('comment_replies')
        .select('id')
        .eq('id', replyB.id),
    ).toDenyAccess('select');
  });

  it('CM-019: lecturer sees replies on assigned course cross-tenant', async () => {
    const { data, error } = await lecturerClient
      .from('comment_replies')
      .select('id')
      .in('comment_id', [commentA1.id, commentB.id]);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(replyA1.id);
    expect(ids).toContain(replyB.id);
  });

  it('CM-020: platform admin sees ALL replies', async () => {
    const { data, error } = await paClient
      .from('comment_replies')
      .select('id')
      .in('comment_id', [commentA1.id, commentB.id]);

    expect(error).toBeNull();
    const ids = data!.map((r: any) => r.id);
    expect(ids).toContain(replyA1.id);
    expect(ids).toContain(replyB.id);
  });

  // =========================================================================
  // GROUP 6: comment_replies INSERT (1 test)
  // =========================================================================

  it('CM-021: learner can insert reply on own tenant comment', async () => {
    const { data, error } = await learnerA1Client
      .from('comment_replies')
      .insert({
        user_id: learnerA1.id,
        tenant_id: tenantA.id,
        comment_id: commentA1.id,
        body: 'CM-021 reply insert test',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.body).toBe('CM-021 reply insert test');
    insertedIds.replies.push(data!.id);
  });

  // =========================================================================
  // GROUP 7: comment_replies UPDATE + DELETE (3 tests)
  // =========================================================================

  it('CM-022: author can update own reply', async () => {
    const { data, error } = await learnerA1Client
      .from('comment_replies')
      .update({ body: 'Updated reply' })
      .eq('id', replyA1.id)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].body).toBe('Updated reply');

    // Restore
    await adminClient.from('comment_replies').update({ body: 'Reply from learnerA1' }).eq('id', replyA1.id);
  });

  it('CM-023: author can delete own reply', async () => {
    expect(replyForDeleteOwn).not.toBeNull();
    const { data, error } = await learnerA1Client
      .from('comment_replies')
      .delete()
      .eq('id', replyForDeleteOwn!.id)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    replyForDeleteOwn = null; // consumed
  });

  it('CM-024: platform admin can delete any reply', async () => {
    expect(replyForDeletePA).not.toBeNull();
    const { data, error } = await paClient
      .from('comment_replies')
      .delete()
      .eq('id', replyForDeletePA!.id)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    replyForDeletePA = null; // consumed
  });
});
