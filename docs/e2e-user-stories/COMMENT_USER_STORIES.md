> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Comment E2E User Stories (Phase 6A)

## Overview

E2E testing scenarios for the Comment System (Phase 6A). These stories verify module-level discussion with tenant isolation, expert badges (auto-set by SECURITY DEFINER trigger), 1-level replies, inline editing, and role-based moderation (own/TA/PA delete). **Migration 00031** added `badge_type` column + auto-set triggers to both `comments` and `comment_replies` tables. 22 existing RLS policies (from 00004 + 00011) enforce tenant isolation, cross-tenant lecturer visibility, and moderation rights.

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-courses-v2.vercel.app |
| **Backend URL** | https://x-courses-v2-production.up.railway.app |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Primary Test User** | et@calypso-commodities.com (Platform Admin) |
| **Tenant** | Calypso (master tenant) |

### Alternative URLs

| Environment | Frontend | Backend |
|-------------|----------|---------|
| **Production** | https://x-courses-v2.vercel.app | https://x-courses-v2-production.up.railway.app |
| **Local Dev** | http://localhost:4200 | http://localhost:8000 |

### Test Users

> Full setup instructions: [TEST_USERS.md](TEST_USERS.md)

All test users use password: `TestUser123!`

| # | Email | Role | Tenant | Used In |
|---|-------|------|--------|---------|
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | CM-03, CM-08, CM-10, CM-13 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit)** | Calypso (master) | CM-02, CM-10 |
| 3 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | CM-14, CM-13 |
| 4 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | CM-01, CM-04, CM-05, CM-06, CM-09, CM-11, CM-12 |
| 5 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | CM-07 |
| 6 | `learner@calypsoclient.com` | **Learner** | Calypso Client | CM-07, CM-09, CM-10 |

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Passed |
| ❌ | Failed |
| ⏳ | Not Tested |
| ⚠️ | Partial |

---

## Recommended Test Order

**IMPORTANT**: Tests should be run in this order due to data dependencies:

| Order | ID | Story | Dependencies |
|-------|-----|-------|--------------|
| 1 | CM-01 | Post First Comment | Learner logged in, module exists, Discussion section empty |
| 2 | CM-04 | Reply to a Comment | CM-01 (comment exists to reply to) |
| 3 | CM-05 | Edit Own Comment | CM-01 (own comment exists) |
| 4 | CM-12 | Edit and Delete Own Reply | CM-04 (own reply exists) |
| 5 | CM-06 | Delete Own Comment | CM-01 (own comment exists, run after CM-05) |
| 6 | CM-02 | Expert Badge — Lecturer | Lecturer logged in, course is assigned |
| 7 | CM-03 | Calypso Badge — Platform Admin | PA logged in |
| 8 | CM-14 | Calypso Badge — CSM | CSM logged in |
| 9 | CM-09 | Tenant Isolation | Both tenant learners post comments |
| 10 | CM-10 | Lecturer Cross-Tenant Visibility | CM-09 (multi-tenant comments exist) |
| 11 | CM-07 | Tenant Admin Moderation | Client learner comment exists, TA logged in |
| 12 | CM-08 | Platform Admin Cross-Tenant Delete | Comments from different tenants exist |
| 13 | CM-13 | Permission Boundaries | Comments from other users exist |
| 14 | CM-11 | Module Navigation Reloads Comments | At least 2 modules in same course |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| CM-01 | Post First Comment | Learner | ✅ | 2026-02-15 |
| CM-02 | Expert Badge — Lecturer | Lecturer | ✅ | 2026-02-15 |
| CM-03 | Calypso Badge — Platform Admin | Platform Admin | ✅ | 2026-02-15 |
| CM-04 | Reply to a Comment | Learner | ✅ | 2026-02-15 |
| CM-05 | Edit Own Comment | Learner | ✅ | 2026-02-15 |
| CM-06 | Delete Own Comment | Learner | ✅ | 2026-02-15 |
| CM-07 | Tenant Admin Moderation | Tenant Admin | ✅ | 2026-02-15 |
| CM-08 | Platform Admin Cross-Tenant Delete | Platform Admin | ✅ | 2026-02-15 |
| CM-09 | Tenant Isolation | Learner (both tenants) | ✅ | 2026-02-15 |
| CM-10 | Lecturer Cross-Tenant Visibility | Lecturer | ✅ | 2026-02-15 |
| CM-11 | Module Navigation Reloads Comments | Learner | ✅ | 2026-02-15 |
| CM-12 | Edit and Delete Own Reply | Learner | ✅ | 2026-02-15 |
| CM-13 | Permission Boundaries | Learner + CSM | ✅ | 2026-02-15 |
| CM-14 | Calypso Badge — CSM | CSM | ✅ | 2026-02-15 |

---

## CM-01: Post First Comment

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that a learner can post a comment on a module, the empty state disappears, the comment renders with avatar initials, author name, "just now" timestamp, and the Discussion count updates.

**Covers**: CommentSectionComponent (add comment form, empty state, comment rendering, `formatRelativeTime`, `getInitials`), CommentService (`addComment`, `loadComments`), `comments_insert_own` RLS policy, `set_comment_badge` trigger (NULL badge for learner)

