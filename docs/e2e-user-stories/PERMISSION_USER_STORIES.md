# X-Courses v2 — Permission & Security E2E User Stories

## Overview

These stories verify access control enforcement at 3 layers: UI visibility, route guards, and RLS/API denial. They complement CW-10 (which only tested UI hiding for Learners) by testing actual database-level security enforcement. Each story isolates a specific permission boundary — from the happy-path verification of a lecturer's full CRUD, through direct Supabase API abuse attempts by unauthorized roles, to cross-tenant data isolation and the comprehensive UI denial matrix across all non-write roles.

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-courses-v2.vercel.app |
| **Backend URL** | https://x-courses-v2-production.up.railway.app |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Storage Bucket** | `course-files` |
| **Primary Focus** | Permission enforcement, RLS denial, route guard redirect |

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
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | Setup / reference |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit)** | Calypso (master) | PM-01, PM-02, PM-07 |
| 3 | `lecturer-view@calypso-commodities.com` | **Lecturer (read-only)** | Calypso (master) | PM-06, PM-08, PM-13 |
| 4 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | PM-05, PM-13 |
| 5 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | PM-03, PM-09, PM-11, PM-13 |
| 6 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | PM-04, PM-12, PM-13 |
| 7 | `learner@calypsoclient.com` | **Learner** | Calypso Client | PM-09, PM-10 |

### Test Data Prerequisites

These stories assume content has already been created (via CW-01 through CW-09). The test environment must have:

- At least **1 course** assigned to both Calypso and Calypso Client tenants (via `tenant_courses`)
- At least **1 course** assigned to Calypso only (NOT to Calypso Client) — for cross-tenant tests
- The shared course must have **at least 1 lecture with at least 1 module** (any type)
- `lecturer-edit@calypso-commodities.com` must be assigned to the shared course with `can_edit = true`
- `lecturer-view@calypso-commodities.com` must be assigned to the shared course with `can_edit = false`
- `csm@calypso-commodities.com` must be assigned to the Calypso Client tenant via `csm_tenant_assignments`

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Passed - All steps completed successfully |
| ❌ | Failed - One or more steps failed |
| ⏳ | Not Tested - Story has not been executed yet |
| ⚠️ | Partial - Some steps passed, issues found |

---

## Recommended Test Order

**IMPORTANT**: Tests should be run in this order due to dependencies:

| Order | ID | Story | Dependencies |
|-------|-----|-------|--------------|
| 1 | PM-01 | Lecturer (can_edit) Full Content CRUD | Lecturer user set up, assigned course with lectures/modules |
| 2 | PM-02 | Lecturer Boundary — Assigned vs Unassigned | PM-01 (same user, verifies boundary) |
| 3 | PM-07 | Lecturer Cannot Delete Course or Manage Tenants | PM-01 (same user, verifies escalation boundary) |
| 4 | PM-08 | Read-Only Lecturer URL Navigation Redirect | Lecturer (read-only) user set up |
| 5 | PM-06 | Read-Only Lecturer Cannot Write via Direct API | PM-08 (same user, already logged in) |
| 6 | PM-03 | Learner Cannot Mutate Content via Direct API | Learner user set up |
| 7 | PM-09 | Learner Route Guard Denial — All Write Routes | PM-03 (can continue same session) |
| 8 | PM-04 | Tenant Admin Cannot Write Content via Direct API | Tenant Admin user set up |
| 9 | PM-12 | Tenant Admin Route Guard Denial | PM-04 (same user, already logged in) |
| 10 | PM-05 | CSM Cannot Write Content via Direct API | CSM user set up |
| 11 | PM-10 | Cross-Tenant Content Visibility Enforcement | Client learner, Calypso-only course exists |
| 12 | PM-11 | Cross-Tenant User Data Isolation | Calypso learner logged in |
| 13 | PM-13 | Full Permission Denial Matrix — All 4 Non-Write Roles | All test users set up, run last (comprehensive) |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| PM-01 | Lecturer (can_edit) Full Content CRUD | Lecturer (can_edit) | ⏳ Not Tested | — |
| PM-02 | Lecturer Boundary — Assigned vs Unassigned | Lecturer (can_edit) | ⏳ Not Tested | — |
| PM-03 | Learner Cannot Mutate Content via Direct API | Learner (Calypso) | ⏳ Not Tested | — |
| PM-04 | Tenant Admin Cannot Write Content via Direct API | Tenant Admin | ⏳ Not Tested | — |
| PM-05 | CSM Cannot Write Content via Direct API | CSM | ⏳ Not Tested | — |
| PM-06 | Read-Only Lecturer Cannot Write via Direct API | Lecturer (read-only) | ⏳ Not Tested | — |
| PM-07 | Lecturer (can_edit) Cannot Delete Course or Manage Tenants | Lecturer (can_edit) | ⏳ Not Tested | — |
| PM-08 | Read-Only Lecturer URL Navigation Redirect | Lecturer (read-only) | ⏳ Not Tested | — |
| PM-09 | Learner Route Guard Denial — All Write Routes | Learner (both tenants) | ⏳ Not Tested | — |
| PM-10 | Cross-Tenant Content Visibility Enforcement | Learner (Calypso Client) | ⏳ Not Tested | — |
| PM-11 | Cross-Tenant User Data Isolation | Learner (Calypso) | ⏳ Not Tested | — |
| PM-12 | Tenant Admin Route Guard Denial | Tenant Admin | ⏳ Not Tested | — |
| PM-13 | Full Permission Denial Matrix — All 4 Non-Write Roles | Learner / TA / CSM / Lecturer (read-only) | ⏳ Not Tested | — |

---

## PM-01: Lecturer (can_edit) Full Content CRUD — Lectures & Modules

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that a Lecturer with `can_edit` permission can perform full lecture and module CRUD on an assigned course, while being correctly denied course deletion and tenant assignment.

**Covers**: CourseDetailPageComponent (`canEdit` signal), LectureAccordionComponent (all action buttons), LectureFormComponent (inline create/edit), ModuleFormPageComponent (create flow), ModuleItemComponent (edit/delete/reorder), CourseService (lecture + module CRUD methods), `lecturer_can_edit_course_ids` JWT claim, RLS policies: `lectures_insert_lecturer`, `lectures_update_lecturer`, `lectures_delete_lecturer`, `modules_insert_lecturer`, `modules_update_lecturer`, `modules_delete_lecturer`

