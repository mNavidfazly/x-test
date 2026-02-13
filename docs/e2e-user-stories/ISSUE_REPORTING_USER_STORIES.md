# X-Courses v2 — Issue Reporting E2E User Stories (Phase 7A)

## Overview

E2E testing scenarios for the Issue Reporting system (Phase 7A). These stories verify the learner-side issue reporting flow: a "Report Issue" button in the module viewer, the My Issues page with status badges and accordion details, and sidebar navigation. **No migration needed** — the `issues` table, `issues_safe` view, 6 active RLS policies, and 2 notification triggers (`notify_new_issue`, `notify_issue_resolved`) already exist. The frontend reads from `issues_safe` (excludes `internal_notes`) and inserts into the base `issues` table.

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-courses-v2.vercel.app |
| **Backend URL** | https://x-courses-v2-production.up.railway.app |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Primary Test User** | learner@calypso-commodities.com (Learner) |
| **Tenant** | Calypso (master tenant) |

### Test Users

> Full setup instructions: [TEST_USERS.md](TEST_USERS.md)

All test users use password: `TestUser123!`

| # | Email | Role | Tenant | Used In |
|---|-------|------|--------|---------|
| 1 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | IR-01 through IR-08 |

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
| 1 | IR-01 | Report an Issue from Module Viewer | Learner logged in, module exists |
| 2 | IR-02 | View My Issues Page | IR-01 (issue exists) |
| 3 | IR-03 | Expand Issue Detail and Navigate to Module | IR-01 (issue exists on My Issues page) |
| 4 | IR-04 | Form Validation and Cancel | None (independent) |
| 5 | IR-05 | Report Another Issue (Reset Flow) | IR-04 (on module viewer page) |
| 6 | IR-06 | All Issue Type Labels Render Correctly | IR-01 + IR-05 (multiple issues exist) |
| 7 | IR-07 | Sidebar Navigation to My Issues | None (independent) |
| 8 | IR-08 | Empty State on My Issues Page | Run only if no issues exist (or use fresh user) |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| IR-01 | Report an Issue from Module Viewer | Learner | ⏳ | — |
| IR-02 | View My Issues Page | Learner | ⏳ | — |
| IR-03 | Expand Issue Detail and Navigate to Module | Learner | ⏳ | — |
| IR-04 | Form Validation and Cancel | Learner | ⏳ | — |
| IR-05 | Report Another Issue (Reset Flow) | Learner | ⏳ | — |
| IR-06 | All Issue Type Labels Render Correctly | Learner | ⏳ | — |
| IR-07 | Sidebar Navigation to My Issues | Learner | ⏳ | — |
| IR-08 | Empty State on My Issues Page | Learner | ⏳ | — |

---

## IR-01: Report an Issue from Module Viewer

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | Claude |

**Purpose**: Verify the complete issue reporting flow: learner clicks "Report Issue" button on module viewer, selects an issue type, writes a description, submits, and sees the success confirmation. This is the core happy path.

**Covers**: ReportIssueComponent (3-state flow: collapsed → form → success), IssueService (`reportIssue`), `issues_insert_own` RLS policy, `notify_new_issue` trigger (fires at DB level)

**Preconditions**:
- A course with at least one viewable module exists and is assigned to the Calypso tenant
- Learner (`learner@calypso-commodities.com`) can access the module

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Log in as Learner (`learner@calypso-commodities.com`) | Dashboard loads | ☐ |
| 2 | Navigate to a course → click a module (video/PDF/markdown) | Module viewer loads with content | ☐ |
| 3 | Scroll down past "Ask an Expert" section | "Report Issue" button visible (rose-tinted: white bg, rose border, rose text, Flag icon) | ☐ |
| 4 | Verify "Report Issue" button styling | `bg-white border border-rose-300 text-rose-700` with Flag icon | ☐ |
| 5 | Click "Report Issue" button | Form expands: card with issue type dropdown, description textarea, Submit + Cancel buttons | ☐ |
| 6 | Verify issue type dropdown has 4 options | "Content Error", "Technical Problem", "Accessibility Issue", "Other" | ☐ |
| 7 | Verify Submit button is disabled | Button is dimmed (no type selected, no description) | ☐ |
| 8 | Select "Content Error" from the dropdown | Type is selected | ☐ |
| 9 | Verify Submit still disabled | Description is still empty | ☐ |
| 10 | Type "There is a typo on slide 3 — 'recieve' should be 'receive'" in description | Text entered in textarea | ☐ |
| 11 | Click "Submit Issue" button | Button shows spinner (Loader2 with animate-spin), then success state appears | ☐ |
| 12 | Verify success confirmation | Emerald card with CheckCircle2 icon, "Your issue has been reported!" message, "The course team will be notified." text | ☐ |
| 13 | Verify "Report Another" button | Rose-tinted button to reset and report a new issue | ☐ |

