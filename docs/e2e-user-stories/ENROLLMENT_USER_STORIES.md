> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Enrollment E2E User Stories (Phase 4A)

## Overview

E2E testing scenarios for the Enrollment System (Phase 4A). These stories verify the complete enrollment flow: self-enrollment for open courses, password-protected enrollment, invite-only information, enrollment badge display, admin enrollment management (add by email, unenroll), and module progress gating behind enrollment status. **No new migrations were needed** — all DB infrastructure (`course_enrollments` table, 10 RLS policies, `enroll_with_password()` RPC) already existed from earlier migrations.

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
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | EN-01 setup, EN-05, EN-06, EN-07, EN-08 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit)** | Calypso (master) | EN-05 |
| 3 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | EN-01, EN-02, EN-03, EN-04, EN-10, EN-11 |
| 4 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | EN-09 |
| 5 | `learner@calypsoclient.com` | **Learner** | Calypso Client | EN-09 |

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
| 1 | EN-01 | Open Course Self-Enrollment | Learner logged in, open course exists |
| 2 | EN-04 | Enrolled Badge Display | EN-01 (learner is now enrolled) |
| 3 | EN-11 | Module Completion Gated by Enrollment | EN-01 (learner enrolled in course with modules) |
| 4 | EN-02 | Password Protected Enrollment | PA changes course to password_protected |
| 5 | EN-03 | Invite-Only Course Info | PA changes course to invite_only |
| 6 | EN-05 | Enrollment CTA Hidden for Editors | PA/Lecturer logged in |
| 7 | EN-06 | Enrollment Manager — Platform Admin View | PA logged in, course exists |
| 8 | EN-07 | Enrollment Manager — Add User by Email | EN-06 (manager visible) |
| 9 | EN-08 | Enrollment Manager — Unenroll User | EN-07 (user enrolled via manager) |
| 10 | EN-09 | Enrollment Manager — Tenant Admin | TA logged in, course assigned to client tenant |
| 11 | EN-10 | Enrollment Manager Hidden for Unauthorized | Learner/Lecturer logged in |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| EN-01 | Open Course Self-Enrollment | Learner | ✅ PASS | 2026-02-17 |
| EN-02 | Password Protected Enrollment | Learner + PA | ✅ PASS | 2026-02-17 |
| EN-03 | Invite-Only Course Info | Learner + PA | ✅ PASS | 2026-02-17 |
| EN-04 | Enrolled Badge Display | Learner | ✅ PASS | 2026-02-17 |
| EN-05 | Enrollment CTA Hidden for Editors | PA + Lecturer | ✅ PASS | 2026-02-17 |
| EN-06 | Enrollment Manager — Platform Admin View | Platform Admin | ✅ PASS | 2026-02-17 |
| EN-07 | Enrollment Manager — Add User by Email | Platform Admin | ✅ PASS | 2026-02-17 |
| EN-08 | Enrollment Manager — Unenroll User | Platform Admin | ✅ PASS | 2026-02-17 |
| EN-09 | Enrollment Manager — Tenant Admin | Tenant Admin | ✅ PASS | 2026-02-17 |
| EN-10 | Enrollment Manager Hidden for Unauthorized | Learner + Lecturer | ✅ PASS | 2026-02-17 |
| EN-11 | Module Completion Gated by Enrollment | Learner | ✅ PASS | 2026-02-17 |

---

## EN-01: Open Course Self-Enrollment

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ PASS |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that a learner can self-enroll in an open course by clicking "Enroll Now", and that the enrollment CTA updates to show the enrolled badge after success.

**Covers**: EnrollmentCtaComponent (`open` case, `enroll` output), CourseDetailPageComponent (`onEnroll()`), CourseService (`enrollInOpenCourse`, `loadCourseDetail` reload), `course_enrollments` INSERT + `ce_insert_self` RLS policy