**Preconditions**:
- `lecturer-edit@calypso-commodities.com` exists with `can_edit = true` for a specific course
- The assigned course has at least 1 lecture with at least 1 module
- Password: `TestUser123!`

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `lecturer-edit@calypso-commodities.com` (password: `TestUser123!`) | Dashboard loads, session established | ☐ |
| 2 | Navigate to `/courses` | Course list page loads, assigned course visible in grid | ☐ |
| 3 | Click the assigned course card | Navigated to `/courses/:courseId`, course detail page loads | ☐ |
| 4 | Verify "Edit" button IS visible in course header (secondary style, Pencil icon) | Button present — `canEdit()` returns true for this course | ☐ |
| 5 | Verify "Add Lecture" button IS visible (dashed border, Plus icon) | Button present at bottom of lecture list | ☐ |
| 6 | Verify existing lectures show pencil, trash, and chevron (reorder) icons in accordion headers | All action icons visible on each lecture | ☐ |
| 7 | Click "Add Lecture" | Inline form appears: "New Lecture" heading, Title input, Description textarea, "Add Lecture" and "Cancel" buttons | ☐ |
| 8 | Enter Title: "PM-01 Test Lecture", click "Add Lecture" | Form disappears, new lecture appears in the accordion list | ☐ |
| 9 | Click pencil icon on "PM-01 Test Lecture" | Inline edit form appears, pre-populated with current title and description | ☐ |
| 10 | Change Title to "PM-01 Test Lecture (Edited)", click "Save" | Form disappears, updated title shown in accordion | ☐ |
| 11 | Expand the "PM-01 Test Lecture (Edited)" accordion | Module list visible (empty), "Add Module" dashed button visible | ☐ |
| 12 | Click "Add Module" | Navigated to `/courses/:courseId/modules/new?lectureId=<lectureId>`, type selector shown | ☐ |
| 13 | Select "Video" type card | VideoFormComponent appears with Title, Description, Video URL, Thumbnail URL, Duration fields | ☐ |
| 14 | Enter Title: "PM-01 Video", Video URL: "https://cdn.example.com/pm01.mp4", click "Create Module" | Module created (two-step: INSERT module + INSERT module_videos), redirected to course detail | ☐ |
| 15 | Verify "PM-01 Video" appears in the lecture accordion with Video icon | Module visible in the expanded lecture | ☐ |
| 16 | Click pencil icon on "PM-01 Video" module | Navigated to `/courses/:courseId/modules/:moduleId/edit`, edit form loads pre-populated | ☐ |
| 17 | Append " (Updated)" to the title, click "Save Changes" | Module updated, redirected to course detail, updated title shown | ☐ |
| 18 | Verify NO "Delete Course" section anywhere on the course detail or edit pages | Section absent — course deletion is Platform Admin only | ☐ |
| 19 | Click "Edit" button on course header to navigate to `/courses/:courseId/edit` | Edit page loads with course form | ☐ |
| 20 | Verify NO "Tenant Assignment" section below the form | Section absent — tenant management is Platform Admin only | ☐ |
| 21 | Navigate back to course detail, click trash icon on "PM-01 Video" module | Inline confirmation: "Delete this module?" with "Yes, Delete" and "Cancel" | ☐ |
| 22 | Click "Yes, Delete" | Module deleted, removed from lecture module list | ☐ |
| 23 | Click trash icon on "PM-01 Test Lecture (Edited)" | Inline confirmation: "Are you sure? This will delete the lecture and all its modules." | ☐ |
| 24 | Click "Yes, Delete" | Lecture deleted, removed from accordion list | ☐ |

**Notes/Learnings**:
- This is the HAPPY PATH test for lecturer content CRUD — it must pass before testing denial scenarios
- Lecturer with `can_edit` has full lecture+module CRUD but NOT course INSERT/DELETE or tenant assignment
- The `canEdit` computed signal checks: `is_platform_admin` OR `lecturer_can_edit_course_ids.includes(courseId)`
- Two-step module creation (INSERT module, then INSERT subtable) with rollback if subtable fails
- Lecturer can DELETE lectures (unlike courses where only Platform Admin can delete)
- JWT claims include `lecturer_can_edit_course_ids` — if a course is in this array, all write UI is shown

---

## PM-02: Lecturer Boundary — Assigned vs Unassigned Course

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that the same lecturer sees full edit UI on assigned courses but zero edit UI on unassigned courses, and that direct URL navigation to edit routes for unassigned courses results in redirect.

**Covers**: CourseDetailPageComponent (`canEdit` computed signal per-course), CourseFormPageComponent (`ngOnInit` canEdit check + redirect), ModuleFormPageComponent (`ngOnInit` canEdit check + redirect), `lecturer_can_edit_course_ids` JWT claim (per-course scoping)

**Preconditions**:
- Logged in as `lecturer-edit@calypso-commodities.com`
- Two courses exist, both visible to this user's tenant:
  - **Course A**: assigned to this lecturer with `can_edit = true` (in `lecturer_can_edit_course_ids`)
  - **Course B**: visible via `tenant_courses` but NOT in this lecturer's `lecturer_can_edit_course_ids`
- Both courses have at least 1 lecture with at least 1 module

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to `/courses/:courseAId` (assigned course) | Course detail loads | ☐ |
| 2 | Verify "Edit" button IS visible in header | Pencil button present — `canEdit()` true for Course A | ☐ |
| 3 | Verify "Add Lecture" button IS visible | Dashed button present | ☐ |
| 4 | Verify pencil/trash/reorder icons on lectures | All action icons visible | ☐ |
| 5 | Verify "Add Module" button visible inside expanded lecture | Dashed button present | ☐ |
| 6 | Verify pencil/trash/reorder icons on modules | All module action icons visible | ☐ |
| 7 | Navigate to `/courses/:courseBId` (unassigned course) | Course detail loads (read access via tenant_courses) | ☐ |
| 8 | Verify NO "Edit" button in header | Pencil button absent — `canEdit()` false for Course B | ☐ |
| 9 | Verify NO "Add Lecture" button | Dashed button absent | ☐ |
| 10 | Verify NO pencil/trash/reorder icons on lectures or modules | All action icons absent — read-only view | ☐ |
| 11 | Navigate directly to `/courses/:courseBId/edit` | Brief load, then redirected to `/courses/:courseBId` — `ngOnInit` canEdit check fails, `router.navigate` fires | ☐ |
| 12 | Navigate directly to `/courses/:courseBId/modules/new?lectureId=<id>` | Redirected to `/courses/:courseBId` — same canEdit check in ModuleFormPageComponent | ☐ |

**Notes/Learnings**:
- The `canEdit` signal is computed per-course — the same user can have edit access on Course A but not Course B
- Route guard (`roleGuard('platform_admin', 'lecturer')`) passes for both courses because the user IS a lecturer — the second layer of defense is the `ngOnInit` canEdit check
- This is a critical test of the TWO-LAYER defense: guard passes (role check), component rejects (per-course permission check)
- Course B must be in `tenant_courses` for the lecturer's tenant so the course detail page loads (otherwise it would be a 404/empty state, not a permission test)
- The `lecturer_course_ids` claim grants read access; `lecturer_can_edit_course_ids` grants write access — different arrays

---

## PM-03: Learner Cannot Mutate Content via Direct Supabase API

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that RLS policies deny all content write operations when executed directly via the Supabase client from a Learner's browser session, proving that UI hiding alone is not the security boundary.