**Notes/Learnings**:
- `issues_insert_own` RLS: validates `user_id = auth.uid() AND tenant_id = jwt_claim('tenant_id')`
- `reportIssue()` inserts into base `issues` table (not `issues_safe` view)
- `notify_new_issue` trigger fires on INSERT → notifies lecturers, CSMs, PAs (verified at DB level, not visible in UI)
- The form sits between "Ask an Expert" and the "Discussion" comment section in the module viewer

---

## IR-02: View My Issues Page

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | Claude |

**Purpose**: Verify that after reporting an issue, the learner can navigate to the My Issues page (`/issues`) and see their reported issue with correct status badge, issue type, course/module info, and relative timestamp.

**Covers**: MyIssuesPageComponent (page layout, issue cards, status badges), IssueService (`loadMyIssues` from `issues_safe` view), sidebar navigation

**Preconditions**:
- At least one issue has been reported (from IR-01)
- Learner is logged in

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Click "My Issues" in the sidebar (Flag icon) | Page navigates to `/issues` | ☐ |
| 2 | Verify page header | Flag icon in rose-100 circle + "My Issues" title + count badge showing number of issues | ☐ |
| 3 | Verify issue card is visible | Card with issue description text, status badge, issue type, course/module names | ☐ |
| 4 | Verify "Open" status badge | Amber badge (`bg-amber-100 text-amber-700`) with Clock icon and text "Open" | ☐ |
| 5 | Verify issue type label | "Content Error" label displayed on the card | ☐ |
| 6 | Verify course name | Course title shown on the card | ☐ |
| 7 | Verify module name | "/ Module Title" shown after course name (with separator) | ☐ |
| 8 | Verify relative timestamp | "just now" or "X minutes ago" shown | ☐ |
| 9 | Verify count badge | Number matches total issues displayed | ☐ |

**Notes/Learnings**:
- `loadMyIssues()` queries `issues_safe` view with FK joins: `course:courses!issues_course_id_fkey(title), module:modules!issues_module_id_fkey(title)`
- Issues are ordered by `created_at desc` (newest first)
- `issues_safe` view filters: learner sees own issues only (`user_id = auth.uid()`)
- Status badge colors: open→amber, investigating→blue, resolved→emerald, closed→slate

---

## IR-03: Expand Issue Detail and Navigate to Module

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | Claude |

**Purpose**: Verify that clicking an issue card expands to show full details (description, resolution info), and the "Go to module" link navigates to the correct module.

**Covers**: MyIssuesPageComponent (accordion expand, detail panel, RouterLink navigation), `expandedId` signal toggle

**Preconditions**:
- At least one issue with a `module_id` exists (from IR-01)
- Learner is on the My Issues page

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to My Issues page (`/issues`) | Issue cards visible | ☐ |
| 2 | Click on an issue card (the description text or expand area) | Card expands to show detail panel | ☐ |
| 3 | Verify "Description" heading in expanded area | "Description" label visible | ☐ |
| 4 | Verify full description text | The complete issue description from IR-01 is shown | ☐ |
| 5 | Verify "Go to module" link | Teal link with ArrowRight icon pointing to the module page | ☐ |
| 6 | Click "Go to module" link | Navigates to the module viewer page (`/courses/:courseId/modules/:moduleId`) | ☐ |
| 7 | Verify correct module loaded | The module that was reported on is displayed | ☐ |
| 8 | Navigate back to My Issues page | Issue still present, accordion collapsed | ☐ |
| 9 | Click the same issue card again | Expands again (toggle behavior) | ☐ |
| 10 | Click the same issue card once more | Collapses (accordion toggle) | ☐ |

**Notes/Learnings**:
- `expandedId` signal tracks which issue is expanded — only one at a time
- Clicking an already-expanded issue collapses it
- "Go to module" link uses `[routerLink]="['/courses', issue.course_id, 'modules', issue.module_id]"`
- Resolution info only shows when `status === 'resolved'` and `resolved_at` is set (not applicable for new "open" issues)

