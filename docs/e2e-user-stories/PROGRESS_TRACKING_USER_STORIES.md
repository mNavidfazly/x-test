> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Progress Tracking E2E User Stories (Phase 4B)

## Overview

E2E testing scenarios for the Progress Tracking system (Phase 4B). These stories verify the admin progress management UI: viewing enrolled users' progress, admin mark complete/reset actions, the significant update checkbox on module edit, and the DB trigger that resets progress on significant updates. **Migration 00026** adds 2 admin INSERT policies on `user_progress`, 3 SECURITY DEFINER trigger functions (`auto_mark_quiz_completed`, `auto_mark_exam_completed`, `reset_progress_on_significant_update`), and 3 corresponding triggers.

**Note:** Auto-mark triggers for quiz/exam pass (`auto_mark_quiz_completed`, `auto_mark_exam_completed`) cannot be E2E tested until Phase 5A (Quiz Taking UI) and Phase 5B (Exam Submission + Grading). They are listed as deferred stories (PT-12, PT-13) at the end.

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
| **Production (Custom Domain)** | https://xcourses.x-lng.com | https://x-courses-v2-production.up.railway.app |
| **Local Dev** | http://localhost:4200 | http://localhost:8000 |

### Test Users

> Full setup instructions: [TEST_USERS.md](TEST_USERS.md)

All test users use password: `TestUser123!`

| # | Email | Role | Tenant | Used In |
|---|-------|------|--------|---------|
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | PT-01, PT-04, PT-05, PT-06, PT-07, PT-08, PT-09, PT-10 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit)** | Calypso (master) | PT-03, PT-09 |
| 3 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | PT-03 |
| 4 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | PT-02, PT-11 |
| 5 | `learner@calypsoclient.com` | **Learner** | Calypso Client | PT-11 |

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Passed |
| ❌ | Failed |
| ⏳ | Not Tested |
| ⚠️ | Partial |

---

## Recommended Test Order

**IMPORTANT**: Tests should be run in this order due to dependencies:

| Order | ID | Story | Dependencies |
|-------|-----|-------|--------------|
| 1 | PT-01 | Progress Manager Visible — Platform Admin | PA logged in, course with enrolled users |
| 2 | PT-04 | Empty State — No Enrolled Users | PA logged in, course with no enrollments |
| 3 | PT-05 | User List with Progress Bars | PT-01 (course with enrolled users) |
| 4 | PT-06 | Expand User — Module Details | PT-05 (user rows visible) |
| 5 | PT-07 | Admin Mark Module Complete | PT-06 (expanded user, module visible) |
| 6 | PT-08 | Admin Reset Module Progress | PT-07 (module marked complete) |
| 7 | PT-02 | Progress Manager Visible — Tenant Admin | TA logged in, course assigned to client tenant |
| 8 | PT-03 | Progress Manager Hidden — Unauthorized | Learner/Lecturer logged in |
| 9 | PT-09 | Significant Update Checkbox — Edit Mode Only | PA/Lecturer logged in, module exists |
| 10 | PT-10 | Significant Update Resets Completed Progress | PT-07 (module marked complete via admin) |
| 11 | PT-11 | TA Cross-Tenant Progress Isolation | TA logged in, both tenants have enrolled users |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| PT-01 | Progress Manager Visible — Platform Admin | Platform Admin | ✅ | 2026-02-15 |
| PT-02 | Progress Manager Visible — Tenant Admin | Tenant Admin | ✅ | 2026-02-15 |
| PT-03 | Progress Manager Hidden — Unauthorized | Learner + Lecturer | ✅ | 2026-02-15 |
| PT-04 | Empty State — No Enrolled Users | Platform Admin | ✅ | 2026-02-15 |
| PT-05 | User List with Progress Bars | Platform Admin | ✅ | 2026-02-15 |
| PT-06 | Expand User — Module Details | Platform Admin | ✅ | 2026-02-15 |
| PT-07 | Admin Mark Module Complete | Platform Admin | ✅ | 2026-02-15 |
| PT-08 | Admin Reset Module Progress | Platform Admin | ✅ | 2026-02-15 |
| PT-09 | Significant Update Checkbox — Edit Mode Only | PA + Lecturer | ✅ | 2026-02-15 |
| PT-10 | Significant Update Resets Completed Progress | Platform Admin | ✅ | 2026-02-15 |
| PT-11 | TA Cross-Tenant Progress Isolation | Tenant Admin | ✅ | 2026-02-15 |
| PT-12 | Auto-Mark on Quiz Pass (Deferred) | Learner | ✅ (via QT-08) | 2026-02-15 |
| PT-13 | Auto-Mark on Exam Grade (Deferred) | Learner + PA | ✅ (via EG-07) | 2026-02-15 |