**Covers**: RLS policies: `courses_insert_platform_admin`, `courses_update_platform_admin`, `courses_update_lecturer`, `courses_delete_platform_admin`, `lectures_insert_*`, `modules_delete_*`, PostgreSQL row-level security enforcement

**Preconditions**:
- Logged in as `learner@calypso-commodities.com`
- A test course exists with known `courseId`, containing at least 1 lecture (`lectureId`) and 1 module (`moduleId`)
- The course is assigned to the Calypso tenant (learner can read it)
- The Supabase client instance is accessible from the browser console (via Angular injector or exposed global)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `learner@calypso-commodities.com` (password: `TestUser123!`) | Dashboard loads, session established | ☐ |
| 2 | Navigate to `/courses/:courseId` to confirm the course is readable | Course detail page loads with title, lectures, and modules visible | ☐ |
| 3 | Open browser console (via Playwright `browser_evaluate`) and attempt: `supabase.from('courses').insert({ title: 'Hacked Course', enrollment_type: 'open' }).select()` | Error returned — RLS INSERT policy requires `is_platform_admin = true`; response contains error code or empty data with error | ☐ |
| 4 | Attempt: `supabase.from('courses').update({ title: 'Hacked Title' }).eq('id', '<courseId>').select()` | Returns `{ data: [], count: 0 }` — RLS UPDATE policy filters out the row (learner is neither platform_admin nor lecturer with can_edit) | ☐ |
| 5 | Attempt: `supabase.from('courses').delete().eq('id', '<courseId>').select()` | Returns `{ data: [], count: 0 }` — RLS DELETE policy requires `is_platform_admin = true`; row filtered out | ☐ |
| 6 | Attempt: `supabase.from('lectures').insert({ course_id: '<courseId>', title: 'Injected Lecture', sort_order: 999 }).select()` | Error returned — RLS INSERT policy requires platform_admin or lecturer with can_edit for this course | ☐ |
| 7 | Attempt: `supabase.from('modules').delete().eq('id', '<moduleId>').select()` | Returns `{ data: [], count: 0 }` — RLS DELETE policy filters out the row | ☐ |
| 8 | Attempt: `supabase.from('lectures').update({ title: 'Tampered' }).eq('id', '<lectureId>').select()` | Returns `{ data: [], count: 0 }` — no matching rows after RLS filter | ☐ |
| 9 | Reload the page (`/courses/:courseId`) | Course detail loads unchanged — original title, original lectures, original modules all intact | ☐ |
| 10 | Verify course title is NOT "Hacked Title", no "Injected Lecture" exists, module count unchanged | All data verified unchanged — RLS successfully blocked every mutation | ☐ |

**Notes/Learnings**:
- Direct API tests require accessing the Supabase client from the browser console. The SupabaseService stores the client instance — it can be accessed via `ng.getComponent(document.querySelector('app-root')).__injector.get(SupabaseService)` or a global if exposed
- RLS returns DIFFERENT responses for denied operations:
  - **INSERT**: typically returns a PostgreSQL 42501 error (`new row violates row-level security policy`)
  - **UPDATE/DELETE with `.select()`**: returns empty `data` array with 0 rows affected (RLS filters the row out of the query before the operation executes)
- This test proves that even if the Angular UI were completely removed, the database itself would deny mutations
- The learner CAN read the course (via `courses_select_learner` policy through `tenant_courses`) but CANNOT write to it

---

## PM-04: Tenant Admin Cannot Write Content via Direct API

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that RLS policies deny all content write operations and tenant_courses self-assignment when executed by a Tenant Admin via the Supabase client, proving that user management privileges do not leak into content management.

**Covers**: RLS policies on `courses`, `lectures`, `modules`, `tenant_courses` (INSERT/UPDATE/DELETE), `is_tenant_admin` claim boundary — TA has user management privileges but zero content write

**Preconditions**:
- Logged in as `admin@calypsoclient.com` (Tenant Admin, Calypso Client)
- A test course exists assigned to Calypso Client (readable by this user)
- At least one course exists that is NOT assigned to Calypso Client (for self-assignment test)
- Known IDs: `courseId` (assigned), `unassignedCourseId` (not assigned), `lectureId`, `moduleId`, `tenantId` (Calypso Client)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `admin@calypsoclient.com` (password: `TestUser123!`) | Dashboard loads, session established | ☐ |
| 2 | Navigate to `/courses/:courseId` to confirm course is readable | Course detail loads — TA can read assigned courses | ☐ |
| 3 | Open browser console and attempt: `supabase.from('lectures').insert({ course_id: '<courseId>', title: 'TA Injected', sort_order: 999 }).select()` | Error returned — RLS INSERT denies (TA is not platform_admin or lecturer) | ☐ |
| 4 | Attempt: `supabase.from('modules').update({ title: 'TA Tampered' }).eq('id', '<moduleId>').select()` | Returns `{ data: [], count: 0 }` — 0 rows affected, RLS filters the row | ☐ |
| 5 | Attempt: `supabase.from('lectures').delete().eq('id', '<lectureId>').select()` | Returns `{ data: [], count: 0 }` — RLS filters out the row | ☐ |
| 6 | Attempt: `supabase.from('tenant_courses').insert({ tenant_id: '<tenantId>', course_id: '<unassignedCourseId>' }).select()` | Error returned — RLS INSERT on `tenant_courses` requires `is_platform_admin = true`; TA cannot self-assign courses to their own tenant | ☐ |
| 7 | Attempt: `supabase.from('courses').insert({ title: 'TA New Course', enrollment_type: 'open' }).select()` | Error returned — RLS INSERT requires platform_admin | ☐ |
| 8 | Reload the page, verify all data unchanged | Course detail loads with original data — no injected lectures, no tampered modules, no new courses | ☐ |

**Notes/Learnings**:
- The `tenant_courses` self-assignment test (step 6) is CRITICAL — if a TA could add rows to `tenant_courses`, they could give their tenant access to courses that were never assigned to them, bypassing the content access boundary
- Tenant Admins have `is_tenant_admin = true` in their JWT — this grants them user management RLS policies (profiles, access_requests) but ZERO content write policies
- RLS policies on content tables check for `is_platform_admin` or `lecturer_can_edit_course_ids` — neither applies to a TA
- This is a privilege escalation test: TA has elevated privileges (above Learner) but in a completely different domain (user management, not content)

---

## PM-05: CSM Cannot Write Content via Direct API

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that RLS policies deny all content write operations when executed by a CSM, despite the CSM having elevated cross-tenant READ access — proving that broad read privileges do not leak into write privileges.

**Covers**: RLS policies on `courses`, `lectures`, `modules`, `tenant_courses` (INSERT/UPDATE/DELETE), `csm_tenant_ids` claim — CSM has cross-tenant SELECT but zero INSERT/UPDATE/DELETE on content