---

## IR-04: Form Validation and Cancel

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | Claude |

**Purpose**: Verify that the report issue form enforces validation (both type and description required) and the cancel button closes the form without submitting.

**Covers**: ReportIssueComponent (validation logic, cancel behavior, form state management)

**Preconditions**:
- Learner is on a module viewer page

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to a module viewer page | Module content loads, "Report Issue" button visible | ☐ |
| 2 | Click "Report Issue" | Form expands | ☐ |
| 3 | Verify Submit disabled (no type, no description) | Button has `disabled:opacity-50` styling | ☐ |
| 4 | Select "Technical Problem" from dropdown | Type selected | ☐ |
| 5 | Verify Submit still disabled (no description) | Button still dimmed | ☐ |
| 6 | Clear the type selection (select placeholder) | Type unselected | ☐ |
| 7 | Type "Test description" in textarea | Text entered | ☐ |
| 8 | Verify Submit still disabled (no type) | Button still dimmed — both fields required | ☐ |
| 9 | Select "Technical Problem" again | Both type and description now filled | ☐ |
| 10 | Verify Submit is now enabled | Button is not dimmed, clickable | ☐ |
| 11 | Click the X (close) button instead of submitting | Form collapses back to "Report Issue" button | ☐ |
| 12 | Click "Report Issue" again | Form re-opens with fields reset (empty type, empty description) | ☐ |

**Notes/Learnings**:
- Submit disabled condition: `!description().trim() || !issueType() || submitting()`
- Cancel/X button sets `isOpen` to false, which collapses the form
- Re-opening the form should show clean state (signals reset)

---

## IR-05: Report Another Issue (Reset Flow)

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | Claude |

**Purpose**: Verify that after successfully reporting an issue, the "Report Another" button resets the form to allow submitting a new issue. Also verifies a second issue appears on the My Issues page.

**Covers**: ReportIssueComponent (success → reset → form flow), IssueService (second insert + reload)

**Preconditions**:
- Learner is on a module viewer page
- The success state from a previous report may or may not be showing

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to a module viewer page | Module loads | ☐ |
| 2 | Click "Report Issue" (or "Report Another" if success state showing) | Form is open with empty fields | ☐ |
| 3 | Select "Accessibility Issue" from dropdown | Type selected | ☐ |
| 4 | Type "Screen reader cannot read the diagram on this page" | Description entered | ☐ |
| 5 | Click "Submit Issue" | Spinner → success confirmation | ☐ |
| 6 | Click "Report Another" button | Form resets: empty dropdown, empty textarea, submit disabled | ☐ |
| 7 | Select "Other" from dropdown | Type selected | ☐ |
| 8 | Type "The page takes too long to load" | Description entered | ☐ |
| 9 | Click "Submit Issue" | Spinner → success confirmation again | ☐ |
| 10 | Navigate to My Issues page (`/issues`) | Page loads | ☐ |
| 11 | Verify multiple issues visible | At least 3 issues now (from IR-01, step 5, step 9) with correct types | ☐ |

**Notes/Learnings**:
- "Report Another" sets `submitted` signal to false, `isOpen` to true, clears `issueType` and `description`
- Each successful report calls `loadMyIssues()` to refresh the service's issue list
- Multiple issues on same module are allowed — no uniqueness constraint

---

## IR-06: All Issue Type Labels Render Correctly

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | Claude |

**Purpose**: Verify that all 4 issue types display with their correct human-readable labels on the My Issues page.

**Covers**: MyIssuesPageComponent (issue type label mapping), label formatting

**Preconditions**:
- Multiple issues with different types have been reported (from IR-01 and IR-05)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Navigate to My Issues page (`/issues`) | Page loads with issue cards | ☐ |
| 2 | Verify "Content Error" label | Issue from IR-01 shows "Content Error" type label | ☐ |
| 3 | Verify "Accessibility" label | Issue from IR-05 step 5 shows "Accessibility" type label | ☐ |
| 4 | Verify "Other" label | Issue from IR-05 step 9 shows "Other" type label | ☐ |
| 5 | (If "Technical" issue exists) Verify "Technical" label | Shows "Technical" type label | ☐ |

**Notes/Learnings**:
- Type label mapping: `content_error` → "Content Error", `technical` → "Technical", `accessibility` → "Accessibility", `other` → "Other"
- Labels are computed in the component template, not from the database
- All issues should show "Open" status badge (no status changes happen without lecturer/PA intervention)

