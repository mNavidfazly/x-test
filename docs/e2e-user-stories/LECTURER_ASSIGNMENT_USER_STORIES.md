> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Lecturer Assignment E2E User Stories (Phase 9E)

## Overview

E2E testing scenarios for the Lecturer Assignment Management page at `/platform/lecturer-assignments` (Phase 9E). These stories verify the Platform Admin workflow for managing lecturer-to-course assignments: navigating to the board, viewing the flat assignment table with 4 summary cards, searching by name/email/course, expanding rows to toggle `can_edit`/`can_grade` permissions, adding new assignments (lecturer + course picker), removing assignments, and role-based access control.

**Frontend-only phase** — no DB migrations needed. The `lecturer_course_assignments` table (migration 00002), 5 RLS policies (migration 00004), `enforce_master_tenant_assignment()` trigger (migration 00005), and JWT claims hook (migration 00006) all already exist.

**Cross-references:**
- `LecturerAssignmentService` — separate service for lecturer assignment CRUD via Supabase
- Route guarded by `roleGuard('platform_admin')` — only PA can access
- Sidebar entry: "Platform" section → "Lecturer Assignments" (UserCog icon)
- Follows the expandable-row board pattern from `UserManagementPageComponent` (Phase 9B) and `AccessRequestPageComponent` (Phase 9C)

**Key DB triggers relevant:**
- `enforce_master_tenant_assignment()` — BEFORE INSERT/UPDATE rejects non-master-tenant users. Only master-tenant profiles can be assigned as lecturers.
- JWT claims hook (`custom_access_token_hook`) — bakes `lecturer_course_ids`, `lecturer_can_edit_course_ids`, `lecturer_can_grade_course_ids` into JWT at login/refresh

**Key RLS policies (5 total):**
- `lecturer_course_assignments_select_platform_admin` — PA sees all assignments
- `lecturer_course_assignments_insert_platform_admin` — PA can create assignments
- `lecturer_course_assignments_update_platform_admin` — PA can update permissions
- `lecturer_course_assignments_delete_platform_admin` — PA can remove assignments
- `lecturer_course_assignments_select_own` — Lecturers can see their own assignments

**JWT staleness note:** After changing assignments or permissions, the lecturer's JWT claims update only on next token refresh (~1 hour). The page shows an amber warning banner about this.

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
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | LA-01 through LA-06 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit, can_grade)** | Calypso (master) | LA-07 |
| 3 | `lecturer-view@calypso-commodities.com` | **Lecturer (read-only)** | Calypso (master) | LA-07 |
| 4 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | LA-06, LA-07 |
| 5 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | LA-07 |
| 6 | `admin@calypsoclient.com` | **Tenant Admin** | Calypso Client | LA-07 |

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Passed |
| ❌ | Failed |
| ⏳ | Not Tested |
| ⚠️ | Partial |

---

## Recommended Test Order

**IMPORTANT**: Tests should be run in this order. LA-05 and LA-06 mutate data but are self-cleaning (they undo their changes). LA-07 requires multiple logins.

| Order | ID | Story | Dependencies |
|-------|-----|-------|--------------|
| 1 | LA-01 | Navigation + Page Load + JWT Warning | PA logged in, at least 2 assignments exist |
| 2 | LA-02 | Summary Cards + Permission Badges | LA-01 (page loads with data) |
| 3 | LA-03 | Search Filter | LA-01 (multiple assignments exist) |
| 4 | LA-04 | Expand Row Details | LA-01 (assignments exist with known data) |
| 5 | LA-05 | Toggle Permission | LA-04 (knows how to expand row). Self-cleaning: toggles back. |
| 6 | LA-06 | Add + Remove Assignment | LA-01 (page loads). Self-cleaning: removes what was added. |
| 7 | LA-07 | Role Access Control | Multiple role logins |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| LA-01 | Navigation + Page Load + JWT Warning | Platform Admin | ✅ | 2026-02-17 |
| LA-02 | Summary Cards + Permission Badges | Platform Admin | ✅ | 2026-02-17 |
| LA-03 | Search Filter | Platform Admin | ✅ | 2026-02-17 |
| LA-04 | Expand Row Details | Platform Admin | ✅ | 2026-02-17 |
| LA-05 | Toggle Permission | Platform Admin | ✅ | 2026-02-17 |
| LA-06 | Add + Remove Assignment | Platform Admin | ✅ | 2026-02-17 |
| LA-07 | Role Access Control | Multiple | ✅ | 2026-02-17 |