**Preconditions**:
- Logged in as `csm@calypso-commodities.com`
- A test course exists assigned to Calypso Client tenant (readable by CSM via `csm_tenant_ids`)
- Known IDs: `courseId`, `lectureId`, `moduleId`, `clientTenantId` (Calypso Client)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `csm@calypso-commodities.com` (password: `TestUser123!`) | Dashboard loads, session established | ☐ |
| 2 | Navigate to `/courses/:courseId` to confirm CSM can read the course | Course detail loads — CSM has SELECT access via `courses_select_csm` policy | ☐ |
| 3 | Open browser console and attempt: `supabase.from('courses').insert({ title: 'CSM Injected', enrollment_type: 'open' }).select()` | Error returned — RLS INSERT requires `is_platform_admin = true` | ☐ |
| 4 | Attempt: `supabase.from('modules').update({ title: 'CSM Tampered' }).eq('id', '<moduleId>').select()` | Returns `{ data: [], count: 0 }` — RLS UPDATE filters the row (CSM has no UPDATE policy on modules) | ☐ |
| 5 | Attempt: `supabase.from('lectures').delete().eq('id', '<lectureId>').select()` | Returns `{ data: [], count: 0 }` — RLS DELETE filters the row | ☐ |
| 6 | Attempt: `supabase.from('tenant_courses').insert({ tenant_id: '<clientTenantId>', course_id: '<someOtherCourseId>' }).select()` | Error returned — `tenant_courses` INSERT requires `is_platform_admin = true` | ☐ |
| 7 | Reload the page, verify all data unchanged | Course detail loads with original data intact | ☐ |
| 8 | Verify via console: `supabase.from('courses').select('id, title')` returns courses (confirming read still works) | Non-empty result — CSM read access is intact, only write was denied | ☐ |

**Notes/Learnings**:
- CSM has ELEVATED read access (cross-tenant via `csm_tenant_ids` in JWT) which makes accidental write policy leakage MORE RISKY — a misconfigured RLS policy using `csm_tenant_ids` for write operations would silently allow mutations
- The `courses_select_csm` policy uses `EXISTS (SELECT 1 FROM csm_tenant_assignments WHERE user_id = auth.uid() AND tenant_id IN (SELECT tenant_id FROM tenant_courses WHERE course_id = courses.id))` — this is SELECT only
- No corresponding `courses_update_csm` or `courses_delete_csm` policies exist — CSM is read-only by design
- Step 8 confirms that read access is unaffected — this is not about blocking the CSM entirely, just about blocking writes

---

## PM-06: Read-Only Lecturer Cannot Write via Direct API

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that a Lecturer with read-only assignment (`can_edit = false`) is denied all write operations at the RLS level, testing the most subtle permission boundary — `lecturer_course_ids` vs `lecturer_can_edit_course_ids`.

**Covers**: RLS policies: `courses_update_lecturer` (checks `lecturer_can_edit_course_ids`, NOT `lecturer_course_ids`), `lectures_insert_lecturer`, `modules_insert_lecturer`, `module_markdown` UPDATE policies, JWT claim distinction between `lecturer_course_ids` and `lecturer_can_edit_course_ids`

**Preconditions**:
- Logged in as `lecturer-view@calypso-commodities.com`
- This user has `lecturer_course_ids = [<courseId>]` but `lecturer_can_edit_course_ids = []`
- The assigned course has at least 1 lecture with at least 1 module (including a markdown module if possible)
- Known IDs: `courseId`, `lectureId`, `moduleId`, `markdownModuleId`

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `lecturer-view@calypso-commodities.com` (password: `TestUser123!`) | Dashboard loads, session established | ☐ |
| 2 | Navigate to `/courses/:courseId` to confirm read access works | Course detail loads — `lecturer_course_ids` grants SELECT access | ☐ |
| 3 | Open browser console and attempt: `supabase.from('courses').update({ title: 'Read-Only Tampered' }).eq('id', '<courseId>').select()` | Returns `{ data: [], count: 0 }` — RLS UPDATE checks `lecturer_can_edit_course_ids` which is EMPTY for this user | ☐ |
| 4 | Attempt: `supabase.from('lectures').insert({ course_id: '<courseId>', title: 'RO Injected', sort_order: 999 }).select()` | Error returned — RLS INSERT checks `lecturer_can_edit_course_ids`, not `lecturer_course_ids` | ☐ |
| 5 | Attempt: `supabase.from('modules').insert({ lecture_id: '<lectureId>', course_id: '<courseId>', title: 'RO Module', module_type: 'markdown', sort_order: 999 }).select()` | Error returned — same `lecturer_can_edit_course_ids` check | ☐ |
| 6 | Attempt: `supabase.from('module_markdown').update({ content: 'HACKED CONTENT' }).eq('module_id', '<markdownModuleId>').select()` | Returns `{ data: [], count: 0 }` — subtable RLS inherits from module policies via JOIN | ☐ |
| 7 | Attempt: `supabase.from('lectures').delete().eq('id', '<lectureId>').select()` | Returns `{ data: [], count: 0 }` — RLS DELETE checks `lecturer_can_edit_course_ids` | ☐ |
| 8 | Reload the page, verify all content unchanged | Course detail shows original title, original lectures, original module content — nothing tampered | ☐ |

**Notes/Learnings**:
- This is the HIGHEST PRIORITY security test because a misconfigured RLS policy checking `lecturer_course_ids` instead of `lecturer_can_edit_course_ids` would SILENTLY ALLOW WRITES — there would be no error, just an unauthorized successful mutation
- The distinction between `lecturer_course_ids` (read-only array) and `lecturer_can_edit_course_ids` (write-enabled array) is the most subtle permission boundary in the system
- Both arrays come from `lecturer_course_assignments` — the difference is the `can_edit` boolean on the assignment row
- The RLS policies for UPDATE/INSERT/DELETE on lectures and modules use: `(SELECT current_setting('request.jwt.claims', true)::json->>'lecturer_can_edit_course_ids')` — if this were accidentally `lecturer_course_ids`, this test would catch it
- If this test FAILS, it indicates a critical RLS misconfiguration that must be fixed immediately

---

## PM-07: Lecturer (can_edit) Cannot Delete Course or Manage Tenants

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify the escalation boundary between content editing and admin operations — a Lecturer with `can_edit` can modify course content but cannot delete courses or manage tenant assignments, even via direct API calls.

**Covers**: RLS policies: `courses_delete_platform_admin` (requires `is_platform_admin`), `tenant_courses_insert_platform_admin`, `tenant_courses_delete_platform_admin`, CourseFormPageComponent (absence of Delete section and Tenant Assignment section), privilege escalation boundary