**Preconditions**:
- A course with at least one viewable module (video/PDF/markdown) exists and is assigned to Calypso tenant
- Learner (`learner@calypso-commodities.com`) can access the module
- The module's Discussion section has no comments (clean state)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Learner (`learner@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Navigate to a course → click a module (video/PDF/markdown) | Module viewer loads with content | ☐ |
| 3 | Scroll to Discussion section below module content | Section header: "Discussion (0)" with MessageSquare icon | ☐ |
| 4 | Verify empty state | Text: "No comments yet. Be the first to start the discussion." centered in slate-400 | ☐ |
| 5 | Verify comment form | Textarea with placeholder "Write a comment..." and "Post Comment" button with Send icon | ☐ |
| 6 | Verify Post Comment button is disabled | Button has `disabled:opacity-50` styling (textarea is empty) | ☐ |
| 7 | Type "Hello, this is my first comment!" in the textarea | Button becomes enabled (not dimmed) | ☐ |
| 8 | Click "Post Comment" | Button shows spinner (Loader2 icon with `animate-spin`) | ☐ |
| 9 | Wait for submission to complete | Comment appears in a white card (`bg-white border border-slate-200 rounded-xl`) | ☐ |
| 10 | Verify comment card content | Avatar circle with initials (e.g., "TL" for "Test Learner"), author full name, "just now" timestamp, comment body text | ☐ |
| 11 | Verify Discussion count updates | Header now shows "Discussion (1)" | ☐ |
| 12 | Verify textarea is cleared | Input field is empty after successful post | ☐ |
| 13 | Verify NO badge on learner comment | No "Expert" or "Calypso" badge pill next to name (badge_type is NULL for learners) | ☐ |
| 14 | Refresh the page | Comment persists (loaded from DB), Discussion count still (1) | ☐ |

**Notes/Learnings**:
- `comments_insert_own` RLS: validates `user_id = auth.uid() AND tenant_id = jwt_claim('tenant_id')`
- `set_comment_badge` trigger sets `badge_type = NULL` for regular learners (no assignment rows)
- `addComment` sends `user_id` + `tenant_id` from AuthService, then reloads all comments
- The textarea uses `(input)` event binding, not `[(ngModel)]` (no FormsModule needed)
- If previous test runs left comments, clean them up first (see Data Setup Notes)

---

## CM-02: Expert Badge — Lecturer

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that when a Lecturer posts a comment on an assigned course's module, the "Expert" badge (amber pill with GraduationCap icon) is automatically displayed. This badge is set server-side by the `set_comment_badge` trigger — the frontend does NOT control it.

**Covers**: `set_comment_badge` trigger (lecturer path), `comments_insert_lecturer` RLS policy, CommentSectionComponent (badge rendering), `lecturer_course_assignments` lookup in trigger