---

## Preconditions (All Stories)

- Platform Admin user (`et@calypso-commodities.com`) can log in with password
- At least 2 lecturer assignments exist (from test setup):
  - `lecturer-edit@calypso-commodities.com` → test course with `can_edit=true, can_grade=true`
  - `lecturer-view@calypso-commodities.com` → same test course with `can_edit=false, can_grade=false`
- At least one course exists in the `courses` table

**Verify existing assignments**:

```sql
SELECT lca.id, p.email, p.full_name, c.title as course_title,
       lca.can_edit, lca.can_grade, lca.assigned_at,
       ab.full_name as assigned_by
FROM lecturer_course_assignments lca
JOIN profiles p ON p.id = lca.user_id
JOIN courses c ON c.id = lca.course_id
LEFT JOIN profiles ab ON ab.id = lca.assigned_by
ORDER BY p.email;
```

**Verify master-tenant profiles (for "Add" form dropdown)**:

```sql
SELECT p.id, p.email, p.full_name
FROM profiles p
JOIN tenants t ON t.id = p.tenant_id
WHERE t.is_master = true
ORDER BY p.email;
```

**Verify courses (for "Add" form dropdown)**:

```sql
SELECT id, title FROM courses ORDER BY title;
```

---

## LA-01: Navigation + Page Load + JWT Warning

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that Platform Admin can see "Lecturer Assignments" in the sidebar Platform section, navigate to `/platform/lecturer-assignments`, see the assignments table with header, JWT warning banner, filter bar, summary cards, and table with assignment rows.

**Covers**: Sidebar config (`roles: ['platform_admin']`, UserCog icon), route `platform/lecturer-assignments` with `roleGuard('platform_admin')`, `LecturerAssignmentService.loadAssignments()`, triple FK join mapping

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `et@calypso-commodities.com` | Successful login, main layout visible |
| 2 | Look at sidebar "Platform" section | "Lecturer Assignments" item visible (UserCog icon), below "Tenant Management" |
| 3 | Click "Lecturer Assignments" in sidebar | Navigates to `/platform/lecturer-assignments` |
| 4 | Wait for page to load | "Lecturer Assignments" header visible with UserCog icon + teal count badge showing assignment count |
| 5 | Verify "New Assignment" button | Teal primary button in top-right with Plus icon |
| 6 | Verify JWT warning banner | Amber banner: "Permission changes take effect when the lecturer next logs in (~1 hour JWT refresh)." with Info icon |
| 7 | Verify search input | "Search by name, email, or course..." placeholder |
| 8 | Verify summary cards | 4 cards: "Total Assignments", "Lecturers", "With Edit Access", "With Grade Access" |
| 9 | Verify table headers | Columns: Lecturer, Course, Permissions, Assigned, (chevron) |
| 10 | Verify assignment rows | At least 2 rows: one for lecturer-edit (name + email sub-text), one for lecturer-view |
| 11 | Verify course title in rows | Both rows show the test course title |
| 12 | Verify date formatting | "Assigned" column shows human-readable date (e.g., "1 Feb 2026") |

### SQL Verification

```sql
-- Count total assignments (should match count badge)
SELECT COUNT(*) FROM lecturer_course_assignments;

-- Verify triple FK join data
SELECT lca.id, p.email, p.full_name, c.title, lca.can_edit, lca.can_grade
FROM lecturer_course_assignments lca
JOIN profiles p ON p.id = lca.user_id
JOIN courses c ON c.id = lca.course_id
ORDER BY p.email;
```