**Preconditions**:
- Logged in as `lecturer-edit@calypso-commodities.com`
- This user has `can_edit = true` for the assigned course
- Known IDs: `assignedCourseId`, any `tenantId`, any `otherTenantId`
- The assigned course has at least 1 existing `tenant_courses` row

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `lecturer-edit@calypso-commodities.com` (password: `TestUser123!`) | Dashboard loads | ☐ |
| 2 | Navigate to `/courses/:assignedCourseId/edit` | Course edit page loads, form pre-populated | ☐ |
| 3 | Scroll through the entire edit page | Verify NO "Delete Course" section (danger zone) visible anywhere on the page | ☐ |
| 4 | Verify NO "Tenant Assignment" section visible | Neither the section heading nor the tenant checkbox list is rendered | ☐ |
| 5 | Open browser console and attempt: `supabase.from('courses').delete().eq('id', '<assignedCourseId>').select()` | Returns `{ data: [], count: 0 }` — RLS DELETE requires `is_platform_admin = true`, which this lecturer does NOT have | ☐ |
| 6 | Attempt: `supabase.from('tenant_courses').insert({ course_id: '<assignedCourseId>', tenant_id: '<otherTenantId>' }).select()` | Error returned — `tenant_courses` INSERT requires `is_platform_admin`; lecturer cannot assign courses to tenants | ☐ |
| 7 | Attempt: `supabase.from('tenant_courses').delete().eq('course_id', '<assignedCourseId>').eq('tenant_id', '<existingTenantId>').select()` | Returns `{ data: [], count: 0 }` — `tenant_courses` DELETE requires `is_platform_admin` | ☐ |
| 8 | Navigate to `/courses/:assignedCourseId` and verify the course still exists | Course detail loads normally — course was NOT deleted | ☐ |
| 9 | Verify tenant assignment count unchanged (if visible via admin tools or console query) | `supabase.from('tenant_courses').select('*').eq('course_id', '<assignedCourseId>')` returns same rows as before | ☐ |
| 10 | Verify the lecturer CAN still update the course (to confirm edit access is intact): `supabase.from('courses').update({ description: 'Still editable' }).eq('id', '<assignedCourseId>').select()` | Returns `{ data: [{...}], count: 1 }` — UPDATE succeeds (can_edit privilege is intact) | ☐ |

**Notes/Learnings**:
- Course deletion cascades to ALL student progress across ALL tenants — this is the most destructive single operation in the system. A lecturer should NEVER have this power
- `tenant_courses` management is equally critical — adding/removing tenant assignments changes which tenant's users can see a course, affecting potentially hundreds of users
- Step 10 is a POSITIVE verification that the lecturer's edit access still works — this confirms the denial is targeted (admin-only operations) not blanket
- The `courses_delete_platform_admin` RLS policy uses a simple `is_platform_admin = true` check — there is no `courses_delete_lecturer` policy at all
- UI correctly hides these sections via `isPlatformAdmin()` computed signal (separate from `canEdit()`)

---

## PM-08: Read-Only Lecturer URL Navigation Redirect

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that a Lecturer without `can_edit` is redirected when navigating directly to edit/create URLs — testing the component-level canEdit redirect that operates AFTER the route guard passes.

**Covers**: CourseFormPageComponent (`ngOnInit` canEdit check → `router.navigate`), ModuleFormPageComponent (`ngOnInit` canEdit check → `router.navigate`), roleGuard (passes for `lecturer` role), TWO-LAYER defense architecture

**Preconditions**:
- Logged in as `lecturer-view@calypso-commodities.com`
- This user has `lecturer_course_ids = [<courseId>]` but `lecturer_can_edit_course_ids = []`
- The assigned course has at least 1 lecture and 1 module with known IDs

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `lecturer-view@calypso-commodities.com` (password: `TestUser123!`) | Dashboard loads | ☐ |
| 2 | Navigate directly to `/courses/:courseId/edit` via URL bar | Route guard passes (user IS a lecturer), page briefly loads, then `ngOnInit` checks `canEdit()` which returns false — redirected to `/courses/:courseId` | ☐ |
| 3 | Verify URL is now `/courses/:courseId` (course detail page) | URL changed, course detail content visible, no edit form | ☐ |
| 4 | Navigate directly to `/courses/:courseId/modules/new?lectureId=<lectureId>` | Route guard passes, page briefly loads, then `ngOnInit` checks `canEdit()` — redirected to `/courses/:courseId` | ☐ |
| 5 | Verify URL is now `/courses/:courseId` | URL changed back to course detail | ☐ |
| 6 | Navigate directly to `/courses/:courseId/modules/:moduleId/edit` | Route guard passes, page briefly loads, then `ngOnInit` checks `canEdit()` — redirected to `/courses/:courseId` | ☐ |
| 7 | Verify URL is now `/courses/:courseId` | URL changed back to course detail | ☐ |
| 8 | Navigate to `/courses/:courseId` and verify normal read access works | Course detail loads fully — title, lectures, modules all visible. No edit buttons shown | ☐ |

**Notes/Learnings**:
- This tests the TWO-LAYER defense: (1) route guard checks role (lecturer = allowed), (2) component `ngOnInit` checks per-course `canEdit()` (empty `lecturer_can_edit_course_ids` = denied)
- The brief page load before redirect is expected — the component must mount and run `ngOnInit` to perform the canEdit check
- `roleGuard('platform_admin', 'lecturer')` is configured on edit/module routes — it allows ANY lecturer through, regardless of `can_edit` status. The component-level check is the second gate
- If the route guard were the ONLY protection, read-only lecturers could access the edit form (even though RLS would block the save). The `ngOnInit` redirect prevents even viewing the form
- This is distinct from PM-06 (which tests RLS denial) — PM-08 tests the UI/navigation layer

---

## PM-09: Learner Route Guard Denial — All Write Routes

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that route guards block Learners (from both tenants) from navigating to any content write route, with immediate redirect to the root/dashboard.

**Covers**: `roleGuard('platform_admin')` on `/courses/new`, `roleGuard('platform_admin', 'lecturer')` on edit/module routes, `app.routes.ts` guard configuration, redirect behavior across tenants

**Preconditions**:
- Two learner accounts set up:
  - `learner@calypso-commodities.com` (Calypso master tenant)
  - `learner@calypsoclient.com` (Calypso Client tenant)
- A test course exists with known `courseId`, lecture `lectureId`, module `moduleId`
- The course is assigned to both tenants

**Steps (Calypso Learner)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `learner@calypso-commodities.com` (password: `TestUser123!`) | Dashboard loads | ☐ |
| 2 | Navigate directly to `/courses/new` | Redirected to `/` (which cascades to `/dashboard`) — `roleGuard('platform_admin')` denies access | ☐ |
| 3 | Verify URL is `/dashboard` (or `/`) | URL changed, dashboard content visible, no course creation form | ☐ |
| 4 | Navigate directly to `/courses/:courseId/edit` | Redirected to `/` — `roleGuard('platform_admin', 'lecturer')` denies (learner is neither) | ☐ |
| 5 | Verify URL is `/dashboard` (or `/`) | URL changed, no edit form visible | ☐ |
| 6 | Navigate directly to `/courses/:courseId/modules/new?lectureId=<lectureId>` | Redirected to `/` — same role guard denial | ☐ |
| 7 | Navigate directly to `/courses/:courseId/modules/:moduleId/edit` | Redirected to `/` — same role guard denial | ☐ |

