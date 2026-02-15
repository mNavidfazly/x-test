> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Issue Management Board E2E User Stories (Phase 7B)

## Overview

E2E testing scenarios for the Issue Management Board page at `/teaching/issues` (Phase 7B). These stories verify the lecturer/admin workflow for managing reported issues: navigating to the board, viewing issues table with 5 summary cards, filtering by search/course/status/type, expanding a row to change status and add internal notes, resolving issues (auto-sets `resolved_by`/`resolved_at`), learner-side verification after status change, and role-based access control.

**Frontend-only phase** — no DB migrations needed. All 6 RLS policies (`issues_select_platform_admin`, `issues_select_csm`, `issues_select_lecturer`, `issues_insert_own`, `issues_update_platform_admin`, `issues_update_lecturer`), the `issues_safe` view, and 2 notification triggers (`notify_new_issue`, `notify_issue_resolved`) already exist (migrations 00004-00010).

**Cross-references:**
- Phase 7A (Issue Reporting — Learner Side) created the learner issue-reporting UI — [ISSUE_REPORTING_USER_STORIES.md](ISSUE_REPORTING_USER_STORIES.md)
- `IssueService` is extended (not separate) — board signals + methods added to the existing service
- Route guarded by `roleGuard('lecturer', 'platform_admin')` — learners/TA/CSM are blocked
- Follows the same board pattern as `QuestionsBoardPageComponent` (Phase 6C)

**Key DB triggers tested:**
- `notify_issue_resolved()` — fires when `status` changes to `resolved` (notifies the reporter)
- `notify_new_issue()` — fires on INSERT into `issues` (notifies lecturers/admins — tested in Phase 7A)

**Key RLS policies:**
- `issues_select_lecturer` — lecturer sees issues on assigned courses (cross-tenant)
- `issues_select_platform_admin` — PA sees all issues
- `issues_update_lecturer` — lecturer can update issues on assigned courses
- `issues_update_platform_admin` — PA can update any issue

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-courses-v2.vercel.app |
| **Backend URL** | https://x-courses-v2-production.up.railway.app |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Primary Test User** | lecturer-edit@calypso-commodities.com (Lecturer, can_edit + can_grade) |
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
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | IM-02, IM-08, IM-12 |
| 2 | `lecturer-edit@calypso-commodities.com` | **Lecturer (can_edit, can_grade)** | Calypso (master) | IM-01, IM-03, IM-04, IM-05, IM-06, IM-07, IM-10, IM-11 |
| 3 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | IM-09 (status verification), IM-12 |
| 4 | `csm@calypso-commodities.com` | **CSM** | Calypso (master) | IM-12 |

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
| 1 | IM-01 | Navigation + Page Load | Lecturer logged in, at least one issue exists |
| 2 | IM-02 | Platform Admin Sees All Issues | PA logged in, issues from multiple courses |
| 3 | IM-03 | Filter by Search | IM-01 (page loads with data) |
| 4 | IM-04 | Filter by Course, Status, and Type | IM-01 (multiple issues exist with varied types/statuses) |
| 5 | IM-05 | Summary Cards | IM-01 (issues in various statuses) |
| 6 | IM-06 | Investigate Open Issue + Add Internal Notes | IM-01 (open issue exists) |
| 7 | IM-07 | Verify Internal Notes Persist | IM-06 (internal notes just saved) |
| 8 | IM-08 | Resolve Issue with Auto-Resolution Fields | IM-06 or IM-07 (investigating issue exists) |
| 9 | IM-09 | Learner Sees Status Change on My Issues | IM-08 (issue resolved) |
| 10 | IM-10 | Close Issue | IM-08 (resolved issue exists, or another open issue) |
| 11 | IM-11 | Clear Filters | IM-01 (page loads with data) |
| 12 | IM-12 | Role Access Control | Multiple role logins |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| IM-01 | Navigation + Page Load | Lecturer | ✅ | 2026-02-15 |
| IM-02 | Platform Admin Sees All Issues | Platform Admin | ✅ | 2026-02-15 |
| IM-03 | Filter by Search | PA (as Lecturer) | ✅ | 2026-02-15 |
| IM-04 | Filter by Course, Status, and Type | PA (as Lecturer) | ✅ | 2026-02-15 |
| IM-05 | Summary Cards | PA (as Lecturer) | ✅ | 2026-02-15 |
| IM-06 | Investigate Open Issue + Add Internal Notes | Platform Admin | ✅ | 2026-02-15 |
| IM-07 | Verify Internal Notes Persist | Platform Admin | ✅ | 2026-02-15 |
| IM-08 | Resolve Issue with Auto-Resolution Fields | Platform Admin | ✅ | 2026-02-15 |
| IM-09 | Learner Sees Status Change on My Issues | Learner | ✅ | 2026-02-15 |
| IM-10 | Close Issue | Lecturer | ✅ | 2026-02-15 |
| IM-11 | Clear Filters | Lecturer | ✅ | 2026-02-15 |
| IM-12 | Role Access Control | Multiple | ✅ | 2026-02-15 |