---

## IR-07: Sidebar Navigation to My Issues

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | Claude |

**Purpose**: Verify that "My Issues" appears in the sidebar with the Flag icon, is visible to all roles, and navigates correctly to `/issues`.

**Covers**: Sidebar nav config (`sidebar-nav.config.ts`), route registration (`app.routes.ts`), `roles: 'all'` visibility

**Preconditions**:
- Learner is logged in and on any page

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | Look at the sidebar navigation | "My Issues" link visible in the main section (after "My Questions") | ☐ |
| 2 | Verify Flag icon | Flag icon (lucide) is displayed next to "My Issues" | ☐ |
| 3 | Click "My Issues" | Page navigates to `/issues`, My Issues page loads | ☐ |
| 4 | Verify the sidebar highlights "My Issues" | Active state styling on the nav item | ☐ |
| 5 | Click "Dashboard" to navigate away | Dashboard loads | ☐ |
| 6 | Click "My Issues" again | Returns to My Issues page, issues still shown | ☐ |

**Notes/Learnings**:
- "My Issues" is in the `roles: 'all'` section — visible to every authenticated user
- Position: after "My Questions" (HelpCircle), before "Notifications" (Bell)
- Route `/issues` is lazy-loaded, no auth guard beyond `authGuard` on parent

---

## IR-08: Empty State on My Issues Page

| Field | Value |
|-------|-------|
| **Last Checked** | — |
| **Status** | ⏳ |
| **Tester** | Claude |

**Purpose**: Verify the empty state on the My Issues page when a user has no reported issues. This tests the zero-data experience.

**Covers**: MyIssuesPageComponent (empty state rendering)

**Preconditions**:
- Either use a fresh user with no issues, or verify the empty state text is correct by checking the component (may not be directly testable if issues already exist from earlier stories)

**Steps**:

| # | Action | Expected Outcome | ✓ |
|---|--------|------------------|---|
| 1 | If possible, log in as a user with no issues (e.g., another test user) | Dashboard loads | ☐ |
| 2 | Navigate to My Issues page (`/issues`) | Page loads | ☐ |
| 3 | Verify empty state message | "No issues reported yet" heading visible | ☐ |
| 4 | Verify empty state subtitle | "You can report issues from any module page." text visible | ☐ |
| 5 | Verify no issue cards are shown | No accordion cards, no count badge (or badge shows "0") | ☐ |

**Notes/Learnings**:
- Empty state is only visible when `issueService.issues().length === 0` and not loading
- This may be difficult to test after IR-01–IR-06 have created issues — could use client learner instead
- The empty state encourages users to report from module pages

---

## Bugs Found During E2E Testing

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| — | (none yet) | — | — |

---

## Data Setup Notes

### Cleaning Up Issues Between Test Runs

```sql
-- Remove all issues by a specific user
DELETE FROM issues
WHERE user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com');

-- Remove all issues on a specific course's modules
DELETE FROM issues WHERE course_id = '<COURSE_ID>';

-- Nuclear option: clear ALL issues
DELETE FROM issues;
```

### Verifying Issues in Database

```sql
-- Check recent issues with status
SELECT i.id, i.description, i.issue_type, i.status, i.created_at,
       p.email, c.title as course_title, m.title as module_title
FROM issues i
JOIN profiles p ON p.id = i.user_id
LEFT JOIN courses c ON c.id = i.course_id
LEFT JOIN modules m ON m.id = i.module_id
ORDER BY i.created_at DESC
LIMIT 10;
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| — | — | — | — | — | — |

---

## References

| Document | Path |
|----------|------|
| ReportIssueComponent | `frontend/src/app/features/courses/components/report-issue.component.ts` |
| MyIssuesPageComponent | `frontend/src/app/features/issues/pages/my-issues-page.component.ts` |
| IssueService | `frontend/src/app/core/services/issue.service.ts` |
| Issue Model | `frontend/src/app/core/models/issue.model.ts` |
| Module Viewer (issue integration) | `frontend/src/app/features/courses/pages/module-viewer-page.component.ts` |
| Sidebar Nav Config | `frontend/src/app/layout/sidebar/sidebar-nav.config.ts` |
| Routes | `frontend/src/app/app.routes.ts` |
| Mock Factories | `frontend/src/app/__mocks__/course.mock.ts` |
| Test Users Setup | `docs/e2e-user-stories/TEST_USERS.md` |