**Steps (Calypso Client Learner)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 8 | Log out, then log in as `learner@calypsoclient.com` (password: `TestUser123!`) | Dashboard loads (different tenant) | ☐ |
| 9 | Navigate directly to `/courses/new` | Redirected to `/` — same guard applies regardless of tenant | ☐ |
| 10 | Navigate directly to `/courses/:courseId/edit` | Redirected to `/` | ☐ |
| 11 | Navigate directly to `/courses/:courseId/modules/new?lectureId=<lectureId>` | Redirected to `/` | ☐ |
| 12 | Navigate directly to `/courses/:courseId/modules/:moduleId/edit` | Redirected to `/` | ☐ |

**Notes/Learnings**:
- Route guards fire BEFORE the component loads — the learner never sees the edit form at all (unlike PM-08 where the page briefly renders)
- Redirect target is `/` which typically cascades to `/dashboard` via the default route
- Testing both tenants confirms that the guard is tenant-independent — it checks role claims, not tenant
- `roleGuard('platform_admin')` = only platform admins; `roleGuard('platform_admin', 'lecturer')` = platform admins OR any lecturer (further narrowed by component-level canEdit check for lecturers)
- A learner has none of these roles in their JWT claims: `is_platform_admin = false`, no entries in `lecturer_course_ids`, no entries in `csm_tenant_ids`

---

## PM-10: Cross-Tenant Content Visibility Enforcement

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that RLS correctly restricts content visibility to courses assigned to the user's tenant via `tenant_courses`, and that a user from one tenant cannot access content from another tenant's courses.

**Covers**: RLS policies: `courses_select_learner` (via `tenant_courses` JOIN), `lectures_select_learner` (via course → `tenant_courses`), `modules_select_learner` (via course → `tenant_courses`), `tenant_courses` as the access boundary for content

**Preconditions**:
- Logged in as `learner@calypsoclient.com` (Calypso Client tenant)
- Two courses exist:
  - **Course A**: assigned to BOTH Calypso and Calypso Client (visible to this user)
  - **Course B**: assigned to Calypso ONLY (NOT visible to this user)
- Course B has known `calypsoOnlyCourseId`, at least 1 lecture, at least 1 module

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `learner@calypsoclient.com` (password: `TestUser123!`) | Dashboard loads | ☐ |
| 2 | Navigate to `/courses` | Course list loads, shows ONLY courses assigned to Calypso Client tenant | ☐ |
| 3 | Verify Course A IS visible in the list | Course card present — this course is assigned to Calypso Client via `tenant_courses` | ☐ |
| 4 | Verify Course B is NOT visible in the list | No card for the Calypso-only course — `tenant_courses` has no row for Calypso Client + Course B | ☐ |
| 5 | Navigate directly to `/courses/:calypsoOnlyCourseId` | Error state or empty page — course not found from this user's perspective (RLS filters it out of the SELECT) | ☐ |
| 6 | Navigate directly to `/courses/:calypsoOnlyCourseId/modules/:moduleId` | Error state or empty page — module's course is not accessible | ☐ |
| 7 | Open browser console and attempt: `supabase.from('courses').select('id, title')` | Returns ONLY courses assigned to Calypso Client — Course B is NOT in the result | ☐ |
| 8 | Attempt: `supabase.from('lectures').select('*').eq('course_id', '<calypsoOnlyCourseId>')` | Returns empty `{ data: [] }` — lectures inherit course-level access via RLS JOIN | ☐ |
| 9 | Attempt: `supabase.from('modules').select('*').eq('course_id', '<calypsoOnlyCourseId>')` | Returns empty `{ data: [] }` — modules also filtered by course access | ☐ |
| 10 | Attempt: `supabase.from('module_videos').select('*, modules!inner(course_id)').eq('modules.course_id', '<calypsoOnlyCourseId>')` | Returns empty — subtable access also gated via course chain | ☐ |

**Notes/Learnings**:
- `tenant_courses` is the PRIMARY access boundary for content — it determines which courses a tenant's users can see
- RLS policies on `courses` use: `EXISTS (SELECT 1 FROM tenant_courses tc WHERE tc.course_id = courses.id AND tc.tenant_id = (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid)`
- `lectures` and `modules` RLS policies chain through: `course_id IN (SELECT tc.course_id FROM tenant_courses tc WHERE tc.tenant_id = ...)`
- Course B existing but being invisible is the expected behavior — it's not a 403, it's a "doesn't exist from your perspective"
- This is different from write denial (PM-03–PM-06) — this tests READ denial across tenant boundaries

---

## PM-11: Cross-Tenant User Data Isolation

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that tenant-scoped user data (profiles, progress, enrollments) is isolated by RLS — a user from one tenant cannot read another tenant's user data.

**Covers**: RLS policies: `profiles_select_own` (read own profile only for learners), `user_progress_select_own`, `course_enrollments_select_own`, tenant data isolation via `tenant_id` column and JWT claim matching

**Preconditions**:
- Logged in as `learner@calypso-commodities.com` (Calypso master tenant)
- Users from Calypso Client tenant exist (e.g., `admin@calypsoclient.com`, `learner@calypsoclient.com`)
- Both tenants have users with profiles

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `learner@calypso-commodities.com` (password: `TestUser123!`) | Dashboard loads | ☐ |
| 2 | Open browser console and query: `supabase.from('profiles').select('*')` | Returns ONLY the logged-in user's own profile (1 row) — `profiles_select_own` policy: `auth.uid() = id` | ☐ |
| 3 | Verify the returned profile has `email: 'learner@calypso-commodities.com'` | Correct — only own data | ☐ |
| 4 | Verify NO profiles from Calypso Client are returned | No rows with `@calypsoclient.com` emails — cross-tenant profiles are invisible | ☐ |
| 5 | Query: `supabase.from('user_progress').select('*')` | Returns ONLY the logged-in user's own progress records (may be empty if no progress yet) | ☐ |
| 6 | Query: `supabase.from('course_enrollments').select('*')` | Returns ONLY the logged-in user's own enrollments | ☐ |
| 7 | Attempt to query all profiles with tenant filter: `supabase.from('profiles').select('*').neq('id', '<ownUserId>')` | Returns empty — RLS enforces `id = auth.uid()` regardless of additional filters | ☐ |
| 8 | Query: `supabase.from('notifications').select('*')` | Returns ONLY the logged-in user's own notifications (filtered by `user_id = auth.uid()`) | ☐ |

**Notes/Learnings**:
- Learner-level profile access is `read_own_profile` — they can ONLY see their own profile, not even other users in the same tenant
- Tenant Admins and Platform Admins have broader profile SELECT policies (for user management), but learners are strictly limited to self
- User data tables (`profiles`, `user_progress`, `course_enrollments`, `notifications`) ALL have `user_id` or `id` based RLS that restricts to the authenticated user
- This is a DATA PRIVACY test — users should never be able to enumerate other tenants' users or even their own tenant's users (as a learner)
- Cross-tenant isolation is enforced at two levels: (1) `tenant_id` on the row matching JWT `tenant_id`, (2) `user_id` matching `auth.uid()` for personal data