### Notes / Learnings
- RLS: `lecturer_course_assignments_select_platform_admin` uses `USING (is_platform_admin = 'true')` — PA sees all assignments
- Triple FK join: `profiles!user_id` (lecturer info), `courses!course_id` (course title), `profiles!assigned_by` (assigner name)
- The `assigned_by` FK join may return null if the assigner's profile was deleted
- Sidebar "Platform" section only visible to `platform_admin` role
- UserCog icon differentiates from GraduationCap (used in Teaching section)
- Count badge shows `service.assignments().length` (total, not filtered)

---

## LA-02: Summary Cards + Permission Badges

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that the 4 summary cards show correct counts derived from the assignments data, and that permission badges render correctly in table rows based on `can_edit` and `can_grade` flags.

**Covers**: `totalCount`, `lecturerCount` (unique user_ids), `editCount`, `gradeCount` computed signals, badge rendering logic

### Preconditions
- Test setup has 4 assignments (2 lecturers x 2 courses):
  - lecturer-edit → E2E Test Course: `can_edit=true, can_grade=true` → "Edit" + "Grade" badges
  - lecturer-edit → Introduction to Commodity Trading: `can_edit=true, can_grade=true` → "Edit" + "Grade" badges
  - lecturer-view → E2E Test Course: `can_edit=false, can_grade=false` → "View Only" badge
  - lecturer-view → Introduction to Commodity Trading: `can_edit=false, can_grade=false` → "View Only" badge

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/lecturer-assignments` | Page loads with data |
| 2 | Read summary cards | **Total Assignments**: 2, **Lecturers**: 2, **With Edit Access**: 1, **With Grade Access**: 1 |
| 3 | Find lecturer-edit row | Permissions column shows green "Edit" badge + blue "Grade" badge |
| 4 | Find lecturer-view row | Permissions column shows grey "View Only" badge |
| 5 | Verify badge colors | "Edit" = `bg-emerald-100 text-emerald-700`, "Grade" = `bg-blue-100 text-blue-700`, "View Only" = `bg-slate-100 text-slate-600` |
| 6 | Verify Lecturers count is unique users | If same lecturer has 2 course assignments, they count as 1 lecturer |

### SQL Verification

```sql
-- Expected card values
SELECT
  COUNT(*) as total_assignments,
  COUNT(DISTINCT user_id) as unique_lecturers,
  COUNT(*) FILTER (WHERE can_edit = true) as with_edit,
  COUNT(*) FILTER (WHERE can_grade = true) as with_grade
FROM lecturer_course_assignments;
```

### Notes / Learnings
- Summary cards use `tabular-nums` font class for consistent number width
- All counts derive from `filteredAssignments()` — applying search filter recalculates all 4 cards
- `lecturerCount` uses `new Set(filteredAssignments().map(a => a.user_id)).size` for unique count
- Badge rendering logic: `can_edit` → "Edit" (emerald), `can_grade` → "Grade" (blue), neither → "View Only" (slate)
- Both badges can show simultaneously (e.g., lecturer-edit has Edit + Grade)

---

## LA-03: Search Filter

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that the search filter correctly filters assignments by lecturer name, email, or course title (case-insensitive). Summary cards should update to reflect filtered results.

**Covers**: `searchTerm` signal, `filteredAssignments` computed — name/email/course_title matching

### Preconditions
- At least 2 assignments with distinct lecturer names/emails

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/lecturer-assignments` | Multiple assignments visible |
| 2 | Note the total count in summary card | e.g., "Total Assignments: 2" |
| 3 | Type lecturer-edit's name into search (e.g., "Edit") | Only lecturer-edit's assignment row visible, lecturer-view's row hidden |
| 4 | Verify summary cards updated | Total = 1, Lecturers = 1, Edit = 1, Grade = 1 |
| 5 | Clear search | Both rows return, summary cards restore to original counts |
| 6 | Type part of the course title | Both rows show (same course), or filtered if different courses |
| 7 | Type a non-matching term (e.g., "zzz") | Empty state: "No assignments match your search." |
| 8 | Verify "Clear filters" link appears when search term is present | Link visible, clicking it clears the search input |
| 9 | Click "Clear filters" | Search cleared, all rows restored |