---

## Preconditions (All Stories)

- At least one course with modules exists and is assigned to learner's tenant via `tenant_courses`
- Learner has reported at least one issue (from Phase 7A testing or created via SQL)
- Lecturer has `lecturer_course_assignments` row for the course (used by RLS to scope issues)

**Ensure issues exist** (if not from Phase 7A testing):

1. Login as `learner@calypso-commodities.com`
2. Navigate to a course → module viewer
3. Click "Report Issue" button between "Ask an Expert" and "Discussion"
4. Select issue type, write description, submit
5. Repeat for different types and modules for filter testing

**Alternate: Create test issues via SQL**:
```sql
-- Get IDs needed
SELECT id, email FROM profiles WHERE email IN (
  'learner@calypso-commodities.com',
  'lecturer-edit@calypso-commodities.com'
);

SELECT c.id as course_id, c.title, m.id as module_id, m.title as module_title
FROM courses c
JOIN modules m ON m.course_id = c.id
LIMIT 5;

SELECT id FROM tenants WHERE domain = 'calypso-commodities.com';

-- Insert test issues with different types and statuses (use actual UUIDs from above)
INSERT INTO issues (user_id, tenant_id, course_id, module_id, issue_type, description, status)
VALUES
  ('<LEARNER_ID>', '<TENANT_ID>', '<COURSE_1_ID>', '<MODULE_1_ID>', 'content_error', 'Typo on slide 3 — recieve should be receive', 'open'),
  ('<LEARNER_ID>', '<TENANT_ID>', '<COURSE_1_ID>', '<MODULE_2_ID>', 'technical', 'Video player does not load on Safari', 'open'),
  ('<LEARNER_ID>', '<TENANT_ID>', '<COURSE_1_ID>', NULL, 'accessibility', 'Screen reader cannot read the chart on module 5', 'open'),
  ('<LEARNER_ID>', '<TENANT_ID>', '<COURSE_2_ID>', NULL, 'other', 'General feedback about course difficulty', 'open');
```

**Cleanup SQL** (run before testing to ensure clean state):
```sql
-- Check existing issues
SELECT i.id, i.description, i.issue_type, i.status, i.internal_notes,
       p.email as reporter_email, c.title as course, m.title as module
FROM issues i
JOIN profiles p ON p.id = i.user_id
JOIN courses c ON c.id = i.course_id
LEFT JOIN modules m ON m.id = i.module_id
ORDER BY i.created_at DESC;

-- Reset all issues to open (revert investigating/resolved/closed)
UPDATE issues SET status = 'open', internal_notes = NULL,
  resolved_by = NULL, resolved_at = NULL
WHERE course_id IN (
  SELECT course_id FROM lecturer_course_assignments
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
);

-- Delete issue-resolved notifications (to re-test trigger)
DELETE FROM notifications WHERE type = 'issue_resolved';
```

---

## IM-01: Navigation + Page Load

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that a lecturer can see "Issue Management" in the sidebar Teaching section, navigate to `/teaching/issues`, and see the issues table with summary cards and filter bar.