**Preconditions**:
- A course exists with `enrollment_type = 'open'` and is assigned to the learner's tenant via `tenant_courses`
- Learner (`learner@calypso-commodities.com`) is NOT yet enrolled in this course
- The course has at least one module (for EN-11 follow-up)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Learner (`learner@calypso-commodities.com`) | Dashboard loads | ✅ |
| 2 | Navigate to the open course detail | Course detail page loads with title, description, lectures | ✅ |
| 3 | Verify enrollment CTA visible | "Enroll Now" teal button with UserPlus icon displayed between header and lectures | ✅ |
| 4 | Verify NO "You're enrolled" badge | Badge should NOT be visible yet | ✅ |
| 5 | Click "Enroll Now" button | Button shows "Enrolling..." loading state | ✅ |
| 6 | Wait for enrollment to complete | Loading state disappears | ✅ |
| 7 | Verify "You're enrolled" badge | Green badge (`bg-emerald-50 border-emerald-200`) with Check icon and "You're enrolled" text replaces the enroll button | ✅ |
| 8 | Refresh the page | "You're enrolled" badge persists (enrollment saved to DB) | ✅ |

**Notes/Learnings**:
- `ce_insert_self` RLS policy validates: `enrollment_type = 'open'` + tenant_courses assignment + not already enrolled
- `enrollInOpenCourse` performs INSERT then automatically reloads course detail to update `isEnrolled`
- The CTA section is wrapped in `@if (!canEdit())` — learners will always see it
- If the learner is already enrolled (e.g., from a previous test run), step 3 will show the badge instead of the button — unenroll first via SQL or enrollment manager

---

## EN-02: Password Protected Enrollment

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ PASS |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that a password-protected course shows a password input field, rejects wrong passwords, and accepts the correct one to enroll the user.

**Covers**: EnrollmentCtaComponent (`password_protected` case, `enrollWithPassword` output, `passwordError` signal), CourseDetailPageComponent (`onEnrollWithPassword()`), CourseService (`enrollWithPassword`), `enroll_with_password()` RPC (server-side bcrypt comparison)

**Preconditions**:
- Platform Admin has set a course to `enrollment_type = 'password_protected'` and set a course password
- The course is assigned to the learner's tenant
- Learner is NOT enrolled in this course

**Setup Steps (PA)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| S1 | Log in as Platform Admin (`et@calypso-commodities.com`) | Dashboard loads | ✅ |
| S2 | Navigate to a course, click "Edit" | Course edit form loads | ✅ |
| S3 | Change "Enrollment Type" to "Password Protected" | Dropdown value changes, password field appears | ✅ |
| S4 | Enter course password (e.g., "CoursePass123") | Password field accepts input | ✅ |
| S5 | Click "Save Changes" | Course updated, `hash_course_password()` trigger hashes the password | ✅ |

**Test Steps (Learner)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Learner | Dashboard loads | ✅ |
| 2 | Navigate to the password-protected course detail | Course detail loads | ✅ |
| 3 | Verify password enrollment form | Glassmorphism card with Lock icon, "Password required to enroll" text, password input, "Enroll" button | ✅ |
| 4 | Leave password empty, click "Enroll" | Error text "Please enter the course password" appears below input | ✅ |
| 5 | Enter wrong password: "WrongPassword" | — | ✅ |
| 6 | Click "Enroll" | Button shows "..." loading, then RPC error — error message displayed (e.g., "Invalid password" or RPC error text) | ✅ |
| 7 | Clear the error by typing in password field | Error text disappears | ✅ |
| 8 | Enter correct password: "CoursePass123" | — | ✅ |
| 9 | Click "Enroll" | Loading state, then "You're enrolled" badge appears | ✅ |
| 10 | Refresh the page | Enrolled badge persists | ✅ |

**Notes/Learnings**:
- The `enroll_with_password()` RPC is SECURITY DEFINER — it handles bcrypt comparison server-side
- `hash_course_password()` trigger auto-hashes the password on INSERT/UPDATE (uses `crypt()` from `pgcrypto`)
- The RPC returns void on success and throws an error on failure with a user-friendly message
- The password input `(keydown.enter)` also triggers enrollment (no need to click the button)
- After successful enrollment, `enrollWithPassword` calls `loadCourseDetail` to refresh `isEnrolled`