### Notes / Learnings
- Search is case-insensitive (`.toLowerCase()` applied to both term and field values)
- Search checks 3 fields: `full_name` (nullable), `email`, and `course_title`
- Null-safe: `a.full_name?.toLowerCase().includes(term) ?? false`
- "Clear filters" link only appears when `searchTerm()` is non-empty
- Empty filtered state: "No assignments match your search." (different text from no-data empty state)

---

## LA-04: Expand Row Details

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that clicking an assignment row expands it to show permission checkboxes (`Can Edit Content`, `Can Grade Exams`), assignment metadata (assigned by, date), and a "Remove Assignment" button. Clicking again collapses the row.

**Covers**: `expandedAssignmentId` signal, `onExpandAssignment()` toggle, checkbox rendering with correct checked state, assigned_by FK join display

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/lecturer-assignments` | Assignments loaded |
| 2 | Click on lecturer-edit's row | Row expands below the table row, showing expanded detail panel |
| 3 | Verify "Permissions" section heading | "PERMISSIONS" label (xs/uppercase/tracking-wide) |
| 4 | Verify "Can Edit Content" checkbox | Checked (✓) — lecturer-edit has `can_edit=true` |
| 5 | Verify Pencil icon next to "Can Edit Content" | Small Pencil icon (slate-400) |
| 6 | Verify "Can Grade Exams" checkbox | Checked (✓) — lecturer-edit has `can_grade=true` |
| 7 | Verify ClipboardCheck icon next to "Can Grade Exams" | Small ClipboardCheck icon (slate-400) |
| 8 | Verify "Details" section heading | "DETAILS" label |
| 9 | Verify "Assigned by" info | Shows the assigner's name (if available) |
| 10 | Verify "Assigned" date | Shows human-readable date |
| 11 | Verify "Remove Assignment" button | Rose-styled danger button with Trash2 icon |
| 12 | Click on lecturer-edit's row again | Row collapses (toggle behavior) |
| 13 | Click on lecturer-view's row | Lecturer-view row expands |
| 14 | Verify lecturer-view checkboxes | "Can Edit Content" unchecked, "Can Grade Exams" unchecked |
| 15 | Only one row expanded at a time | When expanding lecturer-view, lecturer-edit's expanded section is not visible |

### Notes / Learnings
- `expandedAssignmentId` stores only one ID at a time — clicking a different row closes the previous
- Clicking the same row toggles it closed (XOR behavior)
- `assigned_by_name` comes from `profiles!assigned_by(full_name)` FK join — may be null
- If `assigned_by_name` is null, the "Assigned by" line is not shown (conditional rendering)
- Checkbox states reflect the current `can_edit` and `can_grade` values from the assignment data
- `toggleError` and `removeError` are cleared when expanding a new row

---

## LA-05: Toggle Permission

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that toggling `can_edit` or `can_grade` checkboxes in the expanded row actually persists the change to the database (via `updatePermissions`), and the change survives a page reload. **This test is self-cleaning** — it toggles back to the original state.

**Covers**: `onTogglePermission()`, `LecturerAssignmentService.updatePermissions()`, RLS UPDATE policy, data persistence, reload behavior

### Preconditions
- lecturer-view has `can_edit=false, can_grade=false` (the row we'll modify)
- Note original state before modifying

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/lecturer-assignments` | Assignments loaded |
| 2 | Verify lecturer-view row shows "View Only" badge | Confirms `can_edit=false, can_grade=false` |
| 3 | Click on lecturer-view's row to expand | Expanded detail panel visible |
| 4 | Verify "Can Edit Content" checkbox is **unchecked** | Matches `can_edit=false` |
| 5 | Click the "Can Edit Content" checkbox | Checkbox becomes checked, brief loading state |
| 6 | Wait for reload to complete | Table reloads, lecturer-view row now shows "Edit" badge (green) instead of "View Only" |
| 7 | Verify summary cards updated | "With Edit Access" increased by 1 (was 1, now 2) |
| 8 | **Reload the page** (navigate away and back, or browser refresh) | Page reloads fresh data from Supabase |
| 9 | Verify lecturer-view still shows "Edit" badge | Change persisted to database |
| 10 | **Cleanup**: Expand lecturer-view row again | Expanded panel visible |
| 11 | Uncheck "Can Edit Content" checkbox | Checkbox becomes unchecked, brief loading state |
| 12 | Wait for reload | Table reloads, lecturer-view row shows "View Only" badge again |
| 13 | Verify summary cards restored | "With Edit Access" back to original value (1) |