---

## PM-12: Tenant Admin Route Guard Denial

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Verify that route guards block Tenant Admins from accessing content write routes, and that no content write UI is visible — confirming that user management privileges do not extend to content management.

**Covers**: `roleGuard('platform_admin')` on `/courses/new`, `roleGuard('platform_admin', 'lecturer')` on edit/module routes, CourseListPageComponent (no "Create Course" button), CourseDetailPageComponent (no edit UI), `is_tenant_admin` claim boundary

**Preconditions**:
- Logged in as `admin@calypsoclient.com` (Tenant Admin, Calypso Client)
- A test course exists assigned to Calypso Client (viewable by this user)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `admin@calypsoclient.com` (password: `TestUser123!`) | Dashboard loads | ☐ |
| 2 | Navigate to `/courses` | Course list loads with courses assigned to Calypso Client | ☐ |
| 3 | Verify NO "Create Course" button visible (top-right area) | Button absent — `isPlatformAdmin()` is false for Tenant Admins | ☐ |
| 4 | Click a course card to navigate to `/courses/:courseId` | Course detail loads | ☐ |
| 5 | Verify NO "Edit" button in course header | Pencil button absent — `canEdit()` is false (not platform_admin, not lecturer) | ☐ |
| 6 | Verify NO "Add Lecture" button | Dashed button absent | ☐ |
| 7 | Verify NO pencil/trash/reorder icons on lectures or modules | All action icons absent — read-only view | ☐ |
| 8 | Navigate directly to `/courses/new` | Redirected to `/` (dashboard) — `roleGuard('platform_admin')` denies | ☐ |
| 9 | Navigate directly to `/courses/:courseId/edit` | Redirected to `/` — `roleGuard('platform_admin', 'lecturer')` denies (TA is neither) | ☐ |
| 10 | Navigate directly to `/courses/:courseId/modules/new?lectureId=<id>` | Redirected to `/` — same guard denial | ☐ |

**Notes/Learnings**:
- Tenant Admins have `is_tenant_admin = true` in their JWT but this claim is NOT checked by any content write route guard or component
- The content write guards check for `is_platform_admin` and `lecturer` roles — Tenant Admin is neither
- Tenant Admins DO have elevated privileges for user management (profile access, access request approval) but these are in a completely separate feature area
- The "Create Course" button visibility is controlled by `isPlatformAdmin()` computed signal, not `canEdit()` — these are separate signals
- This test confirms the SEPARATION OF CONCERNS: user management (TA domain) vs content management (PA/Lecturer domain)

---

## PM-13: Full Permission Denial Matrix — All 4 Non-Write Roles

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ Not Tested |
| **Tester** | — |

**Purpose**: Comprehensive verification of UI visibility and route guard enforcement across ALL 4 non-write roles, checking all 10 permission entry points per role. This supersedes the incomplete CW-10 by testing each role individually and systematically.

**Covers**: `roleGuard('platform_admin')`, `roleGuard('platform_admin', 'lecturer')`, `canEdit` computed signal, `isPlatformAdmin` computed signal, CourseListPageComponent, CourseDetailPageComponent, LectureAccordionComponent, ModuleItemComponent — ALL permission-gated UI elements and routes

**Preconditions**:
- All 4 test users set up and can log in:
  - `learner@calypso-commodities.com` (Learner)
  - `admin@calypsoclient.com` (Tenant Admin)
  - `csm@calypso-commodities.com` (CSM)
  - `lecturer-view@calypso-commodities.com` (Lecturer read-only)
- A test course exists with at least 1 lecture and 1 module, assigned to both tenants
- Known IDs: `courseId`, `lectureId`, `moduleId`
- Password for all: `TestUser123!`

**Learner (learner@calypso-commodities.com)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as `learner@calypso-commodities.com` (password: `TestUser123!`) | Dashboard loads | ☐ |
| 2 | Navigate to `/courses` — check for "Create Course" button | Button ABSENT — Learner is not Platform Admin | ☐ |
| 3 | Navigate to `/courses/:courseId` — check for "Edit" button | Button ABSENT — `canEdit()` false | ☐ |
| 4 | Check for "Add Lecture" button | Button ABSENT | ☐ |
| 5 | Check for pencil/trash/reorder icons on lectures | Icons ABSENT on all lecture accordion headers | ☐ |
| 6 | Expand a lecture — check for pencil/trash/reorder icons on modules | Icons ABSENT on all module items | ☐ |
| 7 | Expand a lecture — check for "Add Module" button | Button ABSENT | ☐ |
| 8 | Navigate to `/courses/new` | Redirected to `/` — `roleGuard('platform_admin')` denies | ☐ |
| 9 | Navigate to `/courses/:courseId/edit` | Redirected to `/` — `roleGuard('platform_admin', 'lecturer')` denies | ☐ |
| 10 | Navigate to `/courses/:courseId/modules/new?lectureId=<lectureId>` | Redirected to `/` — same guard | ☐ |
| 11 | Navigate to `/courses/:courseId/modules/:moduleId/edit` | Redirected to `/` — same guard | ☐ |

**Tenant Admin (admin@calypsoclient.com)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 12 | Log in as `admin@calypsoclient.com` (password: `TestUser123!`) | Dashboard loads | ☐ |
| 13 | Navigate to `/courses` — check for "Create Course" button | Button ABSENT — TA is not Platform Admin | ☐ |
| 14 | Navigate to `/courses/:courseId` — check for "Edit" button | Button ABSENT — `canEdit()` false | ☐ |
| 15 | Check for "Add Lecture" button | Button ABSENT | ☐ |
| 16 | Check for pencil/trash/reorder icons on lectures | Icons ABSENT | ☐ |
| 17 | Expand a lecture — check for pencil/trash/reorder icons on modules | Icons ABSENT | ☐ |
| 18 | Expand a lecture — check for "Add Module" button | Button ABSENT | ☐ |
| 19 | Navigate to `/courses/new` | Redirected to `/` — guard denies | ☐ |
| 20 | Navigate to `/courses/:courseId/edit` | Redirected to `/` — guard denies (TA is neither platform_admin nor lecturer) | ☐ |
| 21 | Navigate to `/courses/:courseId/modules/new?lectureId=<lectureId>` | Redirected to `/` | ☐ |
| 22 | Navigate to `/courses/:courseId/modules/:moduleId/edit` | Redirected to `/` | ☐ |