---

## EN-03: Invite-Only Course Info

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ PASS |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that an invite-only course shows an informational message (not a button) telling the user they need an administrator invitation.

**Covers**: EnrollmentCtaComponent (`invite_only` case), no enrollment action available

**Preconditions**:
- Platform Admin has set a course to `enrollment_type = 'invite_only'`
- Learner is NOT enrolled in this course

**Setup Steps (PA)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| S1 | Log in as Platform Admin | — | ✅ |
| S2 | Navigate to a course, click "Edit" | Course edit form loads | ✅ |
| S3 | Change "Enrollment Type" to "Invite Only" | Dropdown value changes | ✅ |
| S4 | Click "Save Changes" | Course updated | ✅ |

**Test Steps (Learner)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Learner | Dashboard loads | ✅ |
| 2 | Navigate to the invite-only course detail | Course detail loads | ✅ |
| 3 | Verify invite-only info card | Amber card (`bg-amber-50 border-amber-200`) with Info icon and text: "This course requires an invitation from your administrator." | ✅ |
| 4 | Verify NO "Enroll Now" button | No teal button visible | ✅ |
| 5 | Verify NO password input | No password form visible | ✅ |

**Notes/Learnings**:
- Invite-only courses can only be enrolled via the enrollment manager (PA/TA adds user by email)
- Direct INSERT into `course_enrollments` by a learner will fail with RLS denial (`ce_insert_self` requires `enrollment_type = 'open'`)
- After testing, PA should reset the enrollment type back to 'open' for other tests

---

## EN-04: Enrolled Badge Display

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ PASS |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that an already-enrolled learner sees the "You're enrolled" badge on the course detail page, and that the badge persists across page navigations.

**Covers**: EnrollmentCtaComponent (enrolled badge state), CourseService (`loadCourseDetail` enrollment query)

**Preconditions**:
- Learner is enrolled in the course (from EN-01 or admin enrollment)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Learner | Dashboard loads | ✅ |
| 2 | Navigate to the enrolled course detail | Course detail loads | ✅ |
| 3 | Verify enrolled badge | Green badge with Check icon: "You're enrolled" | ✅ |
| 4 | Verify badge position | Between course header/progress bar and lecture list | ✅ |
| 5 | Verify NO "Enroll Now" button | Badge replaces the enroll button | ✅ |
| 6 | Navigate to another page (e.g., course list) | Different page loads | ✅ |
| 7 | Navigate back to the enrolled course | Badge still shows "You're enrolled" (loaded from DB, not local state) | ✅ |

**Notes/Learnings**:
- `loadCourseDetail` runs a 3rd parallel query: `course_enrollments.select('id').eq('course_id', courseId).eq('user_id', userId).maybeSingle()`
- `isEnrolled: !!enrollmentRes.data` — boolean derived from whether the query returned a row
- The badge is a simple display component — no click handlers, no actions
- If not enrolled, the `@switch(enrollmentType())` block renders instead (open/password/invite cases)

---

## EN-05: Enrollment CTA Hidden for Editors

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ PASS |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that users with edit permissions (Platform Admin, Lecturer with can_edit) do NOT see the enrollment CTA — they have implicit content access.

**Covers**: CourseDetailPageComponent (`@if (!canEdit())` template guard), EnrollmentCtaComponent (`canEdit` input)

**Preconditions**:
- A course exists with at least one lecture

**Steps (Platform Admin)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Platform Admin (`et@calypso-commodities.com`) | Dashboard loads | ✅ |
| 2 | Navigate to any course detail | Course detail loads with "Edit" button and lecture management UI | ✅ |
| 3 | Verify NO enrollment CTA | No "Enroll Now" button, no password input, no "You're enrolled" badge, no invite-only info | ✅ |
| 4 | Verify enrollment manager IS visible | "Enrolled Users (N)" section shown (PA has `canManageEnrollments`) | ✅ |