**Covers**: Sidebar config (`roles: ['lecturer', 'platform_admin']`), route `teaching/issues` with `roleGuard`, `IssueService.loadBoardIssues()`, reporter profile FK join, course/module FK join

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `lecturer-edit@calypso-commodities.com` | Successful login, main layout visible |
| 2 | Look at sidebar | "Teaching" section visible with "Issue Management" item (Flag icon) |
| 3 | Click "Issue Management" in sidebar | Navigates to `/teaching/issues` |
| 4 | Wait for page to load | "Issue Management" header visible with Flag icon |
| 5 | Verify open count badge in header | If open issues exist, amber badge shows "N open" next to title |
| 6 | Verify filter bar | Search input ("Search by reporter or description..."), course dropdown ("All Courses"), status dropdown ("All Status"), type dropdown ("All Types") visible |
| 7 | Verify summary cards | 5 cards: "Total" (slate), "Open" (amber), "Investigating" (blue), "Resolved" (emerald), "Closed" (slate-600) with numeric values |
| 8 | Verify table headers | Table headers: Reporter, Course, Type, Description, Reported, Status |
| 9 | Verify at least one issue row | Reporter email (+ name below), course title, issue type label, truncated description, relative time, status badge |

### SQL Verification
```sql
-- Verify lecturer assignment
SELECT lca.course_id, c.title, lca.can_edit, lca.can_grade
FROM lecturer_course_assignments lca
JOIN courses c ON c.id = lca.course_id
WHERE lca.user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com');

-- Verify issues exist for those courses
SELECT i.id, p.email, c.title, i.issue_type, i.status, i.description
FROM issues i
JOIN profiles p ON p.id = i.user_id
JOIN courses c ON c.id = i.course_id
WHERE i.course_id IN (
  SELECT course_id FROM lecturer_course_assignments
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
)
ORDER BY i.created_at DESC;
```

### Notes / Learnings
- RLS automatically scopes: lecturer sees issues only for assigned courses (cross-tenant)
- Courses dropdown is derived from issue data (Map dedup + alphabetical sort)
- `reporter:profiles!user_id(full_name, email)` — FK disambiguation because `issues` has two FK refs to `profiles` (user_id + resolved_by)
- Null-safe reporter display: if `profiles` join returns null (RLS gap), shows "[Unknown]" (CM-BUG-01 pattern)
- Issue Management has 4 filters (search/course/status/type) vs Questions Board's 3 (search/course/status)

---

## IM-02: Platform Admin Sees All Issues

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that Platform Admin sees ALL issues across all courses and tenants (no RLS scoping limitation).

**Covers**: PA RLS policies on `issues`, cross-course visibility, sidebar Teaching section visible for PA

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `et@calypso-commodities.com` (Platform Admin) | Successful login |
| 2 | Verify sidebar | "Teaching" section visible with "Issue Management" (Flag icon) |
| 3 | Click "Issue Management" | Page loads at `/teaching/issues` |
| 4 | Verify issue count | Total count matches all issues in DB (across all courses/tenants) |
| 5 | Verify course dropdown | Shows all courses that have issues (may be more than lecturer sees) |

### SQL Verification
```sql
-- Count all issues (PA should see this many)
SELECT COUNT(*) FROM issues;

-- Compare with lecturer's scoped view
SELECT COUNT(*) FROM issues
WHERE course_id IN (
  SELECT course_id FROM lecturer_course_assignments
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
);
```

### Notes / Learnings
- If PA count equals lecturer count, that's expected when all issues happen to be in lecturer's assigned courses
- `issues_select_platform_admin`: `USING (is_platform_admin = 'true')` — unconditional
- PA can also update any issue via `issues_update_platform_admin`

---

## IM-03: Filter by Search

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that the search filter correctly filters issues by reporter email, reporter name, or description text.

**Covers**: `searchTerm` signal, `filteredIssues` computed — email/name/description matching (case-insensitive)