---

## PT-01: Progress Manager Visible — Platform Admin

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-12 |
| **Status** | ✅ |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify that the Progress Manager section is visible on the course detail page for Platform Admin, positioned after the Enrollment Manager.

**Covers**: CourseDetailPageComponent (`@if (canManageEnrollments())` template guard), ProgressManagerComponent (init, `loadCourseProgressAdmin`)

**Preconditions**:
- Logged in as Platform Admin (`et@calypso-commodities.com`)
- A course exists with at least one enrolled user and at least one lecture with modules

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Platform Admin | Dashboard loads | ☐ |
| 2 | Navigate to a course with enrolled users | Course detail page loads | ☐ |
| 3 | Scroll past enrollment manager section | Progress Manager section visible below Enrollment Manager, separated by `border-t border-slate-200` | ☐ |
| 4 | Verify section header | "USER PROGRESS (N USERS)" uppercase text with BarChart3 icon, where N = number of enrolled users | ☐ |
| 5 | Verify user count matches enrollment count | N in progress header should match enrolled user count from Enrollment Manager above | ☐ |

**Notes/Learnings**:
- `canManageEnrollments()` returns true for `is_platform_admin || is_tenant_admin`
- Progress manager is positioned AFTER enrollment manager and BEFORE the delete course button
- `loadCourseProgressAdmin` makes 2 parallel queries: `course_enrollments` (with embedded profiles) + `user_progress`
- PA sees users from ALL tenants (no tenant_id scoping on PA's queries)

---

## PT-02: Progress Manager Visible — Tenant Admin

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-12 |
| **Status** | ✅ |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify that a Tenant Admin sees the Progress Manager section on the course detail page for courses assigned to their tenant.

**Covers**: CourseDetailPageComponent (`canManageEnrollments` includes `is_tenant_admin`), ProgressManagerComponent (tenant-scoped data via RLS)

**Preconditions**:
- The test course is assigned to the Calypso Client tenant via `tenant_courses`
- Logged in as Tenant Admin (`admin@calypsoclient.com`)
- At least one user from the client tenant is enrolled

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Tenant Admin (`admin@calypsoclient.com`) | Dashboard loads | ☐ |
| 2 | Navigate to a course assigned to their tenant | Course detail loads | ☐ |
| 3 | Scroll to Progress Manager section | Section visible after enrollment manager | ☐ |
| 4 | Verify section header shows user count | "USER PROGRESS (N USERS)" — N should match TA's tenant-scoped enrollment count | ☐ |
| 5 | Verify NO "Edit" button on course header | TA cannot edit content (canEdit = false) | ☐ |

**Notes/Learnings**:
- RLS on `course_enrollments` and `user_progress` auto-filters by `tenant_id` for TA
- TA sees only their own tenant's enrolled users and progress, not cross-tenant data
- TA also sees enrollment CTA (for themselves) since `canEdit()` is false for them

---

## PT-03: Progress Manager Hidden — Unauthorized

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-12 |
| **Status** | ✅ |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify that users without admin roles (Learner, Lecturer) do NOT see the Progress Manager section.

**Covers**: CourseDetailPageComponent (`@if (canManageEnrollments())` template guard excludes non-admin roles)

**Preconditions**:
- A course exists with enrolled users

**Steps (Learner)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Learner (`learner@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Navigate to any course detail | Course detail loads | ☐ |
| 3 | Verify NO "User Progress" section | No progress manager table, no BarChart3 icon header, no module-level actions | ☐ |
| 4 | Verify enrollment CTA IS visible | Enroll button or enrolled badge shown (depending on enrollment status) | ☐ |

**Steps (Lecturer with can_edit)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 5 | Log in as Lecturer (`lecturer-edit@calypso-commodities.com`) | Dashboard loads | ☐ |
| 6 | Navigate to assigned course detail | Course detail loads with edit buttons | ☐ |
| 7 | Verify NO "User Progress" section | Lecturer cannot manage progress | ☐ |
| 8 | Verify NO enrollment manager either | Enrollment manager also hidden for lecturers | ☐ |

**Notes/Learnings**:
- `canManageEnrollments` is `is_platform_admin || is_tenant_admin` — lecturers and CSMs are excluded
- Both progress manager and enrollment manager share the same visibility guard
- The `<app-progress-manager>` element won't be in the DOM at all for unauthorized users

---

## PT-04: Empty State — No Enrolled Users

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-12 |
| **Status** | ✅ |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify the Progress Manager shows an appropriate empty state when a course has no enrolled users.

**Covers**: ProgressManagerComponent (empty state branch `users().length === 0`)

**Preconditions**:
- Logged in as Platform Admin
- A course exists with NO enrolled users (or all users have been unenrolled)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to a course with no enrolled users | Course detail loads | ☐ |
| 2 | Scroll to Progress Manager section | Section header: "USER PROGRESS (0 USERS)" | ☐ |
| 3 | Verify empty state display | Centered BarChart3 icon (large, slate-300), text: "No enrolled users to show progress for." | ☐ |
| 4 | Verify no user rows or module actions visible | No expandable rows, no Mark Complete/Reset buttons | ☐ |

**Notes/Learnings**:
- Empty state is shown when `loadCourseProgressAdmin` returns an empty array
- This happens naturally when there are no `course_enrollments` rows for the course
- The header count "0 USERS" comes from `users().length`, not from a separate count query

---

## PT-05: User List with Progress Bars

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-12 |
| **Status** | ✅ |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify the Progress Manager displays enrolled users in a list with email, name, progress bar, and completion count.

**Covers**: ProgressManagerComponent (user list rendering, progress bar calculation, `completed/total` display)

**Preconditions**:
- Logged in as Platform Admin
- A course has enrolled users, some with progress (modules marked complete via learner self-marking or admin marking)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to a course with enrolled users | Course detail loads | ☐ |
| 2 | Scroll to Progress Manager section | "USER PROGRESS (N USERS)" header visible | ☐ |
| 3 | Verify user rows in bordered container | Container has `border border-slate-200 rounded-xl overflow-hidden` | ☐ |
| 4 | Verify each user row content | Email (text-sm font-medium text-slate-700), full name below in text-xs (or "—" if null) | ☐ |
| 5 | Verify progress bar per user | Teal bar (`bg-teal-500`) inside slate track (`bg-slate-200`), width proportional to completion | ☐ |
| 6 | Verify completion count | "X/Y" text (tabular-nums) where X = completed modules, Y = total modules in course | ☐ |
| 7 | Verify chevron icon | ChevronDown icon on right side (collapsed state) | ☐ |
| 8 | Verify user with 0 progress | Progress bar at 0% width, count shows "0/Y" | ☐ |
| 9 | Verify user with some progress | Bar partially filled, count shows partial completion | ☐ |

**Notes/Learnings**:
- Progress bar width: `(user.completed / user.total) * 100`%
- `total` comes from `courseDetail().lectures.reduce(sum, l => sum + l.modules.length, 0)` — counts all modules across all lectures
- If total is 0, bar width defaults to 0% (guards against divide by zero)
- User rows are clickable buttons — the entire row area is a toggle for expand/collapse

---

## PT-06: Expand User — Module Details

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-12 |
| **Status** | ✅ |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify that clicking a user row expands an accordion showing module-level progress grouped by lecture, with status badges and action buttons.

**Covers**: ProgressManagerComponent (`toggleUser`, expanded module list, status badges, Mark Complete/Reset buttons)

**Preconditions**:
- Logged in as Platform Admin
- Course has enrolled users with mixed progress (some modules completed, some not)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Click on a user row in the progress manager | Row expands, showing module list below | ☐ |
| 2 | Verify chevron changes | ChevronDown → ChevronUp on the clicked row | ☐ |
| 3 | Verify expanded area styling | `bg-slate-50/50 border-t border-slate-100` background, padded | ☐ |
| 4 | Verify modules grouped by lecture | Each lecture has an uppercase heading (text-xs font-semibold text-slate-400) | ☐ |
| 5 | Verify completed module badge | Emerald badge (`bg-emerald-100 text-emerald-700`) with Check icon and "Done" text | ☐ |
| 6 | Verify in-progress module badge | Amber badge (`bg-amber-100 text-amber-700`) with "In Progress" text | ☐ |
| 7 | Verify not-started module badge | Slate badge (`bg-slate-100 text-slate-500`) with "Not Started" text | ☐ |
| 8 | Verify module titles | Module title text (text-sm text-slate-700) next to status badge | ☐ |
| 9 | Verify "Mark Complete" button on non-completed modules | Teal text button with Check icon, "Mark Complete" label | ☐ |
| 10 | Verify "Reset" button on completed modules | Rose text button with RotateCcw icon, "Reset" label | ☐ |
| 11 | Click the same user row again | Accordion collapses, module list hidden | ☐ |
| 12 | Click a different user row | Previous user collapses, new user expands (only one open at a time) | ☐ |

**Notes/Learnings**:
- Only one user accordion is open at a time — `expandedUserId` signal stores the currently expanded user
- Clicking the same user toggles it closed; clicking a different user switches the expansion
- Status badges use `user.modules[mod.id]?.status` — `?.` handles modules with no progress record (defaults to "Not Started")
- Module list iterates `lectures()` input, which contains all lectures with their modules
- `$event.stopPropagation()` on Mark Complete/Reset buttons prevents row toggle when clicking buttons

---

## PT-07: Admin Mark Module Complete

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-12 |
| **Status** | ✅ |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify that clicking "Mark Complete" on a module in the expanded progress view successfully marks it as completed for that user, and the UI updates to reflect the change.

**Covers**: ProgressManagerComponent (`onMarkComplete`), CourseService (`adminMarkModuleComplete` — upsert with `marked_by='admin'`), `progress_insert_platform_admin` RLS policy

**Preconditions**:
- Logged in as Platform Admin
- Course has enrolled users with at least one non-completed module
- User's accordion is expanded (from PT-06)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Find a module with "Not Started" or "In Progress" status | "Mark Complete" teal button visible on that row | ☐ |
| 2 | Click "Mark Complete" | All action buttons become disabled (`actionInProgress` signal) | ☐ |
| 3 | Wait for action to complete | Data reloads from DB | ☐ |
| 4 | Verify status badge changes | Badge changes to emerald "Done" with Check icon | ☐ |
| 5 | Verify action button changes | "Mark Complete" button replaced by "Reset" button (rose) | ☐ |
| 6 | Verify progress bar updates | User's progress bar fills further, count increments (e.g., "1/5" → "2/5") | ☐ |
| 7 | Verify header count unchanged | User count stays the same (marking complete doesn't add/remove users) | ☐ |
| 8 | Refresh the page | Progress persists — module still shows "Done" | ☐ |

**Verify Learner Can See Progress**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 9 | Log in as the learner whose module was admin-marked | Dashboard loads | ☐ |
| 10 | Navigate to the module in the course | Module viewer loads | ☐ |
| 11 | Verify "Completed" state on module | "Completed" button/badge visible (was marked by admin) | ☐ |

**Notes/Learnings**:
- `adminMarkModuleComplete` uses `marked_by='admin'` which bypasses the `enforce_quiz_exam_completion` BEFORE trigger — allows marking quiz/exam modules without a passing attempt
- The upsert uses `onConflict: 'user_id,tenant_id,module_id'` — handles both INSERT (new progress) and UPDATE (existing progress) cases
- After the action completes, `#loadProgress()` is called to refresh all progress data from DB
- The `actionInProgress` signal disables ALL action buttons during an operation (prevents double-clicks)

---

## PT-08: Admin Reset Module Progress

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-12 |
| **Status** | ✅ |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify that clicking "Reset" on a completed module reverts it to "Not Started" status, and the UI updates accordingly.

**Covers**: ProgressManagerComponent (`onReset`), CourseService (`adminResetModuleProgress` — UPDATE to `not_started`), `notify_progress_reset` trigger (auto-sends notification)

**Preconditions**:
- Logged in as Platform Admin
- A module has been marked as completed (from PT-07 or learner self-marking)
- User's accordion is expanded

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Find a module with "Done" status | "Reset" rose button with RotateCcw icon visible | ☐ |
| 2 | Click "Reset" | All action buttons become disabled | ☐ |
| 3 | Wait for action to complete | Data reloads from DB | ☐ |
| 4 | Verify status badge changes | Badge changes to slate "Not Started" | ☐ |
| 5 | Verify action button changes | "Reset" button replaced by "Mark Complete" button (teal) | ☐ |
| 6 | Verify progress bar updates | User's progress bar decreases, count decrements (e.g., "2/5" → "1/5") | ☐ |
| 7 | Refresh the page | Reset persists — module shows "Not Started" | ☐ |

**Verify Notification Sent**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 8 | Check the learner's notifications (if notification UI exists) or query DB | `notify_progress_reset` trigger should have created a notification row for the affected user | ☐ |

**Notes/Learnings**:
- `adminResetModuleProgress` updates `status='not_started'`, `completed_at=null`, `marked_by=null`, `notes='Reset by admin'`
- The existing `notify_progress_reset` trigger fires automatically when `user_progress.status` changes to `not_started`, creating a notification
- No confirmation dialog for reset — action is immediate (consistent with enrollment unenroll pattern)
- The reset uses UPDATE (not DELETE) — the `user_progress` row remains but with `not_started` status

---

## PT-09: Significant Update Checkbox — Edit Mode Only

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-12 |
| **Status** | ✅ |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify that the "This is a significant update" checkbox appears only when editing an existing module, not when creating a new one.

**Covers**: ModuleFormPageComponent (`significantUpdate` signal, `@if (isEditMode() && selectedType())` template guard)

**Preconditions**:
- Logged in as Platform Admin or Lecturer with can_edit
- A course exists with at least one module

**Steps (Edit Mode — Checkbox Visible)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Platform Admin | Dashboard loads | ☐ |
| 2 | Navigate to a course detail | Course with modules loads | ☐ |
| 3 | Click the pencil icon on any module | Module edit form loads ("Edit Module" heading) | ☐ |
| 4 | Verify significant update checkbox visible | Amber box (`bg-amber-50 border-amber-200`) with checkbox, label "This is a significant update" | ☐ |
| 5 | Verify help text | "Resets learner progress for this module. Use for content changes, not typo fixes." below checkbox | ☐ |
| 6 | Verify checkbox is unchecked by default | Checkbox not checked on load | ☐ |
| 7 | Click the checkbox | Checkbox becomes checked | ☐ |
| 8 | Click the checkbox again | Checkbox unchecked (toggle behavior) | ☐ |

**Steps (Create Mode — Checkbox Hidden)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 9 | Navigate to "Add Module" for a lecture (click + button on a lecture) | New module page loads ("New Module" heading) | ☐ |
| 10 | Verify type selector grid | 6 module type cards shown (Video, PDF, Markdown, Quiz, Exam, External Quiz) | ☐ |
| 11 | Verify NO significant update checkbox | Amber box NOT visible | ☐ |
| 12 | Select a type (e.g., "Markdown") | Module form loads for the selected type | ☐ |
| 13 | Verify STILL no significant update checkbox | Checkbox only appears in edit mode, never in create mode | ☐ |

**Steps (Lecturer with can_edit)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 14 | Log in as Lecturer (`lecturer-edit@calypso-commodities.com`) | Dashboard loads | ☐ |
| 15 | Navigate to an assigned course, click pencil on a module | Module edit form loads | ☐ |
| 16 | Verify significant update checkbox visible | Same amber box with checkbox — lecturers with can_edit see it too | ☐ |

**Notes/Learnings**:
- `isEditMode()` is `computed(() => !!this.moduleId())` — true only when route has `:moduleId` param
- The checkbox position: above the type-specific form component, below the "Edit Module" heading
- `significantUpdate` signal starts as `false` — user must explicitly opt in
- On save, `payload.significantUpdate = this.significantUpdate()` is set only in edit mode
- In `CourseService.updateModule()`, when `significantUpdate` is true, it sets `significant_update_at: new Date().toISOString()` on the module row

---

## PT-10: Significant Update Resets Completed Progress

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-12 |
| **Status** | ✅ |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify the full E2E flow: admin marks a module complete for a user, then edits that module with the "significant update" checkbox checked, and the DB trigger automatically resets the user's progress back to "Not Started".

**Covers**: `reset_progress_on_significant_update()` SECURITY DEFINER trigger on `modules` table, `notify_progress_reset` cascade trigger, ProgressManagerComponent (data reload shows reset)

**Preconditions**:
- Logged in as Platform Admin
- A course with enrolled users and at least one module
- The module has been marked complete for at least one user (via PT-07 or learner self-marking)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to the test course detail | Course detail loads | ☐ |
| 2 | Scroll to Progress Manager, expand a user | Verify the target module shows "Done" status with "Reset" button | ☐ |
| 3 | Note the module that is "Done" | Remember module title for later verification | ☐ |
| 4 | Click pencil icon on that same module | Module edit form loads | ☐ |
| 5 | Check the "This is a significant update" checkbox | Checkbox becomes checked | ☐ |
| 6 | Click "Save Changes" | Module saves successfully, redirects back to course detail | ☐ |
| 7 | Scroll to Progress Manager | Progress data reloads | ☐ |
| 8 | Expand the same user | Module list visible | ☐ |
| 9 | Verify the module status is now "Not Started" | Badge changed from emerald "Done" to slate "Not Started" | ☐ |
| 10 | Verify "Mark Complete" button now shown | Rose "Reset" button replaced by teal "Mark Complete" | ☐ |
| 11 | Verify progress bar decreased | User's completion count decreased by 1 | ☐ |

**Verify Notification Created**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 12 | Query DB for notification | `SELECT * FROM notifications WHERE user_id = '<learner_id>' AND notification_type = 'progress_reset'` should return a row | ☐ |

**Notes/Learnings**:
- The cascade chain: `modules UPDATE (significant_update_at)` → `reset_progress_on_significant_update` trigger → `user_progress UPDATE (status='not_started')` → `notify_progress_reset` trigger → `notifications INSERT`
- The trigger only resets progress where `completed_at < significant_update_at` — users who complete AFTER the update are not affected
- The trigger only affects rows with `status = 'completed'` — `in_progress` and `not_started` rows are untouched
- `reset_progress_on_significant_update` is SECURITY DEFINER — bypasses RLS to update all affected users' progress
- If no users had completed the module, the trigger fires but updates zero rows (no error)

---

## PT-11: TA Cross-Tenant Progress Isolation

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-12 |
| **Status** | ✅ |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify that a Tenant Admin only sees progress data for users in their own tenant, not from other tenants. Also verify TA can perform Mark Complete and Reset for their tenant's users.

**Covers**: `loadCourseProgressAdmin` (RLS auto-filters by tenant_id), `adminMarkModuleComplete` (`progress_insert_tenant_admin` policy), `adminResetModuleProgress`

**Preconditions**:
- The test course is assigned to BOTH Calypso (master) and Calypso Client tenants
- Users enrolled from both tenants:
  - `learner@calypso-commodities.com` (Calypso tenant) — enrolled in course
  - `learner@calypsoclient.com` (Client tenant) — enrolled in course
- Logged in as Tenant Admin (`admin@calypsoclient.com`) of Calypso Client

**Steps (Verify Isolation)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as TA (`admin@calypsoclient.com`) | Dashboard loads | ☐ |
| 2 | Navigate to the test course detail | Course detail loads | ☐ |
| 3 | Scroll to Progress Manager | "USER PROGRESS (N USERS)" — N should only count Client tenant users | ☐ |
| 4 | Verify only client tenant users shown | `learner@calypsoclient.com` visible, but `learner@calypso-commodities.com` NOT visible | ☐ |
| 5 | Verify no data leakage | No email addresses or progress data from Calypso (master) tenant shown | ☐ |

**Steps (TA Mark Complete)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 6 | Expand the client tenant learner's row | Module list visible with status badges | ☐ |
| 7 | Click "Mark Complete" on a module | Action succeeds, module changes to "Done" | ☐ |
| 8 | Verify progress bar updates | Count increments | ☐ |

**Steps (TA Reset)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 9 | Click "Reset" on the completed module | Action succeeds, module changes to "Not Started" | ☐ |
| 10 | Verify progress bar updates | Count decrements back | ☐ |

**Cross-Verify with PA**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 11 | Log in as PA (`et@calypso-commodities.com`) | Dashboard loads | ☐ |
| 12 | Navigate to same course, scroll to Progress Manager | PA sees users from ALL tenants (both Calypso and Client users) | ☐ |
| 13 | Verify PA user count > TA user count | PA's N > TA's N (PA sees cross-tenant) | ☐ |

**Notes/Learnings**:
- RLS on `course_enrollments` and `user_progress` both filter by `tenant_id` for TA users
- `progress_insert_tenant_admin` policy: `tenant_id = jwt_claim('tenant_id')::uuid AND is_tenant_admin = 'true'` — TA can only INSERT progress for their own tenant's users
- PA's `progress_insert_platform_admin` policy has no tenant_id check — PA can mark any user's progress
- This is the same isolation pattern as enrollment manager (EN-09), but applied to progress data

---

## PT-12: Auto-Mark on Quiz Pass — TESTED via QT-08

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 |
| **Status** | ✅ Covered by **QT-08** in `QUIZ_TAKING_USER_STORIES.md` |
| **Tester** | — |

> **UNBLOCKED**: Phase 5A (Quiz Taking) is now complete. This story is fully covered by **QT-08** in [`QUIZ_TAKING_USER_STORIES.md`](QUIZ_TAKING_USER_STORIES.md). QT-08 tests the same trigger flow end-to-end: learner passes quiz → `auto_mark_quiz_completed` trigger fires → `user_progress` row created with `marked_by='system'` → UI reflects completion.

**Purpose**: Verify that when a learner passes a quiz (via `grade_quiz_attempt()` RPC setting `passed=true`), the `auto_mark_quiz_completed` trigger automatically creates a `user_progress` row with `status='completed'` and `marked_by='system'`.

**Covers**: `auto_mark_quiz_completed()` SECURITY DEFINER trigger on `quiz_attempts`, `grade_quiz_attempt()` RPC, `on_quiz_passed` trigger

**No Longer Blocked**: Phase 5A Quiz Taking UI is complete — see `QUIZ_TAKING_USER_STORIES.md` (QT-01 through QT-11)

**Test Coverage (via QT-08)**:
- Pass a quiz → verify auto-mark (`status='completed'`, `marked_by='system'`)
- Fail a quiz → verify NO auto-mark (no `user_progress` row created)
- UI verification: module viewer shows "Completed" badge, course detail shows "Done", progress bar updated
- DB verification: SQL query confirming `user_progress` row

---

## PT-13: Auto-Mark on Exam Grade (Deferred)

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-13 |
| **Status** | ✅ PASS (via EG-07) |
| **Tester** | Claude Code (Playwright MCP) |

**Purpose**: Verify that when an admin grades an exam submission with a passing score, the `auto_mark_exam_completed` trigger automatically marks the exam module as completed.

**Covers**: `auto_mark_exam_completed()` SECURITY DEFINER trigger on `exam_submissions`, `on_exam_passed_auto_mark` trigger

**Resolved By**: Phase 5D Exam Grading — tested via EG-07 (Exam Grading User Stories). Lecturer graded submission with passing score (85 >= 70), learner saw "Passed" badge and score on module viewer page.

**Expected Flow**:
1. Learner submits an exam
2. Admin/Lecturer grades the submission, setting `score` on `exam_submissions`
3. `on_exam_passed_auto_mark` AFTER trigger fires (when `score` changes from NULL to a value)
4. `auto_mark_exam_completed()` checks if `score >= passing_score` from `exams` table
5. If passing: INSERT into `user_progress` with `marked_by='system'`
6. If failing: no action (no progress row created)

**Test When Available**: After Phase 5B implements exam grading UI, test:
- Grade with passing score → verify auto-mark
- Grade with failing score → verify NO auto-mark
- Grade threshold edge case (exact passing score) → verify auto-mark

---

## Data Setup Notes

### Ensuring Enrolled Users with Progress

For testing PT-05 through PT-08, you need users with varying progress states:

```sql
-- Check enrolled users for a course
SELECT ce.user_id, p.email, p.full_name, ce.tenant_id
FROM course_enrollments ce
JOIN profiles p ON p.id = ce.user_id
WHERE ce.course_id = '<COURSE_ID>';

-- Check progress for enrolled users
SELECT up.user_id, up.module_id, up.status, up.completed_at, up.marked_by
FROM user_progress up
WHERE up.course_id = '<COURSE_ID>';
```

### Cleaning Up Progress Between Test Runs

```sql
-- Reset all progress for a specific course
UPDATE user_progress
SET status = 'not_started', completed_at = NULL, marked_by = NULL
WHERE course_id = '<COURSE_ID>';

-- Delete all progress rows for a course (fresh start)
DELETE FROM user_progress WHERE course_id = '<COURSE_ID>';

-- Reset progress for a specific user + module
UPDATE user_progress
SET status = 'not_started', completed_at = NULL, marked_by = NULL
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
AND module_id = '<MODULE_ID>';
```

### Ensuring Course Assigned to Both Tenants (PT-11)

```sql
-- Verify course is assigned to both tenants
SELECT tc.tenant_id, t.name, t.domain
FROM tenant_courses tc
JOIN tenants t ON t.id = tc.tenant_id
WHERE tc.course_id = '<COURSE_ID>';

-- Assign to client tenant if missing
INSERT INTO tenant_courses (tenant_id, course_id)
SELECT t.id, '<COURSE_ID>'::uuid
FROM tenants t WHERE t.domain = 'calypsoclient.com'
ON CONFLICT DO NOTHING;
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-12 | Claude Code (Playwright MCP) | PT-01 to PT-11 | 11 | 0 | All 11 testable stories pass. 0 bugs found. PT-12/PT-13 deferred (Phase 5A/5B). |
| 2026-02-13 | Claude Code (Playwright MCP) | PT-12 (via QT-08) | 1 | 0 | PT-12 tested via Quiz Taking QT-08: `auto_mark_quiz_completed` trigger verified. Required migration 00028 to fix `protect_quiz_attempt_score` blocking the grading UPDATE. PT-13 still deferred (Phase 5B). |
| 2026-02-13 | Claude Code (Playwright MCP) | PT-13 (via EG-07) | 1 | 0 | PT-13 tested via Exam Grading EG-07: `auto_mark_exam_completed` trigger verified. Lecturer graded with passing score 85 >= 70, learner confirmed Passed badge + score on module viewer. All 13 PT stories now complete. |
| 2026-02-14 | Claude (Playwright MCP) | PT-01 through PT-13 (regression) | 13 | 0 | Full regression — all 13 PASS. Verified: PA progress manager (3 users, expand/mark/reset), TA progress manager (1 user, tenant-scoped), progress bars + counts update correctly. No regressions. |
| 2026-02-15 | Claude Opus 4.6 (Playwright MCP) | PT-01 through PT-13 (regression) | 13 | 0 | Full regression run. Verified: User Progress section (3 users: 7/9, 0/9, 1/9), expanded row shows module-level status grouped by lecture (Market Fundamentals + Trading Strategies), Mark Complete/Reset buttons present. No regressions. |

---

## Bugs Found During E2E Testing

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| — | — | — | — |

**0 bugs found** so far.

---

## References

| Document | Path |
|----------|------|
| Progress Manager Component | `frontend/src/app/features/courses/components/progress-manager.component.ts` |
| Course Detail Page (progress integration) | `frontend/src/app/features/courses/pages/course-detail-page.component.ts` |
| Module Form Page (significant update checkbox) | `frontend/src/app/features/courses/pages/module-form-page.component.ts` |
| Course Service (progress admin methods) | `frontend/src/app/core/services/course.service.ts` |
| Course Model (UserProgressSummary, MarkedByType) | `frontend/src/app/core/models/course.model.ts` |
| Migration 00026 (triggers + policies) | `supabase/migrations/00026_progress_tracking.sql` |
| Enrollment User Stories | `docs/e2e-user-stories/ENROLLMENT_USER_STORIES.md` |
| Test Users Setup | `docs/e2e-user-stories/TEST_USERS.md` |