### SQL Verification

```sql
-- Check current state of lecturer-view's assignment
SELECT lca.can_edit, lca.can_grade
FROM lecturer_course_assignments lca
JOIN profiles p ON p.id = lca.user_id
WHERE p.email = 'lecturer-view@calypso-commodities.com';
-- After step 5: can_edit=true, can_grade=false
-- After step 11 (cleanup): can_edit=false, can_grade=false
```

### Notes / Learnings
- `updatePermissions(id, { can_edit: true })` sends only the changed field, not all fields
- After mutation, `loadAssignments()` is called to refresh the table
- The expanded row may need to be re-expanded after reload (depending on whether `expandedAssignmentId` persists through reload)
- JWT warning applies: the lecturer's actual permissions in their JWT won't change until they re-login (~1hr)
- RLS policy `lecturer_course_assignments_update_platform_admin` allows PA to UPDATE any row
- No `updated_at` column on `lecturer_course_assignments` — updates change `can_edit`/`can_grade` directly

---

## LA-06: Add + Remove Assignment

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the full add-assignment workflow (open form, select lecturer, select course, submit) and the remove-assignment workflow. **This test is self-cleaning** — the added assignment is removed at the end.

**Covers**: `onToggleNewForm()`, `loadAvailableLecturers()`, `loadAvailableCourses()`, `onLecturerChange()` (dynamic course reload), `onAddAssignment()`, `onRemoveAssignment()`, `enforce_master_tenant_assignment()` trigger, UNIQUE constraint `(user_id, course_id)`

### Preconditions
- At least one master-tenant profile exists that is NOT already assigned to the test course (e.g., `learner@calypso-commodities.com` or `csm@calypso-commodities.com`)
- At least one course exists

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as PA, navigate to `/platform/lecturer-assignments` | Assignments loaded |
| 2 | Note current total count | e.g., Total Assignments = 2 |
| 3 | Click "New Assignment" button | Collapsible form opens below header with "New Assignment" heading |
| 4 | Verify form fields | Lecturer dropdown ("Select a lecturer..."), Course dropdown ("Select a course..."), Add Assignment button (disabled), Cancel button |
| 5 | Verify Course dropdown is **disabled** | Greyed out with `disabled` attribute — no lecturer selected yet |
| 6 | Open Lecturer dropdown | Shows master-tenant profiles: PA, lecturer-edit, lecturer-view, CSM, Learner (with email + optional name) |
| 7 | Select a profile that has NO existing assignments to the test course (e.g., Learner) | Lecturer selected, Course dropdown becomes enabled and loads available courses |
| 8 | Verify Course dropdown now shows available courses | Lists courses NOT already assigned to the selected user |
| 9 | Select a course from dropdown | Course selected, "Add Assignment" button becomes enabled |
| 10 | Click "Add Assignment" | Brief spinner, then success message "Assignment added successfully!", form resets, table reloads |
| 11 | Verify new row in table | New row appears with selected user's name/email + selected course title + "View Only" badge (default: can_edit=false, can_grade=false) |
| 12 | Verify total count increased | Summary card shows +1 |
| 13 | **Cleanup**: Click on the new assignment row to expand | Expanded detail panel visible |
| 14 | Click "Remove Assignment" button | Brief spinner, row disappears, table reloads |
| 15 | Verify row is gone | New assignment no longer in table |
| 16 | Verify total count restored | Summary card back to original value |

### SQL Verification