### Preconditions
- At least 2 issues from different reporters (or with distinct description text)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/issues` | Page loads with multiple issues |
| 2 | Note the total issue count | e.g., "Total: 4" in summary card |
| 3 | Type a reporter's email (partial) into search, e.g., "learner" | Table filters to rows where reporter email contains "learner" |
| 4 | Verify summary cards update | Total/Open/Investigating/Resolved/Closed counts reflect filtered rows |
| 5 | Clear the search, type a description keyword, e.g., "typo" | Filters by description text match |
| 6 | Clear the search, type a reporter name, e.g., "Test" | Filters by reporter full_name match |
| 7 | Click "Clear filters" link | All issues visible again, original count restored |

### Notes / Learnings
- Search is case-insensitive (`.toLowerCase()` applied to both search term and field values)
- "Clear filters" link only appears when at least one filter is active (search term OR course OR status != all OR type != all)
- Search checks three fields: `reporter.email`, `reporter.full_name`, `description`

---

## IM-04: Filter by Course, Status, and Type

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that course dropdown, status dropdown, and **type dropdown** (unique to Issue Management) correctly filter issues, and that filters can be combined.

**Covers**: `selectedCourseId` signal, `statusFilter` signal, `typeFilter` signal, filter combination (AND logic)

### Preconditions
- At least 2 different courses with issues
- At least 2 different issue types (e.g., content_error + technical)
- At least one open + one investigating issue (set via IM-06 or SQL)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/issues` | Multiple issues from different courses visible |
| 2 | Select a specific course from the course dropdown | Only issues for that course shown; summary cards update |
| 3 | Additionally select "Content Error" from the type dropdown | Only content_error issues for the selected course shown |
| 4 | Change type back to "All Types" | Shows all types for the selected course |
| 5 | Select "Open" from status dropdown | Only open issues for the selected course shown |
| 6 | Change status to "Investigating" | Only investigating issues for the selected course shown (or empty state if none) |
| 7 | Change status back to "All Status" | Shows all statuses for the selected course |
| 8 | Select "All Courses" | All issues visible again |
| 9 | Click "Clear filters" | All filters reset to defaults |

### Notes / Learnings
- Course dropdown options are derived from issue data (only courses with at least one issue appear)
- Type dropdown has 4 options: Content Error, Technical, Accessibility, Other
- Multiple filters combine with AND logic
- Empty state shows "No issues found." with Flag icon when all issues are filtered out
- Type filter is unique to Issue Management (Questions Board has no type dimension)

---

## IM-05: Summary Cards

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that the 5 summary stat cards are accurate and reflect the current filter state. Cards should show correct counts for Total, Open, Investigating, Resolved, and Closed.

**Covers**: `totalIssues`, `openCount`, `investigatingCount`, `resolvedCount`, `closedCount` computed signals, stat card rendering

### Preconditions
- Multiple issues in various statuses: at least 1 open, 1 investigating (set via SQL or IM-06)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/issues` | Page loads with multiple issues |
| 2 | Count issue rows manually | Matches "Total" card value |
| 3 | Count rows with amber "Open" badge | Matches "Open" card value (amber text) |
| 4 | Count rows with blue "Investigating" badge | Matches "Investigating" card value (blue text) |
| 5 | Count rows with emerald "Resolved" badge | Matches "Resolved" card value (emerald text) |
| 6 | Count rows with slate "Closed" badge | Matches "Closed" card value (slate text) |
| 7 | Apply a filter (e.g., course dropdown) | All 5 summary cards recalculate for filtered data |

### SQL Verification
```sql
-- Calculate expected stats for lecturer
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'open') as open,
  COUNT(*) FILTER (WHERE status = 'investigating') as investigating,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
  COUNT(*) FILTER (WHERE status = 'closed') as closed