**CSM (csm@calypso-commodities.com)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 23 | Log in as `csm@calypso-commodities.com` (password: `TestUser123!`) | Dashboard loads | ☐ |
| 24 | Navigate to `/courses` — check for "Create Course" button | Button ABSENT — CSM is not Platform Admin | ☐ |
| 25 | Navigate to `/courses/:courseId` — check for "Edit" button | Button ABSENT — `canEdit()` false (CSM has no lecturer assignment) | ☐ |
| 26 | Check for "Add Lecture" button | Button ABSENT | ☐ |
| 27 | Check for pencil/trash/reorder icons on lectures | Icons ABSENT | ☐ |
| 28 | Expand a lecture — check for pencil/trash/reorder icons on modules | Icons ABSENT | ☐ |
| 29 | Expand a lecture — check for "Add Module" button | Button ABSENT | ☐ |
| 30 | Navigate to `/courses/new` | Redirected to `/` — guard denies | ☐ |
| 31 | Navigate to `/courses/:courseId/edit` | Redirected to `/` — guard denies (CSM is neither platform_admin nor lecturer) | ☐ |
| 32 | Navigate to `/courses/:courseId/modules/new?lectureId=<lectureId>` | Redirected to `/` | ☐ |
| 33 | Navigate to `/courses/:courseId/modules/:moduleId/edit` | Redirected to `/` | ☐ |

**Lecturer — Read-Only (lecturer-view@calypso-commodities.com)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 34 | Log in as `lecturer-view@calypso-commodities.com` (password: `TestUser123!`) | Dashboard loads | ☐ |
| 35 | Navigate to `/courses` — check for "Create Course" button | Button ABSENT — Lecturer is not Platform Admin | ☐ |
| 36 | Navigate to `/courses/:courseId` — check for "Edit" button | Button ABSENT — `canEdit()` false (empty `lecturer_can_edit_course_ids`) | ☐ |
| 37 | Check for "Add Lecture" button | Button ABSENT — `canEdit()` false | ☐ |
| 38 | Check for pencil/trash/reorder icons on lectures | Icons ABSENT | ☐ |
| 39 | Expand a lecture — check for pencil/trash/reorder icons on modules | Icons ABSENT | ☐ |
| 40 | Expand a lecture — check for "Add Module" button | Button ABSENT | ☐ |
| 41 | Navigate to `/courses/new` | Redirected to `/` — `roleGuard('platform_admin')` denies (lecturer role is NOT platform_admin) | ☐ |
| 42 | Navigate to `/courses/:courseId/edit` | Guard PASSES (role is `lecturer`), but component `ngOnInit` checks `canEdit()` → redirected to `/courses/:courseId` | ☐ |
| 43 | Navigate to `/courses/:courseId/modules/new?lectureId=<lectureId>` | Guard PASSES, then component redirects to `/courses/:courseId` | ☐ |
| 44 | Navigate to `/courses/:courseId/modules/:moduleId/edit` | Guard PASSES, then component redirects to `/courses/:courseId` | ☐ |

**Notes/Learnings**:
- KEY DIFFERENCE: Learner/TA/CSM are blocked by `roleGuard` (instant redirect to `/`); Lecturer (read-only) PASSES `roleGuard` but is blocked by component `ngOnInit canEdit()` check (redirect to `/courses/:courseId`)
- This means the redirect DESTINATION differs: Learner/TA/CSM → `/` (dashboard); Lecturer read-only → `/courses/:courseId` (course detail)
- The `/courses/new` route uses `roleGuard('platform_admin')` which blocks ALL four roles (including the read-only lecturer)
- The edit/module routes use `roleGuard('platform_admin', 'lecturer')` which passes for any lecturer — the second defense layer (canEdit) is what blocks the read-only lecturer
- PM-13 supersedes CW-10 which was marked "Partial" — CW-10 only fully tested the Learner role
- All 10 checks should be performed for each role without shortcuts — a missing UI element for one role but present for another indicates a bug
- 44 total steps (11 per role x 4 roles)

---

## Notes

### Accessing Supabase Client from Browser Console

Direct API tests (PM-03 through PM-07) require accessing the Supabase client instance from the browser console via Playwright's `browser_evaluate`. Approaches:

1. **Via Angular injector**: `ng.getComponent(document.querySelector('app-root')).__injector.get(SupabaseService).client` (may require the service class to be available)
2. **Via global exposure**: If `SupabaseService` exposes the client on `window` (e.g., `window.__supabase`), use that directly
3. **Via Playwright code**: Use `browser_run_code` to execute Supabase operations with the authenticated session's JWT

### RLS Response Patterns

RLS returns different responses depending on the operation:

| Operation | Denied Response | Why |
|-----------|----------------|-----|
| **INSERT** | PostgreSQL error `42501`: "new row violates row-level security policy" | RLS cannot "filter" an INSERT — the row either passes or doesn't |
| **UPDATE with `.select()`** | `{ data: [], count: 0 }` | RLS filters the row OUT of the query — the UPDATE finds 0 matching rows |
| **DELETE with `.select()`** | `{ data: [], count: 0 }` | Same as UPDATE — the row is invisible to the query |
| **SELECT** | Empty result or row omitted | RLS silently excludes unauthorized rows — no error |

### JWT Claims and Session Considerations

- JWT claims refresh only on re-login (~1hr token lifetime). After role assignment changes in the database, the user must log out and back in to get updated claims
- When switching between test users during a test session, ensure full logout + login to get a clean JWT for each user
- The `custom_access_token_hook` bakes all 7 claims into the JWT at login/refresh time — claims are NOT read live from the database

### Priority Ranking

If time is limited, execute tests in this priority order:

1. **PM-06** — Read-only lecturer API denial (most subtle boundary, highest risk of misconfiguration)
2. **PM-03** — Learner API denial (baseline security test)
3. **PM-07** — Lecturer escalation boundary (course delete + tenant management)
4. **PM-10** — Cross-tenant content isolation (data privacy)
5. **PM-11** — Cross-tenant user data isolation (data privacy)
6. **PM-13** — Full UI denial matrix (comprehensive but lower risk than API denial)
7. Remaining stories in recommended order

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|------------------|------|------|-------|
| — | — | — | — | — | — |

---

## References

| Document | Purpose |
|----------|---------|
| `frontend/src/app/core/guards/role.guard.ts` | Role guard factory function (`roleGuard()`) |
| `frontend/src/app/app.routes.ts` | Route definitions and guard assignments |
| `frontend/src/app/core/services/course.service.ts` | CourseService — CRUD methods with RLS interaction |
| `frontend/src/app/features/courses/pages/course-detail-page.component.ts` | `canEdit` computed signal, lecture/module CRUD orchestration |
| `frontend/src/app/features/courses/pages/course-form-page.component.ts` | `ngOnInit` canEdit redirect logic |
| `frontend/src/app/features/courses/pages/module-form-page.component.ts` | `ngOnInit` canEdit redirect logic |
| `supabase/migrations/00001*.sql` | Base schema with initial RLS policies |
| `supabase/migrations/00003*.sql` | RLS policies for all tables |
| `supabase/migrations/00009*.sql` | CSM policies, safe views |
| `supabase/migrations/00012*.sql` | Auth hardening (password hook, tenant field protection) |
| `docs/e2e-user-stories/TEST_USERS.md` | Test user accounts, passwords, setup instructions |
| `docs/e2e-user-stories/CONTENT_WRITE_USER_STORIES.md` | CW-10 (predecessor, marked Partial) |