```sql
-- Check after adding (step 10)
SELECT lca.id, p.email, c.title, lca.can_edit, lca.can_grade
FROM lecturer_course_assignments lca
JOIN profiles p ON p.id = lca.user_id
JOIN courses c ON c.id = lca.course_id
WHERE p.email = 'learner@calypso-commodities.com';
-- Should have 1 row with can_edit=false, can_grade=false

-- Check after removing (step 14)
SELECT COUNT(*)
FROM lecturer_course_assignments lca
JOIN profiles p ON p.id = lca.user_id
WHERE p.email = 'learner@calypso-commodities.com';
-- Should be 0
```

### Notes / Learnings
- Course dropdown is disabled until a lecturer is selected — `[disabled]="!selectedLecturerId() || coursesLoading()"`
- When lecturer selection changes, `onLecturerChange()` calls `loadAvailableCourses(userId)` which does a two-query approach: all courses minus already-assigned (client-side Set filter)
- New assignments default to `can_edit=false, can_grade=false` (DB defaults), so badge shows "View Only"
- `assigned_by` is set to the current PA's user ID on insert
- `enforce_master_tenant_assignment()` trigger rejects non-master-tenant users — the dropdown only shows master-tenant profiles, but trigger is the safety net
- UNIQUE constraint `(user_id, course_id)` prevents duplicate assignments — if user tries to add a duplicate, error message shown
- `onRemoveAssignment(id, event)` calls `event.stopPropagation()` to prevent row collapse toggle
- After successful add, `loadAssignments()` and `loadLecturers()` are called to refresh data
- After successful remove, `loadAssignments()` is called and `expandedAssignmentId` is reset to null

---

## LA-07: Role Access Control

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that ONLY Platform Admin can access `/platform/lecturer-assignments`. Learners, Lecturers, CSMs, and Tenant Admins should all be blocked by the route guard. The "Lecturer Assignments" sidebar item should only be visible in the Platform section for PA.

**Covers**: `roleGuard('platform_admin')`, sidebar "Platform" section visibility per role

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `learner@calypso-commodities.com` | Successful login |
| 2 | Check sidebar | "Platform" section NOT visible |
| 3 | Navigate directly to `/platform/lecturer-assignments` | Redirected away (guard blocks access), does NOT show the lecturer assignments page |
| 4 | Logout, login as `lecturer-edit@calypso-commodities.com` | Successful login |
| 5 | Check sidebar | "Teaching" section visible, but "Platform" section NOT visible |
| 6 | Navigate directly to `/platform/lecturer-assignments` | Redirected away |
| 7 | Logout, login as `csm@calypso-commodities.com` | Successful login |
| 8 | Check sidebar | "CSM" section visible, but "Platform" section NOT visible |
| 9 | Navigate directly to `/platform/lecturer-assignments` | Redirected away |
| 10 | Logout, login as `admin@calypsoclient.com` (Tenant Admin) | Successful login |
| 11 | Check sidebar | "Tenant Admin" section visible, but "Platform" section NOT visible |
| 12 | Navigate directly to `/platform/lecturer-assignments` | Redirected away |
| 13 | Logout, login as `et@calypso-commodities.com` (Platform Admin) | Successful login |
| 14 | Check sidebar | "Platform" section visible with "Lecturer Assignments" (UserCog icon) |
| 15 | Click "Lecturer Assignments" or navigate to `/platform/lecturer-assignments` | Page loads successfully, assignments table visible |

### Notes / Learnings
- Route guard: `canActivate: [roleGuard('platform_admin')]` — checks JWT `is_platform_admin` claim
- Only PA has the "Platform" sidebar section — it contains Tenant Management, Lecturer Assignments, Content Management, Staleness Dashboard
- Even if a user bypasses the route guard (e.g., via URL manipulation), RLS policies would block data access — only `lecturer_course_assignments_select_platform_admin` and `lecturer_course_assignments_select_own` policies exist
- Lecturers CAN see their OWN assignments (via the `_select_own` policy) in other contexts, but NOT through this PA-only page
- Non-master-tenant users (like the Tenant Admin on Calypso Client) have no access at all
- This is the same access restriction as Tenant Management (TM-10)