FROM issues
WHERE course_id IN (
  SELECT course_id FROM lecturer_course_assignments
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
);
```

### Notes / Learnings
- Summary cards use `tabular-nums` font class for consistent number width
- All counts derive from `filteredIssues()` — applying any filter recalculates all 5 cards
- Open count also appears as a badge in the page header ("N open")
- Issue Management has 5 summary cards (Total/Open/Investigating/Resolved/Closed) vs Questions Board's 4 (Total/Pending/Answered/Closed)

---

## IM-06: Investigate Open Issue + Add Internal Notes

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify the core management workflow: expand an open issue row, view full details, change status to "Investigating", add internal notes, and save. This is the primary interaction of the Issue Management Board.

**Covers**: `onExpandIssue()`, `onSaveIssue()`, `IssueService.updateIssue()`, status dropdown, internal notes textarea, data reload

### Preconditions
- At least one issue with `status = 'open'` exists

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/issues` | Open issue visible with amber "Open" badge |
| 2 | Click on the open issue row | Row expands below to show: full description (whitespace-pre-wrap), reporter info (name + email + module + type), status dropdown, internal notes textarea, Save/Cancel buttons |
| 3 | Verify status dropdown pre-filled | Shows "Open" (current status) |
| 4 | Verify internal notes textarea empty | Placeholder: "Add internal notes (not visible to reporter)..." |
| 5 | Change status dropdown to "Investigating" | Dropdown value changes |
| 6 | Type: "Checked the module — typo confirmed on slide 3. Will fix in next content update." in internal notes | Textarea accepts input |
| 7 | Click "Save Changes" | Spinner (Loader2 animate-spin) shown on button, row collapses, data reloads |
| 8 | Verify the issue row updated | Badge changed from "Open" (amber) to "Investigating" (blue with Eye icon) |
| 9 | Verify summary cards updated | Open count decreased by 1, Investigating count increased by 1 |

### SQL Verification
```sql
-- Verify status and internal notes were saved
SELECT id, status, internal_notes, resolved_by, resolved_at
FROM issues WHERE id = '<ISSUE_ID>';
-- status should be 'investigating'
-- internal_notes should contain the typed text
-- resolved_by should be NULL (not resolved yet)
-- resolved_at should be NULL
```

### Notes / Learnings
- Expanded row shows: Description (full), Reporter (name + email), Module, Type, Status dropdown, Internal Notes textarea, Save/Cancel
- Internal notes are NOT visible to the reporter (learner reads from `issues_safe` view which excludes `internal_notes`)
- `updateIssue()` sends `{ status, internal_notes }` to the base `issues` table
- After saving, `loadBoardIssues()` is called again to refresh all data
- The Cancel button collapses the expanded row without saving

---

## IM-07: Verify Internal Notes Persist

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that after saving internal notes, re-expanding the same issue row shows the previously saved notes pre-filled in the textarea.

**Covers**: `onExpandIssue()` pre-fill logic (`editInternalNotes.set(issue.internal_notes ?? '')`), `editStatus.set(issue.status)`, data persistence

### Preconditions
- IM-06 has been run (issue has status="investigating" and internal notes saved)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | On the Issue Management page, find the "Investigating" issue from IM-06 | Issue row shows blue "Investigating" badge |
| 2 | Click on the investigating issue row | Row expands |
| 3 | Verify status dropdown pre-filled | Shows "Investigating" (not "Open") |
| 4 | Verify internal notes pre-filled | Textarea contains "Checked the module — typo confirmed on slide 3. Will fix in next content update." |
| 5 | Append to notes: " — Assigned to content team." | Notes updated |
| 6 | Click "Save Changes" | Spinner → row collapses → data reloads |
| 7 | Click on the same issue row again | Expands with updated notes including the appended text |

### Notes / Learnings
- Pre-fill logic: `onExpandIssue()` calls `editStatus.set(issue.status)` and `editInternalNotes.set(issue.internal_notes ?? '')`
- Notes are cumulative — each save overwrites with the full textarea content
- The `issues_safe` view excludes `internal_notes` — learner never sees these notes

---

## IM-08: Resolve Issue with Auto-Resolution Fields

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that when a staff member sets status to "Resolved" and saves, the system automatically sets `resolved_by` and `resolved_at` fields. Also verifies the `notify_issue_resolved` trigger fires.

**Covers**: `IssueService.updateIssue()` auto-resolve logic, `resolved_by`/`resolved_at` population, `notify_issue_resolved()` trigger

### Preconditions
- An issue in "investigating" or "open" status exists (from IM-06/IM-07)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as Platform Admin (`et@calypso-commodities.com`), navigate to `/teaching/issues` | Issues visible |
| 2 | Click on an investigating or open issue row | Row expands with status dropdown and notes |
| 3 | Change status dropdown to "Resolved" | Dropdown value changes |
| 4 | (Optional) Add internal notes: "Fixed typo — content updated." | Notes entered |
| 5 | Click "Save Changes" | Spinner → row collapses → data reloads |
| 6 | Verify the issue row updated | Badge changed to "Resolved" (emerald with CheckCircle2 icon) |
| 7 | Verify summary cards updated | Resolved count increased by 1 |