**Steps (Lecturer with can_edit)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 5 | Log in as Lecturer (`lecturer-edit@calypso-commodities.com`) | Dashboard loads | ✅ |
| 6 | Navigate to the assigned course detail | Course detail loads with edit buttons on modules | ✅ |
| 7 | Verify NO enrollment CTA | No enrollment-related UI between header and lectures | ✅ |
| 8 | Verify NO enrollment manager | Enrollment manager only visible for PA/TA, not lecturers | ✅ |

**Notes/Learnings**:
- `canEdit()` computed: `is_platform_admin || courseId in lecturer_can_edit_course_ids`
- `canManageEnrollments()` computed: `is_platform_admin || is_tenant_admin` — different from `canEdit`
- Lecturers (even with can_edit) don't manage enrollments — that's an admin function
- The `@if (!canEdit())` guard wraps the entire CTA section, not individual CTA variants

---

## EN-06: Enrollment Manager — Platform Admin View

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ PASS |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the enrollment manager section is visible to Platform Admin, shows enrolled users in a table, and displays the correct count.

**Covers**: EnrollmentManagerComponent (init, `loadEnrolledUsers`, enrolled users table, empty state), CourseDetailPageComponent (`canManageEnrollments()` computed)

**Preconditions**:
- Logged in as Platform Admin
- A course exists (enrollment status doesn't matter — manager is always visible for PA)

**Steps (Empty State)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to a course with NO enrolled users | Course detail loads | ✅ |
| 2 | Scroll to enrollment manager section | Section visible below lectures, above delete course button, separated by border-top | ✅ |
| 3 | Verify section header | "ENROLLED USERS (0)" uppercase text with Users icon | ✅ |
| 4 | Verify email input + Add button | Email input (`placeholder="Enter user email to enroll"`) and teal "Add" button with UserPlus icon | ✅ |
| 5 | Verify empty state | Users icon (large, slate-300), "No users enrolled yet." text centered | ✅ |

**Steps (With Enrolled Users)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 6 | Navigate to a course that has enrolled users | Course detail loads | ✅ |
| 7 | Verify section header count updates | "ENROLLED USERS (N)" where N matches actual enrolled count | ✅ |
| 8 | Verify users table | Table with columns: Email, Name, Enrolled, (unenroll action) | ✅ |
| 9 | Verify table header row | "EMAIL", "NAME", "ENROLLED" uppercase headers in `bg-slate-50` | ✅ |
| 10 | Verify user row data | Email in slate-700, Name in slate-600 (or "—" if null), date in "D Mon YYYY" format (en-GB locale) | ✅ |
| 11 | Verify unenroll button per row | Trash2 icon in rose color on hover, `title="Unenroll user"` | ✅ |

**Notes/Learnings**:
- `canManageEnrollments()` returns true for `is_platform_admin || is_tenant_admin`
- Enrollment manager is positioned before the delete course section in the template
- `loadEnrolledUsers` queries `course_enrollments` with embedded `profiles(email, full_name)` select
- Date format uses `en-GB` locale: "12 Feb 2026"
- The manager loads users on `ngOnInit` via `#loadUsers()` — no manual refresh button needed

---

## EN-07: Enrollment Manager — Add User by Email

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ PASS |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that a Platform Admin can add a user to a course by entering their email in the enrollment manager, and that error cases (empty email, non-existent user, already enrolled) are handled.

**Covers**: EnrollmentManagerComponent (`onAddUser()`, `lookupUserByEmail`, `adminEnrollUser`, error states), CourseService (`lookupUserByEmail`, `adminEnrollUser`)

**Preconditions**:
- Logged in as Platform Admin
- A course exists, enrollment manager visible
- A learner exists in the same tenant who is NOT yet enrolled

**Steps (Success)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | In enrollment manager, enter email: `learner@calypso-commodities.com` | Email input accepts text | ✅ |
| 2 | Click "Add" button | Button shows "Adding..." loading state | ✅ |
| 3 | Wait for add to complete | User appears in enrolled users table | ✅ |
| 4 | Verify user row | Email: `learner@calypso-commodities.com`, Name: "Test Learner (Calypso)", Enrolled: today's date | ✅ |
| 5 | Verify count updates | Header changes from "(N)" to "(N+1)" | ✅ |
| 6 | Verify email input cleared | Input field is empty after successful add | ✅ |

**Steps (Error — Empty Email)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 7 | Leave email input empty, click "Add" | Error message: "Please enter an email address" in rose box below input | ✅ |
| 8 | Start typing in email field | Error message disappears | ✅ |

**Steps (Error — Non-Existent User)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 9 | Enter email: `nonexistent@calypso-commodities.com` | — | ✅ |
| 10 | Click "Add" | Error message: "No user found with this email in your tenant" | ✅ |

**Steps (Error — Already Enrolled)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 11 | Enter email of user already in the table (e.g., `learner@calypso-commodities.com` again) | — | ✅ |
| 12 | Click "Add" | Error message: "This user is already enrolled" | ✅ |

**Steps (Enter Key Submit)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 13 | Enter a valid email, press Enter key (don't click Add) | Same behavior as clicking "Add" — user enrolled | ✅ |

**Notes/Learnings**:
- `lookupUserByEmail` queries `profiles` by email + tenant_id — scoped to admin's own tenant
- `adminEnrollUser` performs direct INSERT into `course_enrollments` — TA/PA RLS policies allow this
- The "already enrolled" check is client-side (checks `enrolledUsers()` signal) — prevents unnecessary API call
- After successful add, `#loadUsers()` is called to refresh the table from DB
- The email input has `(keydown.enter)` binding for submit-on-enter

---

## EN-08: Enrollment Manager — Unenroll User

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ PASS |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that a Platform Admin can remove a user from a course by clicking the unenroll (trash) button, and that the table updates correctly.

**Covers**: EnrollmentManagerComponent (`onUnenroll()`), CourseService (`unenrollUser` — DELETE by enrollment ID)

**Preconditions**:
- Logged in as Platform Admin
- A course has at least one enrolled user (from EN-07)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to course with enrolled users | Enrollment manager shows table with users | ✅ |
| 2 | Note the current enrolled count | E.g., "ENROLLED USERS (2)" | ✅ |
| 3 | Click the trash icon (Unenroll user) on one user row | Row removed from table | ✅ |
| 4 | Verify count updates | Header changes from "(2)" to "(1)" | ✅ |
| 5 | Verify the removed user no longer appears in table | Only remaining users shown | ✅ |
| 6 | Unenroll all remaining users | Table replaced by empty state: Users icon + "No users enrolled yet." | ✅ |
| 7 | Verify count shows (0) | "ENROLLED USERS (0)" | ✅ |

**Verify Unenrollment Persists**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 8 | Refresh the page | Enrollment manager still shows the updated state | ✅ |
| 9 | Log in as the unenrolled learner, navigate to the course | Enrollment CTA reappears (e.g., "Enroll Now" for open course) — no longer shows "You're enrolled" | ✅ |

**Notes/Learnings**:
- `unenrollUser` performs DELETE by enrollment `id` (not user_id + course_id)
- After unenroll, `#loadUsers()` is called to refresh the table from DB
- No confirmation dialog for unenroll — action is immediate
- RLS policies: `ce_delete_platform_admin` allows PA to delete any enrollment, `ce_delete_tenant_admin` allows TA to delete within their tenant
- Unenrolling does NOT delete user progress — `user_progress` rows remain in case of re-enrollment

---

## EN-09: Enrollment Manager — Tenant Admin

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ PASS |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that a Tenant Admin can see the enrollment manager and manage enrollments for courses assigned to their tenant, but only for users within their own tenant.

**Covers**: CourseDetailPageComponent (`canManageEnrollments` includes `is_tenant_admin`), EnrollmentManagerComponent (tenant-scoped operations), RLS policies `ce_insert_tenant_admin`, `ce_delete_tenant_admin`

**Preconditions**:
- The test course is assigned to the Calypso Client tenant via `tenant_courses`
- Logged in as Tenant Admin (`admin@calypsoclient.com`)
- A learner exists in the client tenant (`learner@calypsoclient.com`)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Tenant Admin (`admin@calypsoclient.com`) | Dashboard loads | ✅ |
| 2 | Navigate to the test course detail | Course detail loads | ✅ |
| 3 | Verify enrollment manager visible | "ENROLLED USERS (N)" section with email input + Add button | ✅ |
| 4 | Verify NO "Edit" button on course | TA cannot edit content (canEdit = false) | ✅ |
| 5 | Verify enrollment CTA visible | TA is not an editor, so they see enrollment CTA (if not enrolled) | ✅ |
| 6 | Enter email: `learner@calypsoclient.com` in enrollment manager | — | ✅ |
| 7 | Click "Add" | Client learner enrolled, appears in table | ✅ |
| 8 | Verify user row | Email, name, enrolled date shown correctly | ✅ |

**Cross-Tenant Restriction**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 9 | Enter email: `learner@calypso-commodities.com` (different tenant) | — | ✅ |
| 10 | Click "Add" | Error: "No user found with this email in your tenant" (lookupUserByEmail scoped to TA's tenant_id) | ✅ |

**Unenroll**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 11 | Click unenroll on the client learner | User removed from table | ✅ |

**Notes/Learnings**:
- TA's `tenant_id` JWT claim scopes `lookupUserByEmail` — can only find users in their own tenant
- `ce_insert_tenant_admin` RLS policy: `tenant_id = claims.tenant_id` — TA can only enroll users from their tenant
- TA sees both enrollment CTA (for themselves) AND enrollment manager (for managing others) — the CTA is controlled by `canEdit`, the manager by `canManageEnrollments`
- TA can manage enrollments even for invite-only courses — this is the intended mechanism for invite enrollment

---

## EN-10: Enrollment Manager Hidden for Unauthorized

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ PASS |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that users without admin roles (Learner, Lecturer, CSM) do NOT see the enrollment manager section on the course detail page.

**Covers**: CourseDetailPageComponent (`@if (canManageEnrollments())` template guard)

**Preconditions**:
- A course exists with enrolled users

**Steps (Learner)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Learner (`learner@calypso-commodities.com`) | Dashboard loads | ✅ |
| 2 | Navigate to a course detail | Course detail loads | ✅ |
| 3 | Verify NO "Enrolled Users" section | No enrollment manager table, no email input, no "Add" button | ✅ |
| 4 | Verify enrollment CTA IS visible | Enroll button or badge shown (depending on enrollment status) | ✅ |

**Steps (Lecturer with can_edit)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 5 | Log in as Lecturer (`lecturer-edit@calypso-commodities.com`) | Dashboard loads | ✅ |
| 6 | Navigate to the assigned course detail | Course detail loads with edit buttons | ✅ |
| 7 | Verify NO "Enrolled Users" section | Lecturer cannot manage enrollments | ✅ |

**Notes/Learnings**:
- `canManageEnrollments` is `is_platform_admin || is_tenant_admin` — lecturers and CSMs are excluded
- This is by design: enrollment management is an administrative function, not a content function
- Lecturers manage content (modules, lectures); admins manage users (enrollments, assignments)
- The enrollment manager `<app-enrollment-manager>` element won't even be in the DOM for unauthorized users

---

## EN-11: Module Completion Gated by Enrollment

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ PASS |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that the "Mark as complete" button in the module viewer is only visible when the user is enrolled in the course. Unenrolled users can view content but cannot track progress.

**Covers**: ModuleViewerPageComponent (`canMarkComplete` computed — checks `courseDetail()?.isEnrolled`), CourseService (`markModuleComplete`)

**Preconditions**:
- A course with viewable modules (video, PDF, or markdown) exists
- Learner account available for testing

**Steps (Enrolled — Can Mark Complete)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Learner, enroll in the course (or already enrolled from EN-01) | Enrolled in course | ✅ |
| 2 | Navigate to a video/PDF/markdown module in the course | Module viewer loads with content | ✅ |
| 3 | Verify "Mark as complete" button visible | Button at bottom of module viewer, below content area | ✅ |
| 4 | Click "Mark as complete" | Button changes to "Completed" with Check icon, green styling | ✅ |
| 5 | Navigate to a different module (same course) | "Mark as complete" button visible on the new module (if not already completed) | ✅ |

**Steps (Unenrolled — Cannot Mark Complete)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 6 | Unenroll the learner (PA uses enrollment manager) or use a fresh unenrolled user | User not enrolled | ✅ |
| 7 | Navigate to a module in the same course (direct URL if needed) | Module viewer loads — content IS visible (RLS allows reading if tenant_courses exists) | ✅ |
| 8 | Verify NO "Mark as complete" button | Button is hidden — `canMarkComplete` returns false when `!isEnrolled` | ✅ |
| 9 | Verify module navigation still works | Previous/Next buttons functional | ✅ |
| 10 | Verify "Back to course" link works | Returns to course detail | ✅ |

**Steps (Quiz/Exam — Never Mark Complete)**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 11 | Navigate to a quiz module (if enrolled) | "Coming soon" placeholder shown | ✅ |
| 12 | Verify NO "Mark as complete" button | Quiz/exam use their own completion mechanism — not manual marking | ✅ |

**Notes/Learnings**:
- `canMarkComplete` computed logic: `viewer exists && courseDetail?.isEnrolled && type in [video, pdf, markdown, external_quiz]`
- `courseDetail()` is loaded by `loadModuleViewer()` if not already cached — so `isEnrolled` is available
- Content visibility is controlled by `tenant_courses` RLS (not enrollment) — unenrolled users CAN view modules
- Progress tracking requires enrollment — this is the business rule distinction
- Quiz and exam modules use grading-based completion (Phase 4B/5), not manual "mark as complete"
- External quiz modules DO show "Mark as complete" (manual completion until Phase 5B webhook)

---

## Bugs Found During E2E Testing

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | EnrollmentCtaComponent's `enrolling` signal stuck at `true` after failed password enrollment | Medium | Added `setError(message)` method to CTA component and used `viewChild` in parent to call it on error. The button remained disabled showing "..." indefinitely after wrong password was entered. |

**1 bug found** during E2E testing execution on 2026-02-12.

---

## Data Setup Notes

### Changing Course Enrollment Type

The enrollment type is a column on the `courses` table. Platform Admin can change it via the course edit form:
1. Navigate to course detail → click "Edit"
2. Change "Enrollment Type" dropdown (`open`, `password_protected`, `invite_only`)
3. For `password_protected`: enter a password (trigger `hash_course_password()` auto-hashes)
4. Click "Save Changes"

### Ensuring Course is Assigned to Client Tenant

For EN-09, the test course must be visible to the Calypso Client tenant:

```sql
-- Check if already assigned
SELECT * FROM tenant_courses tc
JOIN tenants t ON t.id = tc.tenant_id
WHERE t.domain = 'calypsoclient.com';

-- If not, assign it
INSERT INTO tenant_courses (tenant_id, course_id)
SELECT t.id, '<COURSE_ID>'::uuid
FROM tenants t WHERE t.domain = 'calypsoclient.com'
ON CONFLICT DO NOTHING;
```

### Cleaning Up Enrollments Between Test Runs

```sql
-- Remove all test enrollments for a specific course
DELETE FROM course_enrollments WHERE course_id = '<COURSE_ID>';

-- Remove enrollment for a specific user
DELETE FROM course_enrollments
WHERE course_id = '<COURSE_ID>'
AND user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com');
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-12 | Claude Code | EN-01 to EN-11 | 11 | 0 | All tests passed. 1 bug found and fixed (password enrollment button stuck). |
| 2026-02-14 | Claude (Playwright MCP) | EN-01 through EN-11 (regression) | 11 | 0 | Full regression — all 11 PASS. Verified: enrolled badge, open/password CTA, PA enrollment manager (3 users), TA enrollment manager (1 user, tenant-scoped), CTA hidden for editors. No regressions. |
| 2026-02-15 | Claude Opus 4.6 (Playwright MCP) | EN-01 through EN-11 (regression) | 11 | 0 | Full regression run. Verified: PA enrollment manager (3 enrolled users with Unenroll buttons), email+name+date columns, Add user input. Course detail shows Open badge, enrolled badge on course list. No regressions. |
| 2026-02-17 | Claude Opus 4.6 (Playwright MCP) | EN-01 through EN-11 (full regression) | 11 | 0 | Full re-test of all stories. All stories pass. No bugs found. |

---

## Notes and Learnings from E2E Testing

### Bug Found and Fixed

**Bug 1 (EN-02)**: EnrollmentCtaComponent's `enrolling` signal stuck at `true` after failed password enrollment. The CTA emits events to the parent, but the parent never communicated errors back. Fixed by adding `setError(message)` method to CTA and using `viewChild` in parent to call it on error. The button remained disabled showing "..." indefinitely.

### Key Observations

1. **Cross-tenant enrollment isolation works correctly:**
   - PA sees ALL enrolled users across all tenants (3 total in test)
   - TA sees only their own tenant's users (1 total)
   - No data leakage between tenants

2. **RPC error messages are user-friendly:**
   - `enroll_with_password` RPC returns clear errors: "Invalid course password"
   - No cryptic database error codes exposed to learners

3. **Read-only lecturer behavior:**
   - Lecturer (not enrolled, no can_edit) sees "Enroll Now" CTA — they're neither an editor nor enrolled, so the CTA correctly shows for them
   - This is expected behavior: lecturer role doesn't automatically grant course access unless they have can_edit on that specific course

4. **Course detail page works without authentication:**
   - Shows CTA for unauthenticated users
   - Hides enrollment manager (requires auth)
   - No auth guard on course detail route (by design — courses are browsable, content is gated)

5. **Enrollment manager behavior:**
   - Empty state shows centered "No users enrolled yet." message with Users icon
   - Table columns: Email, Name, Enrolled (date), Unenroll (trash icon)
   - Date format: "D Mon YYYY" (en-GB locale)
   - No confirmation dialog for unenroll (immediate action)

6. **Password-protected enrollment:**
   - Password field appears when enrollment type is "Password Protected"
   - Error clears on keydown in password input
   - Enter key submits the form (no need to click button)
   - `hash_course_password()` trigger auto-hashes passwords using bcrypt

7. **Module completion gating:**
   - "Mark as complete" button only visible when enrolled
   - Unenrolled users CAN view content (RLS uses `tenant_courses`, not enrollment)
   - Progress tracking requires enrollment (business rule distinction)
   - Quiz/exam modules don't show "Mark as complete" (use grading-based completion)

---

## References

| Document | Path |
|----------|------|
| Enrollment CTA Component | `frontend/src/app/features/courses/components/enrollment-cta.component.ts` |
| Enrollment Manager Component | `frontend/src/app/features/courses/components/enrollment-manager.component.ts` |
| Course Detail Page (enrollment integration) | `frontend/src/app/features/courses/pages/course-detail-page.component.ts` |
| Module Viewer (enrollment gating) | `frontend/src/app/features/courses/pages/module-viewer-page.component.ts` |
| Course Service (enrollment methods) | `frontend/src/app/core/services/course.service.ts` |
| Course Model (EnrolledUser, isEnrolled) | `frontend/src/app/core/models/course.model.ts` |
| Test Users Setup | `docs/e2e-user-stories/TEST_USERS.md` |
| Content Write Stories | `docs/e2e-user-stories/CONTENT_WRITE_USER_STORIES.md` |
| Development Approach | `docs/x_courses_development_approach.md` |