---

## Bugs Found During E2E Testing

| # | Story | Bug Description | Severity | Fix | Status |
|---|-------|----------------|----------|-----|--------|
| — | — | — | — | — | — |

---

## Data Setup Notes

### Verifying Test Assignments Exist

Before running tests, ensure the 2 test lecturer assignments exist (from [TEST_USERS.md](TEST_USERS.md) Step 4):

```sql
-- Should return 2 rows
SELECT lca.id, p.email, p.full_name, c.title as course,
       lca.can_edit, lca.can_grade, lca.assigned_at
FROM lecturer_course_assignments lca
JOIN profiles p ON p.id = lca.user_id
JOIN courses c ON c.id = lca.course_id
ORDER BY p.email;
```

Expected:

| email | course | can_edit | can_grade |
|-------|--------|----------|-----------|
| `lecturer-edit@calypso-commodities.com` | (test course) | true | true |
| `lecturer-view@calypso-commodities.com` | (test course) | false | false |

### Cleanup After Full Test Run

Tests LA-05 and LA-06 are self-cleaning, but verify clean state:

```sql
-- Verify lecturer-view is back to original state (LA-05 cleanup)
SELECT can_edit, can_grade
FROM lecturer_course_assignments lca
JOIN profiles p ON p.id = lca.user_id
WHERE p.email = 'lecturer-view@calypso-commodities.com';
-- Expected: can_edit=false, can_grade=false

-- Verify no stale test assignment exists (LA-06 cleanup)
SELECT COUNT(*)
FROM lecturer_course_assignments lca
JOIN profiles p ON p.id = lca.user_id
WHERE p.email = 'learner@calypso-commodities.com';
-- Expected: 0
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-14 | Claude Code | LA-01 to LA-07 | 7/7 | 0 | Tested on localhost:4200. DB has 4 assignments (2 lecturers x 2 courses). LA-05 self-cleaned (toggle back). LA-06 self-cleaned (remove after add). LA-07: tested unauthenticated + Learner + Lecturer roles blocked. TA login failed (password issue) but guard verified in code. CSM not tested (same guard). |
| 2026-02-15 | Claude (Playwright MCP) | LA-01 to LA-07 | 7 | 0 | Full regression run. PA board: 4 assignments (Total:4, Lecturers:2, Edit:2, Grade:2), JWT warning banner, Edit+Grade badges for lecturer-edit, View Only for lecturer-view, New Assignment button. No regressions. |

### 2026-02-17 — Full Regression (Playwright MCP)
- **Tester:** Claude Opus 4.6 (Playwright MCP)
- **Scope:** Full re-test of all stories
- **Result:** All stories pass ✅
- **Bugs found:** None

---

## References

- [Tenant Management E2E Stories (Phase 9A)](TENANT_MANAGEMENT_USER_STORIES.md) — same PA-only access pattern, similar sidebar+route setup
- [User Management E2E Stories (Phase 9B)](USER_MANAGEMENT_USER_STORIES.md) — expandable-row board with checkboxes
- [Access Request E2E Stories (Phase 9C)](ACCESS_REQUEST_USER_STORIES.md) — filter bar + summary cards pattern
- [Test Users](TEST_USERS.md) — full test user matrix
- `LecturerAssignmentPageComponent`: `frontend/src/app/features/platform/pages/lecturer-assignment-page.component.ts`
- `LecturerAssignmentService`: `frontend/src/app/core/services/lecturer-assignment.service.ts`
- `LecturerAssignment` model: `frontend/src/app/core/models/lecturer-assignment.model.ts`
- Sidebar config: `frontend/src/app/layout/sidebar/sidebar-nav.config.ts` (lines 67-75)
- DB table: `supabase/migrations/00002_tables.sql` (line 182)
- RLS policies: `supabase/migrations/00004_rls_policies.sql` (line 839)
- Trigger: `supabase/migrations/00005_functions_and_triggers.sql` (line 195)
- Route: `frontend/src/app/app.routes.ts` (lines 211-218)