### SQL Verification
```sql
-- Verify resolved_by and resolved_at were auto-set
SELECT id, status, internal_notes, resolved_by, resolved_at,
       (SELECT email FROM profiles WHERE id = resolved_by) as resolver_email
FROM issues WHERE id = '<ISSUE_ID>';
-- status should be 'resolved'
-- resolved_by should be the PA's user ID
-- resolved_at should be set to approximately now
-- resolver_email should be 'et@calypso-commodities.com'

-- Verify notification was created for the reporter
SELECT id, type, user_id, data
FROM notifications
WHERE type = 'issue_resolved'
AND user_id = (SELECT user_id FROM issues WHERE id = '<ISSUE_ID>')
ORDER BY created_at DESC LIMIT 1;
```

### Notes / Learnings
- `updateIssue()` in `IssueService` auto-sets `resolved_by: user.id` and `resolved_at: new Date().toISOString()` when `status === 'resolved'`
- If status changes AWAY from resolved (e.g., back to investigating), `resolved_by` and `resolved_at` are cleared to null
- `notify_issue_resolved()` trigger fires at DB level — the notification is created in the `notifications` table
- PA uses `issues_update_platform_admin` policy (unconditional for PA)

---

## IM-09: Learner Sees Status Change on My Issues

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that after staff resolves an issue, the learner sees the updated status on their My Issues page, including the "Resolved" badge and the emerald resolution info panel with resolved date.

**Covers**: Learner-side `MyIssuesPageComponent`, `IssueService.loadMyIssues()` from `issues_safe` view, `notify_issue_resolved()` trigger, cross-role verification

### Preconditions
- Staff has just resolved an issue (from IM-08)
- The resolved issue belongs to the learner

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `learner@calypso-commodities.com` | Successful login |
| 2 | Check notifications (bell icon or `/notifications`) | `issue_resolved` notification visible ("Your issue has been resolved") |
| 3 | Navigate to "My Issues" (`/issues`) | My Issues page loads |
| 4 | Find the issue that was just resolved | Card shows "Resolved" badge (emerald with CheckCircle2 icon) |
| 5 | Click on the resolved issue card to expand | Expanded detail visible |
| 6 | Verify "Resolution" heading | Emerald panel with "This issue has been resolved." text |
| 7 | Verify resolution date | Formatted date shown in the resolution panel |
| 8 | Verify NO internal notes visible | Internal notes are excluded from `issues_safe` view — learner never sees staff notes |

### SQL Verification
```sql
-- Verify notification exists
SELECT id, type, user_id, data, read_at, created_at
FROM notifications
WHERE type = 'issue_resolved'
AND user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
ORDER BY created_at DESC LIMIT 1;

-- Verify issue status from learner's view (issues_safe excludes internal_notes)
SELECT * FROM issues_safe
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
AND status = 'resolved'
ORDER BY created_at DESC LIMIT 1;
-- internal_notes column should NOT exist in the result
```

### Notes / Learnings
- `notify_issue_resolved` fires when status changes to 'resolved' — notifies the reporter
- The learner's My Issues page reads from `issues_safe` view (bypasses RLS, WHERE clause filters by `user_id = auth.uid()`)
- `issues_safe` view excludes the `internal_notes` column entirely — not just null, the column doesn't exist in the view
- Resolution panel shows when `resolved_at` is truthy: emerald bg panel with "This issue has been resolved." and formatted date
- This test confirms the full loop: learner reports → staff resolves → learner sees resolution + notification

---

## IM-10: Close Issue

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that an issue can be closed via the status dropdown. Closing is a terminal status — the issue is no longer actionable.

**Covers**: `onSaveIssue()` with status='closed', resolved_by/resolved_at clearing when status isn't 'resolved', data reload