**Preconditions**:
- Lecturer (`lecturer-edit@calypso-commodities.com`) is assigned to the test course with `can_edit = true`
- The course has a module with the Discussion section visible

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Lecturer (`lecturer-edit@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Navigate to the assigned course → click a module | Module viewer loads | ☐ |
| 3 | Scroll to Discussion section | Discussion header visible | ☐ |
| 4 | Type "Great work on this module! Here's a tip for the exam." | Text entered in textarea | ☐ |
| 5 | Click "Post Comment" | Spinner, then comment appears | ☐ |
| 6 | Verify Expert badge | Amber pill (`bg-amber-100 text-amber-700 rounded-full`) with GraduationCap icon and text "Expert" next to author name | ☐ |
| 7 | Verify comment author | Lecturer's full name shown (e.g., "Test Lecturer (Edit)") | ☐ |
| 8 | Log out, log in as Learner | — | ☐ |
| 9 | Navigate to the same module | Module viewer loads | ☐ |
| 10 | Verify Expert badge visible to learner | The learner sees the lecturer's comment with the "Expert" badge | ☐ |

**Notes/Learnings**:
- The trigger checks: `EXISTS (SELECT 1 FROM lecturer_course_assignments WHERE user_id = NEW.user_id AND course_id = v_course_id)` — course-specific
- If the lecturer comments on a module in a course they're NOT assigned to (if accessible), badge_type will be NULL
- `comments_insert_lecturer` RLS validates: `user_id = auth.uid() AND module's course_id IN lecturer_course_ids AND tenant_courses exists for the comment's tenant_id`
- Badge is denormalized — learners can read it without querying `lecturer_course_assignments` (which RLS would block)

---

## CM-03: Calypso Badge — Platform Admin

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that when a Platform Admin posts a comment, the "Calypso" badge (teal pill with Building2 icon) is automatically displayed. PA badge takes highest priority in the trigger.

**Covers**: `set_comment_badge` trigger (PA path — first priority check), `comments_insert_own` RLS policy (PA inserts with own tenant_id), CommentSectionComponent (Calypso badge rendering)

**Preconditions**:
- Platform Admin (`et@calypso-commodities.com`) is logged in
- A module with the Discussion section exists

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Platform Admin (`et@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Navigate to any course → click a module | Module viewer loads | ☐ |
| 3 | Scroll to Discussion section | — | ☐ |
| 4 | Type "Important announcement: updated materials will be released next week." | — | ☐ |
| 5 | Click "Post Comment" | Comment appears | ☐ |
| 6 | Verify Calypso badge | Teal pill (`bg-teal-100 text-teal-700 rounded-full`) with Building2 icon and text "Calypso" next to author name | ☐ |
| 7 | Verify NO Expert badge | Only Calypso badge shown (PA has highest priority, not Expert even if also a lecturer) | ☐ |
| 8 | Log out, log in as Learner | — | ☐ |
| 9 | Navigate to the same module | Learner sees PA's comment with "Calypso" badge | ☐ |

**Notes/Learnings**:
- Trigger priority: PA (calypso) > CSM (calypso) > Lecturer (expert) > NULL
- PA uses `comments_insert_own` policy (not a special PA INSERT policy) — inserts with own user_id + master tenant_id
- Even if PA is also in `lecturer_course_assignments`, the PA check fires first and sets 'calypso'

---

## CM-04: Reply to a Comment

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that a user can reply to an existing comment, the reply form appears when "Reply" is clicked, the reply is indented under the parent comment, and the reply has its own author/timestamp.

**Covers**: CommentSectionComponent (reply toggle, `onSubmitReply`, reply rendering with indent), CommentService (`addReply`), `comment_replies_insert_own` RLS policy, `set_comment_reply_badge` trigger

**Preconditions**:
- At least one comment exists on the module (from CM-01)
- Learner is logged in

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to the module with the existing comment | Comment visible in Discussion section | ☐ |
| 2 | Verify "Reply" button on the comment | Ghost-style button with Reply icon and text "Reply" | ☐ |
| 3 | Click "Reply" | Reply form appears indented (`ml-8 border-l-2 border-teal-200 pl-4`) below the comment | ☐ |
| 4 | Verify reply form | Textarea with placeholder "Write a reply...", "Post Reply" button, "Cancel" button | ☐ |
| 5 | Click "Cancel" | Reply form disappears | ☐ |
| 6 | Click "Reply" again | Reply form reappears | ☐ |
| 7 | Type "Thanks for sharing! Very helpful." | Text entered in reply textarea | ☐ |
| 8 | Click "Post Reply" | Reply appears indented under the parent comment (`ml-8 border-l-2 border-slate-200 pl-4`) | ☐ |
| 9 | Verify reply content | Smaller avatar circle (`w-6 h-6`), author name, "just now" timestamp, reply body text | ☐ |
| 10 | Verify reply form dismissed | Reply textarea is gone after successful submission | ☐ |
| 11 | Verify Discussion count unchanged | Count shows total top-level comments only (replies don't increment the count) | ☐ |
| 12 | Refresh the page | Reply persists under the parent comment | ☐ |

**Notes/Learnings**:
- `comment_replies_insert_own`: validates `user_id = auth.uid() AND tenant_id = jwt_claim('tenant_id')`
- Replies are 1-level deep only — no nested reply-to-reply
- Reply form has `border-teal-200` (teal accent), while rendered replies have `border-slate-200` (neutral)
- `replyingToId` signal tracks which comment's reply form is open — only one at a time
- Discussion count uses `commentService.comments().length` which is top-level comments only

---

## CM-05: Edit Own Comment

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that a user can edit their own comment via inline editing: click Edit, textarea appears with current body, modify text, Save updates the comment, Cancel discards changes.

**Covers**: CommentSectionComponent (`onStartEditComment`, `onSaveEditComment`, `onCancelEdit`, `canEdit` check), CommentService (`updateComment`), `comments_update_own` RLS policy

**Preconditions**:
- Learner has posted a comment (from CM-01)
- Learner is logged in as the same user who posted

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to the module with the learner's own comment | Comment visible with Edit and Delete buttons | ☐ |
| 2 | Verify Edit button | Ghost-style button with Pencil icon and text "Edit" visible on own comment | ☐ |
| 3 | Click "Edit" | Comment body replaced by textarea pre-filled with current body text, "Save" and "Cancel" buttons appear below | ☐ |
| 4 | Verify Reply button hidden during edit | Action row (Reply/Edit/Delete) is hidden while in edit mode | ☐ |
| 5 | Click "Cancel" | Edit mode dismissed, original body text restored | ☐ |
| 6 | Click "Edit" again | Edit textarea appears again | ☐ |
| 7 | Modify text to "Hello, this is my EDITED first comment!" | Textarea content changes | ☐ |
| 8 | Click "Save" | Textarea disappears, comment body shows updated text | ☐ |
| 9 | Refresh the page | Edited text persists (saved to DB via `updateComment`) | ☐ |

**Notes/Learnings**:
- `comments_update_own` RLS: `USING (user_id = auth.uid())` — only own comments
- `updateComment` sends only `{ body }` — no other fields modified (tenant_id, module_id are immutable)
- `editingCommentId` signal ensures only one comment is in edit mode at a time
- Clicking Edit cancels any open reply form (`replyingToId` set to null)
- The `set_updated_at` trigger auto-updates `updated_at` on UPDATE

---

## CM-06: Delete Own Comment

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that a user can delete their own comment, the comment disappears from the list, and the Discussion count decreases. Also verifies that replies are cascade-deleted with the parent.

**Covers**: CommentSectionComponent (`onDeleteComment`, `canDelete` for own comment), CommentService (`deleteComment`), `comments_delete_own` RLS policy, CASCADE behavior on `comment_replies.comment_id` FK

**Preconditions**:
- Learner has a comment with at least one reply (from CM-01 + CM-04)
- Learner is logged in

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to the module with the learner's comment (which has a reply) | Comment with reply visible, Delete button present | ☐ |
| 2 | Note the current Discussion count | E.g., "Discussion (2)" if 2 comments exist | ☐ |
| 3 | Click "Delete" on the learner's own comment | Comment AND its replies immediately disappear | ☐ |
| 4 | Verify Discussion count decreases | Count decreases by 1 | ☐ |
| 5 | Verify no orphan replies | The reply that was nested under the deleted comment is also gone (FK cascade) | ☐ |
| 6 | Refresh the page | Deleted comment does not reappear (deleted from DB) | ☐ |
| 7 | If all comments deleted, verify empty state returns | "No comments yet. Be the first to start the discussion." text | ☐ |

**Notes/Learnings**:
- `comments_delete_own` RLS: `USING (user_id = auth.uid())` — own comments only
- `comment_replies` has `ON DELETE CASCADE` on `comment_id` FK — deleting a comment removes all its replies
- No confirmation dialog for delete — action is immediate (consistent with enrollment unenroll pattern)
- After delete, `loadComments` is called to refresh the list from DB

---

## CM-07: Tenant Admin Moderation

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that a Tenant Admin can delete another user's comment within the same tenant (moderation), but cannot edit it. Also verify TA cannot delete comments from other tenants.

**Covers**: CommentSectionComponent (`canDelete` for TA — `is_tenant_admin && same tenant_id`), `comments_delete_tenant_admin` RLS policy, negative case for cross-tenant

**Preconditions**:
- Client tenant learner (`learner@calypsoclient.com`) has posted a comment on a module
- Client Tenant Admin (`admin@calypsoclient.com`) is available
- The module is in a course assigned to Calypso Client tenant

**Setup Steps (Client Learner)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| S1 | Log in as Client Learner (`learner@calypsoclient.com`) | Dashboard loads | ☐ |
| S2 | Navigate to a module in the shared test course | Module viewer loads | ☐ |
| S3 | Post a comment: "Client learner question about this topic" | Comment appears | ☐ |
| S4 | Log out | — | ☐ |

**Test Steps (Tenant Admin)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Client Tenant Admin (`admin@calypsoclient.com`) | Dashboard loads | ☐ |
| 2 | Navigate to the same module | Module viewer loads with Discussion section | ☐ |
| 3 | Verify client learner's comment is visible | Comment shows with learner's name and body | ☐ |
| 4 | Verify Delete button IS visible on the learner's comment | Rose-colored trash button visible (TA can delete same-tenant comments) | ☐ |
| 5 | Verify Edit button is NOT visible | TA can only delete, not edit other users' comments | ☐ |
| 6 | Click "Delete" on the learner's comment | Comment disappears, Discussion count decreases | ☐ |
| 7 | Refresh the page | Deleted comment does not reappear | ☐ |

**Negative Case — Cross-Tenant**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 8 | If a Calypso (master tenant) comment exists on same module | TA should NOT see it at all — `comments_select_tenant` only shows same-tenant comments, and TA is on client tenant | ☐ |

**Notes/Learnings**:
- `comments_delete_tenant_admin`: `USING (tenant_id = jwt_claim('tenant_id') AND is_tenant_admin = 'true')` — same tenant only
- TA sees comments via `comments_select_tenant` — only their own tenant's comments are visible
- TA cannot see cross-tenant comments, so the cross-tenant delete restriction is moot at UI level
- `canDelete` logic: `item.user_id === currentUserId || isPlatformAdmin || (isTenantAdmin && item.tenant_id === userTenantId)`

---

## CM-08: Platform Admin Cross-Tenant Delete

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that a Platform Admin can see and delete comments from ANY tenant (cross-tenant moderation). PA uses `comments_select_platform_admin` (sees all) + `comments_delete_platform_admin` (can delete any).

**Covers**: `comments_select_platform_admin` RLS policy, `comments_delete_platform_admin` RLS policy, CommentSectionComponent (`canDelete` for PA — always true)

**Preconditions**:
- Comments exist from multiple tenants on the same module (e.g., Calypso learner + Client learner have both posted)
- Platform Admin is logged in

**Setup**:
- Ensure both `learner@calypso-commodities.com` and `learner@calypsoclient.com` have posted comments on the same module

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Platform Admin (`et@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Navigate to the module with multi-tenant comments | Module viewer loads | ☐ |
| 3 | Verify ALL comments visible | PA sees comments from both Calypso and Calypso Client tenants | ☐ |
| 4 | Verify Delete button on EVERY comment | Rose trash button visible on all comments (PA can delete any) | ☐ |
| 5 | Verify Edit button only on PA's OWN comments | Edit only shown for comments where `user_id === PA's id` | ☐ |
| 6 | Delete a client tenant comment | Comment disappears | ☐ |
| 7 | Delete a master tenant comment | Comment disappears | ☐ |
| 8 | Refresh the page | Both deleted comments stay gone | ☐ |

**Notes/Learnings**:
- `comments_select_platform_admin`: `USING (is_platform_admin = 'true')` — unconditional, sees all tenants
- `comments_delete_platform_admin`: `USING (is_platform_admin = 'true')` — can delete any comment
- PA is the only role that can see AND delete comments across all tenants
- TA can only see/delete within their own tenant; Lecturer can see across tenants but cannot delete others'

---

## CM-09: Tenant Isolation

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that comments are tenant-isolated — a learner from one tenant CANNOT see comments posted by a learner from another tenant on the same module. This is the core security boundary for the comment system.

**Covers**: `comments_select_tenant` RLS policy (`tenant_id = jwt_claim('tenant_id')`), tenant isolation model

**Preconditions**:
- Both Calypso and Calypso Client tenants have access to the same course (via `tenant_courses`)
- Both learners can access the same module

**Steps (Calypso Learner Posts)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Calypso Learner (`learner@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Navigate to a module in the shared course | Module viewer loads | ☐ |
| 3 | Post comment: "This is a Calypso-tenant comment" | Comment appears | ☐ |
| 4 | Verify Discussion count | Shows the count (Calypso tenant comments only) | ☐ |
| 5 | Log out | — | ☐ |

**Steps (Client Learner Checks)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 6 | Log in as Client Learner (`learner@calypsoclient.com`) | Dashboard loads | ☐ |
| 7 | Navigate to the SAME module | Module viewer loads | ☐ |
| 8 | **Verify Calypso learner's comment is NOT visible** | The "Calypso-tenant comment" should NOT appear — RLS filters by tenant_id | ☐ |
| 9 | Verify Discussion section shows different count | Count reflects only client tenant's comments (0 if none from client) | ☐ |
| 10 | Post comment: "This is a Client-tenant comment" | Comment appears | ☐ |
| 11 | Log out | — | ☐ |

**Steps (Calypso Learner Verifies)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 12 | Log in as Calypso Learner again | — | ☐ |
| 13 | Navigate to the same module | Module viewer loads | ☐ |
| 14 | **Verify Client learner's comment is NOT visible** | Only Calypso-tenant comments shown | ☐ |
| 15 | Verify own comment from step 3 IS visible | "This is a Calypso-tenant comment" still present | ☐ |

**Notes/Learnings**:
- `comments_select_tenant`: `USING (tenant_id = jwt_claim('tenant_id'))` — exact match, no cross-tenant leakage
- This is the MOST CRITICAL security test for comments
- Both learners see the SAME course content (modules, lectures) — only comments are tenant-isolated
- The same module_id will have comments from multiple tenants in the DB, but RLS ensures each tenant only sees their own
- If this test fails, it means tenant data is leaking — a P0 security issue

---

## CM-10: Lecturer Cross-Tenant Visibility

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that a Lecturer assigned to a course can see comments from ALL tenants on that course's modules. This is by design — lecturers need cross-tenant visibility to support all learners.

**Covers**: `comments_select_lecturer` RLS policy (checks `module.course_id IN lecturer_course_ids`), cross-tenant comment visibility

**Preconditions**:
- Comments exist from both Calypso and Client tenants on the same module (from CM-09)
- Lecturer (`lecturer-edit@calypso-commodities.com`) is assigned to the course

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Lecturer (`lecturer-edit@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Navigate to the module with multi-tenant comments | Module viewer loads | ☐ |
| 3 | Verify comments from Calypso learner visible | "This is a Calypso-tenant comment" shown | ☐ |
| 4 | Verify comments from Client learner visible | "This is a Client-tenant comment" shown | ☐ |
| 5 | Verify Discussion count includes ALL tenant comments | Count reflects total across all tenants | ☐ |
| 6 | Verify Lecturer can Reply to any comment | Reply button present on comments from both tenants | ☐ |
| 7 | Verify Lecturer CANNOT Delete other users' comments | No Delete button on other users' comments (lecturer is not TA/PA) | ☐ |
| 8 | Verify Lecturer CAN Edit/Delete their own comments | If lecturer has posted (CM-02), Edit + Delete visible on their own | ☐ |

**Notes/Learnings**:
- `comments_select_lecturer`: `EXISTS (SELECT 1 FROM modules m WHERE m.id = comments.module_id AND m.course_id = ANY(lecturer_course_ids))`
- Lecturer sees ALL tenants' comments on assigned courses — intentional for cross-tenant course support
- Lecturer CANNOT delete others' comments — `comments_delete_own` only allows own, and there's no `comments_delete_lecturer` policy
- Lecturer's own comments use master tenant_id (Calypso) — visible to Calypso learners but NOT to Client learners (unless lecturer explicitly sets client tenant_id, which the UI doesn't support)

---

## CM-11: Module Navigation Reloads Comments

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that when navigating between modules (Next/Previous buttons), the Discussion section reloads with the correct module's comments. Comments from module A should not appear on module B.

**Covers**: CommentSectionComponent `effect()` watching `moduleId` changes, CommentService `loadComments(moduleId)`, module navigation

**Preconditions**:
- A course with at least 2 consecutive modules (e.g., Module A and Module B in the same lecture)
- At least one comment exists on Module A
- Module B has no comments (or a different set)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Learner | Dashboard loads | ☐ |
| 2 | Navigate to Module A (which has a comment) | Module viewer loads, Discussion shows comment(s) | ☐ |
| 3 | Note the Discussion count and comment content | E.g., "Discussion (1)" with specific comment text | ☐ |
| 4 | Click "Next" button to navigate to Module B | Module B content loads | ☐ |
| 5 | Verify Discussion section reloaded | Count changes to Module B's comment count (e.g., "Discussion (0)") | ☐ |
| 6 | Verify Module A's comments are NOT shown | Comments from Module A do not appear on Module B | ☐ |
| 7 | Post a comment on Module B: "Comment on Module B" | Comment appears | ☐ |
| 8 | Click "Previous" button to return to Module A | Module A content loads | ☐ |
| 9 | Verify Module A's original comments are back | The comment from step 3 is visible again | ☐ |
| 10 | Verify Module B's comment is NOT shown here | "Comment on Module B" does not appear on Module A | ☐ |

**Notes/Learnings**:
- CommentSectionComponent uses `effect()` watching `moduleId()` signal — triggers `loadComments(mid)` on every change
- Module ID changes when route params change (`:moduleId` in URL)
- The effect runs on component init AND on every moduleId change
- `loadComments` clears existing comments (sets loading=true), fetches new ones, then sets them
- No caching — every module navigation hits the DB fresh (acceptable for comment volumes)

---

## CM-12: Edit and Delete Own Reply

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that a user can edit and delete their own replies. Edit shows inline textarea on the reply, Save updates it, Delete removes it. Also verify that Edit/Delete are NOT shown on other users' replies.

**Covers**: CommentSectionComponent (`onStartEditReply`, `onSaveEditReply`, `onDeleteReply`, `canEdit`/`canDelete` on replies), CommentService (`updateReply`, `deleteReply`), `comment_replies_update_own` + `comment_replies_delete_own` RLS policies

**Preconditions**:
- An existing comment with the learner's own reply on it

**Setup (if needed)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| S1 | Navigate to a module and post a comment | Comment appears | ☐ |
| S2 | Click "Reply" on the comment, post a reply: "My original reply" | Reply appears indented | ☐ |

**Test Steps — Edit Reply**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Verify Edit button on own reply | Pencil icon + "Edit" text visible on the reply | ☐ |
| 2 | Click "Edit" on the reply | Reply body replaced by textarea pre-filled with "My original reply", Save and Cancel buttons appear | ☐ |
| 3 | Modify text to "My EDITED reply" | Textarea content changes | ☐ |
| 4 | Click "Save" | Reply body updates to "My EDITED reply" | ☐ |
| 5 | Refresh the page | Edited reply persists | ☐ |

**Test Steps — Delete Reply**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 6 | Verify Delete button on own reply | Rose trash icon + "Delete" text visible | ☐ |
| 7 | Click "Delete" on the reply | Reply disappears from under the parent comment | ☐ |
| 8 | Verify parent comment still exists | Only the reply was removed, not the parent | ☐ |
| 9 | Refresh the page | Deleted reply does not reappear | ☐ |

**Notes/Learnings**:
- `comment_replies_update_own`: `USING (user_id = auth.uid())`
- `comment_replies_delete_own`: `USING (user_id = auth.uid())`
- `editingReplyId` and `editingCommentId` are mutually exclusive — editing a reply cancels comment edit and vice versa
- Deleting a reply does NOT delete the parent comment (unlike deleting a comment which cascades replies)

---

## CM-13: Permission Boundaries

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that users only see Edit/Delete buttons according to their permissions. Specifically: (1) Learner sees no Edit/Delete on others' comments, (2) CSM sees no Delete on others' comments, (3) No role sees Edit on others' comments (only own).

**Covers**: CommentSectionComponent `canEdit()` (own only), `canDelete()` (own + TA same-tenant + PA), negative permission checks

**Preconditions**:
- Multiple comments exist from different users (learner, lecturer, PA)
- Comments span same-tenant users

**Steps (Learner — No Moderation)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Calypso Learner | — | ☐ |
| 2 | Navigate to module with comments from Lecturer and PA | Comments visible | ☐ |
| 3 | Verify NO Edit button on Lecturer's comment | Only Reply button shown for other users' comments | ☐ |
| 4 | Verify NO Delete button on Lecturer's comment | Learner cannot delete others' comments | ☐ |
| 5 | Verify NO Edit button on PA's comment | Same — no edit on others | ☐ |
| 6 | Verify NO Delete button on PA's comment | Same — no delete on others | ☐ |
| 7 | Verify Reply button IS present on all comments | Any user can reply to any visible comment | ☐ |
| 8 | Verify Edit + Delete on OWN comment (if exists) | Buttons visible only on learner's own comments | ☐ |

**Steps (CSM — Can View But Not Moderate)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 9 | Log in as CSM (`csm@calypso-commodities.com`) | Dashboard loads | ☐ |
| 10 | Navigate to a module in a course (CSM sees via master tenant) | Module viewer loads | ☐ |
| 11 | Verify CSM can see comments | Comments from same tenant (Calypso) visible | ☐ |
| 12 | Verify NO Delete button on others' comments | CSM is NOT in `canDelete` (not TA, not PA) | ☐ |
| 13 | Verify NO Edit button on others' comments | CSM cannot edit others' comments | ☐ |
| 14 | Verify CSM CAN post a comment | Post comment → appears with "Calypso" badge (CSM → calypso badge via trigger) | ☐ |
| 15 | Verify CSM CAN Edit/Delete own comment | Own comment has Edit + Delete buttons | ☐ |

**Notes/Learnings**:
- `canEdit(item)`: `item.user_id === currentUserId` — ALWAYS own-only, no exceptions
- `canDelete(item)`: own OR `isPlatformAdmin` OR (`isTenantAdmin` AND same `tenant_id`) — CSM is excluded
- CSM can READ via `comments_select_csm` (assigned tenant), `comments_select_tenant` (own tenant), but has no special DELETE rights
- CSM can INSERT via `comments_insert_csm` (assigned tenants) — but the UI currently inserts with the CSM's own tenant_id (master)
- Lecturer also cannot delete others' — only own/TA/PA can moderate

---

## CM-14: Calypso Badge — CSM

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 (Run 2) |
| **Status** | ✅ |
| **Tester** | Claude |

**Purpose**: Verify that when a CSM posts a comment, the "Calypso" badge is automatically displayed (same visual as PA badge, but triggered by `csm_tenant_assignments` lookup).

**Covers**: `set_comment_badge` trigger (CSM path — second priority), `comments_insert_csm` RLS policy, badge rendering for CSM

**Preconditions**:
- CSM (`csm@calypso-commodities.com`) is logged in
- CSM has `csm_tenant_assignments` row (assigned to Calypso Client tenant)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as CSM (`csm@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Navigate to a module in a course | Module viewer loads | ☐ |
| 3 | Post comment: "CSM checking in on module completion rates" | Comment appears | ☐ |
| 4 | Verify Calypso badge | Teal pill with Building2 icon and "Calypso" text — same visual as PA badge | ☐ |
| 5 | Verify badge is NOT "Expert" | CSM gets Calypso badge, not Expert (even though both are master tenant roles) | ☐ |
| 6 | Log out, log in as Calypso Learner | — | ☐ |
| 7 | Navigate to the same module | CSM's comment visible with "Calypso" badge | ☐ |

**Notes/Learnings**:
- Trigger CSM check: `EXISTS (SELECT 1 FROM csm_tenant_assignments WHERE user_id = NEW.user_id)` — any CSM assignment qualifies
- CSM badge priority is second (after PA) — if someone is both PA and CSM, they get 'calypso' via the PA check
- `comments_insert_csm` allows CSM to insert comments on modules in their assigned tenants' courses
- CSM comment uses master tenant_id — visible to other master tenant users (Calypso learner, PA, other CSMs, lecturers)

---

## Bugs Found During E2E Testing

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| CM-BUG-01 | `TypeError: Cannot read properties of null (reading 'full_name')` when CSM views comments | P1 | Migration 00032 + defensive null-safe fallback |

### CM-BUG-01: Profile RLS Policy Missing — CSM Cannot Read Other Users' Profiles

**Story**: CM-14 (Calypso Badge — CSM)

**Description**: When CSM (`csm@calypso-commodities.com`) viewed a module's Discussion section, the app threw:

```
TypeError: Cannot read properties of null (reading 'full_name')
```

**Root Cause**: The Supabase query in `CommentService.loadComments()` includes a nested join:

```typescript
author:profiles!user_id(full_name, email)
```

This join returns `null` for other users' profiles because there was **no RLS policy allowing users to read profiles from their own tenant**. The existing RLS policies were:

- `profiles_select_own` — only own profile
- `profiles_select_platform_admin` — PA sees all profiles
- `profiles_select_tenant_admin` — TA sees own tenant profiles

CSM (and regular learners/lecturers) had no cross-user profile SELECT policy within the same tenant. When CSM tried to read a comment posted by another user (e.g., a learner), the nested `author` join returned `null`.

**Fix**:

1. **Migration 00032** added `profiles_select_tenant` policy:
   ```sql
   CREATE POLICY "profiles_select_tenant"
   ON profiles FOR SELECT
   USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
   ```
   This allows any authenticated user to read profiles from their own tenant (needed for comment author display).

2. **Defensive null-safe fallback** in `CommentService.loadComments()`:
   ```typescript
   author: {
     full_name: item.author?.full_name ?? 'Unknown User',
     email: item.author?.email ?? ''
   }
   ```
   And in the template:
   ```html
   <div class="text-sm font-semibold text-slate-900">
     {{ comment.author?.full_name ?? 'Unknown User' }}
   </div>
   ```

**Severity**: P1 — Breaks comment display for all non-PA/TA roles. Critical security fix (RLS gap).

**Prevention**: Always test new features with all 5 roles. CSM is the most commonly overlooked role in testing because it's the least used.

---

## Data Setup Notes

### Cleaning Up Comments Between Test Runs

```sql
-- Remove all comments (and cascade-delete replies) on a specific module
DELETE FROM comments WHERE module_id = '<MODULE_ID>';

-- Remove all comments by a specific user
DELETE FROM comments
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com');

-- Remove all comment replies by a specific user
DELETE FROM comment_replies
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com');

-- Nuclear option: clear ALL comments on the course's modules
DELETE FROM comments WHERE module_id IN (
  SELECT id FROM modules WHERE course_id = '<COURSE_ID>'
);
```

### Ensuring Course is Assigned to Both Tenants

For CM-09 (tenant isolation) and CM-10 (lecturer cross-tenant), the course must be assigned to both tenants:

```sql
-- Verify current assignments
SELECT t.name, tc.course_id
FROM tenant_courses tc
JOIN tenants t ON t.id = tc.tenant_id
WHERE tc.course_id = '<COURSE_ID>';

-- Assign to Calypso Client if missing
INSERT INTO tenant_courses (tenant_id, course_id)
SELECT t.id, '<COURSE_ID>'::uuid
FROM tenants t WHERE t.domain = 'calypsoclient.com'
ON CONFLICT DO NOTHING;
```

### Verifying Badge Trigger Works

After posting a comment, verify the badge was set correctly in the database:

```sql
-- Check badge_type on recent comments
SELECT c.body, c.badge_type, p.email, p.is_platform_admin
FROM comments c
JOIN profiles p ON p.id = c.user_id
WHERE c.module_id = '<MODULE_ID>'
ORDER BY c.created_at DESC
LIMIT 10;
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-13 | Claude (Run 1) | 14/14 | 14 | 0 | 1 bug found+fixed (CM-BUG-01: profiles_select_tenant). Migration 00032 applied. |
| 2026-02-13 | Claude (Run 2) | 14/14 | 14 | 0 | Clean re-run after bug fix. All stories pass. 0 new bugs. |
| 2026-02-14 | Claude (Playwright MCP) | CM-01 through CM-14 (regression) | 14 | 0 | Full regression — all 14 PASS. Verified: Discussion section loads (4 comments), post comment+reply, delete reply+comment, Expert badge (lecturer), Calypso badge (PA+CSM), Edit/Delete on own only, Reply on others. No regressions. |
| 2026-02-15 | Claude Opus 4.6 (Playwright MCP) | CM-01 through CM-14 (regression) | 14 | 0 | Full regression run. Discussion (4) on Market Participants module: Learner comment, Lecturer "Expert" badge, PA "Calypso" badge + Edit/Delete, CSM "Calypso" badge. Reply/Delete buttons on all, Edit only on own. No regressions. |

---

## Notes and Learnings from E2E Testing

- **Run 1**: CM-14 initially failed due to missing `profiles_select_tenant` RLS policy (CM-BUG-01). Fixed with migration 00032. All 14 stories passed after fix.
- **Run 2**: Full clean re-run — deleted all comments, re-tested from scratch. All 14 stories passed with zero new issues.
- **Tenant isolation verified**: Client tenant learner sees 0 comments when Calypso tenant has 4 comments on same module.
- **Cross-tenant visibility**: Lecturer sees 5 comments (all tenants), PA sees 5 comments (all tenants). Client TA sees only 1 (own tenant).
- **Badge triggers work correctly**: Learner=NULL, Lecturer=Expert (amber), CSM=Calypso (teal), PA=Calypso (teal).
- **Permission boundaries correct**: Learner sees Edit+Delete only on own. CSM sees Edit+Delete only on own. Lecturer sees Edit+Delete only on own. TA sees Delete on same-tenant. PA sees Delete on all + Edit on own.
- **Module navigation**: Comments reload correctly when navigating between modules via Next/Previous.

---

## References

| Document | Path |
|----------|------|
| CommentSectionComponent | `frontend/src/app/features/courses/components/comment-section.component.ts` |
| CommentService | `frontend/src/app/core/services/comment.service.ts` |
| Comment Model | `frontend/src/app/core/models/comment.model.ts` |
| Module Viewer (comment integration) | `frontend/src/app/features/courses/pages/module-viewer-page.component.ts` |
| Migration 00031 (badge triggers) | `supabase/migrations/00031_comment_badges.sql` |
| RLS Policies (comments) | `supabase/migrations/00004_rls_policies.sql` (lines 960-1072) |
| RLS Policies (CSM insert) | `supabase/migrations/00011_comprehensive_audit_fixes.sql` (lines 211-230) |
| Mock Factories | `frontend/src/app/__mocks__/course.mock.ts` |
| Test Users Setup | `docs/e2e-user-stories/TEST_USERS.md` |
| Enrollment Stories | `docs/e2e-user-stories/ENROLLMENT_USER_STORIES.md` |
| Development Approach | `docs/x_courses_development_approach.md` |