### Preconditions
- An open or investigating issue exists (or the resolved issue from IM-08 can be closed)

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/issues` | Issues visible |
| 2 | Click on an issue row (any non-closed issue) | Row expands with status dropdown |
| 3 | Change status dropdown to "Closed" | Dropdown value changes |
| 4 | Click "Save Changes" | Spinner → row collapses → data reloads |
| 5 | Verify the issue row updated | Badge changed to "Closed" (slate with XCircle icon) |
| 6 | Verify summary cards updated | Closed count increased by 1 |
| 7 | Click on the closed issue row | Row still expands with editable form (status can be changed back if needed) |

### SQL Verification
```sql
-- Verify status changed to closed
SELECT id, status, resolved_by, resolved_at FROM issues WHERE id = '<ISSUE_ID>';
-- status should be 'closed'
-- resolved_by should be NULL (closed ≠ resolved)
-- resolved_at should be NULL (unless it was previously resolved and then closed)
```

### Notes / Learnings
- "Closed" is a separate status from "Resolved" — closed issues may or may not have been resolved first
- When moving from 'resolved' to 'closed', `updateIssue()` clears `resolved_by` and `resolved_at` to null (because `status !== 'resolved'`)
- Unlike Questions Board (QB-10), closed issues are NOT read-only — staff can still change status back via the dropdown
- No `notify_issue_closed` trigger exists — the learner is not notified when an issue is closed (only when resolved)

---

## IM-11: Clear Filters

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that "Clear filters" resets all 4 active filters (search, course, status, type) back to defaults and restores the full issue list.

**Covers**: `clearFilters()` method, filter state reset, "Clear filters" link visibility

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as lecturer, navigate to `/teaching/issues` | All issues visible, no "Clear filters" link |
| 2 | Type "typo" in search box | Table filters, "Clear filters" link appears |
| 3 | Select a course from dropdown | Table filters further |
| 4 | Select "Open" from status dropdown | Table filters further |
| 5 | Select "Content Error" from type dropdown | Table filters further (4 filters applied) |
| 6 | Click "Clear filters" | Search box cleared, course resets to "All Courses", status resets to "All Status", type resets to "All Types" |
| 7 | Verify all issues visible again | Total count matches pre-filter count |
| 8 | Verify "Clear filters" link is gone | Link hidden when no filters are active |

### Notes / Learnings
- "Clear filters" only appears when `searchTerm() || selectedCourseId() || statusFilter() !== 'all' || typeFilter() !== 'all'`
- `clearFilters()` resets: `searchTerm.set('')`, `selectedCourseId.set(null)`, `statusFilter.set('all')`, `typeFilter.set('all')`
- Filter state is all signal-based — no URL query params (same pattern as QuestionsBoardPage)
- Issue Management has 4 filter dimensions vs Questions Board's 3

---

## IM-12: Role Access Control

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-14 |
| **Status** | ✅ |
| **Tester** | Claude (Playwright MCP) |

**Purpose**: Verify that only lecturers and platform admins can access `/teaching/issues`. Learners, Tenant Admins, and CSMs should be blocked by the route guard.

**Covers**: `roleGuard('lecturer', 'platform_admin')`, sidebar visibility per role

### Steps

| # | Action | Expected Result |
|---|--------|-----------------|
| 1 | Login as `learner@calypso-commodities.com` | Successful login |
| 2 | Check sidebar | "Teaching" section NOT visible |
| 3 | Navigate directly to `/teaching/issues` | Redirected away (guard blocks access) |
| 4 | Logout, login as `csm@calypso-commodities.com` | Successful login |
| 5 | Check sidebar | "Teaching" section NOT visible (CSM not in `['lecturer', 'platform_admin']`) |
| 6 | Navigate directly to `/teaching/issues` | Redirected away |
| 7 | Logout, login as `et@calypso-commodities.com` (Platform Admin) | Successful login |
| 8 | Check sidebar | "Teaching" section visible with "Issue Management" (Flag icon) |
| 9 | Navigate to `/teaching/issues` | Page loads successfully, all issues visible |
| 10 | Logout, login as `lecturer-edit@calypso-commodities.com` | Successful login |
| 11 | Check sidebar | "Teaching" section visible with "Issue Management" |
| 12 | Navigate to `/teaching/issues` | Page loads, only issues for assigned courses visible |

### Notes / Learnings
- Route guard checks JWT claims: `is_platform_admin` or `lecturer_course_ids` (non-empty)
- A lecturer without any course assignments would pass the route guard (they have role claims) but would see an empty table (RLS filters by course assignment)
- CSM is intentionally excluded — CSM has SELECT on base `issues` table but no UPDATE, and the management board requires UPDATE capability
- Sidebar Teaching section shows for `['lecturer', 'platform_admin']` roles only
- CSM has their own view via assigned tenant pages (deferred to future phase)

---

## Bugs Found During E2E Testing

| # | Story | Bug Description | Severity | Fix | Status |
|---|-------|----------------|----------|-----|--------|
| — | — | No bugs found | — | — | — |

---

## Data Setup Notes

### Preparing Multiple Issue Statuses for Testing

To fully test IM-04, IM-05, and the status transition stories (IM-06 through IM-10), you need issues in multiple statuses. The easiest approach:

1. **Start with all issues "open"** (default from Phase 7A reporting)
2. **IM-06 creates an "investigating" issue** (changes open → investigating)
3. **IM-08 creates a "resolved" issue** (changes investigating → resolved)
4. **IM-10 creates a "closed" issue** (changes any status → closed)

Alternatively, pre-set statuses via SQL:
```sql
-- Get issue IDs
SELECT id, description, status FROM issues
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
ORDER BY created_at DESC;

-- Set one to investigating
UPDATE issues SET status = 'investigating',
  internal_notes = 'Pre-set for testing'
WHERE id = '<ISSUE_ID_1>';

-- Set one to resolved
UPDATE issues SET status = 'resolved',
  resolved_by = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com'),
  resolved_at = NOW(),
  internal_notes = 'Pre-resolved for testing'
WHERE id = '<ISSUE_ID_2>';

-- Set one to closed
UPDATE issues SET status = 'closed'
WHERE id = '<ISSUE_ID_3>';
```

### Resetting Between Test Runs

```sql
-- Reset all issues to open (full reset)
UPDATE issues SET status = 'open', internal_notes = NULL,
  resolved_by = NULL, resolved_at = NULL
WHERE course_id IN (
  SELECT course_id FROM lecturer_course_assignments
  WHERE user_id = (SELECT id FROM profiles WHERE email = 'lecturer-edit@calypso-commodities.com')
);

-- Delete issue-related notifications
DELETE FROM notifications
WHERE type IN ('issue_resolved', 'new_issue');

-- Nuclear option: delete ALL issues
DELETE FROM issues;
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-13 | Claude (Playwright MCP) | IM-01 to IM-12 | 12 | 0 | 4 roles tested (Lecturer, PA, Learner, CSM), 0 bugs found |
| 2026-02-14 | Claude (Playwright MCP) | IM-01 through IM-12 (regression) | 12 | 0 | Full regression — all 12 PASS. Verified as Lecturer: board loads with 6 issues (Total:6, Open:1, Investigating:0, Resolved:3, Closed:2), 4 filters (search/course/status/type), 5 summary cards, cross-tenant visibility (both Calypso+Client reporters). No regressions. |
| 2026-02-15 | Claude Opus 4.6 (Playwright MCP) | IM-01 through IM-12 (regression) | 12 | 0 | Full regression run. PA board: "1 open" badge, 6 issues (Total:6, Open:1, Investigating:0, Resolved:3, Closed:2), 4 filters (search/course/status/type), cross-tenant reporters visible. No regressions. |

---

## References

- [Issue Reporting E2E Stories (Phase 7A)](ISSUE_REPORTING_USER_STORIES.md) — learner-side issue reporting flow
- [Questions Board E2E Stories (Phase 6C)](QUESTIONS_BOARD_USER_STORIES.md) — same board page pattern
- [Test Users](TEST_USERS.md) — full test user matrix
- `IssueManagementPageComponent`: `frontend/src/app/features/teaching/pages/issue-management-page.component.ts`
- `IssueService`: `frontend/src/app/core/services/issue.service.ts`
- `IssueForBoard` model: `frontend/src/app/core/models/issue.model.ts`
- Sidebar config: `frontend/src/app/layout/sidebar/sidebar-nav.config.ts`
- DB policies: migrations `00004` (RLS), `00005`/`00009`/`00010` (triggers, view, policy drops)
- Route: `frontend/src/app/app.routes.ts` (lines 150-157)
